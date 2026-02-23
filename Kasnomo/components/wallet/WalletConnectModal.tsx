'use client';

import React from 'react';
import { useOverflowStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Globe } from 'lucide-react';
import { connect } from "starknetkit";
import { useAccount } from "@starknet-react/core";

export const WalletConnectModal: React.FC = () => {
    const isOpen = useOverflowStore(state => state.isConnectModalOpen);
    const setOpen = useOverflowStore(state => state.setConnectModalOpen);
    const isConnected = useOverflowStore(state => state.isConnected);
    const setAddress = useOverflowStore(state => state.setAddress);
    const setIsConnected = useOverflowStore(state => state.setIsConnected);

    const handleStarknetConnect = async () => {
        try {
            const { wallet } = await connect({
                modalMode: "alwaysAsk",
                modalTheme: "dark",
                webWalletUrl: "https://web.argent.xyz",
            });

            if (wallet) {
                const addr = (wallet as any).selectedAddress || (wallet as any).account?.address;
                if (addr) {
                    setAddress(addr);
                    setIsConnected(true);
                }
            }
            setOpen(false);
        } catch (error) {
            console.error('StarknetKit connection error:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOpen(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-stark-orange/10 to-transparent">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Connect Wallet</h2>
                            <p className="text-sm text-gray-400 mt-1">Join the Obolus Market on Starknet</p>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                        >
                            <X className="w-5 h-5 text-gray-500 group-hover:text-white" />
                        </button>
                    </div>

                    {/* Options */}
                    <div className="p-6 space-y-3">
                        {isConnected ? (
                            <div className="py-8 text-center bg-white/5 rounded-xl border border-white/10">
                                <p className="text-emerald-400 font-bold mb-1">Already Connected</p>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleStarknetConnect}
                                className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-stark-orange/0 via-stark-orange/5 to-stark-orange/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="w-12 h-12 rounded-lg bg-stark-orange/10 flex items-center justify-center border border-stark-orange/20 group-hover:scale-110 transition-transform">
                                    <Wallet className="w-7 h-7 text-stark-orange" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">Starknet Wallet</span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-stark-orange/20 text-stark-orange font-bold uppercase tracking-wider">L2</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">Show all wallet options (Argent, Braavos, etc.)</p>
                                </div>
                                <Globe className="w-5 h-5 text-gray-600 group-hover:text-stark-orange transition-colors" />
                            </button>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-white/5 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                            Powered by Obolus Protocol
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
