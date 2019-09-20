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
