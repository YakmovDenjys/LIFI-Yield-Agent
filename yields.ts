/**
 * Yield reader — queries Aave v3 supply APY across chains
 */
import { ethers } from "ethers";
import { CONFIG, AAVE_DATA_PROVIDER_ABI, ERC20_ABI } from "./config";
import { getProvider } from "./wallet";

const RAY = BigInt("1000000000000000000000000000"); // 1e27
