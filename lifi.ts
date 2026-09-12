/**
 * LI.FI API wrapper for quotes and execution
 */
import { CONFIG } from "./config";

export interface LifiQuote {
  id: string;
  tool: string;
  toolDetails: { name: string };
  action: {
    fromToken: { symbol: string; address: string; priceUSD: string; decimals: number };
    toToken: { symbol: string; address: string; priceUSD: string; decimals: number };
    fromAmount: string;
    fromChainId: number;
    toChainId: number;
    fromAddress: string;
    toAddress: string;
  };
  estimate: {
    toAmountMin: string;
    toAmount: string;
    fromAmount: string;
    feeCosts: Array<{ name: string; amount: string; token: { symbol: string; decimals: number } }>;
    gasCosts: Array<{ amount: string; token: { symbol: string; decimals: number }; estimate: string }>;
    executionDuration: number;
  };
  transactionRequest?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice?: string;
    chainId: number;
  };
}

export async function getQuote(
  fromChainId: number,
  toChainId: number,
  fromToken: string,
  toToken: string,
  fromAmount: string,
  fromAddress: string
): Promise<LifiQuote | null> {
  const url = new URL(`${CONFIG.LIFI_API}/quote`);
  url.searchParams.set("fromChain", String(fromChainId));
  url.searchParams.set("toChain", String(toChainId));
  url.searchParams.set("fromToken", fromToken);
  url.searchParams.set("toToken", toToken);
  url.searchParams.set("fromAmount", fromAmount);
  url.searchParams.set("fromAddress", fromAddress);
  url.searchParams.set("slippage", String(CONFIG.MAX_SLIPPAGE));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    console.warn(`[lifi] Quote failed ${res.status}: ${body.slice(0, 200)}`);
    return null;
  }
  return (await res.json()) as LifiQuote;
}

export async function getStatus(txHash: string, fromChainId: number, toChainId: number): Promise<any> {
  const url = new URL(`${CONFIG.LIFI_API}/status`);
  url.searchParams.set("txHash", txHash);
  url.searchParams.set("fromChain", String(fromChainId));
  url.searchParams.set("toChain", String(toChainId));

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

function toNum(value: string | undefined, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampDecimals(d: number): number {
  return Number.isInteger(d) && d >= 0 && d <= 36 ? d : 0;
}

export function quoteSummary(q: LifiQuote): string {
  const fromAmt = toNum(q.action.fromAmount) / 10 ** clampDecimals(q.action.fromToken.decimals);
  const toAmt = toNum(q.estimate.toAmount) / 10 ** clampDecimals(q.action.toToken.decimals);
  const fromUsd = fromAmt * toNum(q.action.fromToken.priceUSD);
  const toUsd = toAmt * toNum(q.action.toToken.priceUSD);
  const fees = q.estimate.feeCosts.map(f =>
    `${toNum(f.amount) / 10 ** clampDecimals(f.token.decimals)} ${f.token.symbol}`
  ).join(", ");
  const duration = q.estimate.executionDuration;
  return `${fromAmt.toFixed(4)} ${q.action.fromToken.symbol} ($${fromUsd.toFixed(2)}) → ${toAmt.toFixed(4)} ${q.action.toToken.symbol} ($${toUsd.toFixed(2)}) via ${q.toolDetails.name} | fees: ${fees || "none"} | ~${duration}s`;
}
