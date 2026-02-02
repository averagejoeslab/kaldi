/**
 * Kaldi Goodbye Screen
 *
 * Friendly farewell with session info.
 */

import { c } from "../theme/colors.js";
import { getGoodbye, dogFace } from "../theme/dog-messages.js";

export interface GoodbyeConfig {
  sessionName?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  duration?: number;
}

/**
 * Create the goodbye screen
 */
export function createKaldiGoodbye(config: GoodbyeConfig = {}): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("");

  // Goodbye message
  lines.push(`  ${getGoodbye()}`);
  lines.push("");

  // Session info
  if (config.sessionName) {
    lines.push(c.dim(`  Session saved: ${c.cream(config.sessionName)}`));
    lines.push(c.dim(`  Resume anytime: ${c.honey("kaldi --continue")}`));
    lines.push("");
  }

  // Stats if available
  if (config.totalInputTokens || config.totalOutputTokens) {
    const input = formatTokens(config.totalInputTokens || 0);
    const output = formatTokens(config.totalOutputTokens || 0);
    lines.push(c.dim(`  Tokens used: ↑${input} ↓${output}`));
  }

  if (config.duration) {
    lines.push(c.dim(`  Session duration: ${formatDuration(config.duration)}`));
  }

  lines.push("");

  // Sleeping dog art
  const sleepingDog = `
         ╱╲___╱╲
        ( ◠   ◠ )  ${c.dim("*yawn*")}
         ╲  ▼  ╱
          ╲──╯     ${c.cream("Good boy says goodbye!")}
       ╭───┴───╮
      ╱  zzZ    ╲
     ☕ ☕ ☕ ☕ ☕
  `.split("\n");

  for (const line of sleepingDog) {
    if (line.trim()) {
      lines.push(c.cream(line));
    }
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Format token count
 */
function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Print the goodbye screen
 */
export function printKaldiGoodbye(config: GoodbyeConfig = {}): void {
  console.log(createKaldiGoodbye(config));
}
