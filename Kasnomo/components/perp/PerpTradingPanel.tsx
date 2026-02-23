'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useStore } from '@/lib/store';
import { openPosition, calculateLiquidationPrice } from '@/lib/perp';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Info, TrendingUp, TrendingDown } from 'lucide-react';

const ASSETS = [
    { id: 'ETH-USD', name: 'ETH-PERP', icon: 'Ξ' },
    { id: 'BTC-USD', name: 'BTC-PERP', icon: '₿' },
    { id: 'STRK-USD', name: 'STRK-PERP', icon: 'S' },
];

export const PerpTradingPanel: React.FC = () => {
    const assetPrices = useStore((state) => state.assetPrices);
    const storeSelectedAsset = useStore((state) => state.selectedAsset);
    const setStoreSelectedAsset = useStore((state) => state.setSelectedAsset);
    const isConnected = useStore((state) => state.isConnected);
    const wallet = useStore((state) => (state as any).wallet);

    const [side, setSide] = useState<'long' | 'short'>('long');
    const [leverage, setLeverage] = useState(10);
    const [collateral, setCollateral] = useState('100');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync store asset with local UI choice
    const selectedAssetData = ASSETS.find(a => a.id.startsWith(storeSelectedAsset)) || ASSETS[0];
    const markPrice = assetPrices[storeSelectedAsset] || (storeSelectedAsset === 'BTC' ? 95000 : 2500);

    const size = (parseFloat(collateral) || 0) * leverage / (markPrice || 1);
    const liquidationPrice = calculateLiquidationPrice(markPrice, leverage, side === 'long');

    const handleOpenPosition = async () => {
        if (!isConnected || !wallet) {
            alert("Please connect wallet");
            return;
        }

        setIsSubmitting(true);
        try {
            const collateralBigInt = BigInt(Math.floor(parseFloat(collateral) * 1000000));
            const sizeBigInt = BigInt(Math.floor(size * 1000000));
            const finalSize = side === 'long' ? sizeBigInt : -sizeBigInt;

            await openPosition(wallet, finalSize, leverage, collateralBigInt);
            alert("Position opened successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to open position");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="max-w-md w-full bg-gradient-to-br from-black/95 via-[#3A1E8D]/20 to-black/95 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden text-neutral-200">
            {/* Side Toggle */}
            <div className="flex p-1 bg-black/40 rounded-t-xl mb-4">
                <button
                    onClick={() => setSide('long')}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${side === 'long'
                        ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                        : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                >
                    LONG
                </button>
                <button
                    onClick={() => setSide('short')}
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${side === 'short'
                        ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                        : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                >
                    SHORT
                </button>
            </div>

            <div className="p-5 space-y-6">
                {/* Asset Selector */}
                <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3 block">Market</label>
                    <div className="grid grid-cols-3 gap-2">
                        {ASSETS.map((asset) => {
                            const assetCode = asset.id.split('-')[0];
                            return (
                                <button
                                    key={asset.id}
                                    onClick={() => setStoreSelectedAsset(assetCode as any)}
                                    className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition-all ${storeSelectedAsset === assetCode
                                        ? 'border-white/20 bg-white/10 text-white'
                                        : 'border-white/5 bg-white/5 text-neutral-500 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="mr-1.5 opacity-70 font-mono">{asset.icon}</span>
                                    {assetCode}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Leverage Slider */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Leverage</label>
                        <span className="text-[11px] font-black text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/5 font-mono">{leverage}x</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="50"
                        value={leverage}
                        onChange={(e) => setLeverage(parseInt(e.target.value))}
                        className={`w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer ${side === 'long' ? 'accent-emerald-500' : 'accent-rose-500'}`}
                    />
                    <div className="flex justify-between text-[9px] text-neutral-600 mt-2 font-black tracking-tighter">
                        <span>1X</span>
                        <span>25X</span>
                        <span>50X</span>
                    </div>
                </div>

                {/* Collateral Input */}
                <div className="relative">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Collateral (USDC)</label>
                        <div className="flex items-center gap-1.5 bg-[#38BDF8]/10 text-[#38BDF8] text-[9px] px-2.5 py-1 rounded-full font-black border border-[#38BDF8]/20 tracking-widest uppercase">
                            <Lock size={10} />
                            Private
                        </div>
                    </div>
                    <div className="group relative">
                        <input
                            type="number"
                            value={collateral}
                            onChange={(e) => setCollateral(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-2xl font-black text-white focus:outline-none focus:border-white/20 transition-all font-mono"
                            placeholder="0.00"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-500 font-black text-xs tracking-widest">USDC</div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="bg-black/40 rounded-2xl p-5 space-y-4 border border-white/5">
                    <div className="flex justify-between text-[11px]">
                        <span className="text-neutral-500 font-bold uppercase tracking-widest">Position Size</span>
                        <span className="text-white font-mono font-bold">{size.toFixed(4)} {storeSelectedAsset}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-neutral-500 font-bold uppercase tracking-widest">Entry Price</span>
                        <span className="text-white font-mono font-bold">${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-neutral-500 font-bold uppercase tracking-widest">Liq. Price</span>
                        <span className="text-rose-500/80 font-mono font-bold">${liquidationPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    onClick={handleOpenPosition}
                    disabled={isSubmitting || !isConnected}
                    className={`w-full py-5 rounded-2xl font-black text-sm tracking-[0.2em] transition-all transform active:scale-[0.98] ${side === 'long'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_10px_40px_rgba(16,185,129,0.25)] border-emerald-500'
                        : 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_10px_40px_rgba(244,63,94,0.25)] border-rose-500'
                        }`}
                >
                    {isSubmitting ? (
                        <div className="flex items-center justify-center gap-3">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full"
                            />
                            PROCESSING
                        </div>
                    ) : (
                        `OPEN ${side.toUpperCase()} POSITION`
                    )}
                </Button>

                {!isConnected && (
                    <p className="text-center text-[10px] text-neutral-600 mt-2 font-bold tracking-widest uppercase">
                        Wallet Connection Required
                    </p>
                )}
            </div>
        </Card>
    );
};
