# ShadowFund — Confidential Investment Vault with Real Aave Yield

> Blind funds come to DeFi. A fund manager runs an encrypted investment strategy and deploys real capital to Aave v3. Depositors earn real USDC yield while the strategy, deposit amounts, and share balances stay encrypted on-chain — until the manager triggers an irreversible Reveal.

Built for the **iExec Vibe Coding Challenge** (Confidential Vault track). Deployed on Arbitrum Sepolia.

---

## What is ShadowFund?

ShadowFund brings the TradFi concept of "blind funds" to DeFi using [iExec Nox](https://docs.iex.ec/nox-protocol/). A manager commits an encrypted WETH/USDC allocation claim, depositors trustlessly put cUSDC in, and the vault supplies productive capital to **Aave v3** to earn real yield. At period end the manager reveals the strategy and is scored on two axes:

1. **Real yield captured** from the Aave USDC supply (plaintext, auditable).
2. **Allocation alpha** — the revealed WETH bps vs a 50/50 benchmark, computed from Chainlink ETH/USD over the fund's lifetime.

**Standards / infra:** ERC-7984 (confidential tokens) · ERC-7540 (async vault, hybrid fast-path) · iExec Nox ACL · Aave v3 · Chainlink Data Feeds · ChainGPT API

---

## Features

- **Encrypted strategy** — the WETH basis-points allocation is stored as an `euint256` and only the manager can decrypt it pre-reveal.
- **Encrypted share balances** — each depositor's position is stored as a per-user `euint256` that only they can decrypt via the Nox SDK.
- **Auto-deposit** — depositing is atomic. Depositors call `cUSDC.confidentialTransferAndCall(vault, …, abi.encode(fundId))` and the vault's ERC-7984 receiver callback mints encrypted shares inline. No manager action required.
- **Hybrid redeem** — when the fund has no capital supplied to Aave (`fundPrincipal == 0`), `requestRedeem` settles atomically in one tx using ERC-4626 proportional math in the encrypted domain. When there is live Aave liquidity, it falls back to the ERC-7540 async queue so the manager can first withdraw enough from Aave, then call `processRedeem`, then the user claims.
- **Real Aave v3 yield** — 100% of productive capital is supplied to the Arb Sepolia USDC reserve via a 2-step manager-driven flow (`initiateSupply` → off-chain TEE decrypt → `finalizeSupply`). Withdraw + re-wrap inflates the vault's encrypted `totalAssets`, so every existing share is worth more.
- **Virtual asset allocation** — the encrypted `wethBps` is a manager *claim*, not a physical leg. At reveal it's scored against a 50/50 ETH/USDC benchmark using Chainlink ETH/USD price delta. This lets the fund compete on allocation skill while keeping all real capital in a single audited yield source.
- **One-way reveal** — once `revealStrategy` is called, the encrypted WETH bps handle is made publicly decryptable via `Nox.allowPublicDecryption`. The encrypted `totalAssets` is also unsealed so the final NAV can be verified.
- **ChainGPT strategy analysis** — after reveal, a natural-language report is generated covering both the real Aave yield and the allocation alpha, via an `/api/analyze-strategy` route calling the ChainGPT API.

---

## Privacy Map

This is an honest, line-by-line map of what ShadowFund actually hides vs reveals.

| Data | Privacy | Why / how |
|---|---|---|
| Strategy (WETH bps) | **Encrypted** pre-reveal, public post-reveal | Stored as `euint256 encryptedWethBps`. Manager has the decrypt ACL until `revealStrategy`, which calls `Nox.allowPublicDecryption`. |
| Fund TVL (`totalAssets`) | **Encrypted** pre-reveal, public post-reveal | Per-fund encrypted aggregate. Only the manager has the decrypt ACL before reveal. Unsealed on reveal for audit. |
| Individual share balance | **Encrypted (permanent)** | Per-user `euint256 shares[user]`. Only the user can decrypt, even after reveal. |
| Individual deposit amount | **Encrypted on the wire** | The ERC-7984 `confidentialTransferAndCall` ingests an encrypted handle + proof; the plaintext amount never leaves the client. |
| Individual redeem amount | **Encrypted on the wire** | Same mechanism, via `requestRedeem(externalEuint256, proof)`. |
| Depositor identity (who deposited) | **PUBLIC** (unavoidable at the ERC-7984 layer) | The cUSDC `Transfer` event fires from the depositor's EOA. Our own `Deposited(fundId)` event is identity-free, but the token-layer event is not. See "Identity leak disclosure" below. |
| Depositor count (`depositorCount`) | **Public** | Plaintext storage field — used for UI and would leak from Transfer events anyway. |
| Per-fund Aave principal (`fundPrincipal`) | **Public (by design)** | The Aave leg is deliberately auditable. Plaintext storage field + `SuppliedToAave(fundId, amount)` / `WithdrawnFromAave(fundId, amount)` events expose aggregate supply/withdraw amounts. This is a load-bearing feature: depositors need to verify capital actually reached Aave. |
| Total Aave position (`aUSDC.balanceOf(vault)`) | **Public** | Aave aTokens are a public ERC-20 balance. |
| Realized yield | **Public** (per fund) | Derived from `getFundYield(fundId) = fundAValue − fundPrincipal`. No secret here — the design explicitly makes the yield claim auditable. |
| Allocation alpha score | **Public post-reveal** | Computed on-chain from the revealed wethBps and Chainlink ETH/USD. |

### Design intent
> **We hide _how much_ the strategy holds and _how much_ each depositor put in. We intentionally reveal _how much the manager has supplied to Aave_ so the yield story is verifiable.**

These two goals are in tension — we can't hide individual amounts *and* publish a precise aggregate. The resolution:

- **Individual amounts** stay encrypted through every vault-side operation (deposit, share mint, redeem, share burn, payout transfer).
- **Aggregate Aave flows** leak only the values the manager *chose* to push to Aave — the vault's own encrypted `totalAssets` can be strictly larger than `fundPrincipal` (the difference is idle cUSDC awaiting redemption).
- Observers see a lower bound on fund capital (≥ `fundPrincipal`) but cannot see the true TVL or any individual depositor's stake.

### Identity leak disclosure

Amounts are encrypted; **identities are not**. Even though ShadowFund's own `Deposited(uint256 fundId)` event deliberately omits the depositor address, the underlying ERC-7984 cUSDC `Transfer(from, to, …)` event logs `from = depositor EOA` and `to = vault`. Anyone can filter that event to learn *who* deposited into *which* fund (and when), just not *how much*. This is a property of the token standard, not the vault.

### Other known side-channels
- **Single-depositor trivialization** — if a fund has exactly one depositor, that depositor's balance trivially equals `totalAssets` post-reveal.
- **Timing leaks** — deposit/redeem transaction timestamps are public.
- **Supply-to-Aave is a public aggregate signal** — observers learn when the manager rebalances but not per-user impact.

---

## Architecture

### Contracts

| Contract | Responsibility |
|---|---|
| `ShadowFundVault.sol` | Multi-fund vault. Per-fund state keyed by `fundId`. Handles create, encrypted setStrategy, auto-mint deposits via ERC-7984 receiver, hybrid redeem, Aave supply/withdraw, reveal, performance scoring. |
| `ShadowFundShareToken.sol` | Per-fund ERC-7984 view-only facade. Lets wallets see a distinct share "token" per fund; all state lives in the vault. |
| `PriceOracle.sol` | Chainlink ETH/USD wrapper + Aave USDC supply APY reader (via `AaveDataProvider.getReserveData`). |
| `AaveAddresses.sol` | Arb Sepolia Aave v3 address book (Pool, DataProvider, USDC, aUSDC, WETH). |
| `IAavePool.sol` | Minimal `supply` / `withdraw` / `getReserveData` interfaces. |

### Flows

**Auto-deposit (1 tx)**
```
depositor → cUSDC.confidentialTransferAndCall(vault, encHandle, proof, abi.encode(fundId))
          → cUSDC moves encrypted balance
          → cUSDC calls vault.onConfidentialTransferReceived(..., amount, data)
          → vault inlines: shares[from] += amount, totalAssets += amount,
                           totalShares += amount, depositorCount++, emit Deposited(fundId)
```

**Supply to Aave (2 txs, manager-driven, mirrors the ERC-7984 unwrap pattern)**
```
Tx1: vault.initiateSupply(fundId, plaintextAmount)
     → trivially-encrypt amount
     → cUSDC.unwrap(vault, vault, euint256) → returns unwrapHandle
     → totalAssets -= amount (kept in lock-step with cUSDC balance)

off-chain: handleClient.publicDecrypt(unwrapHandle) → proof

Tx2: vault.finalizeSupply(fundId, decryptionProof)
     → cUSDC.finalizeUnwrap(handle, proof) → plaintext USDC lands in vault
     → USDC.approve(AavePool, amount)
     → AavePool.supply(USDC, amount, vault, 0)
     → fundPrincipal += amount, totalPrincipalSum += amount
```

**Withdraw from Aave (1 tx)**
```
vault.withdrawFromAave(fundId, amount)
  → pro-rata cap check against (fundPrincipal × aUSDC.balanceOf / totalPrincipalSum)
  → AavePool.withdraw(USDC, amount, vault)
  → cUSDC.wrap(vault, amount) → re-encrypts as cUSDC
  → totalAssets += amount (any excess over fundPrincipal is realized yield)
  → fundPrincipal -= min(amount, fundPrincipal)
```

**Hybrid redeem (fast or slow depending on Aave state)**
```
user → vault.requestRedeem(fundId, encShares, proof)

if (fundPrincipal == 0):
    ─── FAST PATH (atomic, single tx) ───
    payoutAssets = shares × totalAssets / totalShares   (ERC-4626, encrypted)
    shares[user] -= shares
    totalShares -= shares
    totalAssets -= payoutAssets
    cUSDC.confidentialTransfer(user, payoutAssets)      (atomic exit)
    emit RedeemClaimed(fundId, user)

else:
    ─── SLOW PATH (ERC-7540 async queue) ───
    pendingRedeem[user] += shares
    emit RedeemRequested(fundId, user)

    # Manager pulls liquidity back from Aave first, then:
    manager → vault.processRedeem(fundId, user)
    user    → vault.claimRedemption(fundId)
```

---

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| USDC (ERC-20) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| cUSDC (ERC-7984) | `0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e` |
| Aave v3 Pool | `0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff` |
| Aave v3 DataProvider | `0x12373B5085e3b42D42C1D4ABF3B3Cf4Df0E0Fa01` |
| Aave aUSDC | `0x460b97BD498E1157530AEb3086301d5225b91216` |
| PriceOracle | `0x8dC6DA7a623A4909230404c0EAAe99553ff88458` |
| ShadowFundVault | `0x2e04f448a57a4593A1B6cF3FA5eA8a18959DD77d` |

Live addresses are stored in `deployments/arbitrumSepolia.json` and auto-exported to `lib/contracts.ts` after every deploy.

---

## Getting Started

### Prerequisites
- Node.js 20+
- A WalletConnect project ID — [cloud.reown.com](https://cloud.reown.com)
- An Arbitrum Sepolia RPC URL (public fallback available, Alchemy recommended for reliability)
- A deployer wallet with Arbitrum Sepolia ETH

### 1. Install

```bash
git clone https://github.com/your-org/shadow-fund.git
cd shadow-fund
npm install
```

### 2. Configure

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

### 3. Compile + deploy

```bash
npm run compile
npm run deploy:arb     # deploys PriceOracle + ShadowFundVault, verifies on Arbiscan, exports ABIs
```

### 4. Run the frontend

```bash
npm run dev   # → http://localhost:3000
```

---

## End-to-End Test Walkthrough

| # | Action | Expected result |
|---|---|---|
| 1 | Manager → `/dashboard/manager` → **Create Fund** | New fund card with "Sealed" badge |
| 2 | Manager → **Set Strategy** (single WETH slider, e.g. 7000 bps) | "Strategy Set 🔒" badge appears; setStrategy tx on Arbiscan |
| 3 | Depositor → `/dashboard` → wrap USDC to cUSDC | cUSDC balance shows |
| 4 | Depositor → `/fund/{id}` → **Deposit** e.g. 5 cUSDC | Single tx; "Deposited! Shares minted" message; `Deposited(fundId)` event on Arbiscan |
| 5 | Depositor → click **Decrypt** on balance | Shows 5.00 sfUSDC |
| 6 | Manager → **Supply to Aave** → enter e.g. 5 → Initiate | `SupplyInitiated` event; TEE cooldown UI |
| 7 | Manager → **Finalize Supply** | `SuppliedToAave` event; `aUSDC.balanceOf(vault) > 0` |
| 8 | Wait a few blocks | `getFundYield` returns small positive |
| 9 | Manager → **Withdraw from Aave** (e.g. 5.01) | `WithdrawnFromAave` event; vault cUSDC balance inflates by 5.01; `fundPrincipal` → 0 |
| 10 | Depositor → **Redeem** all shares | Single tx auto-settle (fast path, because `fundPrincipal == 0`); depositor receives slightly more than 5 cUSDC back |
| 11 | Manager → `/fund/{id}/reveal` → complete triple-confirm | `revealStrategy` tx; reveal page shows WETH 70% / USDC 30%; ChainGPT analysis panel |
| 12 | Verify privacy invariants on Arbiscan | `shareBalanceOf` still returns handle bytes32 even post-reveal; `setStrategy` calldata is opaque; `Deposited` event has only `fundId` |

---

## Project Structure

```
contracts/
  AaveAddresses.sol          # Arb Sepolia Aave v3 constants
  IAavePool.sol              # Minimal Aave + IERC20 interfaces
  PriceOracle.sol            # Chainlink ETH/USD + Aave APY reader
  ShadowFundShareToken.sol   # Per-fund ERC-7984 view facade
  ShadowFundVault.sol        # Main vault: strategy, deposit, redeem, Aave
scripts/
  deploy.ts                  # Hardhat deploy + Arbiscan verify
  export-abi.ts              # ABI + address export to lib/
app/
  (app)/funds/               # Fund browser
  (app)/dashboard/manager/   # Manager dashboard (strategy, Aave, process redeem)
  (app)/dashboard/depositor/ # Depositor positions
  (app)/fund/[id]/           # Fund detail + deposit/redeem
  (app)/fund/[id]/reveal/    # Reveal + ChainGPT analysis
  api/analyze-strategy/      # ChainGPT endpoint (Aave yield + allocation alpha)
  api/audit-contract/        # ChainGPT contract audit
hooks/
  use-create-fund.ts
  use-set-strategy.ts
  use-request-deposit.ts      # atomic confidentialTransferAndCall
  use-request-redeem.ts       # branches fast/slow on-chain
  use-process-redeem.ts       # manager-only slow path
  use-claim-redemption.ts     # slow path final step
  use-initiate-supply.ts      # Aave supply step 1
  use-finalize-supply.ts      # Aave supply step 2 (TEE decrypt + supply)
  use-withdraw-from-aave.ts
  use-fund-yield.ts           # principal / aValue / yield / APY multicall
  use-reveal-strategy.ts
  use-fund.ts
  use-fund-list.ts
  use-my-position.ts
  use-chaingpt-analysis.ts
components/shadow-fund/
  fund-card.tsx
  fund-browser-content.tsx
  manager-dashboard-content.tsx
  depositor-dashboard-content.tsx
  fund-detail-content.tsx
  reveal-page-content.tsx
  strategy-sliders.tsx        # single WETH slider + live Aave APY
  chaingpt-analysis-panel.tsx
lib/
  shadow-fund-abi.ts          # auto-generated
  contracts.ts                # auto-generated addresses
deployments/
  arbitrumSepolia.json
```

---

## Key Technical Decisions

**Single vault, many funds.** One `ShadowFundVault.sol` with `mapping(uint256 fundId => Fund)`. Per-fund `ShadowFundShareToken` facades deployed by `createFund()` give ERC-7984-compliant token addresses for wallets.

**Nox ACL lifecycle.** Every encrypted mutation calls `Nox.allowThis(handle)` (so the vault can reuse the handle later in the same or next tx) and `Nox.allow(handle, user)` (so the user can decrypt client-side). `Nox.allowTransient(handle, cUSDC)` is required before any cross-contract cUSDC call that consumes the handle (unwrap, confidentialTransfer).

**Strategy collapse: 4 assets → 1.** An earlier iteration had 4 encrypted allocations (ETH/BTC/LINK/USDC) summing to 100%. That couldn't be enforced on-chain because Nox can't revert on an `ebool`, and there was no realistic way to physically execute the basket on testnet. Collapsed to a single `encryptedWethBps` (0-10000) — USDC is implicit — with `Nox.allowPublicDecryption` on reveal so the commitment is auditable.

**Virtual allocation + real yield.** Arb Sepolia has no deep Uniswap pool to physically swap USDC↔WETH, so 100% of productive capital goes to the Aave USDC reserve for real yield. The encrypted `wethBps` is the manager's *claim* about how they would have allocated, scored post-reveal as allocation alpha vs a 50/50 benchmark using Chainlink ETH/USD. Depositors get real Aave yield regardless of the claim.

**Why deposits are auto and redeems are hybrid.** ERC-7540 required a 2-step queue for both sides in the earlier draft, which made the demo feel like an intent protocol rather than a vault. We collapsed deposits to an inline receiver-callback mint because the vault already has all the information at callback time. Redeems stay two-mode: the fast path uses encrypted ERC-4626 math (`Nox.mul` + `Nox.div`) and pays out atomically when the fund is fully liquid; the slow path only kicks in when capital is actually supplied to Aave, because the cUSDC needed to settle doesn't physically exist in the vault until the manager withdraws.

**ERC-4626 math in the encrypted domain.** An earlier bug had `processRedeem` using a 1:1 share→asset assumption, which meant Aave yield never flowed to exiting depositors. Fixed by doing `payout = shares × totalAssets / totalShares` using `Nox.mul` / `Nox.div` before the burn — in `_autoRedeem` (fast path) and `processRedeem` (slow path) alike.

**Identity leak is documented, not worked around.** The `Deposited(uint256 fundId)` event deliberately omits the depositor address, but the ERC-7984 `Transfer` event at the cUSDC layer still logs `from`. We don't try to paper over this — it's called out in the privacy map above.

---

## License

MIT
