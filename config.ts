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
