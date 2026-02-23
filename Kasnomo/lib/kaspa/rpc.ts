/**
 * Kaspa REST API Client
 * Pure HTTP calls to the Kaspa REST API (api-tn10.kaspa.org) — no WASM dependencies
 */

const REST_API_BASE = 'https://api-tn10.kaspa.org';

// ── Response types from the REST API ──────────────────────────────────────

export interface TxOutput {
  transaction_id: string;
  index: number;
  amount: number;
  script_public_key: string;
  script_public_key_address: string;
  script_public_key_type: string;
  accepting_block_hash?: string;
}

export interface TxInput {
  transaction_id: string;
  index: number;
  previous_outpoint_hash: string;
  previous_outpoint_index: string;
  previous_outpoint_resolved?: TxOutput;
  previous_outpoint_address?: string;
  previous_outpoint_amount?: number;
  signature_script: string;
  sig_op_count: string;
}

export interface TxModel {
  subnetwork_id: string;
  transaction_id: string;
  hash: string;
  mass: string;
  payload: string;
  block_hash: string[];
  block_time: number;
  is_accepted: boolean;
  accepting_block_hash?: string;
  accepting_block_blue_score?: number;
  inputs: TxInput[];
  outputs: TxOutput[];
}

export interface UtxoEntry {
  amount: string;
  scriptPublicKey: { scriptPublicKey: string };
  blockDaaScore: string;
  isCoinbase: boolean;
}

export interface UtxoResponse {
  address: string;
  outpoint: {
    transactionId: string;
    index: number;
  };
  utxoEntry: UtxoEntry;
}

export interface BalanceResponse {
  address: string;
  balance: number; // in sompi
}

export interface SubmitTxInput {
  previousOutpoint: {
    transactionId: string;
    index: number;
  };
  signatureScript: string;
  sequence: number;
  sigOpCount: number;
}

export interface SubmitTxOutput {
  amount: number;
  scriptPublicKey: {
    version: number;
    scriptPublicKey: string;
  };
}

export interface SubmitTxModel {
  version: number;
  inputs: SubmitTxInput[];
  outputs: SubmitTxOutput[];
  lockTime: number;
  subnetworkId: string;
}

export interface SubmitTransactionResponse {
  transactionId?: string;
  error?: string;
}

// ── REST API Calls ──────────────────────────────────────────────────────

/**
 * Get transaction by ID
 */
export async function getTransaction(txId: string): Promise<TxModel | null> {
  try {
    const response = await fetch(
      `${REST_API_BASE}/transactions/${txId}?resolve_previous_outpoints=light`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      console.error(`[Kaspa REST] getTransaction failed: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Kaspa REST] getTransaction error:', error);
    return null;
  }
}

/**
 * Get UTXOs for an address
 */
export async function getUtxosByAddress(address: string): Promise<UtxoResponse[]> {
  try {
    const response = await fetch(
      `${REST_API_BASE}/addresses/${address}/utxos`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      console.error(`[Kaspa REST] getUtxos failed: ${response.status}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[Kaspa REST] getUtxosByAddress error:', error);
    return [];
  }
}

/**
 * Get address balance in KAS
 */
export async function getAddressBalance(address: string): Promise<number> {
  try {
    const response = await fetch(
      `${REST_API_BASE}/addresses/${address}/balance`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      console.error(`[Kaspa REST] getBalance failed: ${response.status}`);
      return 0;
    }

    const data: BalanceResponse = await response.json();
    // Balance is returned in sompi, convert to KAS
    return data.balance / 100_000_000;
  } catch (error) {
    console.error('[Kaspa REST] getAddressBalance error:', error);
    return 0;
  }
}

/**
 * Submit a signed transaction to the network via REST API
 */
export async function submitTransaction(transaction: SubmitTxModel): Promise<SubmitTransactionResponse> {
  try {
    const response = await fetch(
      `${REST_API_BASE}/transactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          transaction,
          allowOrphan: false,
        }),
      }
    );

    const data: SubmitTransactionResponse = await response.json();

    if (!response.ok) {
      console.error('[Kaspa REST] submitTransaction failed:', data);
      throw new Error(data.error || `Submit failed with status ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error('[Kaspa REST] submitTransaction error:', error);
    throw error;
  }
}

/**
 * Get fee estimate from node
 */
export async function getFeeEstimate(): Promise<number> {
  try {
    const response = await fetch(
      `${REST_API_BASE}/info/fee-estimate`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return 1; // default feerate

    const data = await response.json();
    return data.priorityBucket?.feerate || 1;
  } catch {
    return 1;
  }
}

/**
 * Get block DAG info
 */
export async function getBlockDagInfo(): Promise<any> {
  try {
    const response = await fetch(
      `${REST_API_BASE}/info/blockdag`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`getBlockDagInfo failed: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error('[Kaspa REST] getBlockDagInfo error:', error);
    throw error;
  }
}
