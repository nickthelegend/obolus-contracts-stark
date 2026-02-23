"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { getExplorerContractUrl } from "@/lib/constants";
import {
  Copy,
  Check,
  ExternalLink,
  LogOut,
  ChevronDown,
} from "lucide-react";

export default function ConnectButton() {
  const {
    isConnected,
    isPending,
    address,
    shortAddress,
    connect,
    disconnect,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setDropdownOpen(false);
  };

  // Loading state
  if (isPending) {
    return (
      <button
        disabled
        className="h-10 px-5 rounded-xl bg-surface animate-pulse text-sm font-medium text-text-secondary"
      >
        Connecting...
      </button>
    );
  }

  // Disconnected state
  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="h-10 px-5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  // Connected state — address with dropdown
  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 h-10 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-border text-sm font-medium transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-success" />
        <span>{shortAddress}</span>
        <ChevronDown
          className={`w-4 h-4 text-text-secondary transition-transform ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface border border-border p-1.5 z-50 animate-fade-in">
          <button
            onClick={handleCopy}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-surface-2 transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-text-secondary" />
            )}
            <span>{copied ? "Copied!" : "Copy address"}</span>
          </button>

          <a
            href={address ? getExplorerContractUrl(address) : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-surface-2 transition-colors"
            onClick={() => setDropdownOpen(false)}
          >
            <ExternalLink className="w-4 h-4 text-text-secondary" />
            <span>View on Explorer</span>
          </a>

          <div className="my-1 border-t border-border" />

          <button
            onClick={handleDisconnect}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-surface-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}
