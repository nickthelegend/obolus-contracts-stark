# ☘️ Obolus

**The first sub-second price prediction market on Starknet.**

Powered by **Starknet** + **Pyth Hermes** price attestations + **Off-chain state (Supabase)**.

Simply put: *Trade binary options with oracle-bound resolution and minimal trust, built for the speed of modern Web3.*

---

## Why Obolus?

Binary options trading in Web3 is often slow or opaque. Obolus leverages Starknet's high-performance infrastructure to deliver an experience that rivals Web2 platforms but with the transparency of the blockchain.

- **Sub-second oracles.** Every tick is backed by Pyth oracles.
- **Predict in Real-time.** Trade on live charts with instant settlement.
- **Starknet Powered.** Leveraging the scalability of ZK-rollups for secure and fast operations.

---

## What You Get

- **Real-time resolution** — Pyth Hermes drives millisecond-level price attestations.
- **20+ markets** — Crypto (BTC, ETH, STRK, SOL, …), stocks (AAPL, NVDA, TSLA), metals (Gold, Silver), forex (EUR, GBP, JPY).
- **Starknet Native** — Supports Argent and Braavos wallets out of the box.
- **Two modes** — **Classic**: UP/DOWN + expiry. **Box**: Tap tiles with multipliers.
- **Settlement in <1ms** — Off-chain engine + oracle-bound resolution.

---

## Technical Architecture

Hybrid design: **Starknet (L2)** + **Pyth Hermes (Oracle)** + **Supabase (State Management)**.

| Layer      | Stack |
|-----------|--------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand |
| **Blockchain** | Starknet (Argent / Braavos), STRK / ETH |
| **Oracle** | Pyth Network (Hermes API) |
| **Backend** | Supabase (PostgreSQL, RLS) |

---

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Environment

Create `.env` based on `.env.example`.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Resources

- [Starknet](https://starknet.io/)
- [Starknet React](https://starknet-react.com/)
- [Pyth Network](https://pyth.network/)
