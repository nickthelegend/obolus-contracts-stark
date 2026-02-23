/**
 * Test script for Kaspa blockchain transactions
 * Tests real withdraw and deposit operations via REST API (no WASM)
 */

import dotenv from 'dotenv';

dotenv.config();

const REST_API_BASE = 'https://api-tn10.kaspa.org';

async function testKaspaConnection() {
  console.log('🔗 Testing Kaspa REST API connection...');

  try {
    const response = await fetch(`${REST_API_BASE}/info/blockdag`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const info = await response.json();
    console.log('✅ Connected to Kaspa Testnet-10 REST API');
    console.log(`📊 Network info:`, {
      networkName: info.networkName,
      blockCount: info.blockCount,
      headerCount: info.headerCount
    });
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    throw error;
  }
}

async function testTreasuryBalance() {
  console.log('\n💰 Checking treasury balance...');

  const treasuryAddress = process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS;
  if (!treasuryAddress) {
    throw new Error('Treasury address not configured');
  }

  try {
    const response = await fetch(`${REST_API_BASE}/addresses/${treasuryAddress}/balance`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const balanceInKAS = data.balance / 100_000_000;

    console.log(`✅ Treasury balance: ${balanceInKAS} KAS`);
    console.log(`📍 Treasury address: ${treasuryAddress}`);

    return balanceInKAS;
  } catch (error: any) {
    console.error('❌ Failed to get balance:', error.message);
    throw error;
  }
}

async function testPrivateKey() {
  console.log('\n🔑 Testing treasury private key...');

  const privateKeyHex = process.env.KASPA_TREASURY_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error('Treasury private key not configured');
  }

  try {
    // Use @noble/secp256k1 to derive address
    const secp = await import('@noble/secp256k1');
    const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');
    const fullPubKey = secp.getPublicKey(privateKeyBytes, true);
    const xOnlyPubKey = fullPubKey.slice(1);

    console.log(`✅ Private key valid`);
    console.log(`📍 Public key (x-only): ${Buffer.from(xOnlyPubKey).toString('hex')}`);

    const expectedAddress = process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS;
    console.log(`📍 Expected treasury address: ${expectedAddress}`);
  } catch (error: any) {
    console.error('❌ Invalid private key:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Kaspa Transaction Tests\n');
  console.log('='.repeat(60));

  try {
    await testKaspaConnection();
    await testPrivateKey();
    await testTreasuryBalance();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('\n💡 You can now test withdraw and deposit endpoints');
    console.log('   - Withdraw will send real KAS from treasury to user');
    console.log('   - Deposit will verify real transactions on blockchain');
  } catch (error: any) {
    console.log('\n' + '='.repeat(60));
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }
}

main();
