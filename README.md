# ShadowFund — Confidential Investment Vault

> Blind funds come to DeFi. A fund manager runs an encrypted investment strategy. Depositors can't see it. Nobody can — until the manager reveals.

Built for the **iExec Vibe Coding Challenge** (Confidential Vault track). Deployed on Arbitrum Sepolia.

---

## What is ShadowFund?

ShadowFund brings the TradFi concept of "blind funds" to DeFi using [iExec Nox](https://docs.iex.ec/nox-protocol/). Everything sensitive is encrypted on-chain:

- Strategy allocations (ETH / BTC / LINK / USDC percentages)
- Individual deposit amounts
- Per-depositor share balances

None of it is visible on the blockchain until the fund manager triggers an irreversible **Reveal** — at which point the strategy is made publicly decryptable and a ChainGPT-powered analysis runs automatically.

**Standards used:** ERC-7984 (confidential tokens) · ERC-7540 (async vault) · iExec Nox ACL · Chainlink Data Feeds · ChainGPT API

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Web3 | wagmi v2 + viem + Reown AppKit |
| Confidential | iExec Nox (`@iexec-nox/handle`, `@iexec-nox/nox-protocol-contracts`) |
| Contracts | Solidity 0.8.28, Hardhat |
| Chain | Arbitrum Sepolia (chainId 421614) |
| Prices | Chainlink Data Feeds (on-chain) |
| AI Analysis | ChainGPT API |

---

## Deployed Contracts (Arbitrum Sepolia)

> After deploy, addresses are stored in `deployments/arbitrumSepolia.json` and exported to `lib/contracts.ts`.

| Contract | Address |
|----------|---------|
| USDC (ERC-20) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| cUSDC (ERC-7984) | `0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e` |
| RLC (ERC-20) | `0x9923eD3cbd90CD78b910c475f9A731A6e0b8C963` |
| cRLC (ERC-7984) | `0x92b23f4a59175415ced5cb37e64a1fc6a9d79af4` |
| NoxCompute | `0xd464B198f06756a1d00be223634b85E0a731c229` |
| PriceOracle | *(deploy to populate)* |
| ShadowFundVault | *(deploy to populate)* |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A WalletConnect project ID — [cloud.reown.com](https://cloud.reown.com)
- An Arbitrum Sepolia RPC URL (public fallback available, Alchemy recommended for reliability)
- A deployer wallet with Arbitrum Sepolia ETH (bridge from [bridge.arbitrum.io](https://bridge.arbitrum.io))

### 1. Clone and install

```bash
git clone https://github.com/your-org/shadow-fund.git
cd shadow-fund
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_id>
NEXT_PUBLIC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARB_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
DEPLOYER_PRIVATE_KEY=0x<your_deployer_key>
ARBISCAN_API_KEY=<your_arbiscan_key>
CHAINGPT_API_KEY=<your_chaingpt_key>
```

### 3. Compile and deploy contracts

```bash
# Compile Solidity contracts
npm run compile

# Deploy to Arbitrum Sepolia and export ABIs to lib/
npm run deploy:arb
```

This will:
1. Deploy `PriceOracle` with Chainlink feeds
2. Deploy `ShadowFundVault`
3. Write addresses to `deployments/arbitrumSepolia.json`
4. Export ABIs + addresses to `lib/shadow-fund-abi.ts` and `lib/contracts.ts`

### 4. Install shadcn primitives (if not already done)

```bash
npx shadcn@latest add input slider tabs badge progress alert-dialog
```

### 5. Run the frontend

```bash
npm run dev    # → http://localhost:3000
```

---

## User Flows

### As a Fund Manager

1. Navigate to **Manager** in the header
2. **Create a Fund** — enter name, description, performance fee
3. **Set Strategy** — drag sliders for ETH/BTC/LINK/USDC (must sum to 100%). Percentages are encrypted via Nox before hitting the chain.
4. **Process deposits** — when depositors submit `requestDeposit`, approve them by entering their address and clicking "Process Deposit"
5. **Reveal** — navigate to the fund's Reveal page, complete the triple-confirm flow. Strategy becomes publicly visible. ChainGPT analysis runs automatically.

### As a Depositor

1. Navigate to **Funds** to browse available vaults
2. **Get cUSDC** first — use the existing Dashboard to wrap USDC → cUSDC
3. Click **Deposit** on a fund card
   - First deposit requires one extra tx to grant operator rights to the vault
   - Amount is encrypted before submission
4. Wait for the manager to process your deposit
5. Navigate to **Depositor** dashboard — click **Decrypt** to see your private balance (gasless, client-side Nox decryption)
6. **Withdraw** anytime — redemptions do NOT require the manager to have revealed

---

## Privacy Model

| Information | Visible to |
|-------------|-----------|
| Fund name, manager address | Everyone |
| Strategy allocations | Nobody (until reveal) |
| Individual deposit amounts | Only the depositor |
| Individual share balances | Only the depositor |
| Depositor count | Everyone |
| TVL | Only the fund manager |
| Performance score | Everyone (post-reveal only) |
| That a deposit/withdrawal happened | Everyone (tx is public, amount is not) |

---

## Project Structure

```
contracts/
  PriceOracle.sol          # Chainlink ETH/BTC/LINK wrapper
  ShadowFundShareToken.sol # Per-fund ERC-7984 view facade
  ShadowFundVault.sol      # Main vault + ERC-7540 logic
scripts/
  deploy.ts                # Hardhat deploy script
  export-abi.ts            # ABI → lib/ export
app/
  (app)/funds/             # Fund browser
  (app)/dashboard/manager/ # Manager dashboard
  (app)/dashboard/depositor/ # Depositor positions
  (app)/fund/[id]/         # Fund detail + deposit/redeem
  (app)/fund/[id]/reveal/  # Manager reveal + ChainGPT analysis
  api/analyze-strategy/    # ChainGPT strategy analysis endpoint
  api/audit-contract/      # ChainGPT contract audit endpoint
hooks/
  use-create-fund.ts
  use-set-strategy.ts
  use-request-deposit.ts
  use-process-deposit.ts
  use-request-redeem.ts
  use-process-redeem.ts
  use-reveal-strategy.ts
  use-fund-list.ts
  use-fund.ts
  use-my-position.ts
  use-chaingpt-analysis.ts
components/shadow-fund/
  fund-card.tsx
  fund-browser-content.tsx
  manager-dashboard-content.tsx
  depositor-dashboard-content.tsx
  fund-detail-content.tsx
  reveal-page-content.tsx
  strategy-sliders.tsx
  chaingpt-analysis-panel.tsx
lib/
  shadow-fund-abi.ts       # Vault ABI (hand-written stubs, replaced after deploy)
  contracts.ts             # All contract addresses
deployments/
  arbitrumSepolia.json     # Generated by npm run deploy:arb
```

---

## Key Technical Decisions

**Single vault, many funds** — one `ShadowFundVault.sol` with `mapping(uint256 fundId => Fund)`. Per-fund `ShadowFundShareToken` facades deployed by `createFund()` give ERC-7984-compliant token addresses for wallets.

**Nox ACL lifecycle** — every encrypted operation must call `Nox.allowThis()` (so the vault can reuse the handle later) and `Nox.allow(handle, user)` (so the user can decrypt). `Nox.allowTransient(handle, cUSDC)` is required before any cross-contract cUSDC call.

**Sum-to-100 trust model** — on-chain enforcement of `pct_ETH + pct_BTC + pct_LINK + pct_USDC == 100` is impossible because Nox has no conditional revert on `ebool`. The equality handle is made publicly decryptable at reveal for ex-post auditing.

**ERC-7984 operator pattern** — depositors call `cUSDC.setOperator(vault, type(uint48).max)` once. The vault then pulls cUSDC directly via `confidentialTransferFrom` in `requestDeposit`.

---

## License

MIT
