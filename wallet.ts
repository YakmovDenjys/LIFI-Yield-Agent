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

