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
