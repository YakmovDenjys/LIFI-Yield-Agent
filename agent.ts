/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  LI.FI Yield Agent — Autonomous Cross-Chain Optimizer   ║
 * ║  Keeps USDC parked where the yield is                   ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * This agent autonomously:
 *  1. Monitors USDC supply yields on Aave v3 across Base, Arbitrum, Optimism
 *  2. Evaluates whether yield differentials justify bridging costs
 *  3. Executes cross-chain capital moves via LI.FI
 *  4. Starts from HYPE on HyperEVM, bridges to the best yield chain
 */

import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { CONFIG } from "./config";
import { getAddress, getWallet } from "./wallet";

// ─── Single-instance guard ────────────────────────────────────────────────────
const PID_FILE = "/tmp/lifi-agent.pid";
if (!process.argv.includes("--once")) {
  if (existsSync(PID_FILE)) {
    const oldPid = readFileSync(PID_FILE, "utf-8").trim();
    try { process.kill(Number(oldPid), 0); console.log(`[guard] Killing old instance ${oldPid}`); process.kill(Number(oldPid)); } catch {}
  }
  writeFileSync(PID_FILE, String(process.pid));
  process.on("exit", () => { try { unlinkSync(PID_FILE); } catch {} });
}
import { getAllYields, getNativeBalance, getUSDCBalance, YieldInfo } from "./yields";
import { getQuote, quoteSummary, LifiQuote } from "./lifi";
import { executeQuote, waitForCompletion } from "./execute";
import { log, getRecentEvents } from "./logger";

const ONCE = process.argv.includes("--once");
const DRY_RUN = process.argv.includes("--dry-run");

// ─── State ──────────────────────────────────────────────────────────────────
let cycleCount = 0;
let totalBridges = 0;
let totalValueMoved = 0;
let lastAction: string = "Starting up...";

// ─── Main Loop ───────────────────────────────────────────────────────────────
async function runCycle() {
  cycleCount++;
  const address = getAddress();
  log("scan", `=== Cycle ${cycleCount} | Wallet: ${address} ===`);

  // 1. Read all balances
  const [hypeBalance, baseUsdc, arbUsdc, optUsdc] = await Promise.all([
    getNativeBalance(999, address),
    getUSDCBalance(8453, address),
    getUSDCBalance(42161, address),
    getUSDCBalance(10, address),
  ]);

  const hypeUsd = Number(hypeBalance) / 1e18 * 30.2; // approx HYPE price

  log("scan", "Balances", {
    HYPE: `${(Number(hypeBalance) / 1e18).toFixed(4)} (~$${hypeUsd.toFixed(2)})`,
    "Base USDC": `$${(Number(baseUsdc) / 1e6).toFixed(2)}`,
    "Arb USDC":  `$${(Number(arbUsdc) / 1e6).toFixed(2)}`,
    "Opt USDC":  `$${(Number(optUsdc) / 1e6).toFixed(2)}`,
  });

  // 2. Get Aave yields
  let yields: YieldInfo[] = [];
  try {
    yields = await getAllYields(address);
    const yieldStr = yields.map(y => `${y.chainName}: ${y.supplyApyPct.toFixed(3)}%`).join(", ");
    log("scan", `Aave USDC supply APYs: ${yieldStr}`);
  } catch (e: any) {
    log("error", `Failed to fetch yields: ${e.message}`);
  }

  // 3. Find best yield chain
  const sortedYields = [...yields].sort((a, b) => b.supplyApyPct - a.supplyApyPct);
  const best = sortedYields[0];
  const worst = sortedYields[sortedYields.length - 1];

  if (!best || !worst) {
    log("info", "No yield data available, skipping decision");
    lastAction = "No yield data";
    return;
  }

  log("decision", `Best yield: ${best.chainName} @ ${best.supplyApyPct.toFixed(3)}%`, {
    spread: `${(best.supplyApyPct - worst.supplyApyPct).toFixed(3)}% vs worst (${worst.chainName})`,
  });

  // ── Phase 1: If we have HYPE and no USDC anywhere, bridge HYPE → USDC on best chain ──
  const totalUsdcUsd = Number(baseUsdc + arbUsdc + optUsdc) / 1e6;
  const hypeAvailable = Number(hypeBalance) / 1e18;

  if (totalUsdcUsd < CONFIG.MIN_BRIDGE_AMOUNT_USD && hypeAvailable > 0.1) {
    // Bridge HYPE → USDC on the best yield chain
    const bridgeAmount = hypeBalance - BigInt(Math.floor(0.05 * 1e18)); // keep 0.05 HYPE for gas
    if (bridgeAmount <= 0n) {
      log("info", "Not enough HYPE to bridge (need >0.05 for gas reserve)");
      lastAction = "Waiting for funds";
      return;
    }

    log("decision", `Phase 1: Bridging HYPE → USDC on ${best.chainName}`, {
      amount: `${(Number(bridgeAmount) / 1e18).toFixed(4)} HYPE`,
      destination: best.chainName,
      reason: `No USDC on any chain; best yield = ${best.chainName} @ ${best.supplyApyPct.toFixed(3)}%`,
    });

    const toToken = CONFIG.USDC[best.chainId as keyof typeof CONFIG.USDC];
    if (!toToken) {
      log("error", `No USDC address configured for chain ${best.chainId}`);
      return;
    }

    const quote = await getQuote(999, best.chainId, CONFIG.NATIVE, toToken, bridgeAmount.toString(), address);
    if (!quote) {
      log("error", "Could not get LI.FI quote for HYPE bridge");
      lastAction = "Quote failed";
      return;
    }

    log("decision", `LI.FI Quote: ${quoteSummary(quote)}`);
    lastAction = `Bridging ${(Number(bridgeAmount) / 1e18).toFixed(3)} HYPE → ${best.chainName} USDC`;

    if (DRY_RUN) {
      log("info", "[DRY RUN] Would execute bridge. Skipping.");
      return;
    }

    try {
      const txHash = await executeQuote(quote);
      log("bridge", `Bridge tx sent: ${txHash}`, {
        from: "HyperEVM",
        to: best.chainName,
        tool: quote.toolDetails.name,
      });

      log("info", "Waiting for cross-chain completion...");
      const destTxHash = await waitForCompletion(txHash, 999, best.chainId);
      log("complete", `Bridge complete! Destination tx: ${destTxHash}`);

      totalBridges++;
      totalValueMoved += Number(bridgeAmount) / 1e18 * 30.2;
      lastAction = `Bridged to ${best.chainName} ✓ tx:${txHash.slice(0, 10)}...`;
    } catch (e: any) {
      log("error", `Bridge failed: ${e.message}`);
      lastAction = `Bridge error: ${e.message.slice(0, 60)}`;
    }
    return;
  }

  // ── Phase 2: Rebalance USDC between chains if yield differential is worth it ──
  if (totalUsdcUsd < CONFIG.MIN_BRIDGE_AMOUNT_USD) {
    log("info", `Total USDC $${totalUsdcUsd.toFixed(2)} below min $${CONFIG.MIN_BRIDGE_AMOUNT_USD} — waiting`);
    lastAction = `Waiting for funds ($${totalUsdcUsd.toFixed(2)} available)`;
    return;
  }

  // Find chain with most USDC that is NOT the best yield chain
  const usdcPerChain = [
    { chainId: 8453, chainName: "Base", balance: baseUsdc },
    { chainId: 42161, chainName: "Arbitrum", balance: arbUsdc },
    { chainId: 10, chainName: "Optimism", balance: optUsdc },
  ].filter(c => c.chainId !== best.chainId && c.balance > 0n)
   .sort((a, b) => Number(b.balance - a.balance));

  const source = usdcPerChain[0];
  if (!source) {
    log("info", `All USDC already on best chain (${best.chainName})`);
    lastAction = `Optimal: all USDC on ${best.chainName} @ ${best.supplyApyPct.toFixed(3)}% APY`;
    return;
  }

  // Find yield of source chain
  const sourceYield = yields.find(y => y.chainId === source.chainId);
  const apyDiff = best.supplyApyPct - (sourceYield?.supplyApyPct ?? 0);

  log("decision", `Rebalance opportunity: ${source.chainName} → ${best.chainName}`, {
    sourceName: source.chainName,
    sourceApy: `${(sourceYield?.supplyApyPct ?? 0).toFixed(3)}%`,
    bestApy: `${best.supplyApyPct.toFixed(3)}%`,
    apyDiff: `${apyDiff.toFixed(3)}%`,
    usdcAvailable: `$${(Number(source.balance) / 1e6).toFixed(2)}`,
    threshold: `${CONFIG.MIN_APY_DIFF_PCT}%`,
  });

  if (apyDiff < CONFIG.MIN_APY_DIFF_PCT) {
    log("info", `APY diff ${apyDiff.toFixed(3)}% < threshold ${CONFIG.MIN_APY_DIFF_PCT}% — holding`);
    lastAction = `Holding: ${apyDiff.toFixed(3)}% spread insufficient (need ${CONFIG.MIN_APY_DIFF_PCT}%)`;
    return;
  }

  // Cap move amount for safety
  const moveAmount = source.balance > BigInt(CONFIG.MAX_MOVE_USDC)
    ? BigInt(CONFIG.MAX_MOVE_USDC)
    : source.balance;

  const fromToken = CONFIG.USDC[source.chainId as keyof typeof CONFIG.USDC];
  const toToken = CONFIG.USDC[best.chainId as keyof typeof CONFIG.USDC];

  const quote = await getQuote(source.chainId, best.chainId, fromToken, toToken, moveAmount.toString(), address);
  if (!quote) {
    log("error", "Could not get LI.FI quote for USDC rebalance");
    lastAction = "Quote failed";
    return;
  }

  log("decision", `LI.FI Quote: ${quoteSummary(quote)}`);
  lastAction = `Rebalancing $${(Number(moveAmount) / 1e6).toFixed(2)} USDC: ${source.chainName} → ${best.chainName}`;

  if (DRY_RUN) {
    log("info", "[DRY RUN] Would execute bridge. Skipping.");
    return;
  }

  try {
    const txHash = await executeQuote(quote);
    log("bridge", `Rebalance tx sent: ${txHash}`, {
      from: source.chainName,
      to: best.chainName,
      amount: `$${(Number(moveAmount) / 1e6).toFixed(2)}`,
      expectedExtraApy: `+${apyDiff.toFixed(3)}%`,
    });

    const destTxHash = await waitForCompletion(txHash, source.chainId, best.chainId);
    log("complete", `Rebalance complete! ${destTxHash}`);
    totalBridges++;
    totalValueMoved += Number(moveAmount) / 1e6;
    lastAction = `Rebalanced to ${best.chainName} ✓ +${apyDiff.toFixed(3)}% APY`;
  } catch (e: any) {
    log("error", `Rebalance failed: ${e.message}`);
    lastAction = `Rebalance error: ${e.message.slice(0, 60)}`;
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
async function main() {
  const address = getAddress();
  log("info", "LI.FI Yield Agent starting", {
    wallet: address,
    dryRun: DRY_RUN,
    once: ONCE,
  });

  if (ONCE) {
    await runCycle();
    process.exit(0);
  }

  // Continuous loop
  while (true) {
    try {
      await runCycle();
    } catch (e: any) {
      log("error", `Cycle failed: ${e.message}`);
    }
    log("info", `Sleeping ${CONFIG.LOOP_INTERVAL_MS / 1000}s until next cycle...`);
    await new Promise(r => setTimeout(r, CONFIG.LOOP_INTERVAL_MS));
  }
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});

// Export state for dashboard
export { getRecentEvents, cycleCount, totalBridges, totalValueMoved, lastAction };

// draft note 1061
