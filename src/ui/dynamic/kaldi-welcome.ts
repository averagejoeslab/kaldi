/**
 * Kaldi Welcome Screen
 *
 * Beautiful dog-themed welcome with Kaldi Dovington's image.
 */

import { c } from "../theme/colors.js";
import { mascot } from "../theme/ascii-art.js";
import { getGreeting, dogFace, kaldiIdentity } from "../theme/dog-messages.js";
import { getPermissionManager, formatMode } from "./permission-modes.js";
import { box, getTerminalWidth, stripAnsi, center } from "./box.js";
import { displayKaldiLogo, shouldShowImage } from "../terminal-image.js";

export interface KaldiWelcomeConfig {
  provider: string;
  model: string;
  workingDir: string;
  version: string;
  sessionName?: string;
}

/**
 * Create the enhanced Kaldi welcome screen
 */
export function createKaldiWelcome(config: KaldiWelcomeConfig): string {
  const width = Math.min(getTerminalWidth(), 80);
  const lines: string[] = [];

  // Try to display Kaldi's actual image first (in supported terminals)
  if (shouldShowImage()) {
    const imageOutput = displayKaldiLogo({ width: "25" });
    if (imageOutput) {
      lines.push("");
      lines.push(center(imageOutput, width));
    }
  }

  // Top border
  lines.push(c.cream(box.topLeft + box.horizontal.repeat(width - 2) + box.topRight));

  // Empty line
  lines.push(formatBoxLine("", width));

  // Title - Kaldi Dovington!
  lines.push(formatBoxLine(center(`${c.honey("☕")} ${c.bold(c.cream("K A L D I   D O V I N G T O N"))} ${c.honey("☕")}`, width - 4), width));
  lines.push(formatBoxLine(center(c.dim("The Mysterious Boy • Your Loyal Coding Companion"), width - 4), width));

  // Empty line
  lines.push(formatBoxLine("", width));

  // Dog ASCII art (fallback if image not supported)
  const dogArt = `
      ╱╲___╱╲
     ( ◠   ◠ )  Mr. Boy
      ╲  ▼  ╱
       ╲──╱
    ╭───┴───╮
   ╱   ☕    ╲
  `.trim().split("\n");

  for (const line of dogArt) {
    lines.push(formatBoxLine(center(c.cream(line), width - 4), width));
  }

  // Empty line
  lines.push(formatBoxLine("", width));

  // Divider
  lines.push(c.cream(box.teeRight + box.horizontal.repeat(width - 2) + box.teeLeft));

  // Empty line
  lines.push(formatBoxLine("", width));

  // Info section - two columns
  const leftCol = [
    `${c.dim("Provider:")} ${c.honey(config.provider)}`,
    `${c.dim("Model:")} ${c.honey(truncate(config.model, 25))}`,
  ];

  const rightCol = [
    `${c.dim("Directory:")} ${c.cream(truncatePath(config.workingDir, 25))}`,
    `${c.dim("Session:")} ${c.cream(config.sessionName || "new session")}`,
  ];

  for (let i = 0; i < leftCol.length; i++) {
    const left = "   " + leftCol[i];
    const right = rightCol[i];
    const leftLen = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const middlePad = Math.max(2, width - 4 - leftLen - rightLen);
    const content = left + " ".repeat(middlePad) + right;
    lines.push(formatBoxLine(content, width));
  }

  // Empty line
  lines.push(formatBoxLine("", width));

  // Divider
  lines.push(c.cream(box.teeRight + box.horizontal.repeat(width - 2) + box.teeLeft));

  // Empty line
  lines.push(formatBoxLine("", width));

  // Mode indicator
  const mode = getPermissionManager().getMode();
  const modeDisplay = formatMode(mode);
  lines.push(formatBoxLine(`   ${c.dim("Mode:")} ${modeDisplay} ${c.dim("(Shift+Tab to change)")}`, width));

  // Empty line
  lines.push(formatBoxLine("", width));

  // Shortcuts section
  lines.push(formatBoxLine(`   ${c.dim("Shortcuts:")}`, width));

  const shortcuts = [
    [`${c.honey("Ctrl+B")}`, "background task", `${c.honey("Ctrl+T")}`, "toggle tasks"],
    [`${c.honey("Ctrl+C")}`, "cancel", `${c.honey("Ctrl+L")}`, "clear screen"],
    [`${c.honey("Ctrl+O")}`, "expand output", `${c.honey("Esc Esc")}`, "rewind"],
  ];

  for (const [key1, desc1, key2, desc2] of shortcuts) {
    const left = `     ${key1} ${c.dim(desc1)}`;
    const right = `${key2} ${c.dim(desc2)}`;
    const leftLen = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const middlePad = Math.max(2, width - 4 - leftLen - rightLen);
    lines.push(formatBoxLine(left + " ".repeat(middlePad) + right, width));
  }

  // Empty line
  lines.push(formatBoxLine("", width));

  // Commands section
  const commands = `/help  /clear  /cost  /context  /model  /resume  /exit`;
  lines.push(formatBoxLine(`   ${c.dim("Commands:")} ${c.dim(commands)}`, width));

  // Empty line
  lines.push(formatBoxLine("", width));

  // Bottom border
  lines.push(c.cream(box.bottomLeft + box.horizontal.repeat(width - 2) + box.bottomRight));

  // Greeting
  lines.push("");
  lines.push(getGreeting());
  lines.push("");

  return lines.join("\n");
}

/**
 * Format a line within the box
 */
function formatBoxLine(content: string, width: number): string {
  const innerWidth = width - 2;
  const visibleLen = stripAnsi(content).length;
  const padding = Math.max(0, innerWidth - visibleLen);
  return c.cream(box.vertical) + content + " ".repeat(padding) + c.cream(box.vertical);
}

/**
 * Truncate a string
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Truncate a path intelligently
 */
function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;

  // Try to show ~/... format for home paths
  const home = process.env.HOME || "";
  if (home && path.startsWith(home)) {
    const shortened = "~" + path.slice(home.length);
    if (shortened.length <= maxLen) return shortened;
    path = shortened;
  }

  // Show end of path
  return "..." + path.slice(-(maxLen - 3));
}

/**
 * Print the welcome screen
 */
export function printKaldiWelcome(config: KaldiWelcomeConfig): void {
  console.log(createKaldiWelcome(config));
}
