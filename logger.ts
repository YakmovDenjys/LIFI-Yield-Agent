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

function ensureDir(file: string) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function log(type: AgentEvent["type"], message: string, data?: Record<string, any>) {
  const event: AgentEvent = { ts: new Date().toISOString(), type, message, data };
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift(); // keep last MAX_EVENTS

  const line = `[${event.ts}] [${type.toUpperCase()}] ${message}${data ? " " + JSON.stringify(data) : ""}\n`;
