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
