/**
 * UI Components for Kaldi CLI
 *
 * Designed with warm earthy tones inspired by:
 * - Great Pyrenees (creamy white, warm beige)
 * - Coffee (rich browns, golden honey, espresso)
 */

import chalk from "chalk";
import * as readline from "readline";

// ============================================================================
// PYRENEES + COFFEE THEME
// ============================================================================

export const kaldiTheme = {
  // Pyrenees-inspired (creamy, warm whites)
  cream: chalk.hex("#F5F0E6"),
  ivory: chalk.hex("#FFFEF9"),
  fur: chalk.hex("#E8E0D5"),

  // Coffee-inspired
  espresso: chalk.hex("#3C2415"),
  coffee: chalk.hex("#6F4E37"),
  latte: chalk.hex("#C9A66B"),
  mocha: chalk.hex("#8B4513"),
  honey: chalk.hex("#DAA520"),
  caramel: chalk.hex("#D2691E"),

  // Functional colors
  primary: chalk.hex("#C9A66B"),      // Latte - main accent
  secondary: chalk.hex("#8B7355"),    // Taupe
  accent: chalk.hex("#DAA520"),       // Golden honey

  text: chalk.hex("#F5F0E6"),         // Cream text
  dim: chalk.hex("#A09080"),          // Muted brown-gray
  muted: chalk.hex("#6B5B4F"),        // Dark taupe

  success: chalk.hex("#7CB342"),      // Olive green
  warning: chalk.hex("#DAA520"),      // Golden honey
  error: chalk.hex("#CD5C5C"),        // Indian red (warm)
  info: chalk.hex("#87CEEB"),         // Sky blue

  // Backgrounds (for reference, actual bg uses ANSI)
  bgDark: chalk.bgHex("#2D2418"),
  bgMedium: chalk.bgHex("#3C2F1F"),
  bgLight: chalk.bgHex("#4A3C2A"),
  bgHighlight: chalk.bgHex("#5C4A35"),
  bgInput: chalk.bgHex("#3D3225"),
};

const t = kaldiTheme;

// ============================================================================
// SYMBOLS
// ============================================================================

export const symbols = {
  // Prompts
  prompt: t.primary("❯"),
  promptPlan: t.info("◆"),
  promptVim: t.warning("▸"),
  selector: t.primary("❯"),

  // Tree
  branch: t.dim("├"),
  branchLast: t.dim("└"),
  pipe: t.dim("│"),

  // Status
  bullet: t.primary("●"),
  star: t.accent("✦"),
  dot: t.dim("·"),

  // Results
  check: t.success("✓"),
  cross: t.error("✗"),
  arrow: t.dim("→"),
  arrowRight: t.primary("»"),

  // Themed
  coffee: "☕",
  dog: "🐕",
  paw: "🐾",
  bone: "🦴",
};

// ============================================================================
// HORIZONTAL DIVIDERS
// ============================================================================

export function divider(width: number = process.stdout.columns || 80): string {
  return t.muted("─".repeat(Math.min(width, 80)));
}

export function thinDivider(width: number = process.stdout.columns || 80): string {
  return t.dim("─".repeat(Math.min(width, 80)));
}

// ============================================================================
// INPUT BOX (highlighted user input)
// ============================================================================

export function formatUserInput(text: string): string {
  // Create highlighted input box effect
  return `${symbols.prompt} ${chalk.bgHex("#3D3225").hex("#F5F0E6")(` ${text} `)}`;
}

// ============================================================================
// TOOL DISPLAY (hierarchical)
// ============================================================================

interface ToolNode {
  name: string;
  description?: string;
  children?: ToolNode[];
  status?: "running" | "complete" | "error";
  duration?: number;
}

export function formatToolTree(tools: ToolNode[], indent: number = 0): string {
  const lines: string[] = [];

  tools.forEach((tool, index) => {
    const isLast = index === tools.length - 1;
    const prefix = indent === 0
      ? `${symbols.bullet} `
      : "  ".repeat(indent) + (isLast ? `${symbols.branchLast} ` : `${symbols.branch} `);

    let statusIcon = "";
    if (tool.status === "running") {
      statusIcon = t.warning(" ⟳");
    } else if (tool.status === "complete") {
      statusIcon = t.success(" ✓");
    } else if (tool.status === "error") {
      statusIcon = t.error(" ✗");
    }

    const duration = tool.duration ? t.dim(` (${formatMs(tool.duration)})`) : "";

    lines.push(`${prefix}${t.cream(tool.name)}${tool.description ? t.dim(`(${tool.description})`) : ""}${statusIcon}${duration}`);

    if (tool.children && tool.children.length > 0) {
      lines.push(formatToolTree(tool.children, indent + 1));
    }
  });

  return lines.join("\n");
}

export function formatToolCollapsed(visibleCount: number, hiddenCount: number): string {
  if (hiddenCount <= 0) return "";
  return t.dim(`  +${hiddenCount} more tool uses (ctrl+o to expand)\n  ctrl+b to run in background`);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================================================
// PERMISSION DIALOG (boxed)
// ============================================================================

interface PermissionOption {
  label: string;
  value: string;
  description?: string;
}

export function formatPermissionDialog(
  title: string,
  command: string,
  description: string,
  options: PermissionOption[],
  selectedIndex: number = 0
): string {
  const width = Math.min(process.stdout.columns || 80, 80);
  const lines: string[] = [];

  // Top divider
  lines.push(thinDivider(width));
  lines.push("");

  // Title (blue header like Claude Code)
  lines.push(t.info(title));
  lines.push("");

  // Command
  lines.push(`  ${t.cream(command)}`);
  lines.push(`  ${t.dim(description)}`);
  lines.push("");

  // Question
  lines.push(t.cream("Do you want to proceed?"));

  // Options
  options.forEach((opt, i) => {
    const isSelected = i === selectedIndex;
    const selector = isSelected ? symbols.selector : " ";
    const number = `${i + 1}.`;
    const label = isSelected ? t.info(opt.label) : t.cream(opt.label);
    lines.push(`${selector} ${number} ${label}`);
  });

  lines.push("");

  // Footer hints
  lines.push(t.dim("Esc to cancel · Tab to amend · ctrl+e to explain"));

  return lines.join("\n");
}

// ============================================================================
// AUTOCOMPLETE DROPDOWN
// ============================================================================

interface AutocompleteItem {
  name: string;
  description: string;
}

export function formatAutocompleteDropdown(
  items: AutocompleteItem[],
  selectedIndex: number = 0,
  maxVisible: number = 6
): string {
  const lines: string[] = [];
  const start = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
  const visible = items.slice(start, start + maxVisible);

  lines.push(thinDivider());
  lines.push("");

  visible.forEach((item, i) => {
    const actualIndex = start + i;
    const isSelected = actualIndex === selectedIndex;

    const name = isSelected ? t.info(item.name.padEnd(20)) : t.primary(item.name.padEnd(20));
    const desc = isSelected ? t.info(item.description) : t.dim(item.description);

    lines.push(`  ${name} ${desc}`);
  });

  return lines.join("\n");
}

// ============================================================================
// THINKING STATUS
// ============================================================================

const thinkingVerbs = [
  "Sniffing around",
  "Brewing thoughts",
  "Percolating",
  "Wandering",
  "Exploring",
  "Thinking",
  "Pondering",
  "Roasting ideas",
];

let thinkingStart = 0;

export function startThinking(): void {
  thinkingStart = Date.now();
}

export function formatThinkingStatus(customVerb?: string): string {
  const elapsed = Date.now() - thinkingStart;
  const verb = customVerb || thinkingVerbs[Math.floor(Math.random() * thinkingVerbs.length)];
  return `${t.accent(symbols.star)} ${t.warning(`${verb}...`)} ${t.dim(`(thought for ${formatMs(elapsed)})`)}`;
}

// ============================================================================
// FOOTER HINT BAR
// ============================================================================

export function formatFooterHints(hints: string[]): string {
  return t.dim(hints.join(" · "));
}

export function formatInterruptHint(): string {
  return t.dim("esc to interrupt");
}

export function formatShortcutsHint(): string {
  return t.dim("? for shortcuts");
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

export function formatResponse(text: string): string {
  // Add bullet prefix for AI responses
  const lines = text.split("\n");
  if (lines.length > 0) {
    lines[0] = `${symbols.bullet} ${lines[0]}`;
    return lines.map((line, i) => i > 0 ? `  ${line}` : line).join("\n");
  }
  return text;
}

// ============================================================================
// WELCOME BANNER
// ============================================================================

export function formatWelcomeBanner(): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`  ${t.primary(symbols.coffee)} ${t.cream("kaldi")} ${t.dim("— your loyal coding companion")}`);
  lines.push("");
  return lines.join("\n");
}

// ============================================================================
// SESSION INFO
// ============================================================================

export function formatSessionInfo(provider: string, model: string, cwd: string): string {
  const lines: string[] = [];
  lines.push(`  ${t.dim(provider)} ${symbols.dot} ${t.dim(model)}`);
  lines.push(`  ${t.dim(cwd)}`);
  lines.push("");
  return lines.join("\n");
}

// ============================================================================
// MODE INDICATOR
// ============================================================================

export function formatModeBar(mode: "safe" | "auto" | "plan"): string {
  let modeText: string;
  let hint: string;

  switch (mode) {
    case "auto":
      modeText = t.warning(`${symbols.arrowRight}${symbols.arrowRight} auto-approve on`);
      hint = "tools run without confirmation";
      break;
    case "plan":
      modeText = t.info(`${symbols.arrowRight}${symbols.arrowRight} plan mode`);
      hint = "read-only exploration";
      break;
    default:
      modeText = t.dim(`${symbols.arrowRight}${symbols.arrowRight} safe mode`);
      hint = "tools require confirmation";
  }

  return `  ${modeText} ${t.muted(`— ${hint}`)}\n  ${t.muted("(shift+tab to cycle)")}\n`;
}

// ============================================================================
// INTERACTIVE SELECTION MENU
// ============================================================================

export class SelectionMenu {
  private items: { label: string; value: any }[];
  private selectedIndex: number = 0;
  private onSelect: (value: any) => void;
  private onCancel: () => void;

  constructor(
    items: { label: string; value: any }[],
    onSelect: (value: any) => void,
    onCancel: () => void
  ) {
    this.items = items;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
  }

  render(): string {
    const lines: string[] = [];

    this.items.forEach((item, i) => {
      const isSelected = i === this.selectedIndex;
      const selector = isSelected ? symbols.selector : " ";
      const label = isSelected ? t.info(item.label) : t.cream(item.label);
      lines.push(`${selector} ${i + 1}. ${label}`);
    });

    return lines.join("\n");
  }

  up(): void {
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
  }

  down(): void {
    this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
  }

  select(): void {
    this.onSelect(this.items[this.selectedIndex].value);
  }

  cancel(): void {
    this.onCancel();
  }

  handleKey(key: readline.Key): boolean {
    if (key.name === "up" || key.name === "k") {
      this.up();
      return true;
    }
    if (key.name === "down" || key.name === "j") {
      this.down();
      return true;
    }
    if (key.name === "return") {
      this.select();
      return true;
    }
    if (key.name === "escape") {
      this.cancel();
      return true;
    }
    // Number keys for quick selection
    const num = parseInt(key.sequence);
    if (num >= 1 && num <= this.items.length) {
      this.selectedIndex = num - 1;
      this.select();
      return true;
    }
    return false;
  }
}

// ============================================================================
// CONTEXT VISUALIZATION
// ============================================================================

export function formatContextBar(used: number, total: number): string {
  const percentage = Math.round((used / total) * 100);
  const barWidth = 40;
  const filledWidth = Math.round((used / total) * barWidth);

  let barColor = t.success;
  if (percentage > 75) barColor = t.error;
  else if (percentage > 50) barColor = t.warning;

  const filled = barColor("█".repeat(filledWidth));
  const empty = t.muted("░".repeat(barWidth - filledWidth));

  const lines: string[] = [];
  lines.push("");
  lines.push(t.primary("  Context Window"));
  lines.push("");
  lines.push(`  ${filled}${empty} ${percentage}%`);
  lines.push(t.dim(`  ${formatTokens(used)} / ${formatTokens(total)} tokens`));
  lines.push("");

  return lines.join("\n");
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export {
  kaldiTheme as theme,
  symbols as sym,
};
