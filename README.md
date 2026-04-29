# ShadowFund

Confidential investment vaults on Arbitrum. A whale depositing $1M and a retail user depositing $100 look **identical on-chain** — every depositor's amount, share balance, and yield are encrypted end-to-end via **iExec Nox**. The manager's strategy stays public, so depositors can vote with their capital without leaking their positions.

🌐 **Live:** https://shadow-fund-tan.vercel.app
🛠 Built for the iExec Vibe Coding Challenge — Confidential Vault track.

---

## Powered by iExec Nox

ShadowFund is built on top of **iExec Nox**, the confidential-computing layer that makes input privacy on EVM actually feel ergonomic. Nox gives us:

- **ERC-7984 confidential tokens** — `confidentialTransferAndCall` lets a user deposit an encrypted amount in a single transaction, with no plaintext ever touching the chain.
- **`euint256` arithmetic** (`Nox.add`, `Nox.mul`, `Nox.div`) — we settle pro-rata redeems entirely in encrypted space; there's no shadow plaintext mapping.
- **Per-handle ACLs** — each depositor's `shares` and `deposited` handles are scoped to their own wallet. The manager can decrypt the encrypted aggregates (TVL) but never an individual position.
- **TEE-attested unwrap** — when the manager deploys capital, Nox's TEE produces a decryption proof that lets us cleanly bridge the encrypted vault into plain ERC-4626 sub-vaults.

Without Nox, this protocol either leaks every deposit amount or has to ship its own MPC stack. With Nox it's a clean ERC-7984 receiver + a few `Nox.*` calls.

---

## How it works

- **Deposit** with cUSDC. Your amount is encrypted on the wire and stored as a Nox handle scoped to your wallet.
- **Manager** publishes a `[Aave %, Fixed %]` allocation and deploys capital across two ERC-4626 sub-vaults:
  - `AaveUSDCVault` — Aave v3 USDC supply (variable APY)
  - `FixedYieldVault` — 8% APY reward pool
- **Redeem** is fully encrypted. Fast-path when capital is idle, ERC-7540 queue when deployed.

> We hide *how much each depositor put in*. We intentionally reveal *the manager's strategy*.

---

## Prerequisites

- Node.js 20+
- A WalletConnect / Reown project ID — [cloud.reown.com](https://cloud.reown.com)
- Arbitrum Sepolia RPC URL
- Deployer wallet funded with **Arbitrum Sepolia ETH** (gas) and **USDC** (to seed the FixedYieldVault reward pool)

---

## Quick start

```bash
git clone https://github.com/youssef-jeddi/ShadowFund.git
cd shadow-fund
npm install
cp .env.local.example .env.local
npm run dev                         # → http://localhost:3000
```

### Environment variables

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown / WalletConnect project ID |
| `NEXT_PUBLIC_RPC_URL` | Arbitrum Sepolia RPC for the frontend |
| `ARB_SEPOLIA_RPC` | Same RPC for Hardhat deploy scripts |
| `DEPLOYER_PRIVATE_KEY` | Funds the deploy + seeds the FixedYieldVault pool |
| `ARBISCAN_API_KEY` | Auto-verifies contracts on Arbiscan after deploy |
| `CHAINGPT_API_KEY` | Powers the in-app strategy analysis |
| `REDEPLOY_SUBVAULTS` | `1` to redeploy sub-vaults too; default `0` reuses existing |
| `FIXED_POOL_AMOUNT` | Reward pool size in USDC base units (default `500000000` = 500 USDC) |

---

## Deploy

```bash
npm run compile

# Pre-flight: verify the Aave reserve is healthy on Arb Sepolia
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/check-aave.ts --network arbitrumSepolia

# Deploy ShadowFundVault, verify on Arbiscan, export ABIs + addresses to lib/
npm run deploy:arb
```

By default this redeploys only `ShadowFundVault` and reuses the existing sub-vaults. Set `REDEPLOY_SUBVAULTS=1` to redeploy the whole stack.

---

## Using the dApp

1. **Manager** opens `/dashboard/manager` → **Create Fund**, sets a `[Aave %, Fixed %]` allocation and a performance fee.
2. **Depositor** opens `/dashboard` → wraps USDC into cUSDC → opens the fund → **Deposit**. The amount is encrypted on the wire.
3. **Depositor** can decrypt their own position from the dashboard (shares, deposited, approximate yield) — no one else can.
4. **Manager** clicks **Deploy Capital** to fan capital across Aave + the fixed-yield pool. Two-step flow with a short TEE cooldown.
5. **Manager** can **Update Allocation** (affects future deploys) or **Withdraw Capital** to bring funds back.
6. **Redeem**: if capital is idle the depositor receives cUSDC instantly; if it's deployed the redeem is queued, the manager processes it after `withdrawCapital`, and the depositor claims from the **Claim** tab.

---

## Deployed contracts (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| **ShadowFundVault** | `0x29C154427Bb65263A0aF43aAfa7b32c998e6d241` |
| AaveUSDCVault | `0xfff39C5BCEf87623De00630bD9DB7bf5Be981546` |
| FixedYieldVault | `0xcaE8150313B69d4f8E0400fe1b4DB1022c08348d` |
| cUSDC (ERC-7984) | `0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e` |
| USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |

Addresses + ABIs are auto-exported to `lib/contracts.ts` and `lib/shadow-fund-abi.ts` after every deploy.

---

## Stack

Next.js · wagmi · **iExec Nox** · ERC-7984 · ERC-7540 · ERC-4626 · Aave v3 · ChainGPT.

## License

MIT
