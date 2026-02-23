'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore, useUserTier } from '@/lib/store';
import { StarknetWalletConnect } from '@/components/wallet';
import { QuickTour } from '@/components/tour/QuickTour';
import { TierStatusModal } from '@/components/game/TierStatusModal';

export const Header: React.FC = () => {
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [clickCount, setClickCount] = useState(0);
    const clickTimer = useRef<NodeJS.Timeout | null>(null);
    const [demoActivated, setDemoActivated] = useState(false);
    const pathname = usePathname();

    // Get store actions for demo mode
    const setAddress = useStore((state) => state.setAddress);
    const setBalance = useStore((state) => state.setBalance);
    const setIsConnected = useStore((state) => state.setIsConnected);
    const toggleAccountType = useStore((state) => state.toggleAccountType);
    const accountType = useStore((state) => state.accountType);
    const userTier = useUserTier();

    const tierIcon = userTier === 'vip' ? '⬢' : userTier === 'standard' ? '♢' : '△';

    const handleOverflowClick = () => {
        if (clickTimer.current) {
            clearTimeout(clickTimer.current);
        }

        const newCount = clickCount + 1;
        setClickCount(newCount);

        if (newCount >= 3) {
            setAddress('0x0000000000000000000000000000000000000000000000000000000000000001');
            setBalance(50);
            setIsConnected(true);
            if (accountType === 'real') toggleAccountType();
            setDemoActivated(true);
            setClickCount(0);
            setTimeout(() => setDemoActivated(false), 2000);
        } else {
            clickTimer.current = setTimeout(() => {
                setClickCount(0);
            }, 1000);
        }
    };

    return (
        <>
            <header className="absolute top-0 left-0 right-0 z-50 px-2 sm:px-6 py-2 sm:py-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-6">
                    <h1 className="flex items-center gap-1 sm:gap-3">
                        <span
                            onClick={handleOverflowClick}
                            className={`text-lg sm:text-3xl font-black tracking-tighter sm:tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E44134] to-white cursor-pointer select-none transition-all duration-500 ${demoActivated ? 'scale-110 !via-emerald-400' : ''}`}
                            style={{ fontFamily: 'var(--font-orbitron)' }}
                        >
                            {demoActivated ? 'DEMO' : 'OBOLUS'}
                        </span>
                    </h1>

                    <div className="hidden md:flex bg-white/5 rounded-lg border border-white/10 p-0.5">
                        <Link
                            href="/"
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${pathname === '/' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
                                }`}
                        >
                            Options
                        </Link>
                        <Link
                            href="/perp"
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${pathname === '/perp' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
                                }`}
                        >
                            Perp
                        </Link>
                    </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-1 sm:gap-4">
                    <button
                        onClick={() => setIsStatusOpen(true)}
                        className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-tighter sm:tracking-widest border border-amber-500/20 transition-all active:scale-95"
                    >
                        <span className="text-xs sm:text-sm">{tierIcon}</span>
                        <span className="hidden xs:inline">Status</span>
                    </button>

                    <button
                        onClick={() => setIsTourOpen(true)}
                        className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1.5 bg-[#E44134]/10 hover:bg-[#E44134]/20 text-[#E44134] rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-tighter sm:tracking-widest border border-[#E44134]/20 transition-all active:scale-95"
                    >
                        <span className="text-xs sm:text-sm">✨</span>
                        <span className="hidden xs:inline">Tour</span>
                    </button>
                    <StarknetWalletConnect />
                </div>
            </header>

            <QuickTour isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
            <TierStatusModal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} />
        </>
    );
};
