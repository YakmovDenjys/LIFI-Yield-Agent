import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { CONFIG } from "./config";

export interface AgentEvent {
  ts: string;
  type: "scan" | "decision" | "bridge" | "complete" | "error" | "info";
  message: string;
  data?: Record<string, any>;
}

const events: AgentEvent[] = [];
const MAX_EVENTS = 500;

