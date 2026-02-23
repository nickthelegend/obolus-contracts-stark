"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ConnectButton from "@/components/wallet/ConnectButton";
import ConnectModal from "@/components/wallet/ConnectModal";

const navItems = [
  { href: "/fund", label: "Fund" },
  { href: "/swap", label: "Swap" },
  { href: "/orders", label: "Orders" },
  { href: "/compliance", label: "Compliance" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[72px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="ShadowSwap" width={32} height={32} className="w-8 h-8" />
            <span className="text-[17px] font-semibold tracking-tight">
              ShadowSwap
            </span>
          </Link>

          {/* Desktop Nav - centered */}
          <div className="hidden md:flex items-center gap-1 bg-surface rounded-2xl p-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-xl text-[15px] font-medium transition-colors ${
                    isActive
                      ? "bg-surface-2 text-foreground"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5">
            {/* Network badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface text-text-secondary text-sm">
              <div className="w-2 h-2 rounded-full bg-success" />
              Mainnet
            </div>

            {/* Wallet connect button */}
            <ConnectButton />

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl text-text-secondary hover:text-foreground hover:bg-surface transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-background"
          >
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                      isActive
                        ? "bg-surface text-foreground"
                        : "text-text-secondary hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet chooser modal (rendered as portal) */}
      <ConnectModal />
    </nav>
  );
}
