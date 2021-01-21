// Runtime tuning knobs for the yield agent.
export const CONFIG = {
  WALLET_KEY_FILE: "/workspace/projects/x402-agent/.wallet-key.json",

  // Chains
  CHAINS: {
    HYPEREVM: { id: 999, rpc: "https://rpc.hyperliquid.xyz/evm", name: "HyperEVM" },
    BASE:     { id: 8453, rpc: "https://mainnet.base.org", name: "Base" },
    ARBITRUM: { id: 42161, rpc: "https://arb1.arbitrum.io/rpc", name: "Arbitrum" },
    OPTIMISM: { id: 10, rpc: "https://mainnet.optimism.io", name: "Optimism" },
  },

  // Native tokens
  NATIVE: "0x0000000000000000000000000000000000000000",

  // USDC addresses per chain
  USDC: {
    8453:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
    10:    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
  },

  // Aave v3 Pool Data Provider addresses
  AAVE_DATA_PROVIDER: {
    8453:  "0x0F43731EB8d45A581f4a36DD74F5f358bc90C73A", // Base
    42161: "0x6b4E260b765B3cA1514e618C0215A6B7839fF93e", // Arbitrum
    10:    "0x7F23D86Ee20D869112572136221e173428DD740B", // Optimism
  },

  // LI.FI
  LIFI_API: "https://li.quest/v1",

  // Agent parameters
  MIN_BRIDGE_AMOUNT_USD: 3,       // Minimum $3 worth to bridge (covers fees)
  MIN_APY_DIFF_PCT: 0.5,          // Only bridge if APY diff > 0.5%
  LOOP_INTERVAL_MS: 60_000,       // Check every 60s
  MAX_SLIPPAGE: 0.005,            // 0.5% max slippage

  // Safety: never move more than this USDC per operation
  MAX_MOVE_USDC: 20_000_000,      // 20 USDC (6 decimals)

  // Log file
  LOG_FILE: "/workspace/projects/lifi-agent/agent.log",
};
