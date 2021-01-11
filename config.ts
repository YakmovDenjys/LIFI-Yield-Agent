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
