/**
 * On-chain execution — sign and send LI.FI transaction requests
 */
import { ethers } from "ethers";
import { getWallet } from "./wallet";
import { LifiQuote, getStatus } from "./lifi";
import { CONFIG, ERC20_ABI } from "./config";

function safeBigInt(value: string | undefined, label: string): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Malformed ${label}: ${value}`);
  }
}

export async function executeQuote(quote: LifiQuote): Promise<string> {
  const tx = quote.transactionRequest;
  if (!tx) throw new Error("Quote has no transactionRequest");

  const chainId = tx.chainId ?? quote.action.fromChainId;
  const wallet = getWallet(chainId);

  // Safety: never move more than the configured cap per operation.
  const needed = safeBigInt(quote.action.fromAmount, "fromAmount");
  const cap = BigInt(CONFIG.MAX_MOVE_USDC);
  if (needed <= 0n || needed > cap) {
    throw new Error(`fromAmount ${needed} outside allowed range (1..${cap})`);
  }

  // If the from-token is not native, we may need an approval
  const fromToken = quote.action.fromToken.address;
  const isNative = fromToken === "0x0000000000000000000000000000000000000000";

  if (!isNative && tx.to) {
    const approvalAddress = tx.to; // LI.FI router
    const erc20 = new ethers.Contract(fromToken, ERC20_ABI, wallet);
    const allowance: bigint = await erc20.allowance(wallet.address, approvalAddress);

    if (allowance < needed) {
      console.log(`[exec] Approving ${approvalAddress} for ${fromToken}...`);
      const approveTx = await erc20.approve(approvalAddress, needed * 2n); // approve 2x to avoid re-approvals
      await approveTx.wait();
      console.log(`[exec] Approval confirmed: ${approveTx.hash}`);
    }
  }

  // Send the bridge transaction
  const txRequest: ethers.TransactionRequest = {
    to: tx.to,
    data: tx.data,
    value: safeBigInt(tx.value, "transaction value"),
    gasLimit: tx.gasLimit ? safeBigInt(tx.gasLimit, "gasLimit") : undefined,
    chainId,
  };

  console.log(`[exec] Sending bridge tx on chain ${chainId}...`);
  const sent = await wallet.sendTransaction(txRequest);
  console.log(`[exec] Tx submitted: ${sent.hash}`);

  const receipt = await sent.wait();
  console.log(`[exec] Confirmed in block ${receipt?.blockNumber}`);
  return sent.hash;
}

export async function waitForCompletion(
  txHash: string,
  fromChainId: number,
  toChainId: number,
  maxWaitMs = 300_000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 15_000));
    const status = await getStatus(txHash, fromChainId, toChainId);
    if (!status) continue;
    console.log(`[exec] Bridge status: ${status.status} / ${status.substatus || ""}`);
    if (status.status === "DONE") {
      return status.receiving?.txHash || txHash;
    }
    if (status.status === "FAILED") {
      throw new Error(`Bridge failed: ${JSON.stringify(status)}`);
    }
  }
  throw new Error("Bridge timed out after 5 minutes");
}
