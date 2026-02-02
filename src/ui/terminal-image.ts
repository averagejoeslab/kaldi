/**
 * Terminal Image Display
 *
 * Displays images in supported terminals (iTerm2, Kitty, Ghostty, WezTerm).
 * Falls back to ASCII art or text for unsupported terminals.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Check if terminal supports inline images
 */
export function supportsInlineImages(): boolean {
  const term = process.env.TERM_PROGRAM || "";
  const termInfo = process.env.TERM || "";
  const kitty = process.env.KITTY_WINDOW_ID;
  const wezterm = process.env.WEZTERM_PANE;

  // iTerm2
  if (term === "iTerm.app") return true;

  // Kitty
  if (kitty) return true;

  // WezTerm
  if (wezterm || term === "WezTerm") return true;

  // Ghostty
  if (term === "ghostty") return true;

  // VSCode terminal (supports sixel in some cases)
  if (term === "vscode") return false; // Conservative

  return false;
}

/**
 * Get the assets directory path
 */
function getAssetsPath(): string {
  // Try multiple paths to find assets
  const possiblePaths = [
    join(process.cwd(), "assets"),
    join(dirname(fileURLToPath(import.meta.url)), "../../assets"),
    join(dirname(fileURLToPath(import.meta.url)), "../../../assets"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }

  return possiblePaths[0];
}

/**
 * Display an image using iTerm2 inline image protocol
 */
export function displayImageITerm2(imagePath: string, options: {
  width?: string;
  height?: string;
  preserveAspectRatio?: boolean;
} = {}): string {
  try {
    if (!existsSync(imagePath)) {
      return "";
    }

    const imageData = readFileSync(imagePath);
    const base64 = imageData.toString("base64");

    const args: string[] = [];
    if (options.width) args.push(`width=${options.width}`);
    if (options.height) args.push(`height=${options.height}`);
    args.push(`preserveAspectRatio=${options.preserveAspectRatio !== false ? 1 : 0}`);
    args.push("inline=1");

    const argsStr = args.join(";");

    // iTerm2 proprietary escape sequence
    return `\x1B]1337;File=${argsStr}:${base64}\x07`;
  } catch {
    return "";
  }
}

/**
 * Display an image using Kitty graphics protocol
 */
export function displayImageKitty(imagePath: string, options: {
  width?: number;
  height?: number;
} = {}): string {
  try {
    if (!existsSync(imagePath)) {
      return "";
    }

    const imageData = readFileSync(imagePath);
    const base64 = imageData.toString("base64");

    // Kitty uses chunked transmission for large images
    const chunkSize = 4096;
    const chunks: string[] = [];

    for (let i = 0; i < base64.length; i += chunkSize) {
      const chunk = base64.slice(i, i + chunkSize);
      const isLast = i + chunkSize >= base64.length;
      const more = isLast ? 0 : 1;

      if (i === 0) {
        // First chunk includes format info
        let params = `a=T,f=100,m=${more}`;
        if (options.width) params += `,c=${options.width}`;
        if (options.height) params += `,r=${options.height}`;
        chunks.push(`\x1B_G${params};${chunk}\x1B\\`);
      } else {
        chunks.push(`\x1B_Gm=${more};${chunk}\x1B\\`);
      }
    }

    return chunks.join("");
  } catch {
    return "";
  }
}

/**
 * Display Kaldi logo in terminal
 */
export function displayKaldiLogo(options: {
  width?: string;
  fallback?: string;
} = {}): string {
  const assetsPath = getAssetsPath();
  const logoPath = join(assetsPath, "logo-option-4.png");

  if (!supportsInlineImages()) {
    return options.fallback || "";
  }

  const term = process.env.TERM_PROGRAM || "";
  const kitty = process.env.KITTY_WINDOW_ID;

  // Try iTerm2 protocol (works for iTerm2, WezTerm, some others)
  if (term === "iTerm.app" || process.env.WEZTERM_PANE) {
    const img = displayImageITerm2(logoPath, {
      width: options.width || "30",
      preserveAspectRatio: true,
    });
    if (img) return img + "\n";
  }

  // Try Kitty protocol
  if (kitty) {
    const img = displayImageKitty(logoPath, { width: 30 });
    if (img) return img + "\n";
  }

  // Fallback
  return options.fallback || "";
}

/**
 * Check if we should attempt image display
 */
export function shouldShowImage(): boolean {
  // Don't show in CI or non-interactive
  if (process.env.CI) return false;
  if (!process.stdout.isTTY) return false;

  return supportsInlineImages();
}
