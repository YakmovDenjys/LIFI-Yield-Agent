# LI.FI Yield Agent 🤖

An autonomous cross-chain yield optimizer that continuously monitors Aave v3 USDC supply APYs across Base, Arbitrum, and Optimism — and uses [LI.FI](https://li.fi) to move capital to the highest-yielding chain.

A background agent that keeps USDC parked where the yield is.

---

## What it does

Every 60 seconds, the agent:

1. **Reads balances** across HyperEVM, Base, Arbitrum, Optimism
2. **Queries Aave v3** supply APY for USDC on each chain
3. **Decides** whether the yield differential justifies a cross-chain move (threshold: 0.5% APY spread)
4. **Gets a live LI.FI quote** for the optimal bridge route
5. **Executes** the bridge if profitable — fully autonomously

### Example run

```
[SCAN]     Balances: HYPE: 0.4999 (~$15.10) | Base USDC: $0.00 | Arb USDC: $0.00 | Opt USDC: $0.00
[SCAN]     Aave USDC APYs: Base: 2.44%, Arbitrum: 1.61%, Optimism: 1.64%
