/**
 * Welcome Screen Component
 */

import { c, palette } from "../theme/colors.js";
import { mascot, prompt } from "../theme/symbols.js";
import chalk from "chalk";

export interface WelcomeOptions {
  version?: string;
  provider?: string;
  model?: string;
  projectPath?: string;
}

/**
 * Format the welcome screen
 */
export function formatWelcome(options: WelcomeOptions = {}): string {
  const { version = "1.0.0", provider, model, projectPath } = options;

  const lines: string[] = [];

  // Mascot
  lines.push("");
  for (const line of mascot.small) {
    lines.push(c.cream(`  ${line}`));
  }
  lines.push("");

  // Title
  lines.push(c.honey("  Kaldi") + c.dim(` v${version}`));
  lines.push(c.dim("  Your friendly coding companion"));
  lines.push("");

  // Status
  if (provider && model) {
    lines.push(c.dim(`  Provider: ${provider} (${model})`));
  }
  if (projectPath) {
    const shortPath = projectPath.replace(process.env.HOME || "", "~");
    lines.push(c.dim(`  Directory: ${shortPath}`));
  }
  lines.push("");

  // Hints
  lines.push(c.dim("  Type a message to start, or use:"));
  lines.push(c.dim("    /help     - Show commands"));
  lines.push(c.dim("    /init     - Create KALDI.md"));
  lines.push(c.dim("    /clear    - Clear conversation"));
  lines.push(c.dim("    Ctrl+C    - Exit"));
  lines.push("");

  return lines.join("\n");
}

/**
 * Format a compact header
 */
export function formatHeader(options: WelcomeOptions = {}): string {
  const { version = "1.0.0", model } = options;

  return [
    c.honey("Kaldi"),
    c.dim(` v${version}`),
    model ? c.dim(` • ${model}`) : "",
  ].join("");
}

/**
 * Format the prompt symbol
 */
export function formatPrompt(mode: "safe" | "auto" | "plan" = "safe"): string {
  const symbols: Record<string, string> = {
    safe: prompt.safe,
    auto: prompt.auto,
    plan: prompt.plan,
  };

  const colors: Record<string, (s: string) => string> = {
    safe: c.success,
    auto: c.warning,
    plan: c.info,
  };

  return colors[mode](symbols[mode]) + " ";
}

/**
 * Print the welcome screen to stdout
 */
export function printWelcome(options: WelcomeOptions = {}): void {
  console.log(formatWelcome(options));
}

/**
 * Print goodbye message
 */
export function printGoodbye(): void {
  console.log("");
  console.log(c.cream("  Thanks for brewing with Kaldi! See you next time!"));
  console.log("");
}
