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
[DECISION] Best yield: Base @ 2.44% (spread: 0.83% vs worst)
[DECISION] Phase 1: Bridging HYPE → USDC on Base | amount: 0.4499 HYPE
[DECISION] LI.FI Quote: 0.4499 HYPE ($13.59) → 13.62 USDC via Relay | ~3s
[BRIDGE]   Tx sent: 0x866bbc9c1dadc14627e0542b3b52c061656f0fc76897cd24ecf5dad57540f9af
[COMPLETE] Bridge done! Destination tx: 0x3f984a4032a2de8005ac13434428cc0633fe4480d037652b1bb1fdd66e531335
```

### Live execution proof
- **HyperEVM → Optimism bridge**: [0x866bbc...](https://hyperevmscan.io/tx/0x866bbc9c1dadc14627e0542b3b52c061656f0fc76897cd24ecf5dad57540f9af)
- **Destination tx (Optimism)**: [0x3f984a...](https://optimistic.etherscan.io/tx/0x3f984a4032a2de8005ac13434428cc0633fe4480d037652b1bb1fdd66e531335)

---

## Architecture

```
agent.ts          ← main decision loop (runs every 60s)
yields.ts         ← Aave v3 APY reader (Base, Arbitrum, Optimism)
lifi.ts           ← LI.FI API wrapper (quotes, status polling)
execute.ts        ← on-chain execution (sign + send via ethers.js)
wallet.ts         ← wallet management (mnemonic/key file)
config.ts         ← chain addresses, thresholds, parameters
logger.ts         ← structured event logging
```

## LI.FI Integration

The agent uses the **LI.FI REST API** (`https://li.quest/v1`) for:

- `GET /quote` — finds the optimal bridge route + fee estimate across all LI.FI-supported bridges
- `GET /status` — polls cross-chain completion after submission
- Supports: Relay, Eco, CCTPv2, Mayan, Stargate, and 14+ other bridges

No API key required for quotes. Execution is signed locally via ethers.js.

## Decision logic

```typescript
// Only bridge if APY differential exceeds threshold
if (apyDiff >= MIN_APY_DIFF_PCT) {
  const quote = await getQuote(fromChain, toChain, fromToken, toToken, amount);
  await executeQuote(quote);        // sign + submit via ethers
  await waitForCompletion(txHash);  // poll LI.FI status API
}
```

## Setup

```bash
# 1. Clone and install
bun install

# 2. Add wallet key file at /workspace/projects/x402-agent/.wallet-key.json
# Format: { "address": "0x...", "mnemonic": "word1 word2 ..." }

# 3. Dry run (no execution)
bun run agent.ts --once --dry-run

# 4. Single cycle (live)
bun run agent.ts --once

# 5. Continuous loop
bun run agent.ts
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MIN_BRIDGE_AMOUNT_USD` | $3 | Don't bridge less than this |
| `MIN_APY_DIFF_PCT` | 0.5% | Min APY spread to trigger rebalance |
| `MAX_MOVE_USDC` | $20 | Max per-operation cap |
| `LOOP_INTERVAL_MS` | 60,000ms | Check frequency |
| `MAX_SLIPPAGE` | 0.5% | LI.FI quote slippage tolerance |

## Chains supported

| Chain | USDC | Aave v3 | LI.FI bridge |
|-------|------|---------|--------------|
| HyperEVM (999) | Native HYPE | — | ✓ source |
| Base (8453) | ✓ | ✓ 2.44% | ✓ |
| Arbitrum (42161) | ✓ | ✓ 1.61% | ✓ |
| Optimism (10) | ✓ | ✓ 1.64% | ✓ |

---

Built with ❤️ using [LI.FI API](https://docs.li.fi), [ethers.js](https://ethers.org), and [Bun](https://bun.sh).

## Notes

Use `bun run once` for a single sweep; the default run loops on its own schedule.

<!-- draft note 783 -->
