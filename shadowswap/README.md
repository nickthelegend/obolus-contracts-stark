# ShadowSwap — Confidential DeFi on Starknet

> Trade tokens without revealing your amounts. Privacy-preserving DEX powered by Tongo encryption on Starknet.

![Starknet](https://img.shields.io/badge/Starknet-Sepolia-blue) ![Tongo](https://img.shields.io/badge/Tongo-ElGamal-purple) ![License](https://img.shields.io/badge/license-MIT-green)

---

## The Problem

DeFi is transparent by default. Every swap amount, every balance, every limit order is visible on-chain. This exposes traders to:

- **Front-running** — MEV bots see your trade size and sandwich you
- **Portfolio tracking** — Anyone can monitor your full financial position
- **Order book sniping** — Limit order prices are visible before execution

Traditional finance has privacy. DeFi doesn't. Until now.

## Our Solution

**ShadowSwap** brings confidential trading to Starknet using the **Tongo protocol** (ElGamal encryption). Users can:

1. **Fund** — Deposit ERC-20 tokens and encrypt them into confidential balances
2. **Swap** — Exchange tokens with fully encrypted amounts (invisible on-chain)
3. **Place sealed orders** — Submit limit orders where price and size are encrypted until matched
4. **Grant viewing keys** — Selectively allow auditors to verify balances (compliance-ready)

All encryption happens client-side. Zero-knowledge proofs verify correctness without revealing values.

## How It Works

```
                    ┌──────────────────────────────────────────────────┐
                    │                   USER WALLET                    │
                    │            (ArgentX / Braavos)                   │
                    └─────────────────────┬────────────────────────────┘
                                          │
                    ┌─────────────────────▼────────────────────────────┐
                    │              ShadowSwap Frontend                  │
                    │          Next.js + starknet.js + Tongo SDK        │
                    │                                                  │
                    │  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
                    │  │   Fund   │ │   Swap   │ │ Sealed Orders   │  │
                    │  │ Page     │ │ Page     │ │ Page            │  │
                    │  └────┬─────┘ └────┬─────┘ └───────┬─────────┘  │
                    │       │            │               │            │
                    │  ┌────▼────────────▼───────────────▼─────────┐  │
                    │  │         Tongo SDK (Client-side)            │  │
                    │  │    ZK Proof Generation + ElGamal Encrypt   │  │
                    │  └──────────────────┬────────────────────────┘  │
                    └─────────────────────┬────────────────────────────┘
                                          │
                    ┌─────────────────────▼────────────────────────────┐
                    │              Starknet (Sepolia)                   │
                    │                                                  │
                    │  ┌─────────────┐  ┌─────────────┐               │
                    │  │ Tongo ETH   │  │ Tongo USDC  │  ...          │
                    │  │ Contract    │  │ Contract    │               │
                    │  │ (ElGamal)   │  │ (ElGamal)   │               │
                    │  └─────────────┘  └─────────────┘               │
                    │                                                  │
                    │  ┌─────────────────────────────────────────────┐ │
                    │  │         ShadowSwap Contracts                 │ │
                    │  │  ShadowPool │ SealedOrderbook │ ViewingKey  │ │
                    │  └─────────────────────────────────────────────┘ │
                    └──────────────────────────────────────────────────┘
```

### Encryption Flow

1. User deposits 100 USDC → Tongo encrypts to `(L, R)` ElGamal ciphertext
2. On-chain, the balance shows `(0x3a7f..., 0x8b2c...)` — unreadable without private key
3. User swaps encrypted USDC for encrypted ETH — amounts never appear in plaintext
4. ZK proofs verify: balance ≥ 0, amounts positive, CPMM invariant holds
5. Only the user (with their Tongo private key) can decrypt and see real amounts

## Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Confidential Fund/Withdraw** | Encrypt ERC-20 ↔ confidential balance via Tongo | ✅ Live |
| **Private Swap** | Swap with encrypted amounts, invisible on-chain | ✅ Live |
| **Sealed-Bid Orders** | Limit orders with encrypted price & amount | ✅ Live |
| **Viewing Keys** | Grant/revoke auditor access to balances | ✅ Live |
| **Wallet Connect** | ArgentX & Braavos support | ✅ Live |
| **Balance Reveal** | Client-side decryption with eye toggle | ✅ Live |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Cairo 2.x on Starknet |
| **Privacy Protocol** | [Tongo](https://docs.tongo.cash) — ElGamal encryption + ZK proofs |
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS |
| **Wallet** | starknet.js v8, ArgentX / Braavos |
| **Animation** | Framer Motion |
| **Deployment** | Vercel (frontend), Starknet Sepolia (contracts) |

## Tongo Integration

ShadowSwap deeply integrates the **Tongo SDK** (`@fatsolutions/tongo-sdk`):

- **`fund()`** — Converts ERC-20 tokens to encrypted ElGamal balances on-chain
- **`transfer()`** — Sends encrypted amounts between accounts (used by swap & orders)
- **`withdraw()`** — Converts encrypted balance back to standard ERC-20
- **`rollover()`** — Consolidates pending incoming transfers into usable balance
- **Client-side ZK proofs** — All proofs generated in-browser before transaction submission

### Tongo Contract Addresses (Sepolia)

| Token | Tongo Contract |
|-------|---------------|
| ETH | `0x2cf0dc1d9e8c7731353dd15e6f2f22140120ef2d27116b982fa4fed87f6fef5` |
| USDC | `0x2caae365e67921979a4e5c16dd70eaa5776cfc6a9592bcb903d91933aaf2552` |
| STRK | `0x408163bfcfc2d76f34b444cb55e09dace5905cf84c0884e4637c2c0f06ab6ed` |

## Deployed Links

- **Live App**: [shadowswap-rust.vercel.app](https://shadowswap-rust.vercel.app)
- **GitHub**: [github.com/obseasd/shadowswap](https://github.com/obseasd/shadowswap)

## Getting Started

### Prerequisites

- Node.js 18+
- ArgentX or Braavos wallet (Starknet Sepolia)
- Sepolia ETH for gas ([faucet](https://starknet-faucet.vercel.app/))

### Install & Run

```bash
git clone https://github.com/obseasd/shadowswap.git
cd shadowswap
npm install
cp .env.example .env.local
# Edit .env.local with your RPC URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|----------|-----------|
| `NEXT_PUBLIC_RPC_URL` | Starknet Sepolia RPC endpoint |
| `NEXT_PUBLIC_NETWORK` | `sepolia` or `mainnet` |

## Project Structure

```
shadowswap/
├── contracts/            # Cairo smart contracts
│   └── src/
│       ├── lib.cairo
│       ├── confidential_token.cairo
│       ├── shadow_pool.cairo
│       ├── sealed_orderbook.cairo
│       └── viewing_key.cairo
├── src/
│   ├── app/              # Next.js pages
│   │   ├── page.tsx      # Landing
│   │   ├── fund/         # Fund/Withdraw
│   │   ├── swap/         # Private swap
│   │   ├── orders/       # Sealed orderbook
│   │   └── compliance/   # Viewing keys
│   ├── components/       # UI components
│   ├── context/          # Wallet + Tongo state
│   └── lib/              # SDK integration
│       ├── constants.ts  # Contract addresses, network config
│       └── tongo.ts      # Tongo SDK wrapper
└── .env.example
```

## Privacy Model

| What's Hidden | What's Public |
|--------------|--------------|
| Token balances | That you have an account |
| Swap amounts | That a swap occurred |
| Order prices & sizes | Order side (BUY/SELL) |
| Transfer amounts | Transfer event |
| Portfolio composition | Wallet address |

### Viewing Keys (Compliance)

ShadowSwap implements **selective disclosure** via viewing keys:

1. Owner generates a viewing key from their Tongo private key
2. Key is encrypted with the auditor's public key (only they can use it)
3. Auditor decrypts balances without the public seeing them
4. Owner can revoke access by rotating their Tongo key

This proves that **privacy ≠ secrecy** — compliance is built-in, not bolted on.

## Why ShadowSwap Wins

1. **Deep Tongo integration** — Not a wrapper. Fund, transfer, withdraw, rollover, viewing keys — all used
2. **Real privacy** — ElGamal encryption on-chain, ZK proofs verify correctness
3. **Unique sealed-bid orderbook** — Nobody else is building encrypted limit orders on Starknet
4. **Compliance-ready** — Viewing keys show we think beyond "privacy for privacy's sake"
5. **Working demo** — Deployed on Sepolia with live transactions
6. **Clean UX** — Uniswap-inspired interface, not a technical demo

## Team

Solo developer — built in 5 days for the Starknet hackathon.

---

*Built with Tongo Protocol on Starknet. Privacy is a right, not a feature.*
