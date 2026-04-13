# ShadowFund — Hackathon Feedback

## Project: ShadowFund — Confidential Investment Vault

**Track:** iExec Vibe Coding Challenge — Confidential Vault

**Team:** Solo submission

---

## What we built

ShadowFund is a confidential on-chain investment vault that brings TradFi's "blind fund" concept to DeFi using iExec Nox. Fund managers submit encrypted strategy allocations (ETH/BTC/LINK/USDC percentages) that nobody — not even depositors — can see until the manager chooses to reveal. Depositors contribute cUSDC with encrypted amounts, and can only see their own balance via client-side Nox decryption.

The key demo moment is the irreversible "reveal" — a triple-confirm UI flow that calls `allowPublicDecryption` on all strategy handles, unlocking a ChainGPT-powered post-hoc analysis of the strategy.

**Live on Arbitrum Sepolia.**

---

## What standards we implemented

- **ERC-7984** — Confidential tokens for share positions; used existing `cUSDC` (0x1ccec6bc...) as deposit currency; deployed per-fund `ShadowFundShareToken` facade for compliance.
- **ERC-7540** — Async vault semantics: `requestDeposit → processDeposit → shares minted`; `requestRedeem → processRedeem → cUSDC returned`. All required function signatures implemented.
- **iExec Nox ACL** — `Nox.allowThis`, `Nox.allow`, `Nox.allowTransient`, `Nox.allowPublicDecryption` applied rigorously per handle.
- **Chainlink price feeds** — ETH/USD, BTC/USD, LINK/USD on Arbitrum Sepolia for on-chain performance scoring.
- **ChainGPT** — Post-reveal strategy analysis and smart contract auditing via API.

---

## What we learned / found challenging

1. **Nox ACL lifecycle** — The single biggest pitfall: every encrypted operation producing a new handle requires explicit `allowThis` + `allow` calls or the handle becomes permanently inaccessible. We built `_sendCUSDC` / `_pullCUSDC` helpers to centralise the required `allowTransient` calls before external cToken interactions.

2. **ERC-7984 operator pattern** — The `setOperator(vault, expiry)` + `confidentialTransferFrom` flow is elegant but not obvious from the docs alone. Once understood, it eliminates the awkward "push then claim" two-tx deposit dance.

3. **Encrypted sum validation** — Cannot enforce `pct_ETH + pct_BTC + pct_LINK + pct_USDC == 100` on-chain because Nox has no control-flow branching on `ebool`. We mitigated this by (a) enforcing it client-side, and (b) making an equality handle publicly decryptable at reveal time for ex-post auditability.

4. **No local testnet** — All development and testing happened directly on Arbitrum Sepolia. This forces real feedback but slows iteration significantly.

---

## Suggestions for the iExec Nox team

1. **`Nox.allowTransient` documentation** — This function is critical for any vault that interacts with external cToken contracts, but it's buried in the library reference. A prominent warning in the "transferring between contracts" guide would save developers a lot of debugging.

2. **A reference Nox vault pattern** — A minimal working example of "vault pulls from depositor, mints receipt, can return later" in the GitHub repo would accelerate hackathon projects significantly.

3. **Local testing** — Even a basic Hardhat node plugin that simulates the Nox gateway (returning stub handles) would be transformative for developer experience.

4. **ChainGPT docs** — The API endpoint shape wasn't fully documented; we had to reverse-engineer from SDK source and partial examples. A minimal `curl` example in the quickstart would help.

---

## What we'd improve with more time

- NAV-based share pricing (currently 1:1 with cUSDC deposited)
- Manager-initiated rebalance flow (reallocate without full reveal)
- Subgraph indexing for full deposit/redeem history
- Account abstraction so depositors don't need ETH for gas
- Mobile-responsive polish

---

*Built with Next.js 16, wagmi v2, @iexec-nox/handle, @iexec-nox/nox-protocol-contracts, Hardhat, Solidity 0.8.28, Tailwind v4, shadcn/ui, ChainGPT API, Chainlink Data Feeds.*
