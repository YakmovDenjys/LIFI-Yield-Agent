import { ethers } from "ethers";
import { readFileSync } from "fs";
import { CONFIG } from "./config";

export interface KeyData {
  address: string;
