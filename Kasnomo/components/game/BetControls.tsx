'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface BetControlsProps {
  selectedTarget: string | null;
  betAmount: string;
  onBetAmountChange: (amount: string) => void;
  onPlaceBet: () => void;
}

export const BetControls: React.FC<BetControlsProps> = ({
  selectedTarget,
  betAmount,
  onBetAmountChange,
  onPlaceBet
}) => {
  const houseBalance = useStore((state) => state.houseBalance);
  const isConnected = useStore((state) => state.isConnected);
  const network = useStore((state) => state.network);
  const activeRound = useStore((state) => state.activeRound);
  const targetCells = useStore((state) => state.targetCells);
  const isPlacingBet = useStore((state) => state.isPlacingBet);

  const [error, setError] = useState<string | null>(null);

  // Get selected target details
  const selectedTargetCell = targetCells.find(cell => cell.id === selectedTarget);

  // Calculate potential payout
  const potentialPayout = selectedTargetCell && betAmount
    ? (parseFloat(betAmount) * selectedTargetCell.multiplier).toFixed(4)
    : '0.0000';

  // Validate bet
  const validateBet = (): boolean => {
    setError(null);

    if (!isConnected) {
      setError('Please connect your wallet');
      return false;
    }

    if (activeRound) {
      setError('Round in progress. Wait for settlement.');
      return false;
    }

    if (!selectedTarget) {
      setError('Please select a target');
      return false;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bet amount');
      return false;
    }

    // Check house balance instead of wallet balance
    if (amount > houseBalance) {
      setError(`Insufficient house balance. You have ${houseBalance.toFixed(4)} KAS. Please deposit more.`);
      return false;
    }

    return true;
  };

  const handlePlaceBet = () => {
    if (validateBet()) {
      onPlaceBet();
    }
  };

  // Quick bet amount buttons
  const quickAmounts = ['0.1', '0.5', '1', '5'];

  return (
    <Card>
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Place Bet</h3>

        {/* House Balance */}
        {isConnected && (
          <div className="bg-gray-900 rounded p-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider">House Balance</p>
            <p className="text-white text-lg font-bold">{houseBalance.toFixed(4)} KAS</p>
          </div>
        )}

        {/* Bet Amount Input */}
        <div>
          <label className="block text-gray-400 text-sm mb-2 font-mono uppercase tracking-wider">Bet Amount (KAS)</label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => onBetAmountChange(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            disabled={!isConnected || !!activeRound}
            className="w-full bg-black/50 border border-white/10 rounded px-4 py-2 text-white font-mono focus:outline-none focus:border-neon-blue focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] disabled:opacity-50 transition-all"
          />
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map(amount => (
            <button
              key={amount}
              onClick={() => onBetAmountChange(amount)}
              disabled={!isConnected || !!activeRound}
              className="bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 text-white py-2 rounded text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            >
              {amount}
            </button>
          ))}
        </div>

        {/* Selected Target Info */}
        {selectedTargetCell && (
          <div className="bg-white/5 border border-white/10 rounded p-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1 font-mono">Selected Target</p>
            <p className="text-white font-semibold flex items-center gap-2">
              {selectedTargetCell.label}
              <span className="text-xs bg-white/10 px-1.5 rounded text-gray-300 font-normal">x{selectedTargetCell.multiplier}</span>
            </p>
          </div>
        )}

        {/* Potential Payout */}
        {selectedTarget && betAmount && parseFloat(betAmount) > 0 && (
          <div className="bg-neon-blue/10 border border-neon-blue/50 rounded p-3 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
            <p className="text-neon-blue text-xs uppercase tracking-wider mb-1 font-mono">Potential Win</p>
            <p className="text-neon-blue text-2xl font-bold font-mono text-shadow-neon">{potentialPayout} KAS</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Place Bet Button */}
        <Button
          onClick={handlePlaceBet}
          disabled={!isConnected || !!activeRound || isPlacingBet}
          className="w-full"
          size="lg"
        >
          {isPlacingBet ? 'Placing Bet...' : 'Place Bet'}
        </Button>

        {!isConnected && (
          <p className="text-gray-500 text-sm text-center">
            Connect your wallet to place bets
          </p>
        )}
      </div>
    </Card>
  );
};
