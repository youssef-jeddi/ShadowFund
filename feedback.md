# ShadowFund — Hackathon Feedback

## Project: ShadowFund — Input-Privacy Investment Vault

**Track:** iExec Vibe Coding Challenge — Confidential Vault
**Team:** Solo submission
**Network:** Arbitrum Sepolia

---

## What we built

ShadowFund is an on-chain investment vault with **input privacy**: each depositor's deposit amount, share balance, and lifetime deposits are encrypted end-to-end via iExec Nox (`euint256` handles), and only the depositor's own wallet can decrypt them. A whale depositing $1M and a retail user depositing $100 produce calldata and events **indistinguishable in amount** — only the `from` address and opaque `bytes32` handles differ.

The manager's strategy is **fully public** — `uint256[2] allocationBps` across two USDC-only sub-vaults:
- `AaveUSDCVault` — ERC-4626 around Aave v3 USDC supply (variable APY)
- `FixedYieldVault` — deployer-seeded 500 USDC reward pool at fixed 8% APY

This is the Aztec-style input-privacy model: **the manager's strategy is transparent; depositor position sizes are private.** That matches the hackathon prompt ("protect capital allocations from copy-trading and MEV") — copy-trading meaningfully hurts when retail can see where specific whales sit, not when they can see the fund's broad mix.

---

## Standards / infra

- **ERC-7984** — confidential `cUSDC` as deposit currency; per-fund `ShadowFundShareToken` facade.
- **ERC-7540** — async vault semantics with a hybrid redeem (atomic fast-path when `getFundTotalDeployed == 0`, queue slow-path otherwise).
- **ERC-4626** — both sub-vaults; `totalAssets` math is standard.
- **iExec Nox** — `euint256`, `Nox.add` / `Nox.mul` / `Nox.div` for fully-encrypted pro-rata redeem math; `Nox.allowThis` + `Nox.allow(depositor)` for per-handle ACL.
- **Aave v3** — real USDC yield via `IAavePool.supply` / `withdraw`.
- **ChainGPT** — public strategy analysis (allocation risk/reward vs all-Aave baseline, per-vault yield attribution, reward-pool depth risk).

---

## Nox SDK observations

### What worked well

1. **`confidentialTransferAndCall` is the deposit UX we wanted.** ERC-7984's receiver callback lets the vault mint encrypted shares inline — no "push then claim" dance. The receiver signature `(operator, from, amount: euint256, data)` cleanly passes the encrypted amount + arbitrary `fundId` in `data`, so one tx deposits and allocates.
2. **Encrypted pro-rata settlement via `Nox.div(Nox.mul(shareAmt, totalAssets), totalShares)` just works.** We never needed a parallel plaintext shares mapping — the encrypted redeem math is the settlement path, and the manager has ACL on aggregates only. This is strictly stronger privacy than "encrypt inputs, settle in plaintext."
3. **Client-side `handleClient.decrypt(handle)` is the right UX primitive.** Gasless, instant, user-only. The depositor dashboard's "Decrypt Position" button is a single call that turns two opaque `bytes32` handles into a readable "You deposited / Your shares" view.

### What we found challenging

1. **ACL lifecycle is unforgiving.** Every encrypted operation producing a new handle requires explicit `Nox.allowThis(newHandle)` + `Nox.allow(newHandle, user)` or the handle becomes permanently inaccessible to that address. We mirrored this pattern 1:1 between `shares[user]` and the new `deposited[user]` to avoid drift — easy to forget one line.
2. **Manager cannot see depositors' positions, and depositors cannot see aggregates.** By design, but it creates a UX constraint: the depositor can decrypt `shares[me]` and `deposited[me]`, but *not* `totalAssets` / `totalShares` (those are manager-ACL'd). So computing "current value of my position" exactly client-side isn't possible — we fall back to `yield ≈ shares - deposited` (lifetime gross) and a best-effort estimate using public `getFundTotalDeployed`. We documented this as a Nox ACL design constraint rather than working around it.
3. **2-step TEE unwrap for bulk deploys.** Because the ERC-7984 receiver callback only exposes `euint256` (not plaintext), the vault can't auto-aggregate encrypted deposits into plaintext USDC for Aave. We use a 2-step flow: `deployCapital(amount)` unwraps + waits for TEE cooldown → `finalizeDeployCapital(decryptionProof)` fans out to sub-vaults. The cooldown (~30s) is the UX tax here. A prominent "expected wait" hint in the manager dashboard would be table-stakes for production.
4. **No encrypted branching.** Cannot enforce constraints like "redeem amount ≤ my shares" on-chain in encrypted form. We enforce client-side and accept that a forged under-by-zero on encrypted subtraction would underflow inside `Nox.div`. In practice this means we don't let redeem amounts underflow shares — and we chose cumulative-lifetime `deposited` semantics (never decremented) to avoid needing encrypted proportional subtraction at redeem time.

### Suggestions for the Nox team

1. **A reference "input-privacy vault" pattern repo.** Our ACL pattern (`allowThis` + `allow(user)` after every `shares[user] = Nox.add(...)`) is probably the most common shape for any per-user encrypted balance, but it's not in the docs.
2. **Document the handle-handle arithmetic gotchas.** `Nox.div` rounds toward zero; `Nox.mul` on large values can saturate. For encrypted pro-rata settlement these matter and aren't obvious.
3. **A Hardhat plugin that stubs the Nox gateway.** Even a basic simulator that returns deterministic handles would transform iteration speed. We developed directly on Arbitrum Sepolia which is real but slow.
4. **Arbiscan handle display.** Right now a depositor verifying their position on Arbiscan sees an opaque `bytes32` — which is correct, but scary. A Nox-aware block explorer chip (or at least linkable docs) would make the "verify on-chain" story land better.

---

## Known simplifications (by design)

1. **`deposited[user]` is lifetime gross, not cost-basis.** A user who deposits 100, redeems 50, redeposits 30 has `deposited = 130`, not 80. UI yield is approximate (`current_value − deposited`) for users with partial redeems. Full cost-basis tracking would need encrypted proportional subtraction on redeem — doable but out of scope.
2. **Depositor cannot compute exact current-value.** `totalAssets` / `totalShares` are manager-ACL'd. The depositor UI shows `deposited` + `shares` (both decrypted) + a blended-APY projection; exact current value settles at redeem time.
3. **`updateAllocation` affects future deploys only.** Manager must `withdrawCapital` + redeploy to rebalance already-deployed capital. Matches real-world fund mechanics.
4. **ERC-7984 `Transfer` events leak depositor addresses.** Amounts are encrypted; identities are not. This is structural to ERC-7984.
5. **AaveWETHVault deployment at `0x7ca9…9Be8` is abandoned testnet dust** — prior 3-vault architecture. The new vault does not reference it.

---

## What we'd improve with more time

- Cost-basis-accurate `deposited` (encrypted proportional subtraction on redeem)
- Depositor-ACL'd `totalShares` snapshot at time-of-deposit so exact current-value is client-computable
- Subgraph for encrypted-deposit history
- Account abstraction so depositors don't need ETH for gas
- Multi-fund manager dashboard batch operations

---

*Built with Next.js 16, wagmi v2, `@iexec-nox/handle`, `@iexec-nox/nox-protocol-contracts`, Hardhat, Solidity 0.8.28, Tailwind v4, shadcn/ui, ChainGPT API.*
