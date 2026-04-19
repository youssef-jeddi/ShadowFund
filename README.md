# ShadowFund — Input-Privacy Investment Vault

> A whale depositing $1M and a retail user depositing $100 look **identical on-chain**. Each depositor's deposit amount, share balance, and yield are encrypted end-to-end via iExec Nox — only their own wallet can decrypt. The manager's strategy is **fully public**: a `uint256[2] allocationBps` mix across two USDC-only sub-vaults (Aave v3 + a fixed-8% reward pool) earning real yield.

Built for the **iExec Vibe Coding Challenge** (Confidential Vault track). Deployed on Arbitrum Sepolia.

---

## What is ShadowFund?

ShadowFund is an on-chain investment vault with **input privacy** — the Aztec model. Depositors contribute via ERC-7984 `confidentialTransferAndCall`; the vault's receiver callback mints encrypted shares (`euint256`) inline. Per-depositor state (`shares`, lifetime `deposited`) is stored as Nox handles with ACL scoped to the depositor, so only that wallet can decrypt their own numbers via `handleClient.decrypt(handle)`.

The manager commits a **public** `uint256[VAULT_COUNT] allocationBps` at fund creation and can rebalance future deploys via `updateAllocation`. Capital fans out across two ERC-4626 sub-vaults earning real yield:

1. **`AaveUSDCVault`** — ERC-4626 around Aave v3 USDC supply (variable APY).
2. **`FixedYieldVault`** — deployer-seeded 500 USDC reward pool at fixed 8% APY. Stable leg that differentiates from Aave's variable rate.

Redeem is fully encrypted (`Nox.div(shareAmt × totalAssets, totalShares)`) — a hybrid flow: atomic fast-path when `getFundTotalDeployed == 0`, ERC-7540-style queue slow-path otherwise.

**Standards / infra:** ERC-7984 (confidential tokens) · ERC-7540 (async redeem, hybrid) · ERC-4626 (sub-vaults + meta math) · iExec Nox ACL · Aave v3 · ChainGPT API.

---

## Privacy Map

| Data | Privacy | Why / how |
|---|---|---|
| `shares[depositor]` | **Encrypted (permanent)** | `euint256` handle; only the depositor can decrypt via Nox ACL. |
| `deposited[depositor]` | **Encrypted (permanent)** | Cumulative lifetime deposits (never decremented). Same ACL. |
| `totalAssets` / `totalShares` | **Encrypted**; manager-ACL | Used inside `Nox.div` for pro-rata redeem; manager can TVL-decrypt client-side. |
| Individual deposit amount on the wire | **Encrypted** | ERC-7984 `confidentialTransferAndCall` ingests an encrypted handle + proof. |
| Individual redeem amount on the wire | **Encrypted** | Same, via `requestRedeem(externalEuint256, proof)`. |
| `allocationBps[VAULT_COUNT]` | **PUBLIC (by design)** | Manager's mix is transparent — a commitment depositors can vote on with their deposits. |
| `subVaultShares[fundId][i]`, sub-vault USDC | **Public aggregate** | Used by `getFundTotalDeployed` and by the UI's per-vault deployed display. |
| Depositor identity | **PUBLIC** (ERC-7984 layer) | cUSDC's own `Transfer` event logs the depositor EOA. Amounts are encrypted; identities are not. This is structural to ERC-7984. |

### Design intent

> **We hide _how much each depositor put in_. We intentionally reveal _the manager's strategy_.** Copy-trading hurts when retail can infer specific whale positions; it does not hurt when retail can see the fund's broad mix. A transparent strategy is a feature.

---

## Architecture

### Contracts

| Contract | Responsibility |
|---|---|
| `ShadowFundVault.sol` | Per-fund state keyed by `fundId`. Public `allocationBps[2]` + `updateAllocation`. Auto-mint deposits via ERC-7984 receiver. 2-step TEE `deployCapital` / `finalizeDeployCapital` fan-out. Bulk `withdrawCapital` rewraps back to cUSDC. Hybrid encrypted redeem. |
| `AaveUSDCVault.sol` | ERC-4626 around Aave v3 USDC supply. |
| `FixedYieldVault.sol` | ERC-4626 with deployer-seeded 500 USDC reward pool. Accrues at 8% APY. |
| `ShadowFundShareToken.sol` | Per-fund ERC-7984 view-only facade. |
| `AaveAddresses.sol` | Arb Sepolia Aave v3 address book (Pool, DataProvider, USDC, aUSDC). |

### Deposit flow (1 tx)

```
depositor → cUSDC.confidentialTransferAndCall(vault, encHandle, proof, abi.encode(fundId))
          → ShadowFundVault.onConfidentialTransferReceived(..., amount: euint256, data)
              shares[from]    = Nox.add(shares[from], amount)       // running
              deposited[from] = Nox.add(deposited[from], amount)    // cumulative lifetime
              totalAssets     = Nox.add(totalAssets, amount)
              totalShares     = Nox.add(totalShares, amount)
              Nox.allow each handle to its owner (depositor / manager)
```

### Bulk deploy (2 txs + TEE cooldown)

```
Tx1: vault.deployCapital(fundId, plaintextAmount)
     → trivially-encrypt amount, cUSDC.unwrap(handle) → pendingUnwrapHandle
     → totalAssets -= amount (encrypted)

off-chain: handleClient.publicDecrypt(pendingUnwrapHandle) → proof

Tx2: vault.finalizeDeployCapital(fundId, proof)
     → cUSDC.finalizeUnwrap(...) — plaintext USDC lands in vault
     for i in 0..VAULT_COUNT:
       slice_i = plaintextAmount × allocationBps[i] / 10000   // last slice gets remainder
       USDC.approve(approvedVaults[i], slice_i)
       shares_i = ISubVault(approvedVaults[i]).deposit(slice_i, vault)
       subVaultShares[fundId][i] += shares_i
     emit CapitalDeployed(fundId, total, slice0, slice1)
```

### Hybrid redeem

```
user → vault.requestRedeem(fundId, encShares, proof)

if (getFundTotalDeployed(fundId) == 0):
    ─── FAST PATH ───
    payout = Nox.div(Nox.mul(shareAmt, totalAssets), totalShares)   // encrypted ERC-4626
    atomic burn + cUSDC.confidentialTransfer(user, payout)

else:
    ─── SLOW PATH ───
    pendingRedeem[user] += shareAmt (encrypted)
    # manager calls withdrawCapital first (rewraps USDC → cUSDC, grows totalAssets),
    # then processRedeem(user), then user claims via claimRedemption.
```

---

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| USDC (ERC-20) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| cUSDC (ERC-7984) | `0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e` |
| Aave v3 Pool | `0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff` |
| Aave aUSDC | `0x460b97BD498E1157530AEb3086301d5225b91216` |
| AaveUSDCVault | `0xfff39C5BCEf87623De00630bD9DB7bf5Be981546` |
| FixedYieldVault | `0xcaE8150313B69d4f8E0400fe1b4DB1022c08348d` |
| **ShadowFundVault** | **`0x29C154427Bb65263A0aF43aAfa7b32c998e6d241`** |

Addresses and ABIs are auto-exported to `lib/contracts.ts` + `lib/shadow-fund-abi.ts` by `scripts/export-abi.ts` after every deploy.

---

## Getting Started

### Prerequisites
- Node.js 20+
- WalletConnect project ID ([cloud.reown.com](https://cloud.reown.com))
- Arbitrum Sepolia RPC URL
- Deployer wallet with **Arbitrum Sepolia ETH** and **USDC** (for seeding FixedYieldVault reward pool)

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

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_id>
NEXT_PUBLIC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARB_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
DEPLOYER_PRIVATE_KEY=0x<your_deployer_key>
ARBISCAN_API_KEY=<your_arbiscan_key>
CHAINGPT_API_KEY=<your_chaingpt_key>

# Optional — set to 1 to redeploy the sub-vaults too (default: reuse existing)
REDEPLOY_SUBVAULTS=0
FIXED_POOL_AMOUNT=500000000    # 500 USDC, FixedYieldVault reward pool
```

### 3. Pre-flight, compile, deploy

```bash
npm run compile
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/check-aave.ts --network arbitrumSepolia
npm run deploy:arb    # deploys ShadowFundVault (+ sub-vaults if REDEPLOY_SUBVAULTS=1) + verifies + exports
```

### 4. Run the frontend

```bash
npm run dev   # → http://localhost:3000
```

---

## End-to-End Test Walkthrough

| # | Action | Expected result |
|---|---|---|
| 1 | Manager (wallet A) → `/dashboard/manager` → **Create Fund** with 60/40 allocation | New fund with "Public strategy · Private positions" badge; bar renders 60% Aave / 40% Fixed |
| 2 | Depositor (wallet B) → `/dashboard` → wrap USDC → cUSDC | cUSDC balance visible |
| 3 | Depositor → `/fund/{id}` → **Deposit** 100 cUSDC | Encrypted `Deposited(fundId)` event; no amount in log |
| 4 | Depositor → `/dashboard/depositor` → **Decrypt Position** | Shows `You deposited: 100.00 cUSDC`, `Your shares: 100 sfUSDC`, yield ≈ 0 |
| 5 | Depositor (wallet C) deposits 500 cUSDC | C's dashboard shows 500; C **cannot** decrypt B's handles — Nox ACL rejection |
| 6 | Manager → **Update Allocation** 80/20 | `getAllocation(fundId)` returns `[8000, 2000]`; fund card updates |
| 7 | Manager → **Deploy Capital** 400 USDC | 2-tx + TEE cooldown: `deployCapital` → `finalizeDeployCapital`; `CapitalDeployed(fundId, 400, 320, 80)` |
| 8 | Wait a few blocks | Per-sub-vault APY populated; blended APY = `(0.8 × AaveAPY + 0.2 × 8%)` |
| 9 | Manager → **Withdraw Capital** all; Depositor B → **Redeem** 50 shares | Fast path fires; B receives ≥ 50 cUSDC (principal + tiny yield) |
| 10 | Slow-path test: new fund, deposit, deploy, depositor requests redeem | Enters queue; manager `withdrawCapital` → `processRedeem` → depositor `claimRedemption` |
| 11 | Manager → **Analyze Fund** | ChainGPT returns 3-section report (allocation vs all-Aave baseline, per-vault yield attribution, reward-pool depth risk) |
| 12 | Arbiscan: call `getDepositorHandles(0, walletB)` | Returns two opaque `bytes32` — verifiably NOT `0x0…0`, not decryptable by anyone except wallet B |

---

## Project Structure

```
contracts/
  AaveAddresses.sol                 # Arb Sepolia Aave v3 constants (USDC/aUSDC only)
  IAavePool.sol                     # Minimal Aave + IERC20 interfaces
  ISubVault.sol                     # ERC-4626 subset the vault calls
  AaveUSDCVault.sol                 # ERC-4626 → Aave v3 USDC supply
  FixedYieldVault.sol               # ERC-4626 → 8% APY reward-pool accrual
  ShadowFundShareToken.sol          # Per-fund ERC-7984 view facade
  ShadowFundVault.sol               # Vault: public allocation + encrypted deposits + hybrid redeem

scripts/
  check-aave.ts                     # Pre-flight Aave reserve probe (USDC only)
  deploy.ts                         # Deploys ShadowFundVault (reuses sub-vaults by default)
  export-abi.ts                     # ABIs + addresses → lib/

app/
  (app)/funds/                      # Fund browser (public-allocation mini bar)
  (app)/dashboard/manager/          # 3-card manager dashboard
  (app)/dashboard/depositor/        # Depositor positions + encrypted-position card
  (app)/fund/[id]/                  # Fund detail page
  api/analyze-strategy/             # ChainGPT 2-vault public-strategy prompt
  api/audit-contract/               # ChainGPT contract audit

hooks/
  use-create-fund.ts                # createFund(name, description, perfFeeBps, [bps0, bps1])
  use-update-allocation.ts          # Manager-only rebalance of future deploys
  use-deploy-capital.ts             # 2-step bulk deploy with TEE cooldown + retryFinalize
  use-withdraw-capital.ts           # Plaintext bulk pull + rewrap to cUSDC
  use-subvault-metrics.ts           # APYs, shares, convertToAssets for both sub-vaults
  use-depositor-position.ts         # Decrypts both depositor handles client-side
  use-my-position.ts                # Decrypts share balance only
  use-role-for-fund.ts              # manager / depositor / both / none detection
  use-request-deposit.ts            # atomic confidentialTransferAndCall
  use-request-redeem.ts             # branches fast/slow on-chain
  use-process-redeem.ts / use-claim-redemption.ts
  use-fund.ts / use-fund-list.ts
  use-chaingpt-analysis.ts          # 2-vault public-strategy payload

components/shadow-fund/
  fund-card.tsx                     # Public-strategy badge + 2-color mini bar
  fund-browser-content.tsx
  manager-dashboard-content.tsx     # 3 cards: overview / actions / ChainGPT analysis
  depositor-dashboard-content.tsx   # Private position card at top of each row
  depositor-position-card.tsx       # Decrypt shares + deposited + yield
  update-allocation-modal.tsx       # Slider editor for updateAllocation
  fund-detail-content.tsx
  strategy-sliders.tsx              # 2 sliders + sum validator + live APY labels
  chaingpt-analysis-panel.tsx

lib/
  shadow-fund-abi.ts                # auto-generated (vault, shares, 2 sub-vaults, ISubVault)
  contracts.ts                      # auto-generated addresses
deployments/
  arbitrumSepolia.json
```

---

## Key Technical Decisions

**Input privacy, not execution privacy.** The earlier iteration encrypted the manager's 3-way allocation via `euint256[3]` + reveal. This protected the manager's edge but left depositor positions as an afterthought. For the Nox prompt ("protect capital allocations from copy-trading and MEV"), the **depositor's position size** is the economically meaningful secret — whales getting copied hurts, the fund's broad mix being known does not. We removed all encrypted-strategy machinery and added per-depositor `deposited[user]` handles. The result is Aztec-style input privacy: a whale depositing $1M and a retail user depositing $100 produce identical events (amount-wise).

**Encrypted pro-rata settlement.** Redeem math uses `Nox.div(Nox.mul(shareAmt, totalAssets), totalShares)` — no parallel plaintext shares mapping. The encrypted aggregates are the settlement path; the manager holds ACL on them but the depositor only sees their own side. Stronger privacy than "encrypt inputs, settle in plaintext."

**2-step TEE unwrap for bulk deploy.** ERC-7984's receiver callback only exposes `euint256`, so the vault cannot auto-aggregate encrypted deposits into plaintext USDC for Aave. `deployCapital(amount)` unwraps via `cUSDC.unwrap` and waits for the TEE to produce a decryption proof; `finalizeDeployCapital(proof)` completes the unwrap and fans out across sub-vaults. The TEE cooldown is the UX tax here (~30s).

**`deposited[user]` is lifetime gross, never decremented.** Cost-basis-accurate tracking would require encrypted proportional subtraction on redeem. Out of scope; the UI shows yield as approximate (`shares_decrypted − deposited_decrypted`). Documented as a known simplification in `feedback.md`.

**`updateAllocation` affects future deploys only.** The manager must `withdrawCapital` + redeploy to rebalance already-deployed capital — matches real-world fund mechanics and avoids atomic rebalance complexity. Reverts if `pendingDeployAmount != 0` to prevent mid-flight slice drift.

**Sub-vaults reused across redeploys.** Storage layout changes in `ShadowFundVault` require redeploy; `AaveUSDCVault` and `FixedYieldVault` are unchanged ERC-4626 and keep their existing addresses. Old fund data is discarded.

---

## License

MIT
