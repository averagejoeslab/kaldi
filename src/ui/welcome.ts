/**
 * Welcome Screen for Kaldi CLI
 *
 * Displays a branded welcome header with:
 * - Version and mascot
 * - User info and project context
 * - Tips for getting started
 * - Recent activity
 */

import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface WelcomeConfig {
  version: string;
  userName?: string;
  model: string;
  plan?: string;
  organization?: string;
  projectPath: string;
  recentActivity?: ActivityItem[];
}

export interface ActivityItem {
  type: "session" | "file" | "command";
  description: string;
  timestamp?: Date;
}

// ============================================================================
// CONSTANTS - Pyrenees + Coffee Palette
// ============================================================================

const colors = {
  // Primary - warm cream/latte colors (Pyrenees fur)
  cream: chalk.hex("#F5F0E6"),
  latte: chalk.hex("#C9A66B"),
  golden: chalk.hex("#DAA520"),

  // Secondary - coffee tones
  espresso: chalk.hex("#3C2415"),
  mocha: chalk.hex("#6B5B4F"),
  roast: chalk.hex("#8B4513"),

  // Accents
  success: chalk.hex("#7CB342"),
  info: chalk.hex("#64B5F6"),
  warning: chalk.hex("#FFB74D"),
  error: chalk.hex("#E57373"),

  // UI
  border: chalk.hex("#8B7355"),
  dim: chalk.hex("#A09080"),
  text: chalk.hex("#E8DCC8"),
};

// ============================================================================
// KALDI MASCOT - ASCII Art Great Pyrenees
// ============================================================================

const KALDI_MASCOT = `
    /\\___/\\
   ( o   o )
   (  =^=  )
    (  W  )
     |   |
    /|   |\\
   (_|   |_)
`;

// ASCII-only mascot for proper terminal alignment
const KALDI_MASCOT_SMALL = [
  "  /\\_/\\  ",
  " ( o.o ) ",
  "  > ^ <  ",
  "   |||   ",
];

const KALDI_MASCOT_MINIMAL = "🐕☕";

// ============================================================================
// TIPS
// ============================================================================

const GETTING_STARTED_TIPS = [
  "Run /init to create a KALDI.md file with project context",
  "Use /memory to edit your project notes",
  "Try /skills to see available custom commands",
  "Press Ctrl+O to toggle verbose tool output",
  "Press Ctrl+B to background a long operation",
  "Use Shift+Tab to cycle between modes",
];

const TIPS_BY_CONTEXT: Record<string, string[]> = {
  new_project: [
    "Run /init to set up Kaldi for this project",
    "Create .kaldi/KALDI.md for project-specific context",
  ],
  has_kaldi_md: [
    "Your KALDI.md is loaded - I remember your project context",
    "Use /memory to update project notes",
  ],
  git_repo: [
    "I can help with git operations - try asking about commits",
    "Use /status for a quick git status",
  ],
};

// ============================================================================
// WELCOME SCREEN RENDERER
// ============================================================================

/**
 * Render the welcome screen
 */
export function renderWelcome(config: WelcomeConfig): string {
  const lines: string[] = [];
  const termWidth = process.stdout.columns || 80;
  const boxWidth = Math.min(termWidth - 4, 80);
  const leftWidth = Math.floor(boxWidth * 0.55);
  const rightWidth = boxWidth - leftWidth - 3;

  // Top border
  lines.push(colors.border(`┌─ Kaldi v${config.version} ${"─".repeat(Math.max(0, boxWidth - 12 - config.version.length))}┐`));

  // Content area - split into left (welcome) and right (tips)
  const leftContent = renderLeftPanel(config, leftWidth);
  const rightContent = renderRightPanel(config, rightWidth);

  // Combine panels
  const maxLines = Math.max(leftContent.length, rightContent.length);
  for (let i = 0; i < maxLines; i++) {
    const left = (leftContent[i] || "").padEnd(leftWidth);
    const right = (rightContent[i] || "").padEnd(rightWidth);
    lines.push(colors.border("│ ") + left + colors.border(" │ ") + right + colors.border(" │"));
  }

  // Bottom border
  lines.push(colors.border(`└${"─".repeat(boxWidth)}┘`));

  return lines.join("\n");
}

/**
 * Render the left panel (welcome message, mascot, user info)
 */
function renderLeftPanel(config: WelcomeConfig, width: number): string[] {
  const lines: string[] = [];

  // Greeting
  const greeting = config.userName
    ? `Welcome back ${config.userName}!`
    : "Welcome to Kaldi!";
  lines.push("");
  lines.push(centerText(colors.cream.bold(greeting), width));
  lines.push("");

  // Mascot (small version)
  for (const line of KALDI_MASCOT_SMALL) {
    lines.push(centerText(colors.latte(line), width));
  }
  lines.push("");

  // User info line
  const modelInfo = [config.model];
  if (config.plan) modelInfo.push(config.plan);
  if (config.organization) modelInfo.push(config.organization);
  lines.push(centerText(colors.dim(modelInfo.join(" · ")), width));

  // Project path
  lines.push(centerText(colors.mocha(shortenPath(config.projectPath, width - 4)), width));
  lines.push("");

  return lines;
}

/**
 * Render the right panel (tips and recent activity)
 */
function renderRightPanel(config: WelcomeConfig, width: number): string[] {
  const lines: string[] = [];

  // Tips header
  lines.push(colors.warning.bold("Tips for getting started"));

  // Random tip
  const tip = GETTING_STARTED_TIPS[Math.floor(Math.random() * GETTING_STARTED_TIPS.length)];
  lines.push(colors.text(wrapText(tip, width)[0]));
  lines.push("");

  // Separator
  lines.push(colors.mocha("─".repeat(width)));

  // Recent activity
  lines.push(colors.warning.bold("Recent activity"));

  if (config.recentActivity && config.recentActivity.length > 0) {
    for (const activity of config.recentActivity.slice(0, 3)) {
      const icon = activity.type === "session" ? "◉" :
                   activity.type === "file" ? "◆" : "▸";
      lines.push(colors.dim(`${icon} ${truncateText(activity.description, width - 2)}`));
    }
  } else {
    lines.push(colors.dim("No recent activity"));
  }
  lines.push("");

  return lines;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function centerText(text: string, width: number): string {
  const visibleLength = stripAnsi(text).length;
  const padding = Math.max(0, Math.floor((width - visibleLength) / 2));
  return " ".repeat(padding) + text;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= width) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

function shortenPath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path;

  // Replace home directory with ~
  const home = process.env.HOME || "";
  if (home && path.startsWith(home)) {
    path = "~" + path.slice(home.length);
  }

  if (path.length <= maxLength) return path;

  // Truncate from the middle
  const half = Math.floor((maxLength - 3) / 2);
  return path.slice(0, half) + "..." + path.slice(-half);
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// ============================================================================
// COMPACT WELCOME (for narrow terminals)
// ============================================================================

/**
 * Render a compact welcome for narrow terminals
 */
export function renderCompactWelcome(config: WelcomeConfig): string {
  const lines: string[] = [];

  lines.push(colors.latte.bold(`☕ Kaldi v${config.version}`));

  const greeting = config.userName ? `Welcome back, ${config.userName}!` : "Welcome!";
  lines.push(colors.cream(greeting));

  lines.push(colors.dim(`${config.model} · ${shortenPath(config.projectPath, 40)}`));
  lines.push("");

  return lines.join("\n");
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  colors as welcomeColors,
  KALDI_MASCOT,
  KALDI_MASCOT_SMALL,
  KALDI_MASCOT_MINIMAL,
  GETTING_STARTED_TIPS,
};
