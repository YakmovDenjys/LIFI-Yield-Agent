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
