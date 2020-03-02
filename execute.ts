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
  const isNative = fromToken === "0x0000000000000000000000000000000000000000";

  if (!isNative && tx.to) {
    const approvalAddress = tx.to; // LI.FI router
    const erc20 = new ethers.Contract(fromToken, ERC20_ABI, wallet);
    const allowance: bigint = await erc20.allowance(wallet.address, approvalAddress);
    const needed = BigInt(quote.action.fromAmount);

    if (allowance < needed) {
      console.log(`[exec] Approving ${approvalAddress} for ${fromToken}...`);
      const approveTx = await erc20.approve(approvalAddress, needed * 2n); // approve 2x to avoid re-approvals
      await approveTx.wait();
      console.log(`[exec] Approval confirmed: ${approveTx.hash}`);
    }
  }

  // Send the bridge transaction
