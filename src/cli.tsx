/**
 * Kaldi CLI - Your Loyal Coding Companion ☕🐕
 *
 * Named after Kaldi, the Ethiopian goatherd who discovered coffee
 * when he noticed his goats dancing after eating coffee berries.
 *
 * Theme inspired by Great Pyrenees (creamy whites, warm fur)
 * combined with coffee (rich browns, honey, espresso)
 */

import { Command } from "commander";
import chalk from "chalk";
import * as readline from "readline";
import { readFile } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createProvider } from "./providers/index.js";
import { createDefaultRegistry } from "./tools/index.js";
import { Agent, buildSystemPrompt } from "./agent/index.js";
import type { PermissionRequest } from "./agent/loop.js";
import {
  getConfig,
  setProvider,
  setApiKey,
  setModel,
  isConfigured,
  getAllProviderConfigs,
  getConfigPath,
} from "./config/index.js";
import {
  createSession,
  saveSession,
  loadSession,
  listSessions,
  getLatestSession,
  getSessionForDirectory,
  getSessionsDir,
  type Session,
} from "./session/index.js";
import { formatDiff } from "./ui/diff.js";
import {
  status,
  startToolStatus,
  getThinkingMessage,
  formatDuration,
} from "./ui/status.js";
import { getClipboardImage, type ClipboardImage } from "./ui/clipboard.js";
import {
  renderWelcome,
  renderCompactWelcome,
  type WelcomeConfig,
  type ActivityItem,
} from "./ui/welcome.js";
import {
  formatToolTree,
  formatToolCall,
  formatToolSummary,
  type ToolCall,
} from "./ui/tool-tree.js";
import {
  renderStatusLine,
  renderCompactionIndicator,
  renderPromptHint,
  type StatusLineConfig,
} from "./ui/statusline.js";
import {
  Planner,
  getPlanner,
  type AgentMode,
} from "./core/planner.js";
import type { ProviderType, ContentBlock, ImageContent } from "./providers/types.js";

const VERSION = "0.3.0";
const KALDI_DIR = join(homedir(), ".kaldi");

// ============================================================================
// PYRENEES + COFFEE THEME
// ============================================================================

type ChalkFn = (text: string) => string;

interface ThemeColors {
  // Core
  primary: ChalkFn;
  secondary: ChalkFn;
  accent: ChalkFn;
  // Text
  text: ChalkFn;
  dim: ChalkFn;
  muted: ChalkFn;
  // Status
  success: ChalkFn;
  warning: ChalkFn;
  error: ChalkFn;
  info: ChalkFn;
  // Special
  highlight: ChalkFn;
  inputBg: ChalkFn;
}

// Great Pyrenees + Coffee inspired palette
const themes: Record<string, ThemeColors> = {
  default: {
    // Pyrenees-inspired creamy tones
    primary: chalk.hex("#C9A66B"),     // Latte - warm golden brown
    secondary: chalk.hex("#8B7355"),   // Taupe - like Pyrenees markings
    accent: chalk.hex("#DAA520"),      // Golden honey

    text: chalk.hex("#F5F0E6"),        // Cream - like Pyrenees fur
    dim: chalk.hex("#A09080"),         // Muted brown-gray
    muted: chalk.hex("#6B5B4F"),       // Dark taupe

    success: chalk.hex("#7CB342"),     // Olive green (natural)
    warning: chalk.hex("#DAA520"),     // Golden honey
    error: chalk.hex("#CD5C5C"),       // Indian red (warm)
    info: chalk.hex("#87CEEB"),        // Sky blue

    highlight: chalk.hex("#F5F0E6"),   // Cream highlight
    inputBg: chalk.bgHex("#3D3225").hex("#F5F0E6"), // Warm dark bg for input
  },
  dark: {
    primary: chalk.hex("#BB86FC"),
    secondary: chalk.hex("#03DAC6"),
    accent: chalk.hex("#CF6679"),
    text: chalk.white,
    dim: chalk.gray,
    muted: chalk.hex("#666666"),
    success: chalk.hex("#4CAF50"),
    warning: chalk.hex("#FF9800"),
    error: chalk.hex("#F44336"),
    info: chalk.hex("#2196F3"),
    highlight: chalk.white,
    inputBg: chalk.bgHex("#1E1E1E").white,
  },
  light: {
    primary: chalk.hex("#6F4E37"),     // Coffee brown
    secondary: chalk.hex("#8B7355"),
    accent: chalk.hex("#D2691E"),      // Chocolate
    text: chalk.hex("#3C2415"),        // Espresso
    dim: chalk.hex("#8B7355"),
    muted: chalk.hex("#A09080"),
    success: chalk.hex("#388E3C"),
    warning: chalk.hex("#F57C00"),
    error: chalk.hex("#D32F2F"),
    info: chalk.hex("#1976D2"),
    highlight: chalk.hex("#3C2415"),
    inputBg: chalk.bgHex("#E8E0D5").hex("#3C2415"),
  },
};

let currentTheme = "default";
let c = themes[currentTheme];

function setTheme(name: string) {
  if (themes[name]) {
    currentTheme = name;
    c = themes[name];
  }
}

// ============================================================================
// SYMBOLS
// ============================================================================

const sym = {
  // Prompts
  prompt: () => c.primary("❯"),
  promptPlan: () => c.info("◆"),
  promptVim: () => c.warning("▸"),
  selector: () => c.primary("❯"),

  // Tree structure (for tool hierarchy)
  branch: () => c.dim("├"),
  branchLast: () => c.dim("└"),
  pipe: () => c.dim("│"),

  // Status
  bullet: () => c.primary("●"),
  star: () => c.accent("✦"),
  dot: () => c.dim("·"),

  // Results
  check: () => c.success("✓"),
  cross: () => c.error("✗"),
  arrow: () => c.dim("→"),
  arrowRight: () => c.primary("»"),

  // Themed emojis
  coffee: "☕",
  dog: "🐕",
  bone: "🦴",
  paw: "🐾",
  fire: "🔥",
};

// ============================================================================
// STATE
// ============================================================================

interface AppState {
  rl: readline.Interface | null;
  isProcessing: boolean;
  turnStartTime: number;
  pendingImages: ClipboardImage[];
  compactMode: boolean;
  planMode: boolean;
  vimMode: boolean;
  verbose: boolean;
  lastResponse: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  // New: tool tracking for tree display
  currentTurnTools: ToolCall[];
  toolIdCounter: number;
  // New: conversation compaction
  isCompacted: boolean;
  // New: recent activity
  recentActivity: ActivityItem[];
  // New: planner
  planner: Planner;
}

const state: AppState = {
  rl: null,
  isProcessing: false,
  turnStartTime: 0,
  pendingImages: [],
  compactMode: false,
  planMode: false,
  vimMode: false,
  verbose: false,
  lastResponse: "",
  totalInputTokens: 0,
  totalOutputTokens: 0,
  currentTurnTools: [],
  toolIdCounter: 0,
  isCompacted: false,
  recentActivity: [],
  planner: getPlanner({ complexityThreshold: 'medium' }),
};

// ============================================================================
// READLINE SETUP
// ============================================================================

// Command descriptions for autocomplete dropdown
const commandDescriptions: Record<string, string> = {
  "/help": "Show help and available commands",
  "/clear": "Clear conversation history",
  "/exit": "Exit kaldi",
  "/quit": "Exit kaldi",
  "/save": "Save current session",
  "/load": "Load/resume a session",
  "/sessions": "List saved sessions",
  "/compact": "Toggle auto-approve mode",
  "/plan": "Toggle read-only plan mode",
  "/vim": "Toggle vim keybindings",
  "/theme": "Change the color theme",
  "/usage": "Show token usage and cost",
  "/cost": "Show token usage and cost",
  "/context": "Visualize context window",
  "/config": "Show configuration",
  "/doctor": "Check system health",
  "/version": "Show version info",
  "/status": "Git status",
  "/diff": "Git diff",
  "/commit": "Create git commit",
  "/copy": "Copy last response to clipboard",
  "/init": "Describe this project",
  "/model": "Show/change model",
  "/coffee": "Get a fresh cup of coffee",
  "/goodboy": "Pet Kaldi",
};

function getReadline(): readline.Interface {
  if (!state.rl) {
    state.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (line: string): [string[], string] => {
        if (line.startsWith("/")) {
          const commands = Object.keys(allCommands).filter(c => !c.startsWith("/?"));
          const matches = commands.filter(cmd => cmd.startsWith(line.toLowerCase()));

          // Show descriptions for matches (Claude Code style)
          if (matches.length > 0 && matches.length <= 10) {
            console.log(); // New line before dropdown
            console.log(thinDivider());
            console.log();
            matches.slice(0, 6).forEach((cmd, i) => {
              const desc = commandDescriptions[cmd] || "";
              const isFirst = i === 0;
              const cmdText = isFirst ? c.info(cmd.padEnd(20)) : c.primary(cmd.padEnd(20));
              const descText = isFirst ? c.info(desc) : c.dim(desc);
              console.log(`  ${cmdText} ${descText}`);
            });
          }

          return [matches.length ? matches : [], line];
        }
        return [[], line];
      },
    });
  }
  return state.rl;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getReadline().question(question, resolve);
  });
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function formatImageBadges(count: number): string {
  if (count === 0) return "";
  const badges = Array.from({ length: count }, (_, i) => c.info(`[Image #${i + 1}]`));
  return badges.join(" ") + " ";
}

// Format user input with background highlight (like Claude Code)
function formatUserInput(text: string): string {
  return c.inputBg(` ${text} `);
}

// Horizontal divider
function divider(): string {
  const width = Math.min(process.stdout.columns || 80, 80);
  return c.muted("─".repeat(width));
}

function thinDivider(): string {
  const width = Math.min(process.stdout.columns || 80, 80);
  return c.dim("─".repeat(width));
}

// Format tool arguments for display
function formatToolArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "read_file":
    case "write_file":
    case "edit_file":
      const path = args.path as string;
      return path ? path.split("/").slice(-2).join("/") : "";
    case "bash":
      const cmd = args.command as string;
      return cmd ? (cmd.length > 40 ? cmd.slice(0, 37) + "..." : cmd) : "";
    case "glob":
    case "grep":
      return args.pattern as string || "";
    case "web_fetch":
      const url = args.url as string;
      return url ? new URL(url).hostname : "";
    default:
      return "";
  }
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

function formatCost(input: number, output: number): string {
  // Claude pricing: $3/1M input, $15/1M output
  const cost = (input / 1e6) * 3 + (output / 1e6) * 15;
  return `$${cost.toFixed(4)}`;
}

function getPromptSymbol(): string {
  if (state.planMode) return sym.promptPlan();
  if (state.vimMode) return sym.promptVim();
  return sym.prompt();
}

function getModeIndicator(): string {
  const modes: string[] = [];
  if (state.compactMode) modes.push(c.warning("auto"));
  if (state.planMode) modes.push(c.info("plan"));
  if (state.vimMode) modes.push(c.warning("vim"));
  if (modes.length === 0) return "";
  return c.dim(" [") + modes.join(c.dim(", ")) + c.dim("]");
}

function printBanner() {
  console.log();
  console.log(`  ${c.primary(sym.coffee)} ${c.text("kaldi")} ${c.dim("— your loyal coding companion")}${getModeIndicator()}`);
  console.log();
}

function printWelcome(config?: { provider: string; model?: string }, cwd?: string) {
  const termWidth = process.stdout.columns || 80;

  // Use compact welcome for narrow terminals or when config not available
  if (termWidth < 60 || !config) {
    printBanner();
    return;
  }

  const welcomeConfig: WelcomeConfig = {
    version: VERSION,
    userName: process.env.USER || process.env.USERNAME,
    model: `${config.provider} ${config.model || "default"}`,
    projectPath: cwd || process.cwd(),
    recentActivity: state.recentActivity.slice(0, 3),
  };

  console.log();
  console.log(renderWelcome(welcomeConfig));
  console.log();
}

function printSessionInfo(config: { provider: string; model?: string }, cwd: string) {
  console.log(c.dim(`  ${config.provider} ${sym.dot()} ${config.model || "default"}`));
  console.log(c.dim(`  ${cwd}`));
  console.log();
}

function printModeBar() {
  let modeText: string;
  let hint: string;

  if (state.planMode) {
    modeText = c.info(`${sym.arrowRight()}${sym.arrowRight()} plan mode`);
    hint = "read-only exploration";
  } else if (state.compactMode) {
    modeText = c.warning(`${sym.arrowRight()}${sym.arrowRight()} auto-approve on`);
    hint = "tools run without confirmation";
  } else {
    modeText = c.dim(`${sym.arrowRight()}${sym.arrowRight()} safe mode`);
    hint = "tools require confirmation";
  }

  console.log(`  ${modeText} ${c.muted(`— ${hint}`)}`);
  console.log(c.dim("  (shift+tab to cycle)"));
  console.log();
}

function printFooterHints() {
  console.log(c.dim("  ? for shortcuts · esc to interrupt"));
}

function printHelp() {
  const sections = [
    {
      title: "Core",
      commands: [
        ["/help", "show this help"],
        ["/clear", "clear conversation history"],
        ["/exit", "exit kaldi"],
      ]
    },
    {
      title: "Session",
      commands: [
        ["/save", "save current session"],
        ["/load [id]", "load/resume session"],
        ["/sessions", "list saved sessions"],
      ]
    },
    {
      title: "Mode",
      commands: [
        ["/compact", "toggle auto-approve mode"],
        ["/plan", "toggle read-only plan mode"],
        ["/vim", "toggle vim keybindings"],
        ["/theme [name]", "change color theme"],
      ]
    },
    {
      title: "Info",
      commands: [
        ["/usage", "show token usage & cost"],
        ["/context", "visualize context window"],
        ["/config", "show configuration"],
        ["/doctor", "check system health"],
        ["/version", "show version info"],
      ]
    },
    {
      title: "Git",
      commands: [
        ["/status", "git status"],
        ["/diff", "git diff"],
        ["/commit", "create commit"],
      ]
    },
    {
      title: "Utility",
      commands: [
        ["/copy", "copy last response"],
        ["/init", "describe project"],
        ["/model [name]", "show/change model"],
      ]
    },
  ];

  console.log();
  console.log(c.primary("  Commands"));
  console.log();

  for (const section of sections) {
    console.log(c.dim(`  ${section.title}`));
    for (const [cmd, desc] of section.commands) {
      console.log(`    ${c.accent(cmd.padEnd(16))} ${c.dim(desc)}`);
    }
    console.log();
  }

  console.log(c.primary("  Shortcuts"));
  console.log();
  console.log(`    ${c.accent("ctrl+v".padEnd(16))} ${c.dim("paste image from clipboard")}`);
  console.log(`    ${c.accent("ctrl+c".padEnd(16))} ${c.dim("cancel current operation")}`);
  console.log(`    ${c.accent("ctrl+d".padEnd(16))} ${c.dim("exit kaldi")}`);
  console.log(`    ${c.accent("ctrl+l".padEnd(16))} ${c.dim("clear screen")}`);
  console.log(`    ${c.accent("shift+tab".padEnd(16))} ${c.dim("cycle permission modes")}`);
  console.log(`    ${c.accent("tab".padEnd(16))} ${c.dim("autocomplete commands")}`);
  console.log(`    ${c.accent("↑/↓".padEnd(16))} ${c.dim("command history")}`);
  console.log();
}

function printContextVisualization(used: number, total: number) {
  const percentage = Math.round((used / total) * 100);
  const barWidth = 40;
  const filledWidth = Math.round((used / total) * barWidth);

  let barColor = c.success;
  if (percentage > 75) barColor = c.error;
  else if (percentage > 50) barColor = c.warning;

  const filled = barColor("█".repeat(filledWidth));
  const empty = c.muted("░".repeat(barWidth - filledWidth));

  console.log();
  console.log(c.primary("  Context Window"));
  console.log();
  console.log(`  ${filled}${empty} ${percentage}%`);
  console.log(c.dim(`  ${formatTokens(used)} / ${formatTokens(total)} tokens`));
  console.log();

  // Grid visualization
  const gridWidth = 20;
  const gridHeight = 4;
  const cellsTotal = gridWidth * gridHeight;
  const cellsFilled = Math.round((used / total) * cellsTotal);

  console.log(c.dim("  Grid view:"));
  for (let row = 0; row < gridHeight; row++) {
    let line = "  ";
    for (let col = 0; col < gridWidth; col++) {
      const idx = row * gridWidth + col;
      if (idx < cellsFilled) {
        if (percentage > 75) line += c.error("■");
        else if (percentage > 50) line += c.warning("■");
        else line += c.success("■");
      } else {
        line += c.muted("□");
      }
    }
    console.log(line);
  }
  console.log();
}

// ============================================================================
// PERMISSION HANDLING
// ============================================================================

async function askPermission(request: PermissionRequest): Promise<boolean> {
  status.clear();
  console.log();
  console.log(thinDivider());
  console.log();

  const tool = request.tool;
  let title = "Tool";
  let command = "";
  let description = "";

  if (tool === "bash") {
    title = "Bash command";
    command = request.args.command as string;
    description = "Run shell command";
  } else if (tool === "write_file") {
    title = "Write file";
    command = request.args.path as string;
    description = "Create or overwrite file";
  } else if (tool === "edit_file") {
    title = "Edit file";
    command = request.args.path as string;
    description = "Modify file contents";

    // Show diff preview
    const path = request.args.path as string;
    try {
      const content = await readFile(path, "utf-8");
      const newContent = content.replace(
        request.args.old_string as string,
        request.args.new_string as string
      );
      console.log(formatDiff({ oldContent: content, newContent, filePath: path, context: 2 }));
      console.log();
    } catch {
      // File doesn't exist yet
    }
  } else if (tool === "web_fetch") {
    title = "Web fetch";
    command = request.args.url as string;
    description = "Fetch content from URL";
  }

  // Title (like Claude Code's blue header)
  console.log(c.info(title));
  console.log();

  // Command display
  const displayCmd = command.length > 70 ? command.slice(0, 67) + "..." : command;
  console.log(`  ${c.text(displayCmd)}`);
  console.log(`  ${c.dim(description)}`);
  console.log();

  // Question with numbered options
  console.log(c.text("Do you want to proceed?"));
  console.log(`${sym.selector()} 1. ${c.info("Yes")}`);
  console.log(`  2. ${c.text("Yes, and don't ask again for this session")}`);
  console.log(`  3. ${c.text("No")}`);
  console.log();

  // Footer hints
  console.log(c.dim("Esc to cancel · Tab to amend · ctrl+e to explain"));

  const answer = await ask(c.dim("\n  choice: "));
  const choice = answer.trim().toLowerCase();

  return choice === "1" || choice === "y" || choice === "yes" || choice === "2";
}

// ============================================================================
// COMMANDS
// ============================================================================

type CommandHandler = (args: string[], ctx: CommandContext) => Promise<void> | void;

interface CommandContext {
  agent: Agent;
  session: Session;
}

const allCommands: Record<string, CommandHandler> = {
  "/help": () => printHelp(),
  "/h": () => printHelp(),
  "/?": () => printHelp(),
  "/woof": () => printHelp(),

  "/exit": () => { console.log(c.dim(`\n  bye ${sym.dog}\n`)); process.exit(0); },
  "/quit": () => { console.log(c.dim(`\n  bye ${sym.dog}\n`)); process.exit(0); },
  "/q": () => { console.log(c.dim(`\n  bye ${sym.dog}\n`)); process.exit(0); },

  "/clear": (_, ctx) => {
    ctx.agent.clearHistory();
    ctx.session.messages = [];
    state.totalInputTokens = 0;
    state.totalOutputTokens = 0;
    console.log(c.dim(`\n  ${sym.check()} cleared\n`));
  },

  "/compact": () => {
    state.compactMode = !state.compactMode;
    if (state.compactMode) {
      console.log(c.warning(`\n  ${sym.fire} auto-approve on`) + c.dim(" — tools run without confirmation\n"));
    } else {
      console.log(c.dim(`\n  ${sym.check()} safe mode — tools require confirmation\n`));
    }
  },

  "/plan": () => {
    state.planMode = !state.planMode;
    if (state.planMode) {
      console.log(c.info(`\n  ${sym.promptPlan()} plan mode on`) + c.dim(" — read-only exploration\n"));
    } else {
      console.log(c.dim(`\n  ${sym.check()} plan mode off\n`));
    }
  },

  "/vim": () => {
    state.vimMode = !state.vimMode;
    if (state.vimMode) {
      console.log(c.warning(`\n  ${sym.promptVim()} vim mode on\n`));
    } else {
      console.log(c.dim(`\n  ${sym.check()} vim mode off\n`));
    }
  },

  "/theme": (args) => {
    if (args.length === 0) {
      console.log(c.dim("\n  available themes:"));
      for (const name of Object.keys(themes)) {
        const mark = name === currentTheme ? c.success("→") : " ";
        console.log(`  ${mark} ${name}`);
      }
      console.log();
      return;
    }
    const name = args[0];
    if (themes[name]) {
      setTheme(name);
      console.log(c.success(`\n  ${sym.check()} theme: ${name}\n`));
    } else {
      console.log(c.error(`\n  ${sym.cross()} unknown theme: ${name}\n`));
    }
  },

  "/usage": (_, ctx) => {
    const u = ctx.agent.getUsage();
    console.log();
    console.log(c.primary("  Token Usage"));
    console.log();
    console.log(`  ${c.dim("input")}   ${formatTokens(u.inputTokens)}`);
    console.log(`  ${c.dim("output")}  ${formatTokens(u.outputTokens)}`);
    console.log(`  ${c.dim("total")}   ${formatTokens(u.inputTokens + u.outputTokens)}`);
    console.log();
    console.log(`  ${c.dim("cost")}    ~${formatCost(u.inputTokens, u.outputTokens)}`);
    console.log();
  },
  "/cost": (args, ctx) => allCommands["/usage"](args, ctx),
  "/tokens": (args, ctx) => allCommands["/usage"](args, ctx),

  "/context": (_, ctx) => {
    const u = ctx.agent.getUsage();
    const maxTokens = 200000; // Claude's context window
    const used = u.inputTokens + u.outputTokens;
    printContextVisualization(used, maxTokens);
  },
  "/ctx": (args, ctx) => allCommands["/context"](args, ctx),

  "/config": () => {
    const cfg = getConfig();
    console.log();
    console.log(c.primary("  Configuration"));
    console.log();
    console.log(`  ${c.dim("provider")}  ${cfg.provider}`);
    console.log(`  ${c.dim("model")}     ${cfg.model || "default"}`);
    console.log(`  ${c.dim("config")}    ${getConfigPath()}`);
    console.log(`  ${c.dim("sessions")}  ${getSessionsDir()}`);
    console.log();
  },

  "/model": (args) => {
    if (args.length === 0) {
      const cfg = getConfig();
      console.log(c.dim(`\n  current model: ${cfg.model || "default"}\n`));
      return;
    }
    const model = args[0];
    setModel(getConfig().provider, model);
    console.log(c.success(`\n  ${sym.check()} model: ${model}\n`));
  },

  "/version": () => {
    console.log();
    console.log(c.primary(`  ${sym.coffee} kaldi v${VERSION}`));
    console.log(c.dim(`  your loyal coding companion`));
    console.log();
    console.log(c.dim(`  node ${process.version}`));
    console.log(c.dim(`  ${process.platform} ${process.arch}`));
    console.log();
  },
  "/v": (args, ctx) => allCommands["/version"](args, ctx),

  "/doctor": async () => {
    console.log();
    console.log(c.primary("  System Check"));
    console.log();

    const cfg = getConfig();
    console.log(cfg.apiKey ? `  ${sym.check()} api key configured` : `  ${sym.cross()} no api key`);
    if (cfg.apiKey) {
      console.log(c.dim(`    ${cfg.provider} ${sym.dot()} ${cfg.model || "default"}`));
    }

    const v = parseInt(process.version.slice(1).split(".")[0]);
    console.log(v >= 20 ? `  ${sym.check()} node ${process.version}` : `  ${sym.cross()} node ${process.version} (20+ recommended)`);

    try {
      const { execSync } = await import("child_process");
      execSync("git --version", { stdio: "pipe" });
      console.log(`  ${sym.check()} git installed`);
    } catch {
      console.log(`  ${sym.cross()} git not found`);
    }

    // Check for kaldi directory
    if (existsSync(KALDI_DIR)) {
      console.log(`  ${sym.check()} ~/.kaldi exists`);
    } else {
      console.log(`  ${sym.cross()} ~/.kaldi not found`);
    }

    console.log();
  },

  "/sessions": async () => {
    const list = await listSessions();
    if (!list.length) {
      console.log(c.dim("\n  no saved sessions\n"));
      return;
    }
    console.log();
    console.log(c.primary("  Saved Sessions"));
    console.log();
    for (const s of list.slice(0, 10)) {
      const dir = s.workingDirectory.split("/").pop();
      const date = new Date(s.updatedAt || s.createdAt).toLocaleDateString();
      console.log(`  ${c.accent(s.id.slice(0, 8))} ${c.dim(sym.dot())} ${dir} ${c.dim(sym.dot())} ${s.messageCount} msgs ${c.dim(sym.dot())} ${c.dim(date)}`);
    }
    console.log();
  },

  "/save": async (_, ctx) => {
    await saveSession(ctx.session);
    console.log(c.success(`\n  ${sym.check()} saved ${ctx.session.metadata.id.slice(0, 8)}\n`));
  },

  "/load": async (args) => {
    const id = args[0];
    let loaded = id ? await loadSession(id) : await getSessionForDirectory(process.cwd());
    if (!loaded) loaded = await getLatestSession();

    if (loaded) {
      console.log(c.success(`\n  ${sym.check()} loaded ${loaded.metadata.id.slice(0, 8)}\n`));
    } else {
      console.log(c.dim("\n  no session found\n"));
    }
  },

  "/status": async (_, ctx) => {
    state.isProcessing = true;
    try {
      status.start("Checking the grounds", false);
      await ctx.agent.run("Run git status and show the output.");
      status.clear();
    } catch {
      status.clear();
    }
    state.isProcessing = false;
    console.log();
  },

  "/diff": async (_, ctx) => {
    state.isProcessing = true;
    try {
      status.start("Comparing brews", false);
      await ctx.agent.run("Run git diff and show the output.");
      status.clear();
    } catch {
      status.clear();
    }
    state.isProcessing = false;
    console.log();
  },

  "/commit": async (_, ctx) => {
    state.isProcessing = true;
    try {
      status.start("Preparing a fresh brew", false);
      await ctx.agent.run("Create a git commit with an appropriate message for the staged changes. Use conventional commit format.");
      status.clear();
    } catch {
      status.clear();
    }
    state.isProcessing = false;
    console.log();
  },

  "/init": async (_, ctx) => {
    console.log();
    state.isProcessing = true;
    state.turnStartTime = Date.now();
    try {
      status.start("Sniffing around the project", true);
      await ctx.agent.run("Describe this project briefly. What is it, what's the tech stack, and what are the main files?");
      status.clear();
      const time = Date.now() - state.turnStartTime;
      if (time > 2000) console.log(c.dim(`\n  ${sym.coffee} ${formatDuration(time)}`));
    } catch {
      status.clear();
    }
    state.isProcessing = false;
    console.log("\n");
  },

  "/copy": () => {
    if (!state.lastResponse) {
      console.log(c.dim("\n  nothing to copy\n"));
      return;
    }
    try {
      const { execSync } = require("child_process");
      if (process.platform === "darwin") {
        execSync("pbcopy", { input: state.lastResponse });
      } else if (process.platform === "linux") {
        execSync("xclip -selection clipboard", { input: state.lastResponse });
      } else if (process.platform === "win32") {
        execSync("clip", { input: state.lastResponse });
      }
      console.log(c.success(`\n  ${sym.check()} copied to clipboard\n`));
    } catch {
      console.log(c.error(`\n  ${sym.cross()} failed to copy\n`));
    }
  },

  // Easter eggs
  "/coffee": () => {
    console.log();
    console.log(c.primary("        ( ("));
    console.log(c.primary("         ) )"));
    console.log(c.primary("      ........"));
    console.log(c.primary("      |      |]"));
    console.log(c.primary("      \\      /"));
    console.log(c.primary("       `----'"));
    console.log();
    console.log(c.dim("  Here's a fresh cup of coffee!"));
    console.log();
  },
  "/brew": (args, ctx) => allCommands["/coffee"](args, ctx),

  "/goodboy": () => {
    console.log();
    console.log(c.primary("    / \\__"));
    console.log(c.primary("   (    @\\___"));
    console.log(c.primary("   /         O"));
    console.log(c.primary("  /   (_____/"));
    console.log(c.primary(" /_____/   U"));
    console.log();
    console.log(c.dim(`  ${sym.paw} Kaldi says woof! ${sym.bone}`));
    console.log();
  },
  "/pet": (args, ctx) => allCommands["/goodboy"](args, ctx),
};

async function handleCommand(input: string, agent: Agent, session: Session): Promise<boolean> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const handler = allCommands[cmd];
  if (handler) {
    await handler(args, { agent, session });
    return true;
  }

  console.log(c.dim(`\n  unknown command: ${cmd}\n`));
  console.log(c.dim(`  type /help for available commands\n`));
  return false;
}

// ============================================================================
// MAIN SESSION
// ============================================================================

async function runSession(resumeSession?: Session) {
  if (!isConfigured()) {
    printBanner();
    console.log(c.warning(`  ${sym.cross()} no api key configured`));
    console.log(c.dim(`  run: kaldi beans -p anthropic -k YOUR_KEY\n`));
    return;
  }

  const config = getConfig();
  const cwd = process.cwd();

  // Use new welcome screen with full info
  printWelcome(config, cwd);
  printModeBar();

  const provider = createProvider(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });

  const tools = createDefaultRegistry();

  let session = resumeSession || createSession(cwd, config.provider, config.model || "default");

  if (resumeSession) {
    console.log(c.dim(`  ${sym.dog} resumed ${sym.dot()} ${session.metadata.messageCount} messages\n`));
  }

  const agent = new Agent({
    provider,
    tools,
    systemPrompt: buildSystemPrompt(cwd),
    requirePermission: !state.compactMode,
    callbacks: {
      onText: (text) => {
        if (!state.isProcessing) return;
        status.clear();
        process.stdout.write(text);
        state.lastResponse += text;
      },
      onToolUse: (name, args) => {
        // Track tool use
        const toolCall: ToolCall = {
          id: `tool_${++state.toolIdCounter}`,
          name,
          args: args as Record<string, unknown>,
          startTime: Date.now(),
        };
        state.currentTurnTools.push(toolCall);

        if (!state.planMode) {
          // Show tool in tree format with better formatting
          status.clear();
          const isFirst = state.currentTurnTools.length === 1;
          const prefix = isFirst ? sym.branch() : sym.branch();
          const argStr = formatToolArgs(name, args);

          // Format tool name nicely
          const toolName = name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          console.log(`${prefix} ${c.text(toolName)} ${c.dim(argStr)}`);
          startToolStatus(name, args);
        }
      },
      onToolResult: (name, result, isError) => {
        const completion = status.stop();

        // Update the tool call with result
        const toolCall = state.currentTurnTools[state.currentTurnTools.length - 1];
        if (toolCall) {
          toolCall.endTime = Date.now();
          toolCall.isError = isError;
          if (result) {
            // Count lines for read operations
            const lines = result.split('\n').length;
            toolCall.resultLineCount = lines;
          }
        }

        if (isError) {
          console.log(`${sym.branchLast()} ${sym.cross()} ${c.error("failed")} ${c.dim(completion)}`);
        } else {
          // Show line count for read operations like Claude Code
          if (["read_file", "glob", "grep", "list_dir"].includes(name) && result) {
            const lines = result.split('\n').length;
            console.log(`${sym.branchLast()} ${c.dim(`(${lines} lines)`)} ${c.dim(completion)}`);
          } else {
            console.log(`${sym.branchLast()} ${sym.check()} ${c.dim(completion)}`);
          }
        }
      },
      onPermissionRequest: async (request) => {
        if (state.compactMode || state.planMode) {
          if (state.planMode && !["read_file", "glob", "grep", "list_dir"].includes(request.tool)) {
            console.log(c.info(`\n  ${sym.promptPlan()} skipped ${request.tool} (plan mode)\n`));
            return false;
          }
          status.clear();
          const info = request.tool === "bash"
            ? (request.args.command as string).slice(0, 50)
            : request.args.path || request.args.url || "";
          console.log(c.dim(`  ${sym.arrow()} ${request.tool} ${info}`));
          return true;
        }
        return askPermission(request);
      },
      onUsage: (input, output) => {
        session.totalInputTokens += input;
        session.totalOutputTokens += output;
        state.totalInputTokens += input;
        state.totalOutputTokens += output;
      },
      onTurnStart: () => {
        state.turnStartTime = Date.now();
        state.lastResponse = "";
        state.currentTurnTools = [];
        // Show thinking status
        const verb = getThinkingMessage();
        status.start(verb, false);
      },
      onTurnComplete: () => {
        status.clear();

        // Show collapsed tool summary if many tools were used
        if (!state.verbose && state.currentTurnTools.length > 5) {
          console.log();
          console.log(formatToolSummary(state.currentTurnTools));
        }
      },
    },
  });

  // Ctrl+C handler
  process.on("SIGINT", () => {
    if (state.isProcessing) {
      status.clear();
      console.log(c.dim("\n  cancelled\n"));
      agent.stop();
      state.isProcessing = false;
      state.pendingImages = [];
      prompt();
    } else {
      console.log(c.dim(`\n  bye ${sym.dog}\n`));
      process.exit(0);
    }
  });

  // Ctrl+D handler
  getReadline().on("close", () => {
    console.log(c.dim(`\n  bye ${sym.dog}\n`));
    process.exit(0);
  });

  const buildPrompt = (): string => {
    const imageBadges = formatImageBadges(state.pendingImages.length);
    const modeIndicator = getModeIndicator();
    return `${getPromptSymbol()}${modeIndicator} ${imageBadges}`;
  };

  const setupKeypress = () => {
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin, getReadline());
    }

    process.stdin.on("keypress", (_: string, key: readline.Key) => {
      if (!key) return;

      // Ctrl+V for image paste
      if (key.ctrl && key.name === "v") {
        const image = getClipboardImage();
        if (image) {
          state.pendingImages.push(image);
          const currentLine = (getReadline() as any).line || "";
          process.stdout.write("\r\x1b[K");
          process.stdout.write(buildPrompt() + currentLine);
        }
      }

      // Ctrl+L to clear screen
      if (key.ctrl && key.name === "l") {
        console.clear();
        printBanner();
        process.stdout.write(buildPrompt());
      }

      // Shift+Tab to cycle modes
      if (key.shift && key.name === "tab") {
        if (!state.compactMode && !state.planMode) {
          state.compactMode = true;
          console.log(c.warning(`\n  ${sym.fire} auto-approve mode\n`));
        } else if (state.compactMode) {
          state.compactMode = false;
          state.planMode = true;
          console.log(c.info(`\n  ${sym.promptPlan()} plan mode\n`));
        } else {
          state.planMode = false;
          console.log(c.dim(`\n  ${sym.check()} safe mode\n`));
        }
        process.stdout.write(buildPrompt());
      }
    });
  };

  setupKeypress();

  const prompt = () => {
    getReadline().question(buildPrompt(), async (input) => {
      const text = input.trim();
      const images = [...state.pendingImages];
      state.pendingImages = [];

      if (!text && images.length === 0) return prompt();

      if (text.startsWith("/") && images.length === 0) {
        await handleCommand(text, agent, session);
        return prompt();
      }

      state.isProcessing = true;
      state.turnStartTime = Date.now();
      state.lastResponse = "";
      console.log();

      // Build content blocks with images and text
      let userContent: string | ContentBlock[] = text;
      if (images.length > 0) {
        const blocks: ContentBlock[] = [];
        for (const img of images) {
          blocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mediaType,
              data: img.data,
            },
          } as ImageContent);
        }
        if (text) {
          blocks.push({ type: "text", text });
        }
        userContent = blocks;
      }

      try {
        status.start(getThinkingMessage(), false);
        await agent.run(userContent);
        session.messages = agent.getMessages();
        status.clear();

        // Show total time for the turn
        const totalTime = Date.now() - state.turnStartTime;
        if (totalTime > 2000) {
          console.log(c.dim(`\n  ${sym.coffee} ${formatDuration(totalTime)}`));
        }
      } catch (e) {
        status.clear();
        if (state.isProcessing) {
          console.log(`\n  ${sym.cross()} ${c.dim(e instanceof Error ? e.message : String(e))}`);
        }
      }

      console.log();
      state.isProcessing = false;
      prompt();
    });
  };

  prompt();
}

// ============================================================================
// CLI PROGRAM
// ============================================================================

const program = new Command()
  .name("kaldi")
  .description(`${sym.coffee} your loyal coding companion`)
  .version(VERSION);

program
  .command("beans")
  .description("configure your coffee beans (API keys)")
  .option("-p, --provider <name>", "anthropic, openai, ollama, openrouter")
  .option("-k, --key <key>", "api key")
  .option("-m, --model <model>", "model name")
  .option("-l, --list", "list all configs")
  .action((opts) => {
    if (opts.list) {
      const configs = getAllProviderConfigs();
      const current = getConfig().provider;
      console.log();
      console.log(c.primary("  Provider Configs"));
      console.log();
      for (const [name, cfg] of Object.entries(configs)) {
        const mark = name === current ? c.success("→") : " ";
        const keyStatus = cfg.apiKey ? c.success("✓") : c.error("✗");
        console.log(`  ${mark} ${c.accent(name.padEnd(12))} ${keyStatus} ${c.dim(cfg.model || "default")}`);
      }
      console.log();
      return;
    }

    if (opts.provider) {
      if (!["anthropic", "openai", "ollama", "openrouter"].includes(opts.provider)) {
        console.log(c.error(`\n  ${sym.cross()} invalid provider: ${opts.provider}`));
        console.log(c.dim("  valid: anthropic, openai, ollama, openrouter\n"));
        return;
      }
      setProvider(opts.provider);
      console.log(c.success(`  ${sym.check()} provider: ${opts.provider}`));
    }

    if (opts.key) {
      setApiKey(getConfig().provider, opts.key);
      console.log(c.success(`  ${sym.check()} api key saved`));
    }

    if (opts.model) {
      setModel(getConfig().provider, opts.model);
      console.log(c.success(`  ${sym.check()} model: ${opts.model}`));
    }

    if (!opts.provider && !opts.key && !opts.model && !opts.list) {
      console.log(c.dim("\n  usage:"));
      console.log(c.dim("    kaldi beans -p anthropic -k YOUR_KEY"));
      console.log(c.dim("    kaldi beans -m claude-sonnet-4-20250514"));
      console.log(c.dim("    kaldi beans -l\n"));
    }
  });

program
  .command("roast [path]")
  .description("review code like a coffee roaster inspects beans")
  .action(async (path) => {
    if (!isConfigured()) {
      console.log(c.error(`\n  ${sym.cross()} configure first: kaldi beans -p anthropic -k KEY\n`));
      return;
    }

    const target = path || ".";
    console.log(c.dim(`\n  ${sym.coffee} roasting ${target}...\n`));

    const config = getConfig();
    const agent = new Agent({
      provider: createProvider(config.provider, config),
      tools: createDefaultRegistry(),
      systemPrompt: buildSystemPrompt(process.cwd()),
      requirePermission: false,
      callbacks: { onText: (t) => process.stdout.write(t) },
    });

    const start = Date.now();
    try {
      await agent.run(`Review "${target}". Focus on bugs, code smells, and potential issues. Be concise and actionable.`);
      const time = Date.now() - start;
      console.log(c.dim(`\n\n  ${sym.coffee} Roasted in ${formatDuration(time)}\n`));
    } catch (e) {
      console.log(c.error(`\n  ${sym.cross()} ${e}`));
    }
  });

program
  .command("refill")
  .description("resume your last session")
  .action(async () => {
    let session = await getSessionForDirectory(process.cwd());
    if (!session) session = await getLatestSession();
    await runSession(session || undefined);
  });

program
  .command("doctor")
  .description("check if kaldi is healthy")
  .action(async () => {
    await allCommands["/doctor"]([], {} as any);
  });

program
  .command("theme [name]")
  .description("set color theme")
  .action((name) => {
    allCommands["/theme"](name ? [name] : [], {} as any);
  });

// Default action - start interactive session
program.action(() => runSession());

program.parse();
