/**
 * Kaspa Transaction Builder & Signer
 * Pure JS implementation — no WASM dependencies
 *
 * Uses:
 *  - @noble/secp256k1 for Schnorr signing
 *  - blakejs for Blake2b hashing (with KEY = domain separator, matching rusty-kaspa)
 *
 * References:
 *  - https://github.com/kaspanet/rusty-kaspa/blob/master/consensus/core/src/hashing/sighash.rs
 *  - https://github.com/kaspanet/rusty-kaspa/blob/master/crypto/hashes/src/hashers.rs
 *  - Kaspa uses Blake2b with KEY (not personalization) set to domain string
 *  - BIP-143-style sighash structure
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import * as secp from '@noble/secp256k1';
import * as blakejs from 'blakejs';
import {
  getUtxosByAddress,
  submitTransaction,
  type UtxoResponse,
  type SubmitTxModel,
  type SubmitTxInput,
} from './rpc';

// ── Crypto helpers ────────────────────────────────────────────────────
// @noble/secp256k1 v3 needs sync hashes set for schnorr.sign() and sign()
(secp.hashes as any).sha256 = (msg: Uint8Array) => sha256(msg);
(secp.hashes as any).hmacSha256 = (key: Uint8Array, msg: Uint8Array) => hmac(sha256, key, msg);

async function getSecp() {
  return secp;
}

/**
 * Blake2b-256 with domain separation KEY.
 * Kaspa uses the domain string as the blake2b KEY parameter (not personalization).
 * See: rusty-kaspa blake2b_hasher! macro uses `.key($domain_sep)`.
 * blakejs signature: blake2b(input, key, outlen)
 */
function blake2bKeyed(data: Uint8Array, domainKey: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(domainKey);
  return new Uint8Array(blakejs.blake2b(data, keyBytes, 32));
}

// ZERO_HASH: 32 bytes of zeros
const ZERO_HASH = new Uint8Array(32);

// ── Byte writing helpers ──────────────────────────────────────────────

function writeU8(value: number): Uint8Array {
  return new Uint8Array([value & 0xff]);
}

function writeU16LE(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  return buf;
}

function writeU32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  return buf;
}

function writeU64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return buf;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * write_var_bytes: len(u64_le) + bytes
 * Matches rusty-kaspa HasherExtensions::write_var_bytes
 */
function varBytes(data: Uint8Array): Uint8Array {
  return concat(writeU64LE(BigInt(data.length)), data);
}

/**
 * Encode script_public_key for hashing: version(u16_le) + write_var_bytes(script)
 */
function encodeScriptPublicKey(version: number, script: Uint8Array): Uint8Array {
  return concat(writeU16LE(version), varBytes(script));
}

// ── Address utilities ──────────────────────────────────────────────────

function decodeBech32(str: string): { prefix: string; words: number[] } {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const sepIndex = str.lastIndexOf(':');
  if (sepIndex === -1) throw new Error('Missing separator in bech32 address');

  const prefix = str.slice(0, sepIndex);
  const dataStr = str.slice(sepIndex + 1);

  const words: number[] = [];
  for (const char of dataStr) {
    const idx = CHARSET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid bech32 character: ${char}`);
    words.push(idx);
  }

  // Remove the 8-character checksum
  return { prefix, words: words.slice(0, words.length - 8) };
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;

  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  }

  return ret;
}

/**
 * Get the script public key bytes from a Kaspa address
 * For Schnorr P2PK: 0x20 <32-byte-xonly-pubkey> 0xac (OP_CHECKSIG)
 */
export function addressToScriptPublicKey(address: string): Uint8Array {
  const { words } = decodeBech32(address);

  // First 5-bit word is the version/type
  const version = words[0]; // 0 = Schnorr P2PK, 1 = ECDSA, 8 = P2SH
  const dataWords = words.slice(1);

  // Convert from 5-bit to 8-bit
  const decoded = convertBits(dataWords, 5, 8, false);
  const pubKeyBytes = new Uint8Array(decoded);

  if (version === 0) {
    // Schnorr P2PK: OP_DATA_32 <32-byte-xonly-pubkey> OP_CHECKSIG
    const script = new Uint8Array(34);
    script[0] = 0x20; // OP_DATA_32
    script.set(pubKeyBytes.slice(0, 32), 1);
    script[33] = 0xac; // OP_CHECKSIG
    return script;
  } else if (version === 8) {
    // P2SH: OP_BLAKE2B OP_DATA_32 <32-byte-hash> OP_EQUAL
    const script = new Uint8Array(35);
    script[0] = 0xaa; // OP_BLAKE2B
    script[1] = 0x20; // OP_DATA_32
    script.set(pubKeyBytes.slice(0, 32), 2);
    script[34] = 0x87; // OP_EQUAL
    return script;
  }

  throw new Error(`Unsupported address version: ${version}`);
}

/**
 * Encode bech32 for Kaspa addresses
 */
function encodeBech32(prefix: string, words: number[]): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function polymod(values: number[]): bigint {
    const GEN = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];
    let chk = 1n;
    for (const v of values) {
      const b = chk >> 35n;
      chk = ((chk & 0x07ffffffffn) << 5n) ^ BigInt(v);
      for (let i = 0; i < 5; i++) {
        if ((b >> BigInt(i)) & 1n) {
          chk ^= GEN[i];
        }
      }
    }
    return chk;
  }

  function hrpExpand(hrp: string): number[] {
    const result: number[] = [];
    for (const c of hrp) {
      result.push(c.charCodeAt(0) >> 5);
    }
    result.push(0);
    for (const c of hrp) {
      result.push(c.charCodeAt(0) & 31);
    }
    return result;
  }

  const checksumInput = [...hrpExpand(prefix), ...words, 0, 0, 0, 0, 0, 0, 0, 0];
  const pmod = polymod(checksumInput) ^ 1n;
  const checksum: number[] = [];
  for (let i = 0; i < 8; i++) {
    checksum.push(Number((pmod >> BigInt(5 * (7 - i))) & 0x1fn));
  }

  const allWords = [...words, ...checksum];
  let result = prefix + ':';
  for (const w of allWords) {
    result += CHARSET[w];
  }
  return result;
}

/**
 * Convert a public key (x-only, 32 bytes) to a Kaspa testnet address
 */
export function publicKeyToAddress(pubKeyXOnly: Uint8Array, testnet: boolean = true): string {
  const prefix = testnet ? 'kaspatest' : 'kaspa';

  // Convert 8-bit pubkey to 5-bit words
  const pubKeyBits = convertBits(Array.from(pubKeyXOnly), 8, 5, true);

  // Version 0 = Schnorr P2PK
  const words = [0, ...pubKeyBits];

  return encodeBech32(prefix, words);
}

// ── Sub-hash computations (matching rusty-kaspa exactly) ──────────────

const DOMAIN_TX_SIGNING = 'TransactionSigningHash';

interface TxInputForSig {
  txId: Uint8Array;      // 32 bytes (raw, not hex)
  index: number;         // u32
  sequence: bigint;      // u64
  sigOpCount: number;    // u8
  amount: bigint;        // u64 value of the UTXO being spent
  scriptVersion: number; // u16 (always 0 for now)
  script: Uint8Array;    // raw script bytes of the UTXO being spent
}

interface TxOutputForSig {
  amount: bigint;         // u64
  scriptVersion: number;  // u16
  script: Uint8Array;     // raw script bytes
}

/**
 * Hash of previous outputs
 * For each input: write txId(32 bytes) + index(u32_le)
 */
function hashPreviousOutputs(inputs: TxInputForSig[]): Uint8Array {
  let data: Uint8Array = new Uint8Array(0);
  for (const input of inputs) {
    data = concat(data, input.txId, writeU32LE(input.index)) as Uint8Array;
  }
  return blake2bKeyed(data, DOMAIN_TX_SIGNING);
}

/**
 * Hash of sequences
 * For each input: write sequence(u64_le)
 */
function hashSequences(inputs: TxInputForSig[]): Uint8Array {
  let data: Uint8Array = new Uint8Array(0);
  for (const input of inputs) {
    data = concat(data, writeU64LE(input.sequence)) as Uint8Array;
  }
  return blake2bKeyed(data, DOMAIN_TX_SIGNING);
}

/**
 * Hash of sig op counts
 * For each input: write sig_op_count(u8)
 */
function hashSigOpCounts(inputs: TxInputForSig[]): Uint8Array {
  let data: Uint8Array = new Uint8Array(0);
  for (const input of inputs) {
    data = concat(data, writeU8(input.sigOpCount)) as Uint8Array;
  }
  return blake2bKeyed(data, DOMAIN_TX_SIGNING);
}

/**
 * Hash of outputs
 * For each output: write amount(u64_le) + script_public_key(version:u16_le + var_bytes(script))
 */
function hashOutputs(outputs: TxOutputForSig[]): Uint8Array {
  let data: Uint8Array = new Uint8Array(0);
  for (const output of outputs) {
    data = concat(data, writeU64LE(output.amount), encodeScriptPublicKey(output.scriptVersion, output.script)) as Uint8Array;
  }
  return blake2bKeyed(data, DOMAIN_TX_SIGNING);
}

/**
 * Compute the sighash for a single input (SIGHASH_ALL = 0x01)
 * Field order matches rusty-kaspa calc_schnorr_signature_hash
 */
function computeSigHash(
  version: number,
  inputs: TxInputForSig[],
  outputs: TxOutputForSig[],
  inputIndex: number,
  subnetworkId: Uint8Array, // 20 bytes
  lockTime: bigint,
  gas: bigint,
): Uint8Array {
  const prevOutputsHash = hashPreviousOutputs(inputs);
  const sequencesHash = hashSequences(inputs);
  const sigOpCountsHash = hashSigOpCounts(inputs);
  const outputsHash = hashOutputs(outputs);
  // payload_hash for native subnetwork with empty payload = ZERO_HASH
  const payloadHash = ZERO_HASH;

  const input = inputs[inputIndex];
  const SIGHASH_ALL = 0x01;

  const sigData = concat(
    writeU16LE(version),                  // tx.version
    prevOutputsHash,                       // hashPreviousOutputs
    sequencesHash,                         // hashSequences
    sigOpCountsHash,                       // hashSigOpCounts
    input.txId,                            // outpoint.transaction_id
    writeU32LE(input.index),               // outpoint.index
    encodeScriptPublicKey(input.scriptVersion, input.script), // prev output script_public_key
    writeU64LE(input.amount),              // prev output value
    writeU64LE(input.sequence),            // input sequence
    writeU8(input.sigOpCount),             // input sig_op_count
    outputsHash,                           // hashOutputs
    writeU64LE(lockTime),                  // tx.lock_time
    subnetworkId,                          // tx.subnetwork_id (raw 20 bytes)
    writeU64LE(gas),                       // tx.gas
    payloadHash,                           // hashPayload
    writeU8(SIGHASH_ALL),                  // hash_type
  );

  return blake2bKeyed(sigData, DOMAIN_TX_SIGNING);
}

/**
 * Convert a hex string to Uint8Array (transaction IDs in Kaspa are little-endian)
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Transaction Building & Sending ────────────────────────────────────

interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Send KAS from treasury wallet to a user address
 * No WASM dependency — uses REST API + pure JS Schnorr signing
 */
export async function sendKaspaTransaction(
  toAddress: string,
  amountInKAS: number
): Promise<TransactionResult> {
  try {
    const secp = await getSecp();

    const privateKeyHex = process.env.KASPA_TREASURY_PRIVATE_KEY;
    if (!privateKeyHex) {
      throw new Error('KASPA_TREASURY_PRIVATE_KEY not configured in environment');
    }

    console.log(`[Kaspa TX] Initiating transaction: ${amountInKAS} KAS to ${toAddress}`);

    // Use the configured treasury address (don't derive — the key and address must match externally)
    const treasuryAddress = process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS;
    if (!treasuryAddress) {
      throw new Error('NEXT_PUBLIC_KASPA_TREASURY_ADDRESS not configured in environment');
    }

    // Derive the public key from private key (needed for signing)
    const privateKeyBytes = hexToBytes(privateKeyHex);
    const fullPubKey: Uint8Array = secp.getPublicKey(privateKeyBytes, true);
    const xOnlyPubKey = fullPubKey.slice(1); // x-only = drop the 0x02/0x03 prefix

    // Log derived address for debugging (may differ from configured address)
    const isTestnet = (process.env.NEXT_PUBLIC_KASPA_NETWORK || 'testnet-10').includes('testnet');
    const derivedAddress = publicKeyToAddress(xOnlyPubKey, isTestnet);
    console.log(`[Kaspa TX] Configured treasury: ${treasuryAddress}`);
    console.log(`[Kaspa TX] Derived from key:    ${derivedAddress}`);
    if (derivedAddress !== treasuryAddress) {
      console.warn(`[Kaspa TX] ⚠️ WARNING: Derived address does NOT match configured treasury address!`);
      console.warn(`[Kaspa TX] The private key may not control the configured treasury address.`);
      console.warn(`[Kaspa TX] Signing will use the private key, but UTXOs are fetched from the configured address.`);
    }

    // Get UTXOs for treasury address
    const utxos = await getUtxosByAddress(treasuryAddress);
    if (utxos.length === 0) {
      throw new Error('No UTXOs available in treasury wallet');
    }

    console.log(`[Kaspa TX] Found ${utxos.length} UTXOs`);

    // Calculate total available and select UTXOs
    const amountInSompi = BigInt(Math.floor(amountInKAS * 100_000_000));
    const feeEstimate = 10000n; // 0.0001 KAS fee (generous for simple tx)

    let selectedUtxos: UtxoResponse[] = [];
    let totalInput = 0n;
    const needed = amountInSompi + feeEstimate;

    // Sort UTXOs by amount (largest first) for efficiency
    const sortedUtxos = [...utxos].sort(
      (a, b) => Number(BigInt(b.utxoEntry.amount) - BigInt(a.utxoEntry.amount))
    );

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      totalInput += BigInt(utxo.utxoEntry.amount);
      if (totalInput >= needed) break;
    }

    if (totalInput < needed) {
      throw new Error(
        `Insufficient funds. Available: ${Number(totalInput) / 1e8} KAS, needed: ${Number(needed) / 1e8} KAS`
      );
    }

    console.log(`[Kaspa TX] Selected ${selectedUtxos.length} UTXOs, total: ${Number(totalInput) / 1e8} KAS`);

    // Build outputs
    const recipientScript = addressToScriptPublicKey(toAddress);
    const treasuryScript = addressToScriptPublicKey(treasuryAddress);

    const txOutputs: TxOutputForSig[] = [
      { amount: amountInSompi, scriptVersion: 0, script: recipientScript },
    ];

    // Change output
    const change = totalInput - amountInSompi - feeEstimate;
    if (change > 0n) {
      txOutputs.push({ amount: change, scriptVersion: 0, script: treasuryScript });
    }

    // Build inputs for signing
    const NATIVE_SUBNETWORK_ID = hexToBytes('0000000000000000000000000000000000000000'); // 20 bytes

    const txInputs: TxInputForSig[] = selectedUtxos.map((utxo) => ({
      txId: hexToBytes(utxo.outpoint.transactionId),
      index: utxo.outpoint.index,
      sequence: 0n,
      sigOpCount: 1,
      amount: BigInt(utxo.utxoEntry.amount),
      scriptVersion: 0,
      script: hexToBytes(utxo.utxoEntry.scriptPublicKey.scriptPublicKey),
    }));

    const TX_VERSION = 0;
    const LOCK_TIME = 0n;
    const GAS = 0n;

    // Sign each input with Schnorr
    const signedInputs: SubmitTxInput[] = [];

    for (let i = 0; i < txInputs.length; i++) {
      const sigHash = computeSigHash(
        TX_VERSION,
        txInputs,
        txOutputs,
        i,
        NATIVE_SUBNETWORK_ID,
        LOCK_TIME,
        GAS
      );

      // Schnorr sign
      const signature: Uint8Array = secp.schnorr.sign(sigHash, privateKeyBytes);

      // Build the signature script
      // Kaspa format: <push_length> <64-byte-schnorr-sig> <sighash_type>
      // = 0x41 (push 65 bytes) + 64-byte sig + 0x01 (SIGHASH_ALL)
      const signatureScript = bytesToHex(
        concat(
          writeU8(65),        // push 65 bytes onto the stack
          signature,          // 64-byte Schnorr signature
          writeU8(0x01),      // SIGHASH_ALL
        )
      );

      signedInputs.push({
        previousOutpoint: {
          transactionId: utxos[0].outpoint.transactionId, // will override below
          index: txInputs[i].index,
        },
        signatureScript,
        sequence: 0,
        sigOpCount: 1,
      });
      // Fix: use correct UTXO's transaction ID
      signedInputs[i].previousOutpoint.transactionId = bytesToHex(txInputs[i].txId);
    }

    // Build the submission payload
    const submitTx: SubmitTxModel = {
      version: TX_VERSION,
      inputs: signedInputs,
      outputs: txOutputs.map((o) => ({
        amount: Number(o.amount),
        scriptPublicKey: {
          version: o.scriptVersion,
          scriptPublicKey: bytesToHex(o.script),
        },
      })),
      lockTime: 0,
      subnetworkId: bytesToHex(NATIVE_SUBNETWORK_ID),
    };

    console.log('[Kaspa TX] Submitting transaction...');

    const result = await submitTransaction(submitTx);

    if (result.transactionId) {
      console.log(`[Kaspa TX] ✅ Transaction successful: ${result.transactionId}`);
      return { success: true, txHash: result.transactionId };
    } else {
      throw new Error(result.error || 'No transaction ID returned');
    }
  } catch (error: any) {
    console.error('[Kaspa TX] ❌ Transaction failed:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Get treasury wallet balance in KAS
 */
export async function getTreasuryBalance(): Promise<number> {
  try {
    const treasuryAddress = process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS;
    if (!treasuryAddress) {
      throw new Error('NEXT_PUBLIC_KASPA_TREASURY_ADDRESS not configured');
    }

    const { getAddressBalance } = await import('./rpc');
    return await getAddressBalance(treasuryAddress);
  } catch (error) {
    console.error('[Kaspa] Failed to get treasury balance:', error);
    return 0;
  }
}
