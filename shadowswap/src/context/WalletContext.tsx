"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { hash as starkHash } from "starknet";
import type { TokenSymbol } from "@/lib/constants";
import { getNetwork, getToken } from "@/lib/constants";

/** Generate a random Tongo private key (felt252 on Stark curve). */
function generateTongoKey(): string {
  const bytes = new Uint8Array(31); // 248 bits, safely within felt252 range
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "0x" + hex;
}

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  shortAddress: string;
  // starknet-react connect
  connect: () => void;
  connectors: ReturnType<typeof useConnect>["connectors"];
  connectWallet: ReturnType<typeof useConnect>["connect"];
  disconnect: () => void;
  isPending: boolean;
  showWalletModal: boolean;
  setShowWalletModal: (v: boolean) => void;
  // Tongo key (auto-generated, transparent to user)
  tongoPrivateKey: string | null;
  // Execute transactions via connected wallet
  execute: (calls: unknown[]) => Promise<string | null>;
  // Tongo encrypted balances
  balances: Record<TokenSymbol, { balance: bigint; pending: bigint } | null>;
  refreshBalance: (token: TokenSymbol) => Promise<void>;
  // ERC-20 wallet balances
  erc20Balances: Record<TokenSymbol, bigint | null>;
  refreshErc20Balances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  shortAddress: "",
  connect: () => {},
  connectors: [],
  connectWallet: () => {},
  disconnect: () => {},
  isPending: false,
  showWalletModal: false,
  setShowWalletModal: () => {},
  tongoPrivateKey: null,
  execute: async () => null,
  balances: { ETH: null, USDC: null, STRK: null },
  refreshBalance: async () => {},
  erc20Balances: { ETH: null, USDC: null, STRK: null },
  refreshErc20Balances: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address: rawAddress, account, isConnected } = useAccount();
  const { connect: connectWallet, connectors, isPending } = useConnect();
  const { disconnect: starknetDisconnect } = useDisconnect();

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [tongoPrivateKey, setTongoPrivateKeyState] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<TokenSymbol, { balance: bigint; pending: bigint } | null>>({
    ETH: null,
    USDC: null,
    STRK: null,
  });
  const [erc20Balances, setErc20Balances] = useState<Record<TokenSymbol, bigint | null>>({
    ETH: null,
    USDC: null,
    STRK: null,
  });

  const address = rawAddress ?? null;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  // Auto-generate or restore Tongo private key when wallet connects.
  // Each wallet address gets its own persistent key stored in localStorage.
  React.useEffect(() => {
    if (isConnected && address && !tongoPrivateKey) {
      const storageKey = `tongo_pk_${address}`;
      const savedKey = localStorage.getItem(storageKey);
      if (savedKey) {
        setTongoPrivateKeyState(savedKey);
      } else {
        const newKey = generateTongoKey();
        localStorage.setItem(storageKey, newKey);
        setTongoPrivateKeyState(newKey);
      }
    }
  }, [isConnected, address, tongoPrivateKey]);

  // Fetch ERC-20 wallet balances via direct JSON-RPC call
  const refreshErc20Balances = useCallback(async () => {
    if (!address) return;
    const network = getNetwork();
    const selector = starkHash.getSelectorFromName("balanceOf");
    const tokens: TokenSymbol[] = ["ETH", "USDC", "STRK"];
    const results = await Promise.all(
      tokens.map(async (symbol) => {
        try {
          const token = getToken(symbol);
          const resp = await fetch(network.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "starknet_call",
              params: [
                {
                  contract_address: token.erc20,
                  entry_point_selector: selector,
                  calldata: [address],
                },
                "latest",
              ],
            }),
          });
          const json = await resp.json();
          if (json.result) {
            const low = BigInt(json.result[0] || "0");
            const high = BigInt(json.result[1] || "0");
            return { symbol, balance: low + high * (1n << 128n) };
          }
          return { symbol, balance: null };
        } catch (e) {
          console.error(`Failed to fetch ${symbol} balance:`, e);
          return { symbol, balance: null };
        }
      })
    );
    setErc20Balances((prev) => {
      const next = { ...prev };
      for (const r of results) {
        next[r.symbol] = r.balance;
      }
      return next;
    });
  }, [address]);

  // Auto-fetch ERC-20 balances when wallet connects
  React.useEffect(() => {
    if (isConnected && address) {
      refreshErc20Balances();
    }
  }, [isConnected, address, refreshErc20Balances]);

  const disconnect = useCallback(() => {
    starknetDisconnect();
    setTongoPrivateKeyState(null);
    setBalances({ ETH: null, USDC: null, STRK: null });
    setErc20Balances({ ETH: null, USDC: null, STRK: null });
  }, [starknetDisconnect]);

  const execute = useCallback(
    async (calls: unknown[]): Promise<string | null> => {
      if (!account) return null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await account.execute(calls as any);
        return result?.transaction_hash || null;
      } catch (err) {
        console.error("Transaction failed:", err);
        return null;
      }
    },
    [account]
  );

  const refreshBalance = useCallback(
    async (token: TokenSymbol) => {
      if (!tongoPrivateKey) return;
      try {
        const { getAccountState } = await import("@/lib/tongo");
        const state = await getAccountState(tongoPrivateKey, token);
        setBalances((prev) => ({
          ...prev,
          [token]: { balance: state.balance, pending: state.pending },
        }));
      } catch (err) {
        console.error(`Failed to fetch ${token} balance:`, err);
      }
    },
    [tongoPrivateKey]
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!isConnected,
        shortAddress,
        connect: () => setShowWalletModal(true),
        connectors,
        connectWallet,
        disconnect,
        isPending,
        showWalletModal,
        setShowWalletModal,
        tongoPrivateKey,
        execute,
        balances,
        refreshBalance,
        erc20Balances,
        refreshErc20Balances,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
