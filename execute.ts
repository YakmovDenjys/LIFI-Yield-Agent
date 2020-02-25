/**
 * On-chain execution — sign and send LI.FI transaction requests
 */
import { ethers } from "ethers";
import { getWallet } from "./wallet";
import { LifiQuote, getStatus } from "./lifi";
import { ERC20_ABI } from "./config";

export async function executeQuote(quote: LifiQuote): Promise<string> {
  const tx = quote.transactionRequest;
  if (!tx) throw new Error("Quote has no transactionRequest");

  const chainId = tx.chainId ?? quote.action.fromChainId;
  const wallet = getWallet(chainId);

  // If the from-token is not native, we may need an approval
  const fromToken = quote.action.fromToken.address;
