'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, X, Plus } from 'lucide-react';
import { closePosition } from '@/lib/perp';
import { useStore } from '@/lib/store';

interface PositionCardProps {
    position: {
        id: number;
        asset: string;
        side: 'long' | 'short';
        size: number;
        collateral: number;
        entryPrice: number;
        markPrice: number;
        liqPrice: number;
        pnl: number;
    };
}

export const PositionCard: React.FC<PositionCardProps> = ({ position }) => {
    const isPositive = position.pnl >= 0;
    const pnlPercent = (position.pnl / position.collateral) * 100;

    const wallet = useStore((state) => (state as any).wallet);

    const handleClose = async () => {
        if (!wallet) return;
        try {
            await closePosition(wallet, position.id);
            alert("Position closing initiated");
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="bg-[#050507]/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:border-[#E44134]/30 transition-all group shadow-lg">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${position.side === 'long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {position.side === 'long' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-white tracking-widest text-[10px] uppercase">{position.asset}</h3>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase ${position.side === 'long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                {position.side === 'long' ? 'Buy' : 'Sell'}
                            </span>
                        </div>
                        <p className="text-[9px] text-neutral-600 font-mono mt-0.5 font-bold uppercase tracking-tighter">ID: #{position.id}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`text-xl font-black font-mono tracking-tighter ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-[10px] font-black tracking-widest uppercase ${isPositive ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                        {isPositive ? 'Profit' : 'Loss'} {pnlPercent.toFixed(2)}%
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-6 bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Size</p>
                    <p className="text-[11px] font-black text-white font-mono">{position.size.toFixed(4)} {position.asset.split('-')[0]}</p>
                </div>
                <div className="space-y-1 text-right">
                    <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Mark Price</p>
                    <p className="text-[11px] font-black text-white font-mono">${position.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Entry Price</p>
                    <p className="text-[11px] font-black text-neutral-500 font-mono">${position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1 text-right">
                    <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Liq. Price</p>
                    <p className="text-[11px] font-black text-rose-500/80 font-mono">${position.liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleClose}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-500 py-3 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all border border-white/5 flex items-center justify-center gap-2 uppercase"
                >
                    <X size={14} />
                    Close Position
                </button>
                <button className="px-4 bg-white/5 hover:bg-white/10 text-neutral-500 py-3 rounded-xl transition-all border border-white/5">
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
};
