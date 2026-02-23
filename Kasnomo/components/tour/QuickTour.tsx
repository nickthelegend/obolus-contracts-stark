'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';

interface TourStep {
    target: string;
    title: string;
    content: string;
    action?: () => void;
    position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
    {
        target: '[data-tour="asset-selector"]',
        title: 'Choose Your Asset',
        content: 'Click here to switch between Crypto, Metals, Forex, and Stocks. Each has different volatility and returns.',
        position: 'bottom'
    },
    {
        target: '[data-tour="classic-mode"]',
        title: 'Classic Mode',
        content: 'Predict if the price will be Higher or Lower after a set amount of time. Simple and powerful.',
        action: () => {
            // We can't easily trigger a store action here without access to it, 
            // but the component itself will handle the view.
        },
        position: 'top'
    },
    {
        target: '[data-tour="box-mode"]',
        title: 'Box Mode',
        content: 'Place bets directly on the grid. Multipliers vary based on the price distance. High risk, high reward!',
        position: 'top'
    },
    {
        target: '[data-tour="wallet-tab"]',
        title: 'Manage Your Funds',
        content: 'Switch to the Wallet tab to see your balance, deposit funds, or request a withdrawal.',
        position: 'top'
    },
    {
        target: '[data-tour="deposit-section"]',
        title: 'Quick Deposit',
        content: 'Easily deposit STRK to start trading. Transactions are secure on Starknet.',
        position: 'top'
    }
];

export const QuickTour: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Use specific selectors for stability
    const isConnected = useStore(state => state.isConnected);
    const setActiveTab = useStore(state => state.setActiveTab);
    const setGameMode = useStore(state => state.setGameMode);

    // Memoize steps to prevent infinite loops
    const steps: TourStep[] = useMemo(() => [
        ...(isConnected ? [] : [{
            target: '[data-tour="connect-button"]',
            title: 'Welcome! Connect First',
            content: 'Start by connecting your Starknet wallet for a seamless trading experience.',
            position: 'bottom' as const
        }]),
        {
            target: '[data-tour="asset-selector"]',
            title: 'Choose Your Asset',
            content: 'Switch between Crypto, Metals, Forex, and Stocks. Each has different volatility and returns.',
            position: 'bottom' as const
        },
        {
            target: '[data-tour="classic-mode"]',
            title: 'Classic Mode',
            content: 'Predict if the price will be Higher or Lower after a set amount of time. Simple and powerful.',
            position: 'top' as const
        },
        {
            target: '[data-tour="box-mode"]',
            title: 'Box Mode',
            content: 'Place bets directly on the grid. Multipliers vary based on the price distance. High risk, high reward!',
            position: 'top' as const
        },
        {
            target: '[data-tour="wallet-tab"]',
            title: 'Navigation Controls',
            content: 'Switch between Bet, Wallet, and Blitz modes using these tabs.',
            position: 'top' as const
        },
        {
            target: '[data-tour="deposit-section"]',
            title: 'Manage Your Funds',
            content: isConnected
                ? 'Easily deposit STRK to start trading. Your house balance is updated instantly.'
                : 'After connecting, you can manage your deposits and withdrawals right here.',
            position: 'top' as const
        }
    ], [isConnected]);

    // Handle view state changes (tabs/modes) independently of positioning
    useEffect(() => {
        if (!isOpen) return;

        const step = steps[currentStep];
        if (!step) return;

        if (step.target === '[data-tour="classic-mode"]') setGameMode('binomo');
        if (step.target === '[data-tour="box-mode"]') setGameMode('box');
        if (step.target === '[data-tour="wallet-tab"]') setActiveTab('bet');
        if (step.target === '[data-tour="deposit-section"]') setActiveTab('wallet');
    }, [currentStep, isOpen, steps, setGameMode, setActiveTab]);

    const updateTargetRect = useCallback(() => {
        const step = steps[currentStep];
        if (!step) return;

        const element = document.querySelector(step.target);
        if (element) {
            setTargetRect(element.getBoundingClientRect());
        }
    }, [currentStep, steps]);

    useEffect(() => {
        if (isOpen) {
            // Initial position and scroll
            const step = steps[currentStep];
            setTimeout(() => {
                const element = document.querySelector(step?.target || '');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    updateTargetRect();
                }
            }, 150);

            window.addEventListener('resize', updateTargetRect);
            window.addEventListener('scroll', updateTargetRect);
            return () => {
                window.removeEventListener('resize', updateTargetRect);
                window.removeEventListener('scroll', updateTargetRect);
            };
        }
    }, [isOpen, currentStep, steps, updateTargetRect]);

    if (!isOpen || !targetRect) return null;

    const currentStepData = steps[currentStep];
    const tooltipWidth = 300;
    const tooltipHeight = 160;

    // Calculate clamped position
    const calculatePosition = () => {
        let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        let top = currentStepData.position === 'bottom' ? targetRect.bottom + 20 : targetRect.top - tooltipHeight - 20;

        if (currentStepData.position === 'right') {
            left = targetRect.right + 20;
            top = targetRect.top;
        } else if (currentStepData.position === 'left') {
            left = targetRect.left - tooltipWidth - 20;
            top = targetRect.top;
        }

        // Viewport clamping
        const padding = 20;
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
        top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

        return { left, top };
    };

    const pos = calculatePosition();

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
            setCurrentStep(0);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Dimmed Background with Hole */}
            <svg className="absolute inset-0 w-full h-full pointer-events-auto">
                <defs>
                    <mask id="tour-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <rect
                            x={targetRect.left - 8}
                            y={targetRect.top - 8}
                            width={targetRect.width + 16}
                            height={targetRect.height + 16}
                            rx="12"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.7)"
                    mask="url(#tour-mask)"
                    onClick={onClose}
                />
            </svg>

            {/* Spotlight Border */}
            <motion.div
                initial={false}
                animate={{
                    left: targetRect.left - 8,
                    top: targetRect.top - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16,
                }}
                className="absolute border-2 border-stark-orange rounded-xl shadow-[0_0_20px_rgba(228,65,52,0.5)] pointer-events-none"
            />

            {/* Tooltip */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    left: pos.left,
                    top: pos.top,
                }}
                className="absolute w-[300px] bg-[#0d0d0d] border border-white/10 rounded-2xl p-5 shadow-2xl pointer-events-auto backdrop-blur-xl"
            >
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-stark-orange font-bold text-sm uppercase tracking-wider">
                        {currentStepData.title}
                    </h3>
                    <span className="text-[10px] text-gray-500 font-mono">
                        {currentStep + 1} / {steps.length}
                    </span>
                </div>

                <p className="text-gray-300 text-xs leading-relaxed mb-6">
                    {currentStepData.content}
                </p>

                <div className="flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                    >
                        Skip
                    </button>

                    <div className="flex gap-2">
                        {currentStep > 0 && (
                            <button
                                onClick={handleBack}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest border border-white/10 transition-all"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="px-4 py-2 rounded-lg bg-stark-orange hover:bg-stark-orange/80 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-stark-orange/20 transition-all"
                        >
                            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>

                {/* Arrow - Only show if not clamped too much */}
                <div
                    className={`absolute w-3 h-3 bg-[#0d0d0d] border-white/10 transform rotate-45 hidden sm:block
            ${currentStepData.position === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2 border-t border-l' : ''}
            ${currentStepData.position === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r' : ''}
          `}
                />
            </motion.div>
        </div>
    );
};
