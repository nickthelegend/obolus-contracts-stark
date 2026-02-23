/**
 * Wallet state slice for Zustand store
 * Manages wallet connection status and address
 * 
 * Note: This slice is now primarily used for storing wallet state.
 * Actual wallet connection is handled by BNB Wallet integration in lib/bnb/wallet.ts
 */

import { StateCreator } from "zustand";

export interface WalletState {
  // State
  address: string | null;
  walletBalance: number;
  isConnected: boolean;
  isConnecting: boolean;
  network: 'KAS' | 'BNB' | null;
  preferredNetwork: 'KAS' | 'BNB' | null;
  error: string | null;
  isConnectModalOpen: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshWalletBalance: () => Promise<void>;
  clearError: () => void;
  setConnectModalOpen: (open: boolean) => void;

  // Setters for wallet integration
  setAddress: (address: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setNetwork: (network: 'KAS' | 'BNB' | null) => void;
  setPreferredNetwork: (network: 'KAS' | 'BNB' | null) => void;
}

/**
 * Create wallet slice for Zustand store
 * Handles wallet state management for Kaspa integration
 */
export const createWalletSlice: StateCreator<WalletState> = (set, get) => ({
  // Initial state
  address: null,
  walletBalance: 0,
  isConnected: false,
  isConnecting: false,
  network: null,
  preferredNetwork: typeof window !== 'undefined' ? localStorage.getItem('kasnomo_preferred_network') as 'KAS' | 'BNB' | null : null,
  error: null,
  isConnectModalOpen: false,

  /**
   * Connect wallet
   */
  connect: async () => {
    set({ isConnectModalOpen: true });
  },

  /**
   * Disconnect wallet
   */
  disconnect: () => {
    // Reset state
    set({
      address: null,
      walletBalance: 0,
      isConnected: false,
      isConnecting: false,
      network: null,
      error: null
    });
  },

  /**
   * Refresh balance for connected Kaspa wallet
   */
  refreshWalletBalance: async () => {
    // const { address, isConnected, network } = get(); // Removing this check for now to debugging why it fails even when connected
    // Re-enabling checks but being less strict about 'network' if it's not set yet
    const { isConnected } = get();

    if (!isConnected) {
      return;
    }

    try {
      // In Kaspa Testnet, we'll use KasWare API
      if (typeof window !== 'undefined' && (window as any).kasware) {
        const balanceObj = await (window as any).kasware.getBalance();

        console.log("KasWare Raw Balance Object:", balanceObj);

        if (balanceObj) {
          let total = 0;

          const parseVal = (val: any) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val);
            if (typeof val === 'bigint') return Number(val);
            return 0;
          };

          if (balanceObj.total !== undefined) {
            total = parseVal(balanceObj.total);
          } else if (typeof balanceObj === 'number' || typeof balanceObj === 'string' || typeof balanceObj === 'bigint') {
            total = parseVal(balanceObj);
          } else if (balanceObj.balance !== undefined) {
            total = parseVal(balanceObj.balance);
          } else if (balanceObj.confirmed !== undefined) {
            total = parseVal(balanceObj.confirmed) + parseVal(balanceObj.unconfirmed);
          } else if (balanceObj.amount !== undefined) {
            total = parseVal(balanceObj.amount);
          } else {
            // Fallback for properties that might contain 'amount' or 'kaspa'
            for (const key in balanceObj) {
              if (Object.prototype.hasOwnProperty.call(balanceObj, key)) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('amount') || lowerKey.includes('kaspa')) {
                  const value = parseVal(balanceObj[key]);
                  if (value > 0) {
                    total = value;
                    break;
                  }
                }
              }
            }
          }

          const totalKAS = total / 100000000; // SOMPI to KAS

          if (total > 0) {
            console.log(`[Wallet] Balance detected: ${totalKAS} KAS`);
          }

          set({ walletBalance: totalKAS });
        }
      }
    } catch (error) {
      // Log the error message if available, otherwise the object
      console.error("Error refreshing KAS balance:", error instanceof Error ? error.message : JSON.stringify(error));
    }
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Set connect modal visibility
   */
  setConnectModalOpen: (open: boolean) => {
    set({ isConnectModalOpen: open });
  },

  /**
   * Set address
   */
  setAddress: (address: string | null) => {
    set({ address });
  },

  /**
   * Set connected status
   */
  setIsConnected: (connected: boolean) => {
    set({ isConnected: connected });
  },

  /**
   * Set active network
   */
  setNetwork: (network: 'KAS' | 'BNB' | null) => {
    set({ network });
  },

  /**
   * Set preferred network
   */
  setPreferredNetwork: (network: 'KAS' | 'BNB' | null) => {
    set({ preferredNetwork: network });
    if (typeof window !== 'undefined') {
      if (network) {
        localStorage.setItem('kasnomo_preferred_network', network);
      } else {
        localStorage.removeItem('kasnomo_preferred_network');
      }
    }
  }
});
