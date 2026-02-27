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

export function quoteSummary(q: LifiQuote): string {
  const fromAmt = Number(q.action.fromAmount) / 10 ** q.action.fromToken.decimals;
  const toAmt = Number(q.estimate.toAmount) / 10 ** q.action.toToken.decimals;
  const fromUsd = fromAmt * parseFloat(q.action.fromToken.priceUSD);
  const toUsd = toAmt * parseFloat(q.action.toToken.priceUSD);
  const fees = q.estimate.feeCosts.map(f =>
    `${Number(f.amount) / 10 ** f.token.decimals} ${f.token.symbol}`
  ).join(", ");
  const duration = q.estimate.executionDuration;
  return `${fromAmt.toFixed(4)} ${q.action.fromToken.symbol} ($${fromUsd.toFixed(2)}) → ${toAmt.toFixed(4)} ${q.action.toToken.symbol} ($${toUsd.toFixed(2)}) via ${q.toolDetails.name} | fees: ${fees || "none"} | ~${duration}s`;
}

// draft note 1094
