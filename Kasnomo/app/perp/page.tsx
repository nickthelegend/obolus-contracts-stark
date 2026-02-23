'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PerpTradingPanel } from '@/components/perp/PerpTradingPanel';
import { PositionCard } from '@/components/perp/PositionCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { Shield, Activity, Wallet } from 'lucide-react';
import { Header } from '@/components/ui/Header';
import { TradingViewChart } from '@/components/perp/TradingViewChart';

export default function PerpPage() {
    const isConnected = useStore((state) => state.isConnected);
    const assetPrices = useStore((state) => state.assetPrices);
    const startGlobalPriceFeed = useStore((state) => state.startGlobalPriceFeed);
    const updateAllPrices = useStore((state) => state.updateAllPrices);
    const selectedAsset = useStore((state) => state.selectedAsset);

    const [positions, setPositions] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('positions');

    // Start price feed on mount
    useEffect(() => {
        const stopFeed = startGlobalPriceFeed(updateAllPrices);
        return () => stopFeed();
    }, [startGlobalPriceFeed, updateAllPrices]);

    const currentPrice = assetPrices[selectedAsset || 'BTC'] || 0;

    // Mock positions for demo
    useEffect(() => {
        if (isConnected) {
            setPositions([
                {
                    id: 1,
                    asset: 'ETH-USD',
                    side: 'long',
                    size: 0.5,
                    collateral: 125,
                    entryPrice: 2450.50,
                    markPrice: assetPrices['ETH'] || 2510.20,
                    liqPrice: 2210.00,
                    pnl: assetPrices['ETH'] ? (assetPrices['ETH'] - 2450.50) * 0.5 : 29.85
                }
            ]);
        } else {
            setPositions([]);
        }
    }, [isConnected, assetPrices]);

    return (
        <main className="min-h-screen bg-[#02040A] text-white pt-24 pb-12 px-2 sm:px-6 md:px-8 overflow-hidden relative">
            <Header />

            {/* Background decoration */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#3A1E8D]/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#E44134]/5 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-[1600px] mx-auto relative z-10 h-full">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:h-[calc(100vh-140px)]">
                    {/* Main Content Area */}
                    <div className="flex flex-col gap-6 h-full overflow-hidden">
                        {/* Chart Area */}
                        <div className="flex-1 min-h-[400px] lg:h-auto bg-[#050507]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden relative shadow-2xl">
                            <TradingViewChart />
                        </div>

                        {/* Positions & Orders Section */}
                        <Card className="bg-[#050507]/40 backdrop-blur-xl border-white/5 rounded-3xl overflow-hidden h-[300px] lg:h-[350px] flex flex-col shadow-2xl">
                            <div className="border-b border-white/5 px-6 shrink-0 bg-black/20">
                                <div className="flex gap-10">
                                    {['positions', 'orders', 'history'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`py-4 text-[10px] font-black tracking-[0.2em] transition-all relative uppercase ${activeTab === tab ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                                                }`}
                                        >
                                            {tab}
                                            {activeTab === tab && (
                                                <motion.div
                                                    layoutId="activeTabUnderline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E44134] shadow-[0_0_15px_rgba(228,65,52,0.8)]"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'positions' && (
                                        <motion.div
                                            key="pos"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                                        >
                                            {positions.length > 0 ? (
                                                positions.map((pos) => (
                                                    <PositionCard key={pos.id} position={pos} />
                                                ))
                                            ) : (
                                                <div className="col-span-full py-12 text-center flex flex-col items-center gap-4">
                                                    <div className="p-5 bg-white/5 rounded-full border border-white/5">
                                                        <Shield size={32} className="text-neutral-800" />
                                                    </div>
                                                    <p className="text-neutral-600 font-black text-xs uppercase tracking-widest">No active positions</p>
                                                    {!isConnected && (
                                                        <Button variant="primary" className="px-10 py-3 rounded-full font-black tracking-widest text-[10px] uppercase">Connect Wallet</Button>
                                                    )}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                    {activeTab !== 'positions' && (
                                        <motion.div
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center justify-center h-full text-neutral-600 font-black text-[10px] uppercase tracking-widest gap-4"
                                        >
                                            <Activity size={24} className="opacity-20" />
                                            No {activeTab} available
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar - Trading Panel */}
                    <aside className="space-y-6 flex flex-col h-full lg:overflow-y-auto custom-scrollbar">
                        <PerpTradingPanel />

                        <div className="bg-[#3A1E8D]/10 border border-[#3A1E8D]/20 rounded-3xl p-6 shadow-[0_10px_40px_rgba(58,30,141,0.08)] backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-4 text-[#38BDF8]">
                                <Shield size={20} />
                                <h4 className="text-[11px] font-black uppercase tracking-[0.25em]">Privacy Engine™</h4>
                            </div>
                            <p className="text-[12px] text-neutral-400 leading-relaxed font-bold tracking-tight mb-5">
                                Institutional collateral vault active. All positions are cryptographically blinded using Tongo. PnL settlements are proved via ZK-STARKs without revealing strategy intent.
                            </p>
                            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Shield Status</p>
                                    <p className="text-[11px] text-emerald-400 font-black uppercase tracking-widest">Maximum Blinded</p>
                                </div>
                                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
                            </div>
                        </div>

                        <div className="mt-auto pt-6 text-center">
                            <p className="text-[9px] text-neutral-700 font-black uppercase tracking-[0.3em]">
                                Powered by Starknet & Tongo
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
}
