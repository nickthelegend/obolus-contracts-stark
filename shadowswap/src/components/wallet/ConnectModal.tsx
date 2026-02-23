"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Connector, useConnect } from "@starknet-react/core";
import { X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

export default function ConnectModal() {
  const { showWalletModal, setShowWalletModal } = useWallet();
  const { connectors, connect } = useConnect();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only show wallets that are actually installed
  const availableConnectors = useMemo(
    () => connectors.filter((c) => c.available()),
    [connectors]
  );

  function handleConnectWallet(connector: Connector) {
    connect({ connector });
    setShowWalletModal(false);
  }

  if (!showWalletModal || !mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) setShowWalletModal(false);
      }}
    >
      <div className="w-full max-w-[380px] rounded-2xl bg-surface border border-border p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">
            Connect a Wallet
          </h3>
          <button
            onClick={() => setShowWalletModal(false)}
            className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Wallet list */}
        <div className="flex flex-col gap-3">
          {availableConnectors.map((connector) => (
            <WalletOption
              key={connector.id}
              connector={connector}
              onClick={() => handleConnectWallet(connector)}
            />
          ))}
        </div>

        <p className="text-xs text-text-tertiary text-center mt-5">
          By connecting, you agree to the Terms of Service
        </p>
      </div>
    </div>,
    document.body
  );
}

function WalletOption({
  connector,
  onClick,
}: {
  connector: Connector;
  onClick: () => void;
}) {
  const icon =
    typeof connector.icon === "object"
      ? (connector.icon.dark as string)
      : (connector.icon as string);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full p-4 rounded-xl border border-border hover:border-border-hover hover:bg-surface-2 transition-all group"
    >
      {icon ? (
        <img
          src={icon}
          alt={connector.name}
          className="w-10 h-10 rounded-xl object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center text-lg font-bold text-primary">
          {connector.name.charAt(0)}
        </div>
      )}
      <div className="text-left flex-1">
        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {connector.name}
        </div>
        <div className="text-sm text-text-secondary">Starknet wallet</div>
      </div>
    </button>
  );
}
