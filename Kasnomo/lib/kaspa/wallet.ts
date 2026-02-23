/**
 * Kaspa Wallet Utilities
 * Pure REST API wrapper — no WASM dependencies
 * 
 * Re-exports functions from rpc.ts and transaction.ts for backwards compatibility
 */

export { sendKaspaTransaction as sendKaspa, getTreasuryBalance } from './transaction';
export { getTransaction, getAddressBalance, getUtxosByAddress } from './rpc';

/**
 * Verify a transaction exists on the blockchain via REST API
 */
export async function verifyTransaction(txHash: string): Promise<boolean> {
  try {
    const { getTransaction } = await import('./rpc');
    const txInfo = await getTransaction(txHash);
    return !!txInfo;
  } catch (error) {
    console.error('[Kaspa] Transaction verification failed:', error);
    return false;
  }
}
