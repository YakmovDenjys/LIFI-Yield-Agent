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

