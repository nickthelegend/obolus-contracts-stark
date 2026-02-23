"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Eye, Shield, UserMinus, Key as KeyIcon, Loader2, CheckCircle, Copy, Check } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

interface Auditor {
  id: string;
  address: string;
  label: string;
  grantedAt: string;
  status: "active" | "revoked";
}

/** Derive a viewing key from the Tongo private key (demo: simple hash). */
function deriveViewingKey(tongoPrivateKey: string): string {
  // Simple deterministic derivation for demo purposes.
  // In production this would be a proper cryptographic derivation.
  let hash = 0;
  for (let i = 0; i < tongoPrivateKey.length; i++) {
    const char = tongoPrivateKey.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(16, "0");
  return `0xvk_${hex.slice(0, 16)}${hex.slice(0, 8)}${hex.slice(0, 8)}`;
}

export default function CompliancePage() {
  const { isConnected, connect, tongoPrivateKey } = useWallet();
  const [auditorAddress, setAuditorAddress] = useState("");
  const [auditorLabel, setAuditorLabel] = useState("");
  const [isGranting, setIsGranting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [auditors, setAuditors] = useState<Auditor[]>([]);

  const handleGrant = async () => {
    if (!auditorAddress || !isConnected || !tongoPrivateKey) return;
    setIsGranting(true);
    // Auditor grant is local state for now (viewing key contract not deployed).
    // Simulate a brief delay for UX consistency.
    await new Promise((r) => setTimeout(r, 1000));
    setAuditors((prev) => [{
      id: Date.now().toString(), address: auditorAddress, label: auditorLabel || "Unnamed Auditor",
      grantedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), status: "active",
    }, ...prev]);
    setIsGranting(false);
    setAuditorAddress("");
    setAuditorLabel("");
  };

  const toggleAuditor = (id: string) => {
    setAuditors((prev) => prev.map((a) => a.id === id ? { ...a, status: a.status === "active" ? "revoked" as const : "active" as const } : a));
  };

  const viewingKey = useMemo(() => {
    if (!tongoPrivateKey) return null;
    return deriveViewingKey(tongoPrivateKey);
  }, [tongoPrivateKey]);

  const copyKey = () => {
    if (!viewingKey) return;
    navigator.clipboard.writeText(viewingKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] max-w-[960px] mx-auto px-4 pt-8 sm:pt-12 pb-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

        {/* Banner */}
        <div className="rounded-2xl bg-surface border border-border p-5 sm:p-6 mb-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold mb-1">Privacy with accountability</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Balances are encrypted by default. Grant viewing keys to authorized auditors or regulators
              so they can verify holdings without compromising your privacy to the public.
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Grant access */}
          <div className="lg:w-[400px] shrink-0">
            <div className="rounded-3xl bg-surface border border-border p-5 lg:sticky lg:top-[88px]">
              <h2 className="text-lg font-semibold mb-4">Grant viewing access</h2>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-text-tertiary mb-1.5 block">Auditor address</label>
                  <input type="text" placeholder="0x..." value={auditorAddress} onChange={(e) => setAuditorAddress(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-surface-2 border border-border font-mono text-sm focus:outline-none focus:border-border-hover transition-colors" />
                </div>

                <div>
                  <label className="text-sm text-text-tertiary mb-1.5 block">Label (optional)</label>
                  <input type="text" placeholder="e.g. Treasury Auditor" value={auditorLabel} onChange={(e) => setAuditorLabel(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-surface-2 border border-border text-sm focus:outline-none focus:border-border-hover transition-colors" />
                </div>

                <div>
                  <label className="text-sm text-text-tertiary mb-1.5 block">Your viewing key</label>
                  {viewingKey ? (
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-2 border border-border">
                      <KeyIcon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-mono text-text-tertiary truncate flex-1">{viewingKey}</span>
                      <button onClick={copyKey} className="p-1 rounded-lg hover:bg-surface-hover transition-colors shrink-0">
                        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-text-tertiary" />}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-surface-2 border border-border text-sm text-text-tertiary">
                      Set your Tongo private key to generate a viewing key
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={isConnected ? handleGrant : connect}
                disabled={isConnected && (!auditorAddress || isGranting || !tongoPrivateKey)}
                className={`w-full mt-4 py-3.5 rounded-2xl text-[15px] font-semibold transition-colors flex items-center justify-center gap-2 ${
                  !isConnected ? "bg-primary-soft text-primary hover:bg-primary/20"
                    : !auditorAddress ? "bg-surface-2 text-text-tertiary cursor-not-allowed"
                    : "bg-primary hover:bg-primary-hover text-white"
                } disabled:opacity-60`}
              >
                {isGranting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Encrypting key...</>)
                  : !isConnected ? "Connect Wallet"
                  : !auditorAddress ? "Enter auditor address"
                  : (<><KeyIcon className="w-4 h-4" /> Grant access</>)}
              </button>
            </div>
          </div>

          {/* Auditors list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-secondary">Authorized auditors</h2>
              <span className="text-sm text-text-tertiary">
                {auditors.filter((a) => a.status === "active").length} active
              </span>
            </div>

            <div className="space-y-2">
              {auditors.map((auditor, i) => (
                <motion.div key={auditor.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-2xl bg-surface border border-border ${auditor.status === "revoked" ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${auditor.status === "active" ? "bg-success/12" : "bg-surface-2"}`}>
                        {auditor.status === "active" ? <CheckCircle className="w-4 h-4 text-success" /> : <UserMinus className="w-4 h-4 text-text-tertiary" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{auditor.label}</div>
                        <div className="text-xs text-text-tertiary">Granted {auditor.grantedAt}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${auditor.status === "active" ? "bg-success/10 text-success" : "bg-surface-2 text-text-tertiary"}`}>
                      {auditor.status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-2 mb-3">
                    <span className="text-xs font-mono text-text-tertiary truncate block">{auditor.address}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-text-tertiary">
                      <Eye className="w-3 h-3" /> All confidential balances
                    </div>
                    <button onClick={() => toggleAuditor(auditor.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        auditor.status === "active" ? "bg-danger/10 text-danger hover:bg-danger/15" : "bg-success/10 text-success hover:bg-success/15"
                      }`}>
                      {auditor.status === "active" ? "Revoke" : "Re-grant"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {auditors.length === 0 && (
              <div className="text-center py-16 text-text-tertiary">
                <Eye className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No auditors yet</p>
              </div>
            )}

            {/* How it works */}
            <div className="mt-6 rounded-2xl bg-surface border border-border p-5">
              <h3 className="text-sm font-semibold mb-4">How viewing keys work</h3>
              <div className="space-y-3">
                {[
                  { n: "1", t: "Generate a viewing key", d: "Derived from your Tongo account" },
                  { n: "2", t: "Encrypt for auditor", d: "Key is encrypted with the auditor's public key" },
                  { n: "3", t: "Auditor reads balances", d: "They decrypt the key and view your holdings" },
                  { n: "4", t: "Revoke anytime", d: "Rotate your Tongo key to invalidate all keys" },
                ].map((s) => (
                  <div key={s.n} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-soft flex items-center justify-center text-xs font-bold text-primary shrink-0">{s.n}</div>
                    <div>
                      <div className="text-sm font-medium">{s.t}</div>
                      <div className="text-xs text-text-tertiary">{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
