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
