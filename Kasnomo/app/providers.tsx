'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useOverflowStore } from '@/lib/store';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Custom Components
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';

// Starknet Imports
import { mainnet, sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  argent,
  braavos,
  useInjectedConnectors,
  useAccount,
  jsonRpcProvider
} from "@starknet-react/core";


export function Providers({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [queryClient] = useState(() => new QueryClient());
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
  });

  /**
   * Component to sync Starknet wallet state with global store
   */
  function StarknetSync() {
    const { address, isConnected } = useAccount();
    const { setAddress, setIsConnected } = useOverflowStore();

    useEffect(() => {
      // Only sync from starknet-react to store if it's connected
      // This avoids FIGHTING with manual connections from StarknetKit
      if (isConnected && address) {
        console.log("[StarknetSync] Syncing connected account to store:", address);
        setAddress(address);
        setIsConnected(true);
      } else if (initialized.current && !isConnected) {
        // If we were connected and now we're NOT, and it's not a demo session, clear it
        const currentAddress = useOverflowStore.getState().address;
        if (currentAddress && !currentAddress.startsWith('0xDEMO')) {
          console.log("[StarknetSync] Account disconnected, clearing store");
          setAddress(null);
          setIsConnected(false);
        }
      }
    }, [address, isConnected, setAddress, setIsConnected]);

    return null;
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initializeApp = async () => {
      try {
        const { updateAllPrices, loadTargetCells, startGlobalPriceFeed } = useOverflowStore.getState();

        await loadTargetCells().catch(console.error);
        const stopPriceFeed = startGlobalPriceFeed(updateAllPrices);
        setIsReady(true);
        return () => { if (stopPriceFeed) stopPriceFeed(); };
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stark-orange"></div>
      </div>
    );
  }

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc: () => ({ nodeUrl: "https://free-rpc.nethermind.io/mainnet-juno" }) })}
      connectors={connectors}
    >
      <QueryClientProvider client={queryClient}>
        <StarknetSync />
        {children}
        <WalletConnectModal />
        <ToastProvider />
      </QueryClientProvider>
    </StarknetConfig>
  );
}

