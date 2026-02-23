"use client";

import { Lock, Eye, ArrowLeftRight, BookOpen, ArrowRight, Zap } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";

const features = [
  {
    icon: Lock,
    title: "Encrypted Balances",
    description:
      "Token amounts are encrypted with ElGamal via Tongo. No one sees your holdings.",
  },
  {
    icon: ArrowLeftRight,
    title: "Private Swaps",
    description:
      "Trade without revealing amounts. Swap sizes stay hidden from all on-chain observers.",
  },
  {
    icon: BookOpen,
    title: "Sealed Orders",
    description:
      "Limit orders with encrypted price and size. Only revealed when matched.",
  },
  {
    icon: Eye,
    title: "Viewing Keys",
    description:
      "Grant auditors selective read access. Privacy with accountability built in.",
  },
];

export default function Home() {
  const { isConnected, connect } = useWallet();

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="absolute top-[60%] -right-40 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.05] blur-[100px]" />
      </div>

      <section className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-[680px] mx-auto"
        >
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.1] tracking-tight mb-5">
            Trade with{" "}
            <span className="bg-gradient-to-r from-primary via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              complete privacy
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary max-w-[520px] mx-auto mb-10 leading-relaxed">
            Confidential DeFi on Starknet. Encrypted balances, private swaps, and
            sealed-bid orders powered by Tongo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isConnected ? (
              <Link
                href="/swap"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
              >
                Launch App <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={connect}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <a
              href="https://docs.tongo.cash"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-medium bg-surface hover:bg-surface-hover text-text-secondary hover:text-foreground transition-colors"
            >
              Learn More
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-8 sm:gap-14 mt-20"
        >
          {[
            { val: "Tongo", label: "Encryption Protocol" },
            { val: "ElGamal", label: "Cipher" },
            { val: "100%", label: "On-chain Privacy" },
            { val: "Starknet", label: "Network" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold">{s.val}</div>
              <div className="text-sm text-text-tertiary mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-6 rounded-2xl bg-surface border border-border hover:border-border-hover transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-[15px] font-semibold mb-1.5 group-hover:text-primary transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">How It Works</h2>
          <p className="text-text-secondary">Three steps to private trading</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 max-w-[800px] mx-auto">
          {[
            { n: "1", title: "Fund", desc: "Deposit tokens and encrypt them via Tongo. Your balance becomes confidential.", icon: Lock },
            { n: "2", title: "Trade", desc: "Swap or place sealed orders. All amounts are encrypted on-chain.", icon: ArrowLeftRight },
            { n: "3", title: "Withdraw", desc: "Convert back to standard ERC-20 anytime you want.", icon: Zap },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-6"
              >
                <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Step {s.n}</div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{s.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pb-24">
        <div className="rounded-3xl bg-surface border border-border p-10 sm:p-16 text-center">
          <Image src="/logo.svg" alt="ShadowSwap" width={40} height={40} className="w-10 h-10 mx-auto mb-6" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to trade privately?</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            Connect your wallet and start making confidential swaps on Starknet.
          </p>
          {isConnected ? (
            <Link href="/fund" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-primary hover:bg-primary-hover text-white transition-colors">
              Fund Account <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button onClick={connect} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-primary hover:bg-primary-hover text-white transition-colors">
              Connect Wallet <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-text-tertiary text-sm">
            <Image src="/logo.svg" alt="" width={16} height={16} className="w-4 h-4" /> ShadowSwap
          </div>
          <div className="flex items-center gap-6 text-sm text-text-tertiary">
            <a href="https://docs.tongo.cash" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Tongo Docs</a>
            <a href="https://starknet.io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Starknet</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
