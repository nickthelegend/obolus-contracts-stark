'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useOverflowStore } from '@/lib/store';
import { useToast } from '@/lib/hooks/useToast';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amount: number, txHash: string) => void;
  onError?: (error: string) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  const { depositFunds, network, walletBalance, refreshWalletBalance, address } = useOverflowStore();
  const toast = useToast();

  const currencySymbol = 'KAS';
  const networkName = 'Kaspa Testnet';

  // Quick select amounts
  const quickAmounts = [100, 500, 1000, 5000];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      refreshWalletBalance();
    } else {
      setAmount('');
      setError(null);
      setIsLoading(false);
      setSuccessTx(null);
    }
  }, [isOpen]);

  const validateAmount = (value: string): string | null => {
    if (!value || value.trim() === '') {
      return 'Please enter an amount';
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return 'Please enter a valid number';
    }

    if (numValue <= 0) {
      return 'Amount must be greater than zero';
    }

    if (numValue > walletBalance) {
      return `Insufficient ${currencySymbol} balance`;
    }

    return null;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const handleQuickSelect = (value: number) => {
    setAmount(value.toString());
    setError(null);
  };

  const handleMaxClick = () => {
    if (walletBalance > 0) {
      const gasBuffer = 1; // 1 KAS buffer
      const maxAmount = Math.max(0, walletBalance - gasBuffer);
      setAmount(maxAmount.toFixed(2));
      setError(null);
    }
  };

  const handleDeposit = async () => {
    const validationError = validateAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const depositAmount = parseFloat(amount);
      let txHash: string = '';

      // Kaspa KasWare logic
      if (typeof window !== 'undefined' && (window as any).kasware) {

        const treasuryAddress = process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS;
        if (!treasuryAddress) throw new Error("Treasury address not configured");

        toast.info(`Please confirm ${depositAmount} KAS deposit in your wallet...`);

        // Amount in Sompi (1 KAS = 100,000,000 Sompi)
        const amountSompi = Math.floor(depositAmount * 100000000);

        // Request transaction signing
        // KasWare sendKaspa takes (address, amount)
        const result = await (window as any).kasware.sendKaspa(treasuryAddress, amountSompi);

        console.log("Deposit Transaction Result:", result);

        if (!result) throw new Error("Transaction request failed");

        // Extract transaction ID from KasWare response
        // KasWare can return: a plain txid string, a JSON string, or an object
        if (typeof result === 'string') {
          // Could be a plain hex txid OR a JSON string of the full tx object
          try {
            const parsed = JSON.parse(result);
            txHash = parsed.id || parsed.txid || parsed.transactionId || result;
          } catch {
            // It's a plain string (hex txid) — use as-is
            txHash = result;
          }
        } else if (typeof result === 'object') {
          txHash = result.id || result.txid || result.transactionId || '';
          if (!txHash) throw new Error('Could not extract transaction ID from wallet response');
        } else {
          throw new Error('Unexpected wallet response format');
        }

      } else {
        throw new Error("KasWare wallet not found");
      }

      toast.info('Transaction submitted. Waiting for confirmation...');

      // Update balance in database
      await depositFunds(address, depositAmount, txHash!);

      // Refresh balances
      refreshWalletBalance();

      setSuccessTx(txHash);

      toast.success(
        `Successfully deposited ${depositAmount.toLocaleString()} ${currencySymbol}!`
      );

      if (onSuccess) onSuccess(depositAmount, txHash!);
    } catch (err: any) {
      console.error('Deposit error:', err);
      const errorMessage = err.message || 'Failed to deposit funds';
      setError(errorMessage);
      toast.error(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (successTx) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Deposit Successful"
      >
        <div className="text-center py-4 space-y-6">
          <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-2 border border-cyan-500/50 relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
            <svg className="w-10 h-10 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">Deposit Confirmed</h3>
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">House balance increased</p>
          </div>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex flex-col items-center gap-1.5 font-mono">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Transaction Hash</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#00f5ff] font-medium">{successTx.slice(0, 10)}...{successTx.slice(-10)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(successTx);
                      toast.info('Copied');
                    }}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                  <a
                    href={`https://explorer-tn10.kaspa.org/txs/${successTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={onClose}
            variant="primary"
            className="w-full bg-white text-black hover:bg-gray-200 border-none h-12 text-sm font-black uppercase tracking-widest"
          >
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Deposit ${currencySymbol}`}
      showCloseButton={!isLoading}
    >
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-[#00f5ff]/10 to-purple-500/10 border border-[#00f5ff]/30 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#00f5ff]/20 text-[#00f5ff] text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg">
            {networkName}
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-mono">
            Wallet Balance
          </p>
          <p className="text-[#00f5ff] text-xl font-bold font-mono flex items-center gap-2">

            {walletBalance.toFixed(4)} {currencySymbol}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="deposit-amount" className="text-gray-400 text-xs font-mono uppercase">Amount to Deposit</label>
          <div className="relative">
            <input
              id="deposit-amount"
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              disabled={isLoading}
              className={`
                w-full px-4 py-3 bg-black/50 border rounded-lg text-lg
                text-white font-mono
                focus:outline-none focus:ring-1 focus:ring-[#00f5ff]
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error ? 'border-red-500' : 'border-[#00f5ff]/30'}
              `}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
              {currencySymbol}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handleMaxClick}
              disabled={isLoading}
              className="text-[10px] text-[#00f5ff] hover:text-cyan-400 font-mono disabled:opacity-50 transition-colors uppercase tracking-wider"
            >
              Use Max
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((quickAmount) => (
            <button
              key={quickAmount}
              onClick={() => handleQuickSelect(quickAmount)}
              disabled={isLoading}
              className={`
                px-2 py-2 rounded border font-mono text-xs
                transition-all duration-200
                ${amount === quickAmount.toString()
                  ? 'bg-[#00f5ff]/20 border-[#00f5ff] text-[#00f5ff] shadow-[0_0_10px_rgba(0,245,255,0.3)]'
                  : 'bg-black/30 border-[#00f5ff]/30 text-gray-300 hover:border-[#00f5ff] hover:text-[#00f5ff]'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {quickAmount}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg px-3 py-2">
            <p className="text-red-400 text-xs font-mono">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            variant="primary"
            className="flex-1"
            disabled={isLoading || !amount || parseFloat(amount || '0') <= 0}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing</span>
              </span>
            ) : (
              `Deposit ${currencySymbol}`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
