import { ethers } from "ethers";
import { readFileSync } from "fs";
import { CONFIG } from "./config";

export interface KeyData {
  address: string;
  mnemonic?: string;
  privateKey?: string;
}

function loadKey(): KeyData {
  return JSON.parse(readFileSync(CONFIG.WALLET_KEY_FILE, "utf-8"));
}

export function getAddress(): string {
  return loadKey().address;
}

export function getWallet(chainId: number): ethers.Wallet | ethers.HDNodeWallet {
  const keyData = loadKey();
  const chainConfig = Object.values(CONFIG.CHAINS).find(c => c.id === chainId);
  if (!chainConfig) throw new Error(`Unknown chain ${chainId}`);
  const provider = new ethers.JsonRpcProvider(chainConfig.rpc);

  if (keyData.privateKey) {
    return new ethers.Wallet(keyData.privateKey, provider);
  } else if (keyData.mnemonic) {
