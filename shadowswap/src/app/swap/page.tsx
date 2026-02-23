"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, Lock, Settings, Loader2, ChevronDown, Eye, EyeOff, ExternalLink, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import TokenIcon from "@/components/TokenIcon";
import { type TokenSymbol, getToken, getExplorerTxUrl } from "@/lib/constants";

const TOKEN_LIST: { symbol: TokenSymbol; name: string }[] = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "STRK", name: "Starknet Token" },
];

/** Compute a rate between two tokens using their Tongo rates (ERC20/Tongo unit).
 *  Rate = tokenIn.rate / tokenOut.rate  (as a float for display).
 */
function getSwapRate(from: TokenSymbol, to: TokenSymbol): number {
  const fromToken = getToken(from);
  const toToken = getToken(to);
  // rate field = ERC20 units per 1 Tongo unit
  // price of 1 tokenIn in tokenOut = (fromToken.rate / fromToken_decimals) / (toToken.rate / toToken_decimals)
  // Simplified: since both are bigint rates mapping to the same Tongo unit scale,
  // 1 Tongo-unit of tokenIn = fromToken.rate ERC20 of tokenIn
  // 1 Tongo-unit of tokenOut = toToken.rate ERC20 of tokenOut
  // So 1 ERC20 of tokenIn = (1/fromToken.rate) tongo units, which equals (toToken.rate / fromToken.rate) ERC20 of tokenOut... no.
  // Actually: 1 ERC20-unit of tokenIn = 1/fromToken.rate Tongo units. Converting that many Tongo units of tokenOut = (1/fromToken.rate) * toToken.rate ERC20-units of tokenOut.
  // But we want user-facing amounts (considering decimals).
  const fromDec = 10 ** fromToken.decimals;
  const toDec = 10 ** toToken.decimals;
  // 1 human-unit of tokenIn = fromDec ERC20 wei of tokenIn
  // = (fromDec / Number(fromToken.rate)) tongo-units
  // each tongo-unit of tokenOut = Number(toToken.rate) ERC20 wei of tokenOut = Number(toToken.rate)/toDec human-units
  // So 1 human-unit tokenIn => (fromDec / Number(fromToken.rate)) * (Number(toToken.rate) / toDec) human-units tokenOut
  return (fromDec / Number(fromToken.rate)) * (Number(toToken.rate) / toDec);
}

function formatBalance(raw: bigint | undefined | null, symbol: TokenSymbol): string {
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

// Demo pool public key (Stark curve secondary generator - a valid EC point)
const POOL_PUBLIC_KEY = {
  x: "627088272801405713560985229077786158610581355215145837257248988047835443922",
  y: "962306405833205337611861169387935900858447421343428280515103558221889311122",
};

interface SwapTx {
  id: string;
  from: string;
  to: string;
  amountIn: string;
  amountOut: string;
  time: string;
  hash: string;
  revealed: boolean;
}

export default function SwapPage() {
  const { isConnected, connect, address, tongoPrivateKey, execute, balances, refreshBalance } = useWallet();
  const [tokenIn, setTokenIn] = useState(TOKEN_LIST[0]);
  const [tokenOut, setTokenOut] = useState(TOKEN_LIST[1]);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapComplete, setSwapComplete] = useState(false);
  const [selectingFor, setSelectingFor] = useState<"in" | "out" | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<SwapTx[]>([]);

  // Refresh balances for swap tokens
  const refreshSwapBalances = useCallback(async () => {
    if (!tongoPrivateKey) return;
    await refreshBalance(tokenIn.symbol);
    await refreshBalance(tokenOut.symbol);
  }, [tongoPrivateKey, refreshBalance, tokenIn.symbol, tokenOut.symbol]);

  useEffect(() => {
    refreshSwapBalances();
  }, [refreshSwapBalances]);

  const rate = getSwapRate(tokenIn.symbol, tokenOut.symbol);
  const estimatedOut = amountIn ? (parseFloat(amountIn) * rate).toFixed(tokenOut.symbol === "USDC" ? 2 : 6) : "";

  const flipTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
  };

  const handleSwap = async () => {
    if (!amountIn || !isConnected || !tongoPrivateKey || !address) return;
    setIsSwapping(true);
    setSwapComplete(false);
    setTxHash(null);
    setError(null);
    try {
      // For the hackathon demo, a "swap" is modeled as:
      // 1. Transfer tokenIn from user's encrypted balance (sends to a pool/burn address conceptually)
      // 2. The pool would transfer tokenOut back. For demo we just do the outgoing transfer.
      const { buildTransferOp } = await import("@/lib/tongo");
      const { calls } = await buildTransferOp(tongoPrivateKey, tokenIn.symbol, POOL_PUBLIC_KEY, amountIn, address);
      const hash = await execute(calls);
      if (hash) {
        setTxHash(hash);
        setSwapComplete(true);
        setHistory((prev) => [
          {
            id: Date.now().toString(),
            from: tokenIn.symbol,
            to: tokenOut.symbol,
            amountIn,
            amountOut: estimatedOut,
            time: "Just now",
            hash,
            revealed: false,
          },
          ...prev,
        ]);
        await refreshBalance(tokenIn.symbol);
        await refreshBalance(tokenOut.symbol);
        setTimeout(() => { setSwapComplete(false); setAmountIn(""); }, 3000);
      } else {
        setError("Swap transaction was rejected or failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Swap failed. Please try again.");
    } finally {
      setIsSwapping(false);
    }
  };

  const toggleRevealTx = (id: string) => {
    setHistory((prev) => prev.map((tx) => (tx.id === id ? { ...tx, revealed: !tx.revealed } : tx)));
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex flex-col items-center px-4 pt-8 sm:pt-16 pb-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[480px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h1 className="text-lg font-semibold">Swap</h1>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-xl hover:bg-surface transition-colors">
            <Settings className={`w-[18px] h-[18px] ${showSettings ? "text-primary" : "text-text-secondary"}`} />
          </button>
        </div>

        {/* Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Slippage</span>
                  <div className="flex gap-1.5">
                    {["0.1", "0.5", "1.0"].map((val) => (
                      <button key={val} onClick={() => setSlippage(val)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${slippage === val ? "bg-primary-soft text-primary" : "bg-surface-2 text-text-secondary hover:text-foreground"}`}>
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swap card */}
        <div className="rounded-3xl bg-surface border border-border p-1.5">
          {/* Pay */}
          <div className="rounded-2xl bg-surface-2 p-4 sm:p-5">
            <div className="flex items-center justify-between text-sm text-text-tertiary mb-2">
              <span>You pay</span>
              <span className="text-xs">Bal: {balances[tokenIn.symbol] ? formatBalance(balances[tokenIn.symbol]!.balance, tokenIn.symbol) : "--"}</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="number" inputMode="decimal" placeholder="0" value={amountIn} onChange={(e) => setAmountIn(e.target.value)}
                className="flex-1 text-[32px] sm:text-4xl font-medium bg-transparent focus:outline-none placeholder-text-tertiary min-w-0" />
              <button onClick={() => setSelectingFor("in")}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface hover:bg-surface-hover border border-border transition-colors shrink-0">
                <TokenIcon symbol={tokenIn.symbol} size="sm" />
                <span className="text-[15px] font-semibold">{tokenIn.symbol}</span>
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
          </div>

          {/* Flip */}
          <div className="flex justify-center -my-3 relative z-10">
            <button onClick={flipTokens}
              className="w-9 h-9 rounded-xl bg-surface border-[3px] border-background flex items-center justify-center hover:bg-surface-hover transition-colors group">
              <ArrowDown className="w-4 h-4 text-text-secondary group-hover:text-foreground transition-colors" />
            </button>
          </div>

          {/* Receive */}
          <div className="rounded-2xl bg-surface-2 p-4 sm:p-5">
            <div className="flex items-center justify-between text-sm text-text-tertiary mb-2">
              <span>You receive</span>
              <span className="text-xs">Bal: {balances[tokenOut.symbol] ? formatBalance(balances[tokenOut.symbol]!.balance, tokenOut.symbol) : "--"}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {estimatedOut && <Lock className="w-4 h-4 text-primary shrink-0" />}
                <span className={`text-[32px] sm:text-4xl font-medium truncate ${estimatedOut ? "" : "text-text-tertiary"}`}>
                  {estimatedOut || "0"}
                </span>
              </div>
              <button onClick={() => setSelectingFor("out")}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface hover:bg-surface-hover border border-border transition-colors shrink-0">
                <TokenIcon symbol={tokenOut.symbol} size="sm" />
                <span className="text-[15px] font-semibold">{tokenOut.symbol}</span>
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
          </div>
        </div>

        {/* Rate */}
        {amountIn && (
          <div className="mt-3 p-4 rounded-2xl bg-surface border border-border space-y-2.5">
            <div className="flex justify-between text-sm"><span className="text-text-secondary">Rate</span><span>1 {tokenIn.symbol} = {rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenOut.symbol}</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-secondary">Slippage</span><span>{slippage}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-secondary">Privacy</span><span className="flex items-center gap-1 text-primary"><Lock className="w-3.5 h-3.5" /> Encrypted</span></div>
          </div>
        )}

        {/* Button */}
        <button
          onClick={isConnected ? handleSwap : connect}
          disabled={isConnected && (!amountIn || isSwapping || !tongoPrivateKey)}
          className={`w-full mt-3 py-4 rounded-2xl text-[17px] font-semibold transition-colors flex items-center justify-center gap-2 ${
            !isConnected ? "bg-primary-soft text-primary hover:bg-primary/20"
              : !amountIn ? "bg-surface-2 text-text-tertiary cursor-not-allowed"
              : swapComplete ? "bg-success/15 text-success"
              : "bg-primary hover:bg-primary-hover text-white"
          } disabled:opacity-60`}
        >
          {isSwapping ? (<><Loader2 className="w-5 h-5 animate-spin" /> Swapping...</>)
            : swapComplete ? "Swap successful"
            : !isConnected ? "Connect Wallet"
            : !amountIn ? "Enter an amount"
            : "Swap"}
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
        {selectingFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectingFor(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="w-full max-w-[400px] rounded-3xl bg-surface border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Select token</h3>
                <button onClick={() => setSelectingFor(null)} className="p-1.5 rounded-xl hover:bg-surface-2 transition-colors"><X className="w-5 h-5 text-text-secondary" /></button>
              </div>
              <div className="space-y-1">
                {TOKEN_LIST.filter((t) => (selectingFor === "in" ? t.symbol !== tokenOut.symbol : t.symbol !== tokenIn.symbol)).map((token) => (
                  <button key={token.symbol} onClick={() => { if (selectingFor === "in") setTokenIn(token); else setTokenOut(token); setSelectingFor(null); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-surface-2 transition-colors">
                    <TokenIcon symbol={token.symbol} size="lg" />
                    <div className="text-left flex-1"><div className="font-semibold">{token.symbol}</div><div className="text-sm text-text-secondary">{token.name}</div></div>
                    <span className="text-sm text-text-tertiary font-mono">
                      {balances[token.symbol] ? formatBalance(balances[token.symbol]!.balance, token.symbol) : "--"}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && (
        <div className="w-full max-w-[480px] mt-8">
          <h2 className="text-sm font-semibold text-text-secondary mb-3 px-1">Recent transactions</h2>
          <div className="space-y-2">
            {history.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center shrink-0"><Lock className="w-4 h-4 text-primary" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{tx.from} &rarr; {tx.to}</div>
                    <div className="text-xs text-text-tertiary">{tx.time}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <div className="text-right">
                    {tx.revealed ? (
                      <div className="text-xs font-mono"><span className="text-text-secondary">-{tx.amountIn}</span> <span className="text-success">+{tx.amountOut}</span></div>
                    ) : (<span className="text-xs text-text-tertiary font-mono">encrypted</span>)}
                  </div>
                  <button onClick={() => toggleRevealTx(tx.id)} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                    {tx.revealed ? <EyeOff className="w-3.5 h-3.5 text-text-tertiary" /> : <Eye className="w-3.5 h-3.5 text-primary" />}
                  </button>
                  <a href={getExplorerTxUrl(tx.hash)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"><ExternalLink className="w-3.5 h-3.5 text-text-tertiary" /></a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
