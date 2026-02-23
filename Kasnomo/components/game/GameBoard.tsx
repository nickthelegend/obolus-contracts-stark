'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { LiveChart } from './';
import { BalanceDisplay } from '@/components/balance';
import { useToast } from '@/lib/hooks/useToast';


export const GameBoard: React.FC = () => {
  const {
    address,
    isConnected,
    network,
    walletBalance,
    gameMode,
    setGameMode,
    setTimeframeSeconds,
    selectedAsset,
    updatePrice,
    placeBetFromHouseBalance,
    isPlacingBet,
    isBlitzActive,
    blitzEndTime,
    nextBlitzTime,
    hasBlitzAccess,
    updateBlitzTimer,
    enableBlitzAccess,
    error,
    clearError,
    isLoading: isLoadingBalance,
    activeTab,
    setActiveTab,
    userTier,
    refreshWalletBalance,
    fetchBalance,
    connect,
    disconnect
  } = useStore();

  // Refresh wallet and house balance when switching to wallet tab
  useEffect(() => {
    if (activeTab === 'wallet' && isConnected && address) {
      refreshWalletBalance();
      // Also fetch house balance from Supabase (skip for demo mode)
      if (fetchBalance && !address.startsWith('0xDEMO')) {
        fetchBalance(address);
      }
    }
  }, [activeTab, isConnected, address, refreshWalletBalance, fetchBalance]);

  const [betAmount, setBetAmount] = useState<string>('0.1');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const [blitzCountdown, setBlitzCountdown] = useState<string>('');
  const [blitzTimeRemaining, setBlitzTimeRemaining] = useState<string>('');
  const [isActivatingBlitz, setIsActivatingBlitz] = useState(false);

  const toast = useToast();

  // Unified balance and currency - STRK for Obolus on Starknet
  const currencySymbol = 'STRK';
  const blitzEntryFee = 0.01;

  const handleEnterBlitz = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!isBlitzActive) {
      toast.error("Blitz Round is not currently active");
      return;
    }

    try {
      setIsActivatingBlitz(true);

      // Starknet Blitz payment logic would go here
      toast.info(`Confirming ${blitzEntryFee} ${currencySymbol} Blitz Entry...`);

      toast.success("Payment successful! Blitz Mode enabled.");
      // Update store state
      enableBlitzAccess();
      refreshWalletBalance();
    } catch (err: any) {
      console.error("Blitz entry failed:", err);
      const errorMessage = err.message || "";
      if (errorMessage.includes('rejected') || errorMessage.includes('denied') || errorMessage.includes('User rejected')) {
        toast.error("User rejected");
      } else {
        toast.error(errorMessage || "Failed to enter Blitz Round");
      }
    } finally {
      setIsActivatingBlitz(false);
    }
  };

  // Update Blitz Timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      updateBlitzTimer();
      const now = Date.now();
      if (isBlitzActive && blitzEndTime) {
        const remaining = Math.max(0, blitzEndTime - now);
        setBlitzTimeRemaining(`${Math.floor(remaining / 1000)}s`);
        setBlitzCountdown('');
      } else {
        const timeToNext = Math.max(0, nextBlitzTime - now);
        const mins = Math.floor(timeToNext / 60000);
        const secs = Math.floor((timeToNext % 60000) / 1000);
        setBlitzCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
        setBlitzTimeRemaining('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isBlitzActive, blitzEndTime, nextBlitzTime, updateBlitzTimer]);



  // Sync selectedDuration with store's timeframeSeconds
  useEffect(() => {
    setTimeframeSeconds(selectedDuration);
  }, [selectedDuration, setTimeframeSeconds]);

  // Multiplier mapping based on duration
  const getMultiplier = (duration: number) => {
    switch (duration) {
      case 5: return 1.75;
      case 10: return 1.80;
      case 15: return 1.85;
      case 30: return 1.90;
      case 60: return 1.95;
      default: return 1.90;
    }
  };

  const handleObolusBet = async (direction: 'UP' | 'DOWN') => {
    if (!address || !isConnected || gameMode !== 'binomo') return;

    try {
      const multiplier = getMultiplier(selectedDuration);
      await placeBetFromHouseBalance(
        betAmount,
        `${direction}-${multiplier}-${selectedDuration}`,
        address
      );
    } catch (err) {
      console.error("Failed to place Obolus bet:", err);
    }
  };

  // Redundant price feed removed - now handled globally in Providers.tsx

  const activeWalletBalance = walletBalance;

  const formatAddress = (addr: string) => {
    if (!addr || addr.length <= 10) return addr || '---';
    return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
  };

  const formatBalance = (bal: number) => {
    return isNaN(bal) ? '0.00' : bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      {/* Main Interactive Chart */}
      <div className="absolute inset-0">
        <LiveChart
          betAmount={betAmount}
          setBetAmount={setBetAmount}
        />
      </div>

      {/* Blitz Round Indicator - Top Right */}
      <div className="absolute top-12 sm:top-20 right-3 sm:right-6 z-30 pointer-events-auto">
        <div className={`rounded-xl backdrop-blur-xl border shadow-lg overflow-hidden transition-all duration-500 ${isBlitzActive ? 'bg-gradient-to-br from-orange-500/20 via-red-500/20 to-yellow-500/20 border-orange-500/50 shadow-orange-500/30 animate-pulse' : 'bg-black/80 border-gray-700/50'
          }`}>
          <div className="px-3 py-2">
            {isBlitzActive ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <div>
                  <p className="text-orange-400 text-[9px] font-bold uppercase tracking-wider">BLITZ ACTIVE</p>
                  <p className="text-white text-sm font-bold font-mono">{blitzTimeRemaining} left</p>
                </div>
                {hasBlitzAccess && (
                  <div className="ml-2 px-1.5 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-[8px] text-green-400 font-bold">2x</div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg opacity-50">⏰</span>
                <div>
                  <p className="text-gray-500 text-[9px] font-medium uppercase tracking-wider">Next Blitz</p>
                  <p className="text-gray-300 text-sm font-mono">{blitzCountdown}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Toggle Button - Fixed to bottom (Mobile only) */}

      {!isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(true)}
          className="sm:hidden fixed bottom-4 left-4 w-10 h-10 bg-stark-orange rounded-full shadow-lg shadow-stark-orange/40 flex items-center justify-center text-white text-lg font-bold z-40"
        >
          ▲
        </button>
      )}

      {/* Modern Quick Bet Panel - Collapsible on Mobile */}
      <div className="absolute bottom-3 sm:bottom-6 left-3 right-3 sm:left-6 sm:right-auto z-30 pointer-events-none">

        {/* Panel - Animated slide up/down on mobile */}
        <div className={`bg-gradient-to-br from-black/95 via-stark-purple/20 to-black/95 backdrop-blur-xl border border-stark-purple/20 rounded-2xl shadow-2xl overflow-hidden w-full sm:w-[300px] transition-all duration-300 ease-out pointer-events-auto ${isPanelOpen
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-full opacity-0 scale-95 !pointer-events-none sm:translate-y-0 sm:opacity-100 sm:scale-100 sm:!pointer-events-auto'
          }`}>

          {/* Close button for mobile */}
          <button
            onClick={() => setIsPanelOpen(false)}
            className="sm:hidden absolute top-2 right-2 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white text-xs z-10"
          >
            ✕
          </button>

          {/* Game Mode Selector */}
          <div className="flex gap-1 p-1 bg-black/60 border-b border-white/5">
            <button
              onClick={() => setGameMode('binomo')}
              data-tour="classic-mode"
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all duration-200 ${gameMode === 'binomo'
                ? 'bg-stark-orange/20 text-stark-orange border border-stark-orange/40'
                : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              Classic
            </button>
            <button
              onClick={() => setGameMode('box')}
              data-tour="box-mode"
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all duration-200 ${gameMode === 'box'
                ? 'bg-stark-orange/20 text-stark-orange border border-stark-orange/40'
                : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              Box Mode
            </button>
          </div>

          {/* Tab Navigation - Pill Style */}
          <div className="flex gap-1 p-2 bg-black/40">
            <button
              onClick={() => setActiveTab('bet')}
              className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === 'bet'
                ? 'bg-gradient-to-r from-stark-orange to-red-600 text-white shadow-lg shadow-stark-orange/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              Bet
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              data-tour="wallet-tab"
              className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === 'wallet'
                ? 'bg-gradient-to-r from-stark-orange to-red-600 text-white shadow-lg shadow-stark-orange/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              Wallet
            </button>
            <button
              onClick={() => setActiveTab('blitz')}
              className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === 'blitz'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                : 'text-orange-400/70 hover:text-orange-400 hover:bg-orange-400/5'
                }`}
            >
              Blitz
            </button>
          </div>

          {/* Content Area - Fixed Height */}
          <div className="p-4 min-h-[180px]">
            {activeTab === 'bet' ? (
              <div className="space-y-4">
                {/* Amount Presets */}
                <div>
                  <label className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mb-2 block">
                    Quick Amount
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[100, 500, 1000, 5000, 10000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setBetAmount(amt.toString())}
                        className={`
                          py-2.5 rounded-lg font-bold text-[10px] transition-all duration-200
                          ${betAmount === amt.toString()
                            ? 'bg-gradient-to-b from-stark-orange to-red-700 text-white shadow-lg shadow-stark-orange/30 scale-105'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:scale-102'
                          }
                        `}
                      >
                        {amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration Selector */}
                <div>
                  <label className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mb-2 block">
                    Expiration Time
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[5, 10, 15, 30, 60].map(duration => (
                      <button
                        key={duration}
                        onClick={() => setSelectedDuration(duration)}
                        className={`
                          py-2 rounded-lg font-bold text-xs transition-all duration-200 border
                          ${selectedDuration === duration
                            ? 'bg-stark-orange/20 border-stark-orange text-stark-orange shadow-[0_0_10px_rgba(228,65,52,0.2)]'
                            : 'bg-black/40 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10'
                          }
                        `}
                      >
                        <div className="flex flex-col items-center">
                          <span>{duration < 60 ? `${duration}s` : '1m'}</span>
                          {gameMode === 'binomo' && (
                            <span className="text-[8px] opacity-70">x{getMultiplier(duration)}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Input */}
                <div>
                  <label className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mb-2 block">
                    Investment Amount
                  </label>
                  <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5">
                    <input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="flex-1 bg-transparent px-2 py-2 text-white font-mono text-base focus:outline-none min-w-0"
                      placeholder="0.00"
                    />
                    <span className="px-2 py-1.5 bg-stark-orange/20 rounded-lg text-stark-orange text-[10px] font-bold shrink-0">
                      {currencySymbol}
                    </span>
                  </div>
                </div>

                {/* Action Buttons / Instructions */}
                {gameMode === 'binomo' ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handleObolusBet('UP')}
                      disabled={!isConnected || isPlacingBet}
                      className="group relative flex flex-col items-center justify-center gap-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50"
                    >
                      <div className="text-emerald-500 text-2xl font-bold group-hover:scale-110 transition-transform">▲</div>
                      <span className="text-emerald-400 text-xs font-black tracking-tighter uppercase">Higher</span>
                    </button>

                    <button
                      onClick={() => handleObolusBet('DOWN')}
                      disabled={!isConnected || isPlacingBet}
                      className="group relative flex flex-col items-center justify-center gap-1 py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50"
                    >
                      <div className="text-rose-500 text-2xl font-bold group-hover:scale-110 transition-transform">▼</div>
                      <span className="text-rose-400 text-xs font-black tracking-tighter uppercase">Lower</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 text-center">
                      <p className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-1">Box Mode Active</p>
                      <p className="text-gray-400 text-[10px] leading-relaxed">
                        Click any cell on the grid chart to place your bet. Each cell has a different multiplier based on its distance from the current price.
                      </p>
                    </div>
                  </div>
                )}

                {/* ERROR MESSAGE DISPLAY */}
                {error && (
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl relative group">
                    <button
                      onClick={clearError}
                      className="absolute top-2 right-2 text-red-500/50 hover:text-red-500 p-1"
                    >
                      ✕
                    </button>
                    <div className="flex items-start gap-2">
                      <span className="text-lg">⚠️</span>
                      <div className="flex-1">
                        <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Error</p>
                        <p className="text-red-300 text-[11px] leading-tight mt-0.5">
                          {error.includes('User not found') || error.includes('balance')
                            ? `Account not found or no balance. Please deposit ${currencySymbol} to your house balance to start trading.`
                            : error}
                        </p>
                        {(error.includes('User not found') || error.includes('balance')) && (
                          <button
                            onClick={() => {
                              setActiveTab('wallet');
                              clearError();
                            }}
                            className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-[10px] font-bold transition-all"
                          >
                            Go to Deposit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!isConnected && (
                  <p className="text-gray-500 text-[10px] text-center font-mono">
                    Connect Starknet wallet to start
                  </p>
                )}
              </div>

            ) : activeTab === 'wallet' ? (
              <div className="space-y-4" data-tour="deposit-section">
                {isConnected && address ? (
                  <>
                    {/* House Balance Display */}
                    <BalanceDisplay />

                    {/* Address Card */}
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Wallet Address</p>
                      <p className="text-white font-mono text-xs break-all">{address}</p>
                    </div>

                    {/* Wallet Balance Display */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl p-4 border border-purple-500/20">
                      <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Wallet Balance</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                          {isLoadingBalance ? 'Loading...' : formatBalance(activeWalletBalance)}
                        </span>
                        <span className="text-purple-400 text-sm font-medium">{currencySymbol}</span>
                      </div>
                    </div>

                    {/* Disconnect Button */}
                    <button
                      onClick={() => disconnect()}
                      className="w-full py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition-all duration-200"
                    >
                      Disconnect Wallet
                    </button>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">No wallet connected</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Blitz Round Section */}
                <div className={`rounded-xl p-4 relative overflow-hidden border-2 transition-all duration-500 ${isBlitzActive ? 'bg-gradient-to-br from-orange-500/20 via-red-500/10 to-yellow-500/10 border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : 'bg-black/40 border-gray-800/50'}`}>
                  <div className="absolute top-0 right-0 px-3 py-1 bg-orange-500/20 border-b border-l border-orange-500/30 text-orange-400 text-[9px] font-black uppercase tracking-widest rounded-bl-xl">
                    Live System
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border shadow-inner transition-transform duration-500 ${isBlitzActive ? 'bg-orange-500/20 border-orange-500/50 animate-pulse scale-110' : 'bg-gray-900 border-gray-800'}`}>
                      {isBlitzActive ? '🔥' : '⏰'}
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase font-black tracking-[0.2em] mb-1 ${isBlitzActive ? 'text-orange-400' : 'text-gray-500'}`}>
                        {isBlitzActive ? 'Blitz Round Active' : 'Next Blitz Sequence'}
                      </p>
                      <p className={`text-2xl font-black font-mono tracking-tighter ${isBlitzActive ? 'text-white' : 'text-gray-400'}`}>
                        {isBlitzActive ? blitzTimeRemaining : blitzCountdown}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                        <span>Current Multiplier Boost</span>
                        <span className={isBlitzActive ? 'text-orange-400' : 'text-gray-400'}>{isBlitzActive ? '2.0x' : '1.0x'}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${isBlitzActive ? 'bg-gradient-to-r from-orange-500 to-red-500 w-full' : 'bg-gray-700 w-0'}`}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleEnterBlitz}
                      disabled={!isConnected || hasBlitzAccess || isActivatingBlitz}
                      className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 transform active:scale-95 ${hasBlitzAccess
                        ? 'bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)] cursor-default'
                        : !isConnected
                          ? 'bg-gray-800 text-gray-500 border border-gray-700'
                          : 'bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 bg-[length:200%_auto] hover:bg-right text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 border-t border-white/20'
                        }`}
                    >
                      {isActivatingBlitz ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing...
                        </span>
                      ) : hasBlitzAccess ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-base">✓</span> System Enabled
                        </span>
                      ) : !isConnected ? (
                        'Connect Wallet'
                      ) : (
                        `Enter Blitz Round (${blitzEntryFee} ${currencySymbol})`
                      )}
                    </button>


                    <p className={`text-[9px] text-center font-medium leading-relaxed ${isBlitzActive ? 'text-orange-500/60' : 'text-gray-600'}`}>
                      {isBlitzActive
                        ? 'Activate now to receive 2x multipliers on all boosted grid cells.'
                        : 'Blitz rounds occur every 3 minutes. Prepare your balance.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
