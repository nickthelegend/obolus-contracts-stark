"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, ArrowDown, Eye, EyeOff, Loader2, ChevronDown, X, ExternalLink, RefreshCw } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import TokenIcon from "@/components/TokenIcon";
import { type TokenSymbol, getToken, getExplorerTxUrl } from "@/lib/constants";

const TOKEN_LIST: { symbol: TokenSymbol; name: string }[] = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "STRK", name: "Starknet Token" },
];

type Mode = "fund" | "withdraw";

function formatTongoBalance(raw: bigint | undefined | null, symbol: TokenSymbol): string {
  if (raw == null) return "0";
  const token = getToken(symbol);
  // raw is in Tongo units (small integer). 1 Tongo unit = rate ERC-20 wei.
  const erc20Wei = raw * token.rate;
  const divisor = 10n ** BigInt(token.decimals);
  const whole = erc20Wei / divisor;
  const remainder = erc20Wei % divisor;
  const decimals = symbol === "USDC" ? 2 : 4;
  const fracStr = remainder.toString().padStart(token.decimals, "0").slice(0, decimals);
  return `${whole.toLocaleString()}.${fracStr}`;
}

function formatErc20Balance(raw: bigint | undefined | null, symbol: TokenSymbol): string {
  if (raw == null) return "--";
  const token = getToken(symbol);
  const divisor = 10n ** BigInt(token.decimals);
  const whole = raw / divisor;
  const remainder = raw % divisor;
  const decimals = symbol === "USDC" ? 2 : 4;
  const fracStr = remainder.toString().padStart(token.decimals, "0").slice(0, decimals);
  return `${whole.toLocaleString()}.${fracStr}`;
}

export default function FundPage() {
  const { isConnected, connect, address, tongoPrivateKey, execute, balances, refreshBalance, erc20Balances, refreshErc20Balances } = useWallet();
  const [mode, setMode] = useState<Mode>("fund");
  const [selectedToken, setSelectedToken] = useState(TOKEN_LIST[0]);
  const [amount, setAmount] = useState("");
  const [showSelector, setShowSelector] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEncrypted, setShowEncrypted] = useState(false);
  const [revealedBalances, setRevealedBalances] = useState<Record<string, boolean>>({});
  const [txComplete, setTxComplete] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRollingOver, setIsRollingOver] = useState<TokenSymbol | null>(null);

  // Refresh balances when tongo key is set
  const refreshAll = useCallback(async () => {
    if (!tongoPrivateKey) return;
    for (const t of TOKEN_LIST) {
      await refreshBalance(t.symbol);
    }
  }, [tongoPrivateKey, refreshBalance]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleRollover = async (tokenSymbol: TokenSymbol) => {
    if (!tongoPrivateKey || !address) return;
    setIsRollingOver(tokenSymbol);
    setError(null);
    try {
      const { buildRolloverOp } = await import("@/lib/tongo");
      const { calls } = await buildRolloverOp(tongoPrivateKey, tokenSymbol, address);
      const hash = await execute(calls);
      if (hash) {
        setTxHash(hash);
        await refreshBalance(tokenSymbol);
      } else {
        setError("Rollover transaction failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Rollover failed.");
    } finally {
      setIsRollingOver(null);
    }
  };

  const handleProcess = async () => {
    if (!amount || !isConnected || !tongoPrivateKey || !address) return;
    setIsProcessing(true);
    setTxComplete(false);
    setTxHash(null);
    setError(null);
    try {
      if (mode === "fund") {
        const { buildFundOp } = await import("@/lib/tongo");
        const { calls } = await buildFundOp(tongoPrivateKey, selectedToken.symbol, amount, address);
        const hash = await execute(calls);
        if (hash) {
          setTxHash(hash);
          setTxComplete(true);
          setShowEncrypted(true);
          await refreshBalance(selectedToken.symbol);
          await refreshErc20Balances();
        } else {
          setError("Fund transaction was rejected or failed.");
        }
      } else {
        const { buildWithdrawOp } = await import("@/lib/tongo");
        const { calls } = await buildWithdrawOp(tongoPrivateKey, selectedToken.symbol, amount, address, address);
        const hash = await execute(calls);
        if (hash) {
          setTxHash(hash);
          setTxComplete(true);
          await refreshBalance(selectedToken.symbol);
          await refreshErc20Balances();
        } else {
          setError("Withdraw transaction was rejected or failed.");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed. Please try again.");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setTxComplete(false), 5000);
    }
  };

  const toggleReveal = (symbol: string) => {
    setRevealedBalances((prev) => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex flex-col items-center px-4 pt-8 sm:pt-16 pb-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[480px]">
        {/* Header with mode toggle */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1 bg-surface rounded-2xl p-1">
            {(["fund", "withdraw"] as Mode[]).map((m) => (
              <button key={m} onClick={() => { setMode(m); setAmount(""); setTxComplete(false); setShowEncrypted(false); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === m ? "bg-surface-2 text-foreground" : "text-text-secondary hover:text-foreground"}`}>
                {m === "fund" ? "Encrypt" : "Decrypt"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface text-text-secondary text-xs">
            <Lock className="w-3 h-3 text-primary" /> Tongo
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-surface border border-border p-1.5">
          {/* Input */}
          <div className="rounded-2xl bg-surface-2 p-4 sm:p-5">
            <div className="flex items-center justify-between text-sm text-text-tertiary mb-2">
              <span>{mode === "fund" ? "You deposit" : "You decrypt"}</span>
              <span className="text-xs">
                {mode === "fund"
                  ? `Wallet: ${formatErc20Balance(erc20Balances[selectedToken.symbol], selectedToken.symbol)} ${selectedToken.symbol}`
                  : `Encrypted: ${balances[selectedToken.symbol] ? formatTongoBalance(balances[selectedToken.symbol]!.balance, selectedToken.symbol) : "--"} ${selectedToken.symbol}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-[32px] sm:text-4xl font-medium bg-transparent focus:outline-none placeholder-text-tertiary min-w-0" />
              <button onClick={() => setShowSelector(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface hover:bg-surface-hover border border-border transition-colors shrink-0">
                <TokenIcon symbol={selectedToken.symbol} size="sm" />
                <span className="text-[15px] font-semibold">{selectedToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-surface border-[3px] border-background flex items-center justify-center">
              <ArrowDown className="w-4 h-4 text-text-secondary" />
            </div>
          </div>

          {/* Output */}
          <div className="rounded-2xl bg-surface-2 p-4 sm:p-5">
            <div className="text-sm text-text-tertiary mb-2">
              {mode === "fund" ? "You receive (encrypted)" : "You receive (ERC-20)"}
            </div>
            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                {showEncrypted && mode === "fund" ? (
                  <motion.div key="enc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    <span className="text-[32px] sm:text-4xl font-medium text-primary">***</span>
                  </motion.div>
                ) : (
                  <motion.div key="plain" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <span className={`text-[32px] sm:text-4xl font-medium ${amount ? "" : "text-text-tertiary"}`}>
                      {amount || "0"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="text-text-tertiary text-lg ml-auto">{selectedToken.symbol}</span>
            </div>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={isConnected ? handleProcess : connect}
          disabled={isConnected && (!amount || isProcessing || !tongoPrivateKey)}
          className={`w-full mt-3 py-4 rounded-2xl text-[17px] font-semibold transition-colors flex items-center justify-center gap-2 ${
            !isConnected ? "bg-primary-soft text-primary hover:bg-primary/20"
              : !amount ? "bg-surface-2 text-text-tertiary cursor-not-allowed"
              : txComplete ? "bg-success/15 text-success"
              : "bg-primary hover:bg-primary-hover text-white"
          } disabled:opacity-60`}
        >
          {isProcessing ? (<><Loader2 className="w-5 h-5 animate-spin" /> {mode === "fund" ? "Encrypting..." : "Decrypting..."}</>)
            : txComplete ? (mode === "fund" ? "Encrypted successfully" : "Decrypted successfully")
            : !isConnected ? "Connect Wallet"
            : !amount ? "Enter an amount"
            : mode === "fund" ? (<><Lock className="w-5 h-5" /> Encrypt &amp; Fund</>)
            : (<><Unlock className="w-5 h-5" /> Decrypt &amp; Withdraw</>)}
        </button>

        {/* Error message */}
        {error && (
          <div className="mt-2 p-3 rounded-xl bg-danger/10 text-danger text-sm text-center">
            {error}
          </div>
        )}

        {/* Transaction link */}
        {txHash && (
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <span className="text-text-tertiary">Tx:</span>
            <a href={getExplorerTxUrl(txHash)}
              target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 font-mono text-xs">
              {txHash.slice(0, 10)}...{txHash.slice(-6)} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </motion.div>

      {/* Token modal */}
      <AnimatePresence>
        {showSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowSelector(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="w-full max-w-[400px] rounded-3xl bg-surface border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Select token</h3>
                <button onClick={() => setShowSelector(false)} className="p-1.5 rounded-xl hover:bg-surface-2 transition-colors"><X className="w-5 h-5 text-text-secondary" /></button>
              </div>
              <div className="space-y-1">
                {TOKEN_LIST.map((token) => (
                  <button key={token.symbol} onClick={() => { setSelectedToken(token); setShowSelector(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-surface-2 transition-colors">
                    <TokenIcon symbol={token.symbol} size="lg" />
                    <div className="text-left flex-1"><div className="font-semibold">{token.symbol}</div><div className="text-sm text-text-secondary">{token.name}</div></div>
                    <div className="text-right">
                      <div className="text-sm text-text-tertiary font-mono">{formatErc20Balance(erc20Balances[token.symbol], token.symbol)}</div>
                      <div className="text-[11px] text-text-tertiary font-mono">wallet</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balances */}
      <div className="w-full max-w-[480px] mt-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-text-secondary">Confidential balances</h2>
          {tongoPrivateKey && (
            <button onClick={refreshAll} className="text-xs text-primary hover:underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>
        <div className="space-y-2">
          {TOKEN_LIST.map((token) => {
            const bal = balances[token.symbol];
            const hasPending = bal && bal.pending > 0n;
            return (
              <div key={token.symbol} className="p-3.5 rounded-2xl bg-surface border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={token.symbol} />
                    <div>
                      <div className="text-sm font-semibold">{token.symbol}</div>
                      <div className="text-xs text-text-tertiary">{token.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      {revealedBalances[token.symbol] ? (
                        <div>
                          <span className="text-sm font-mono">{bal ? formatTongoBalance(bal.balance, token.symbol) : "0"}</span>
                          {hasPending && <div className="text-[11px] font-mono text-text-tertiary">+{formatTongoBalance(bal.pending, token.symbol)} pending</div>}
                        </div>
                      ) : (
                        <span className="text-sm font-mono text-text-tertiary">encrypted</span>
                      )}
                    </div>
                    <button onClick={() => toggleReveal(token.symbol)} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                      {revealedBalances[token.symbol] ? <EyeOff className="w-3.5 h-3.5 text-text-tertiary" /> : <Eye className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  </div>
                </div>
                {/* Rollover button when there is a pending balance */}
                {hasPending && revealedBalances[token.symbol] && (
                  <button onClick={() => handleRollover(token.symbol)}
                    disabled={isRollingOver === token.symbol}
                    className="mt-2 w-full py-2 rounded-xl bg-primary-soft text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {isRollingOver === token.symbol ? <><Loader2 className="w-3 h-3 animate-spin" /> Rolling over...</> : <><RefreshCw className="w-3 h-3" /> Rollover pending to balance</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
