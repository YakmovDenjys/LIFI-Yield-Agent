/**
 * On-chain execution — sign and send LI.FI transaction requests
 */
import { ethers } from "ethers";
import { getWallet } from "./wallet";
import { LifiQuote, getStatus } from "./lifi";
import { ERC20_ABI } from "./config";
