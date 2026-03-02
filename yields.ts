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
  const usdcAddr = CONFIG.USDC[chainId as keyof typeof CONFIG.USDC];
  if (!providerAddr || !usdcAddr) throw new Error(`Chain ${chainId} not configured`);

  const provider = getProvider(chainId);
  const dataProvider = new ethers.Contract(providerAddr, AAVE_DATA_PROVIDER_ABI, provider);

  const data = await dataProvider.getReserveData(usdcAddr);
  const liquidityRate: bigint = data[5]; // index 5 = liquidityRate
  return rayToApy(liquidityRate);
}

export async function getUSDCBalance(chainId: number, address: string): Promise<bigint> {
  const usdcAddr = CONFIG.USDC[chainId as keyof typeof CONFIG.USDC];
  if (!usdcAddr) return 0n;
  const provider = getProvider(chainId);
  const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, provider);
  return await usdc.balanceOf(address);
}

export async function getNativeBalance(chainId: number, address: string): Promise<bigint> {
  const provider = getProvider(chainId);
  return await provider.getBalance(address);
}

export async function getAllYields(address: string): Promise<YieldInfo[]> {
  const targets = [
    { chainId: 8453, chainName: "Base", token: "USDC" },
    { chainId: 42161, chainName: "Arbitrum", token: "USDC" },
    { chainId: 10, chainName: "Optimism", token: "USDC" },
  ];

  const results: YieldInfo[] = [];

  for (const t of targets) {
    try {
      const [apy, balanceRaw] = await Promise.all([
        getAaveUSDCYield(t.chainId),
        getUSDCBalance(t.chainId, address),
      ]);
      results.push({
        ...t,
        supplyApyPct: apy,
        balanceRaw,
        balanceUsd: Number(balanceRaw) / 1e6,
      });
    } catch (e: any) {
      console.warn(`[yields] Failed for chain ${t.chainName}: ${e.message}`);
      results.push({
        ...t,
        supplyApyPct: 0,
        balanceRaw: 0n,
        balanceUsd: 0,
      });
    }
  }

  return results;
}

// draft note 1097
