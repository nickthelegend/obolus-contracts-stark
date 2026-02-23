'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserTier } from '@/lib/store';

interface TierStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TIER_DATA = [
    {
        id: 'free',
        name: 'Free',
        color: 'from-gray-400 to-gray-600',
        icon: '△',
        assets: 'All',
        blitz: true,
        payout: '80%',
        withdrawal: 'Instant',
        fee: '2.0%',
        requirement: '0 KAS',
    },
    {
        id: 'standard',
        name: 'Standard',
        color: 'from-amber-400 to-amber-600',
        icon: '♢',
        assets: 'All',
        blitz: true,
        payout: '85%',
        withdrawal: 'Instant',
        fee: '1.75%',
        requirement: '10,000 KAS',
    },
    {
        id: 'vip',
        name: 'VIP',
        color: 'from-purple-400 to-purple-600',
        icon: '⬢',
        assets: 'All',
        blitz: true,
        payout: '90%',
        withdrawal: 'Instant',
        fee: '1.5%',
        requirement: '50,000 KAS',
    }
];

export const TierStatusModal: React.FC<TierStatusModalProps> = ({ isOpen, onClose }) => {
    const currentTier = useUserTier();

    const currentTierIndex = TIER_DATA.findIndex(t => t.id === currentTier);
    const nextTier = TIER_DATA[currentTierIndex + 1];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-2xl bg-[#0d0d0d] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-8 border-b border-white/5">
                            <button
                                onClick={onClose}
                                className="text-amber-400 font-bold hover:text-amber-300 transition-colors"
                            >
                                Close
                            </button>
                            <h2 className="text-white text-xl font-black uppercase tracking-widest">Your Status</h2>
                            <div className="w-12" /> {/* Spacer */}
                        </div>

                        <div className="p-8">
                            {/* Progress Card */}
                            {nextTier && (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-12 flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20">
                                        {nextTier.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-white text-lg font-bold">{nextTier.requirement} until</h3>
                                        <p className="text-gray-400 text-sm">{nextTier.name} status</p>
                                    </div>
                                </div>
                            )}

                            {/* Tiers Progress Line */}
                            <div className="relative flex justify-between px-4 mb-12">
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2 z-0" />
                                <div
                                    className="absolute top-1/2 left-0 h-0.5 bg-amber-400 -translate-y-1/2 z-0 transition-all duration-1000"
                                    style={{ width: `${(currentTierIndex / (TIER_DATA.length - 1)) * 100}%` }}
                                />

                                {TIER_DATA.map((tier, idx) => (
                                    <div key={tier.id} className="relative z-10 flex flex-col items-center gap-4">
                                        <div className={`text-2xl mb-2 ${idx <= currentTierIndex ? 'text-amber-400' : 'text-gray-600'}`}>
                                            {tier.icon}
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className={`text-sm font-black uppercase tracking-tighter ${idx === currentTierIndex ? 'text-white' : 'text-gray-500'}`}>
                                                {tier.name}
                                            </span>
                                            {idx === currentTierIndex && (
                                                <span className="text-[10px] text-amber-400 font-bold mt-1">Your Status</span>
                                            )}
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 ${idx <= currentTierIndex ? 'bg-amber-400 border-amber-400' : 'bg-[#0d0d0d] border-white/20'}`}>
                                            {idx <= currentTierIndex && (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] text-black">✓</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Comparison Table */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-4 px-4 text-[10px] text-gray-500 font-black uppercase tracking-widest mb-4">
                                    <div>Feature</div>
                                    {TIER_DATA.map(t => (
                                        <div key={t.id} className="text-center">{t.name}</div>
                                    ))}
                                </div>

                                {[
                                    { label: 'Assets', key: 'assets' },
                                    { label: 'Blitz Mode', key: 'blitz', type: 'bool' },
                                    { label: 'Max Payout', key: 'payout' },
                                    { label: 'Withdrawal', key: 'withdrawal' },
                                    { label: 'Withdrawal Fee', key: 'fee' },
                                ].map((row, i) => (
                                    <div key={i} className="grid grid-cols-4 px-4 py-4 bg-white/[0.02] border border-white/5 rounded-2xl items-center">
                                        <div className="text-xs text-gray-400 font-medium">{row.label}</div>
                                        {TIER_DATA.map(t => (
                                            <div key={t.id} className="text-center text-xs font-bold text-white">
                                                {row.type === 'bool' ? (
                                                    t[row.key as keyof typeof t] ? '✓' : '—'
                                                ) : (
                                                    t[row.key as keyof typeof t]
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
