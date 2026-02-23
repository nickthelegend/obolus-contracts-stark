"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, X, ExternalLink } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import TokenIcon from "@/components/TokenIcon";
import { getExplorerTxUrl } from "@/lib/constants";

interface SealedOrder {
  id: string;
  side: "BUY" | "SELL";
  pair: string;
  baseSymbol: string;
  quoteSymbol: string;
  price: string;
  amount: string;
  status: "active" | "matched" | "cancelled";
  time: string;
  revealed: boolean;
  txHash?: string;
}

export default function OrdersPage() {
  const { isConnected, connect, address, tongoPrivateKey, execute, refreshBalance } = useWallet();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [tab, setTab] = useState<"all" | "active" | "matched">("all");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [orders, setOrders] = useState<SealedOrder[]>([]);

  const handlePlaceOrder = async () => {
    if (!price || !amount || !isConnected || !tongoPrivateKey || !address) return;
    setIsPlacing(true);
    setTxHash(null);
    setError(null);
    try {
      // Placing an order is a commitment: transfer the order amount as an encrypted transfer.
      // For a BUY order on ETH/USDC, we commit USDC (price * amount).
      // For a SELL order, we commit ETH (amount).
      const { buildTransferOp } = await import("@/lib/tongo");
      const commitToken = side === "BUY" ? "USDC" : "ETH";
      const commitAmount = side === "BUY" ? (parseFloat(price) * parseFloat(amount)).toString() : amount;
      // Orderbook public key (valid EC point on Stark curve)
      const orderbookPublicKey = {
        x: "627088272801405713560985229077786158610581355215145837257248988047835443922",
        y: "962306405833205337611861169387935900858447421343428280515103558221889311122",
      };
      const { calls } = await buildTransferOp(tongoPrivateKey, commitToken, orderbookPublicKey, commitAmount, address);
      const hash = await execute(calls);
      if (hash) {
        setTxHash(hash);
        setOrders((prev) => [{
          id: Date.now().toString(), side, pair: "ETH/USDC", baseSymbol: "ETH", quoteSymbol: "USDC",
          price, amount, status: "active", time: "Just now", revealed: false, txHash: hash,
        }, ...prev]);
        await refreshBalance(commitToken as "ETH" | "USDC" | "STRK");
        setPrice("");
        setAmount("");
      } else {
        setError("Order transaction was rejected or failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setIsPlacing(false);
    }
  };

  const cancelOrder = (id: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "cancelled" as const } : o)));
  };

  const toggleReveal = (id: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, revealed: !o.revealed } : o)));
  };

  const filtered = orders.filter((o) => tab === "all" ? true : o.status === tab);

  return (
    <div className="min-h-[calc(100vh-72px)] max-w-[960px] mx-auto px-4 pt-8 sm:pt-12 pb-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Create order */}
          <div className="lg:w-[380px] shrink-0">
            <div className="rounded-3xl bg-surface border border-border p-5 lg:sticky lg:top-[88px]">
              <h2 className="text-lg font-semibold mb-4">New sealed order</h2>

              {/* Side */}
              <div className="flex gap-1.5 p-1 rounded-2xl bg-surface-2 mb-4">
                {(["BUY", "SELL"] as const).map((s) => (
                  <button key={s} onClick={() => setSide(s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      side === s ? (s === "BUY" ? "bg-success text-white" : "bg-danger text-white") : "text-text-secondary hover:text-foreground"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Pair display */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-2 mb-4">
                <div className="flex -space-x-2">
                  <TokenIcon symbol="ETH" size="sm" />
                  <TokenIcon symbol="USDC" size="sm" />
                </div>
                <span className="font-semibold text-sm">ETH / USDC</span>
              </div>

              {/* Price */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm text-text-tertiary mb-1.5">
                  <span>Price (USDC)</span>
                  <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-primary" /> Sealed</span>
                </div>
                <input type="number" inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-surface-2 border border-border text-lg font-medium focus:outline-none focus:border-border-hover transition-colors" />
              </div>

              {/* Amount */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-text-tertiary mb-1.5">
                  <span>Amount (ETH)</span>
                  <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-primary" /> Sealed</span>
                </div>
                <input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-surface-2 border border-border text-lg font-medium focus:outline-none focus:border-border-hover transition-colors" />
              </div>

              {/* Total */}
              {price && amount && (
                <div className="p-3 rounded-xl bg-surface-2 flex justify-between text-sm mb-4">
                  <span className="text-text-secondary">Total</span>
                  <span className="font-mono">{(parseFloat(price) * parseFloat(amount)).toLocaleString()} USDC</span>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={isConnected ? handlePlaceOrder : connect}
                disabled={isConnected && (!price || !amount || isPlacing || !tongoPrivateKey)}
                className={`w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2 ${
                  !isConnected ? "bg-primary-soft text-primary hover:bg-primary/20"
                    : !price || !amount ? "bg-surface-2 text-text-tertiary cursor-not-allowed"
                    : side === "BUY" ? "bg-success hover:bg-success/90 text-white"
                    : "bg-danger hover:bg-danger/90 text-white"
                } disabled:opacity-60`}
              >
                {isPlacing ? (<><Loader2 className="w-4 h-4 animate-spin" /> Placing...</>)
                  : !isConnected ? "Connect Wallet"
                  : !price || !amount ? "Enter price & amount"
                  : (<><Lock className="w-4 h-4" /> Place sealed {side.toLowerCase()}</>)}
              </button>

              {/* Error message */}
              {error && (
                <div className="mt-2 p-2.5 rounded-xl bg-danger/10 text-danger text-xs text-center">
                  {error}
                </div>
              )}

              {/* Transaction link */}
              {txHash && (
                <div className="mt-2 flex items-center justify-center gap-2 text-xs">
                  <span className="text-text-tertiary">Tx:</span>
                  <a href={getExplorerTxUrl(txHash)}
                    target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 font-mono">
                    {txHash.slice(0, 10)}...{txHash.slice(-6)} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <p className="text-xs text-text-tertiary mt-3 text-center">
                Price and amount are encrypted on-chain until matched
              </p>
            </div>
          </div>

          {/* Orders list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 bg-surface rounded-2xl p-1">
                {(["all", "active", "matched"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-medium capitalize transition-colors ${tab === t ? "bg-surface-2 text-foreground" : "text-text-secondary hover:text-foreground"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-sm text-text-tertiary">{filtered.length} orders</span>
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((order) => (
                  <motion.div key={order.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`p-4 rounded-2xl bg-surface border border-border ${order.status === "cancelled" ? "opacity-40" : ""}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${order.side === "BUY" ? "bg-success/12 text-success" : "bg-danger/12 text-danger"}`}>
                          {order.side}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                            <TokenIcon symbol={order.baseSymbol} size="sm" />
                            <TokenIcon symbol={order.quoteSymbol} size="sm" />
                          </div>
                          <span className="text-sm font-semibold">{order.pair}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          order.status === "active" ? "bg-success/10 text-success"
                            : order.status === "matched" ? "bg-primary-soft text-primary"
                            : "bg-surface-2 text-text-tertiary"
                        }`}>{order.status}</span>
                      </div>
                      <span className="text-xs text-text-tertiary">{order.time}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-8">
                        <div>
                          <div className="text-[11px] text-text-tertiary uppercase tracking-wider mb-0.5">Price</div>
                          {order.revealed ? <span className="text-sm font-mono">{order.price}</span>
                            : <span className="text-sm text-text-tertiary flex items-center gap-1"><Lock className="w-3 h-3" /> Sealed</span>}
                        </div>
                        <div>
                          <div className="text-[11px] text-text-tertiary uppercase tracking-wider mb-0.5">Amount</div>
                          {order.revealed ? <span className="text-sm font-mono">{order.amount}</span>
                            : <span className="text-sm text-text-tertiary flex items-center gap-1"><Lock className="w-3 h-3" /> Sealed</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleReveal(order.id)} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                          {order.revealed ? <EyeOff className="w-4 h-4 text-text-tertiary" /> : <Eye className="w-4 h-4 text-primary" />}
                        </button>
                        {order.txHash && (
                          <a href={getExplorerTxUrl(order.txHash)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                            <ExternalLink className="w-4 h-4 text-text-tertiary" />
                          </a>
                        )}
                        {order.status === "active" && (
                          <button onClick={() => cancelOrder(order.id)} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                            <X className="w-4 h-4 text-text-tertiary hover:text-danger" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-text-tertiary">
                <Lock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No {tab === "all" ? "" : tab} orders</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
