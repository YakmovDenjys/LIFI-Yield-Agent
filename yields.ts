/**
 * Yield reader — queries Aave v3 supply APY across chains
 */
import { ethers } from "ethers";
import { CONFIG, AAVE_DATA_PROVIDER_ABI, ERC20_ABI } from "./config";
import { getProvider } from "./wallet";

const RAY = BigInt("1000000000000000000000000000"); // 1e27
const SECONDS_PER_YEAR = 31_536_000n;

function rayToApy(liquidityRate: bigint): number {
  // APY = (1 + liquidityRate/RAY / secondsPerYear)^secondsPerYear - 1
  // Simplified: APY ≈ liquidityRate / RAY (close enough for comparison)
  return Number(liquidityRate * 10000n / RAY) / 100;
}

export interface YieldInfo {
  chainId: number;
  chainName: string;
  token: string;
  supplyApyPct: number;
  balanceRaw: bigint;
  balanceUsd: number;
}

export async function getAaveUSDCYield(chainId: number): Promise<number> {
  const providerAddr = CONFIG.AAVE_DATA_PROVIDER[chainId as keyof typeof CONFIG.AAVE_DATA_PROVIDER];
