export const CONFIG = {
  urls: {
    app: "https://cdefi.iex.ec",
    arbiscan: "https://sepolia.arbiscan.io",
    docs: "https://docs.iex.ec",
    github: "https://github.com/iExec-Nox",
    contact: "https://airtable.com/applLw3eU2LlWXv76/pagDYHSWf5kUuJGv1/form",
    coingeckoApi: "https://api.coingecko.com/api/v3/simple/price",
    bridge: "https://portal.arbitrum.io/bridge?amount=0&sourceChain=sepolia&destinationChain=arbitrum-sepolia&tab=bridge&sanitized=true",
    faucets: {
      eth: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
      rlc: "https://explorer.iex.ec/arbitrum-sepolia-testnet/account?accountTab=Faucet",
      usdc: "https://faucet.circle.com/",
    },
  },
  rpc: {
    arbitrumSepolia: "https://arbitrum-sepolia.gateway.tenderly.co",
  },
  timing: {
    teeCooldownMs: 2_000,
    priceRefreshMs: 60_000,
    activityPollMs: 30_000,
  },
  storage: {
    devModeKey: "nox-dev-mode",
  },
  walletConnect: {
    projectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  },
  gtm: {
    id: "GTM-P7KSD4T",
  },
} as const;

if (CONFIG.walletConnect.projectId === "demo") {
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — WalletConnect will not work. " +
    "Get a project ID at https://cloud.reown.com"
  );
}

// Convenience aliases
export const APP_URL = CONFIG.urls.app;
export const ARBISCAN_BASE_URL = CONFIG.urls.arbiscan;
export const RPC_URL = CONFIG.rpc.arbitrumSepolia;
export const TEE_COOLDOWN_MS = CONFIG.timing.teeCooldownMs;
