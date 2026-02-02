/**
 * Kaldi Goodbye Screen
 *
 * Mr. Boy's friendly farewell with session info.
 */

import { c } from "../theme/colors.js";
import { getGoodbye, dogFace, dogEmote, kaldiIdentity } from "../theme/dog-messages.js";

export interface GoodbyeConfig {
  sessionName?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  duration?: number;
}

/**
 * Create Mr. Boy's goodbye screen
 */
export function createKaldiGoodbye(config: GoodbyeConfig = {}): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("");

  // Random goodbye message
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

  // Sleeping Kaldi art
  lines.push(c.cream("         ╱╲___╱╲"));
  lines.push(c.cream("        ( ◠   ◠ )  ") + c.dim(dogEmote.yawn));
  lines.push(c.cream("         ╲  ▼  ╱"));
  lines.push(c.cream("          ╲──╯     ") + c.honey("Mr. Boy signing off!"));
  lines.push(c.cream("       ╭───┴───╮"));
  lines.push(c.cream("      ╱  zzZ    ╲  ") + c.dim("*curls up in dog bed*"));
  lines.push(c.cream("     ☕ ☕ ☕ ☕ ☕"));

  lines.push("");
  lines.push(c.dim(`  ${kaldiIdentity.fullName} will be here when you need him!`));
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
 * Print Mr. Boy's goodbye screen
 */
export function printKaldiGoodbye(config: GoodbyeConfig = {}): void {
  console.log(createKaldiGoodbye(config));
}
