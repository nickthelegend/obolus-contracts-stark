# Obolus Contracts — Starknet

![Cairo](https://img.shields.io/badge/Cairo-2.x-orange?style=flat-square)
![Starknet](https://img.shields.io/badge/Starknet-Sepolia-blue?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)

> A Starknet DeFi monorepo — perpetuals, confidential trading, and prediction markets — built around the **Obolus** project.

## Overview

`obolus-contracts-stark` is a workspace that bundles several related Starknet
DeFi experiments in one place. At its core are the **Obolus** Cairo contracts: a
minimal perpetual-futures engine with an operator-driven oracle and a
Tongo-based confidential collateral vault. Around that core sit three companion
projects — a confidential DEX (**ShadowSwap**), a sub-second prediction-market
app (**Kasnomo / Obolus**), and a vendored copy of StarkWare's reference
**Starknet Perpetual** protocol used for study and comparison.

Much of this code is hackathon / prototype grade — several paths (e.g. the
confidential-collateral deposit) are simulated for demo purposes rather than
production-hardened. Treat it as a working reference and starting point, not an
audited system.

## What's Inside

### `contracts/` — Obolus core (Cairo)
The eponymous package (`obolus`). Three contracts:
- **`ObolusPerp`** — perpetual-futures engine: deposit/withdraw collateral, open
  long/short positions with leverage, close, liquidate, and compute PnL against
  an oracle mark price. Configurable initial-margin, maintenance-margin, and
  liquidation-penalty ratios; emits position lifecycle events.
- **`ObolusOracle`** — a simple operator-gated price feed keyed by `asset_id`
  (prices scaled by 1e6).
- **`ObolusCollateral`** — a confidential-collateral vault interface that accepts
  a Tongo proof and encrypted amount (deposit is simulated in this demo build).

Built on Cairo `2.9.1` with OpenZeppelin `cairo-contracts` v0.20.0.

### `shadowswap/` — Confidential DEX
**ShadowSwap**: a privacy-preserving DEX that encrypts trade amounts using the
**Tongo** protocol (ElGamal). Cairo contracts (`confidential_token`,
`shadow_pool`, `sealed_orderbook`, `viewing_key`) plus a Next.js 16 frontend with
fund / swap / sealed-orders / compliance flows and Argent/Braavos wallet support.

### `Kasnomo/` — Prediction-market app (Obolus)
A Next.js 16 / React 19 app for **sub-second binary-options / price-prediction**
trading. Uses Pyth Hermes price attestations, Supabase for off-chain state, and
Starknet wallets, with a Kaspa treasury integration and a Solidity
`BinomoTreasury` contract for deposits/withdrawals.

### `starknet-perpetual/` — Reference protocol (Apache-2.0)
A vendored copy of StarkWare's **Starknet Perpetual** trading contracts — a Cairo
workspace (perpetuals / vault / fulfillment) kept here as a reference
implementation. See its own `README.md` and `docs/` for details.

## Tech Stack

- **Smart contracts:** Cairo 2.x, Scarb, Starknet Foundry (`snforge`), OpenZeppelin Cairo Contracts
- **Privacy:** Tongo protocol (ElGamal encryption), `@fatsolutions/tongo-sdk`
- **Frontends:** Next.js 16, React 19, TypeScript, Tailwind CSS, starknet.js, `@starknet-react/core`, `starknetkit`
- **Oracles / data:** Pyth Network (Hermes API)
- **Off-chain state:** Supabase (PostgreSQL)
- **Also present:** Solidity treasury (`BinomoTreasury.sol`), Kaspa network integration

## Getting Started

This is a monorepo with no root build — each subproject builds independently.

**Cairo contracts** (`contracts/`, `shadowswap/contracts/`, `starknet-perpetual/`):

```bash
# from a contracts directory containing Scarb.toml
scarb build

# tests (where a snforge suite exists, e.g. starknet-perpetual)
snforge test
```

**Frontends** (`Kasnomo/`, `shadowswap/`):

```bash
cd Kasnomo   # or: cd shadowswap
npm install
cp .env.example .env   # fill in the required values (Kasnomo)
npm run dev
```

## Project Structure

```
obolus-contracts-stark/
├── contracts/            # Obolus core Cairo contracts (perp, oracle, collateral)
├── shadowswap/           # ShadowSwap: confidential DEX (Cairo + Next.js)
├── Kasnomo/              # Obolus prediction-market app (Next.js + Pyth + Supabase)
└── starknet-perpetual/   # StarkWare reference perpetual protocol (Apache-2.0)
```

---

Built by [**nickthelegend**](https://github.com/nickthelegend) · [nickthelegend.tech](https://nickthelegend.tech)
