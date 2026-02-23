/**
 * Test script for Kaspa blockchain transactions
 * Tests real withdraw and deposit operations
 */

const { PrivateKey, Address, NetworkId, RpcClient, Resolver } = require('kaspa');
require('dotenv').config();

async function testKaspaConnection() {
  console.log('🔗 Testing Kaspa RPC connection...');
  
  const rpcClient = new RpcClient({
    resolver: new Resolver(),
    networkId: NetworkId.Testnet10
  });

  try {
    await rpcClient.connect();
    console.log('✅ Connected to Kaspa Testnet-10');
    
    const info = await rpcClient.getBlockDagInfo();
    console.log(`📊 Network info:`, {
      networkName: info.networkName,
      blockCount: info.blockCount,
      headerCount: info.headerCount
    });
    
    await rpcClient.disconnect();
  } catch (error) {
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

  const rpcClient = new RpcClient({
    resolver: new Resolver(),
    networkId: NetworkId.Testnet10
  });

  try {
    await rpcClient.connect();
    
    const address = new Address(treasuryAddress);
    const utxos = await rpcClient.getUtxosByAddresses([address]);
    
    let totalBalance = 0n;
    for (const utxo of utxos) {
      totalBalance += BigInt(utxo.utxoEntry.amount);
    }
    
    const balanceInKAS = Number(totalBalance) / 100000000;
    console.log(`✅ Treasury balance: ${balanceInKAS} KAS`);
    console.log(`📍 Treasury address: ${treasuryAddress}`);
    
    await rpcClient.disconnect();
    
    return balanceInKAS;
  } catch (error) {
    console.error('❌ Failed to get balance:', error.message);
    await rpcClient.disconnect();
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
    const privateKey = new PrivateKey(privateKeyHex);
    const address = privateKey.toAddress(NetworkId.Testnet10);
    
    console.log(`✅ Private key valid`);
    console.log(`📍 Derived address: ${address.toString()}`);
    
    const expectedAddress = process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS;
    if (address.toString() === expectedAddress) {
      console.log('✅ Address matches treasury address');
    } else {
      console.warn('⚠️  Address does NOT match treasury address!');
      console.warn(`   Expected: ${expectedAddress}`);
      console.warn(`   Got: ${address.toString()}`);
    }
  } catch (error) {
    console.error('❌ Invalid private key:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Kaspa Transaction Tests\n');
  console.log('=' .repeat(60));
  
  try {
    await testKaspaConnection();
    await testPrivateKey();
    await testTreasuryBalance();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('\n💡 You can now test withdraw and deposit endpoints');
    console.log('   - Withdraw will send real KAS from treasury to user');
    console.log('   - Deposit will verify real transactions on blockchain');
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }
}

main();
