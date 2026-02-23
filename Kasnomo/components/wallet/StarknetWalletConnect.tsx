'use client';

import React from 'react';
import { connect, disconnect } from "starknetkit";
import { useStore } from '@/lib/store';
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";

export const StarknetWalletConnect: React.FC = () => {
    // We'll use starknet-react's useAccount for reading state since it's already in Providers
    // but we'll use starknetkit for the interaction as requested.
    // Use starknet-react as the primary source of truth
    const { address: accountAddress, isConnected: accountIsConnected } = useAccount();
    const { connect: connectReact } = useConnect();
    const { disconnect: disconnectReact } = useDisconnect();

    // Store sync
    const setAddress = useStore(state => state.setAddress);
    const setIsConnected = useStore(state => state.setIsConnected);
    const isConnectedStore = useStore(state => state.isConnected);
    const addressStore = useStore(state => state.address);

    // Derived values
    const isConnected = accountIsConnected || isConnectedStore;
    const address = accountAddress || addressStore;

    const shortenAddress = (addr: string) => {
        if (!addr) return '...';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const connectWallet = async () => {
        try {
            const { wallet, connector } = await connect({
                modalMode: "alwaysAsk",
                modalTheme: "dark",
                webWalletUrl: "https://web.argent.xyz",
            });

            if (wallet && connector) {
                // Pass the connector to starknet-react to update all hooks
                await connectReact({ connector: connector as any });

                const addr = (wallet as any).selectedAddress || (wallet as any).account?.address;
                if (addr) {
                    setAddress(addr);
                    setIsConnected(true);
                }
            }
        } catch (error) {
            console.error("StarknetKit connection error:", error);
        }
    };

    const disconnectWallet = async () => {
        try {
            await disconnectReact();
            await disconnect({ clearLastWallet: true });
            setAddress(null);
            setIsConnected(false);
        } catch (error) {
            console.error("StarknetKit disconnect error:", error);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {!isConnected ? (
                <button
                    onClick={connectWallet}
                    className="px-4 py-1.5 bg-stark-orange text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-stark-orange/20 transition-all active:scale-95 flex items-center gap-2"
                >
                    <div className="w-3 h-3">
                        <img
                            src="https://starknet.io/wp-content/uploads/2022/10/starknet-logo-1.png"
                            alt="Starknet"
                            className="w-full h-full object-contain brightness-0 invert"
                        />
                    </div>
                    Connect Wallet
                </button>
            ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 flex items-center gap-2 sm:gap-2.5">
                        <div className="w-4 h-4 shrink-0">
                            <img
                                src="https://starknet.io/wp-content/uploads/2022/10/starknet-logo-1.png"
                                alt="Starknet"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="flex flex-col items-center sm:items-end">
                            <span className="text-[8px] text-stark-orange font-bold uppercase tracking-tighter">
                                STARKNET
                            </span>
                            <span className="text-white text-[10px] sm:text-[11px] font-mono leading-none">
                                {shortenAddress(address ?? '')}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={disconnectWallet}
                        className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
                        title="Disconnect"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};
