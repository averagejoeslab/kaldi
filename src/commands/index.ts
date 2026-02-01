/**
 * Kaldi CLI Slash Commands System
 *
 * A comprehensive command registry for the Kaldi CLI.
 * Named after Kaldi's goats who discovered coffee - these commands
 * help you navigate your coding journey with the energy of
 * coffee-fueled goats dancing through your terminal.
 *
 * Coffee/Dog themed command system for the loyal coding companion.
 */

import chalk from "chalk";
import { execSync, spawnSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import type { Agent, AgentSession } from "../agent/loop.js";
import type { Session, SessionMetadata } from "../session/store.js";
import {
  saveSession,
  loadSession,
  listSessions,
  createSession,
  getSessionsDir,
} from "../session/store.js";
import {
  getConfig,
  setProvider,
  setModel,
  getAllProviderConfigs,
  getConfigPath,
} from "../config/store.js";
import type { ProviderType } from "../providers/types.js";
import {
  getTheme,
  setTheme,
  themes,
  getThemeChalk,
  renderContextGrid,
  printBanner,
  printDivider,
  printKeyValue,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  clearScreen,
  printKaldiArt,
  printCoffeeCup,
} from "../ui/terminal.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Command execution context - the coffee cup that holds everything together
 */
export interface CommandContext {
  /** The agent instance (the loyal dog doing the work) */
  agent?: Agent;
  /** Current session data */
  session?: Session;
  /** Working directory */
  cwd: string;
  /** Current provider */
  provider: ProviderType;
  /** Current model */
  model: string;
  /** Vim mode enabled */
  vimMode: boolean;
  /** Plan mode (read-only) */
  planMode: boolean;
  /** Auto-compact mode */
  compactMode: boolean;
  /** Last response from agent */
  lastResponse?: string;
  /** Token usage tracking */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
  /** Update context callback */
  updateContext?: (updates: Partial<CommandContext>) => void;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  /** Whether to exit the CLI */
  exit?: boolean;
  /** Whether to clear the conversation */
  clear?: boolean;
  /** Message to display */
  message?: string;
  /** Error message */
  error?: string;
  /** Whether command was handled */
  handled: boolean;
  /** New session to load */
  loadSession?: Session;
  /** Whether to suppress default output */
  silent?: boolean;
}

/**
 * Parsed command arguments
 */
export interface ParsedArgs {
  /** Positional arguments */
  positional: string[];
  /** Named flags (--flag or -f) */
  flags: Map<string, string | boolean>;
  /** Raw argument string */
  raw: string;
}

/**
 * Command handler function type
 */
export type CommandHandler = (
  args: ParsedArgs,
  context: CommandContext
) => Promise<CommandResult>;

/**
 * Command definition
 */
export interface Command {
  /** Primary command name (without slash) */
  name: string;
  /** Alternative names */
  aliases: string[];
  /** Short description for help */
  description: string;
  /** Detailed usage information */
  usage?: string;
  /** Example usages */
  examples?: string[];
  /** Command category */
  category: CommandCategory;
  /** Handler function */
  handler: CommandHandler;
  /** Whether command is hidden from help */
  hidden?: boolean;
}

/**
 * Command categories for organization
 */
export type CommandCategory =
  | "core"
  | "session"
  | "mode"
  | "git"
  | "info"
  | "utility";

// ============================================================================
// CONSTANTS
// ============================================================================

const VERSION = "1.0.0";
const KALDI_MD_FILENAME = "KALDI.md";

// Cost per 1K tokens (approximate, varies by model)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
  "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  default: { input: 0.001, output: 0.002 },
};

// Coffee-themed category names for display
const CATEGORY_NAMES: Record<CommandCategory, string> = {
  core: "Espresso Shot (Core)",
  session: "Coffee Break (Session)",
  mode: "Brew Style (Mode)",
  git: "Bean Tracking (Git)",
  info: "Menu Board (Info)",
  utility: "Barista Tools (Utility)",
};

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

/**
 * Parse command arguments
 */
export function parseArgs(input: string): ParsedArgs {
  const parts = input.trim().split(/\s+/);
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith("--")) {
      const key = part.slice(2);
      const eqIndex = key.indexOf("=");

      if (eqIndex !== -1) {
        flags.set(key.slice(0, eqIndex), key.slice(eqIndex + 1));
      } else if (i + 1 < parts.length && !parts[i + 1].startsWith("-")) {
        flags.set(key, parts[++i]);
      } else {
        flags.set(key, true);
      }
    } else if (part.startsWith("-") && part.length === 2) {
      const key = part.slice(1);
      if (i + 1 < parts.length && !parts[i + 1].startsWith("-")) {
        flags.set(key, parts[++i]);
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(part);
    }
  }

  return { positional, flags, raw: input };
}

// ============================================================================
// COMMAND REGISTRY
// ============================================================================

/**
 * Command Registry - The coffee shop menu of available commands
 *
 * Like a well-organized cafe menu, this registry keeps track of
 * all available commands and helps users find what they need.
 */
export class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.registerBuiltinCommands();
  }

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.name, command);

    // Register aliases
    for (const alias of command.aliases) {
      this.aliasMap.set(alias, command.name);
    }
  }

  /**
   * Get a command by name or alias
   */
  get(name: string): Command | undefined {
    // Remove leading slash if present
    const normalizedName = name.startsWith("/") ? name.slice(1) : name;

    // Check direct match
    if (this.commands.has(normalizedName)) {
      return this.commands.get(normalizedName);
    }

    // Check aliases
    const aliasedName = this.aliasMap.get(normalizedName);
    if (aliasedName) {
      return this.commands.get(aliasedName);
    }

    return undefined;
  }

  /**
   * Get all commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: CommandCategory): Command[] {
    return this.getAll().filter((cmd) => cmd.category === category && !cmd.hidden);
  }

  /**
   * Check if input is a command
   */
  isCommand(input: string): boolean {
    return input.startsWith("/");
  }

  /**
   * Execute a command
   */
  async execute(input: string, context: CommandContext): Promise<CommandResult> {
    if (!this.isCommand(input)) {
      return { handled: false };
    }

    // Parse command and arguments
    const trimmed = input.slice(1).trim();
    const spaceIndex = trimmed.indexOf(" ");
    const commandName = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
    const argsString = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1);

    const command = this.get(commandName);

    if (!command) {
      return {
        handled: true,
        error: `Unknown command: /${commandName}. Type /help for available commands.`,
      };
    }

    try {
      const args = parseArgs(argsString);
      return await command.handler(args, context);
    } catch (error) {
      return {
        handled: true,
        error: `Error executing /${commandName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get autocomplete suggestions for partial command input
   */
  getAutocompleteSuggestions(partial: string): string[] {
    if (!partial.startsWith("/")) {
      return [];
    }

    const search = partial.slice(1).toLowerCase();
    const suggestions: string[] = [];

    // Match command names
    for (const cmd of Array.from(this.commands.values())) {
      if (cmd.name.toLowerCase().startsWith(search) && !cmd.hidden) {
        suggestions.push(`/${cmd.name}`);
      }

      // Match aliases
      for (const alias of cmd.aliases) {
        if (alias.toLowerCase().startsWith(search)) {
          suggestions.push(`/${alias}`);
        }
      }
    }

    return suggestions.sort();
  }

  /**
   * Get help text for a specific command
   */
  getCommandHelp(commandName: string): string {
    const command = this.get(commandName);
    if (!command) {
      return `Unknown command: ${commandName}`;
    }

    const tc = getThemeChalk();
    const lines: string[] = [];

    lines.push(tc.primary.bold(`/${command.name}`));

    if (command.aliases.length > 0) {
      lines.push(tc.dim(`Aliases: ${command.aliases.map((a) => `/${a}`).join(", ")}`));
    }

    lines.push("");
    lines.push(tc.text(command.description));

    if (command.usage) {
      lines.push("");
      lines.push(tc.secondary("Usage:"));
      lines.push(tc.dim(`  ${command.usage}`));
    }

    if (command.examples && command.examples.length > 0) {
      lines.push("");
      lines.push(tc.secondary("Examples:"));
      for (const example of command.examples) {
        lines.push(tc.dim(`  ${example}`));
      }
    }

    return lines.join("\n");
  }

  /**
   * Register all built-in commands
   */
  private registerBuiltinCommands(): void {
    // ========================================================================
    // CORE COMMANDS - The essential espresso shots
    // ========================================================================

    this.register({
      name: "help",
      aliases: ["h", "?", "woof"],
      description: "Show help - Your friendly barista guide to all commands",
      usage: "/help [command]",
      examples: ["/help", "/help commit", "/h status"],
      category: "core",
      handler: async (args, _context) => {
        const tc = getThemeChalk();

        if (args.positional.length > 0) {
          const helpText = this.getCommandHelp(args.positional[0]);
          return { handled: true, message: helpText };
        }

        const lines: string[] = [];

        // Header with coffee art
        lines.push("");
        lines.push(tc.primary.bold("  Kaldi CLI Commands"));
        lines.push(tc.dim("  Your loyal coding companion's command menu"));
        lines.push(tc.muted("  " + "=".repeat(50)));
        lines.push("");

        // Group by category
        const categories: CommandCategory[] = ["core", "session", "mode", "git", "info", "utility"];

        for (const category of categories) {
          const commands = this.getByCategory(category);
          if (commands.length === 0) continue;

          lines.push(tc.secondary.bold(`  ${CATEGORY_NAMES[category]}`));
          lines.push("");

          for (const cmd of commands) {
            const name = tc.primary(`/${cmd.name.padEnd(12)}`);
            const aliases = cmd.aliases.length > 0 ? tc.muted(` (${cmd.aliases.map(a => `/${a}`).join(", ")})`) : "";
            lines.push(`    ${name} ${tc.dim(cmd.description)}${aliases}`);
          }

          lines.push("");
        }

        lines.push(tc.dim("  Type /help <command> for detailed help on a specific command"));
        lines.push("");

        return { handled: true, message: lines.join("\n") };
      },
    });

    this.register({
      name: "clear",
      aliases: ["cls", "reset", "shake"],
      description: "Clear conversation - Shake off the old coffee grounds",
      category: "core",
      handler: async (_args, _context) => {
        clearScreen();
        return {
          handled: true,
          clear: true,
          message: "Conversation cleared - Fresh cup ready!",
        };
      },
    });

    this.register({
      name: "exit",
      aliases: ["quit", "q", "bye", "naptime"],
      description: "Exit Kaldi - Time for a coffee break",
      category: "core",
      handler: async (_args, _context) => {
        return {
          handled: true,
          exit: true,
          message: "Thanks for brewing with Kaldi! See you next time!",
        };
      },
    });

    this.register({
      name: "compact",
      aliases: ["compress", "squeeze"],
      description: "Compact context with optional focus - Pack those coffee beans tight",
      usage: "/compact [focus instructions]",
      examples: ["/compact", "/compact focus on the authentication flow"],
      category: "core",
      handler: async (args, context) => {
        const tc = getThemeChalk();
        const focus = args.raw.trim();

        if (!context.session || context.session.messages.length === 0) {
          return {
            handled: true,
            error: "No conversation to compact - the coffee pot is empty!",
          };
        }

        const messageCount = context.session.messages.length;
        const tokenEstimate = context.usage.inputTokens + context.usage.outputTokens;

        let message = tc.primary("Compacting conversation...\n");
        message += tc.dim(`  Messages: ${messageCount}\n`);
        message += tc.dim(`  Estimated tokens: ${tokenEstimate}\n`);

        if (focus) {
          message += tc.dim(`  Focus: ${focus}\n`);
        }

        message += tc.success("\n  Context compacted - beans are packed!");

        // In a real implementation, this would actually compact the context
        // by summarizing the conversation while preserving key information

        return { handled: true, message };
      },
    });

    this.register({
      name: "config",
      aliases: ["settings", "prefs", "menu"],
      description: "Open settings - Customize your brew",
      category: "core",
      handler: async (_args, _context) => {
        const tc = getThemeChalk();
        const configPath = getConfigPath();
        const providerConfigs = getAllProviderConfigs();
        const currentConfig = getConfig();

        const lines: string[] = [];

        lines.push(tc.primary.bold("  Kaldi Configuration"));
        lines.push(tc.muted("  " + "-".repeat(40)));
        lines.push("");
        lines.push(tc.secondary("  Current Settings:"));
        lines.push(tc.dim(`    Provider: ${tc.text(currentConfig.provider)}`));
        lines.push(tc.dim(`    Model: ${tc.text(currentConfig.model || "default")}`));
        lines.push(tc.dim(`    Config file: ${tc.text(configPath)}`));
        lines.push("");
        lines.push(tc.secondary("  Provider Status:"));

        for (const [provider, config] of Object.entries(providerConfigs)) {
          const status = config.apiKey === "(not set)" ? tc.error("not configured") : tc.success("configured");
          lines.push(tc.dim(`    ${provider}: ${status} - model: ${config.model}`));
        }

        lines.push("");
        lines.push(tc.dim("  Use /model <name> to change the model"));
        lines.push(tc.dim("  Edit config file directly for API keys"));

        return { handled: true, message: lines.join("\n") };
      },
    });

    this.register({
      name: "context",
      aliases: ["ctx", "window", "beans"],
      description: "Visualize context usage as grid - See how full your coffee cup is",
      category: "core",
      handler: async (_args, context) => {
        const tc = getThemeChalk();

        // Estimate context window based on model
        const maxTokens = context.model.includes("claude") ? 200000 : 128000;
        const used = context.usage.inputTokens + context.usage.outputTokens;

        const grid = renderContextGrid({
          used,
          total: maxTokens,
          rows: 5,
          width: 50,
        });

        const lines: string[] = [];
        lines.push("");
        lines.push(grid);
        lines.push("");
        lines.push(tc.dim(`  Model: ${context.model}`));
        lines.push(tc.dim(`  Input tokens: ${context.usage.inputTokens.toLocaleString()}`));
        lines.push(tc.dim(`  Output tokens: ${context.usage.outputTokens.toLocaleString()}`));

        return { handled: true, message: lines.join("\n") };
      },
    });

    this.register({
      name: "cost",
      aliases: ["tokens", "bill", "tab"],
      description: "Show token usage and cost - Check your coffee tab",
      category: "core",
      handler: async (_args, context) => {
        const tc = getThemeChalk();
        const costs = TOKEN_COSTS[context.model] || TOKEN_COSTS.default;

        const inputCost = (context.usage.inputTokens / 1000) * costs.input;
        const outputCost = (context.usage.outputTokens / 1000) * costs.output;
        const totalCost = inputCost + outputCost;

        const lines: string[] = [];
        lines.push("");
        lines.push(tc.primary.bold("  Token Usage & Cost"));
        lines.push(tc.muted("  " + "-".repeat(40)));
        lines.push("");
        lines.push(tc.dim(`  Model: ${tc.text(context.model)}`));
        lines.push("");
        lines.push(tc.secondary("  Tokens:"));
        lines.push(tc.dim(`    Input:  ${context.usage.inputTokens.toLocaleString().padStart(10)}`));
        lines.push(tc.dim(`    Output: ${context.usage.outputTokens.toLocaleString().padStart(10)}`));
        lines.push(tc.dim(`    Total:  ${(context.usage.inputTokens + context.usage.outputTokens).toLocaleString().padStart(10)}`));
        lines.push("");
        lines.push(tc.secondary("  Estimated Cost:"));
        lines.push(tc.dim(`    Input:  $${inputCost.toFixed(4).padStart(9)}`));
        lines.push(tc.dim(`    Output: $${outputCost.toFixed(4).padStart(9)}`));
        lines.push(tc.primary(`    Total:  $${totalCost.toFixed(4).padStart(9)}`));
        lines.push("");

        return { handled: true, message: lines.join("\n") };
      },
    });

    this.register({
      name: "doctor",
      aliases: ["health", "checkup", "vet"],
      description: "Check health - Give Kaldi a checkup",
      category: "core",
      handler: async (_args, context) => {
        const tc = getThemeChalk();
        const checks: { name: string; status: "ok" | "warn" | "error"; message: string }[] = [];

        // Check config
        const config = getConfig();
        if (config.apiKey) {
          checks.push({ name: "API Key", status: "ok", message: `${config.provider} key configured` });
        } else {
          checks.push({ name: "API Key", status: "error", message: "No API key configured" });
        }

        // Check git
        try {
          execSync("git --version", { stdio: "pipe" });
          checks.push({ name: "Git", status: "ok", message: "Git is installed" });
        } catch {
          checks.push({ name: "Git", status: "warn", message: "Git not found" });
        }

        // Check working directory
        if (existsSync(context.cwd)) {
          checks.push({ name: "Working Directory", status: "ok", message: context.cwd });
        } else {
          checks.push({ name: "Working Directory", status: "error", message: "Directory not found" });
        }

        // Check for KALDI.md
        const kaldiMdPath = join(context.cwd, KALDI_MD_FILENAME);
        if (existsSync(kaldiMdPath)) {
          checks.push({ name: "Project Config", status: "ok", message: "KALDI.md found" });
        } else {
          checks.push({ name: "Project Config", status: "warn", message: "No KALDI.md (run /init)" });
        }

        // Check session
        if (context.session) {
          checks.push({ name: "Session", status: "ok", message: `ID: ${context.session.metadata.id}` });
        } else {
          checks.push({ name: "Session", status: "warn", message: "No active session" });
        }

        const lines: string[] = [];
        lines.push("");
        lines.push(tc.primary.bold("  Kaldi Health Check"));
        lines.push(tc.muted("  " + "-".repeat(40)));
        lines.push("");

        for (const check of checks) {
          const icon = check.status === "ok" ? tc.success("[OK]") : check.status === "warn" ? tc.warning("[!!]") : tc.error("[XX]");
          lines.push(`  ${icon} ${tc.text(check.name.padEnd(20))} ${tc.dim(check.message)}`);
        }

        const hasErrors = checks.some((c) => c.status === "error");
        const hasWarns = checks.some((c) => c.status === "warn");

        lines.push("");
        if (hasErrors) {
          lines.push(tc.error("  Some issues need attention!"));
        } else if (hasWarns) {
          lines.push(tc.warning("  Kaldi is mostly healthy with some warnings."));
        } else {
          lines.push(tc.success("  Kaldi is happy and healthy!"));
        }
        lines.push("");

        return { handled: true, message: lines.join("\n") };
      },
    });

    // ========================================================================
    // SESSION COMMANDS - Coffee break management
    // ========================================================================

    this.register({
      name: "save",
      aliases: ["s", "store", "preserve"],
      description: "Save session - Store your coffee for later",
      category: "session",
      handler: async (_args, context) => {
        if (!context.session) {
          return { handled: true, error: "No active session to save!" };
        }

        await saveSession(context.session);
        return {
          handled: true,
          message: `Session saved: ${context.session.metadata.id}`,
        };
      },
    });

    this.register({
      name: "load",
      aliases: ["resume", "restore", "fetch"],
      description: "Load/resume session - Reheat your previous coffee",
      usage: "/load [session-id]",
      examples: ["/load", "/load 20240115-143022-abc1"],
      category: "session",
      handler: async (args, _context) => {
        const tc = getThemeChalk();

        if (args.positional.length === 0) {
          // Show available sessions
          const sessions = await listSessions();

          if (sessions.length === 0) {
            return { handled: true, error: "No saved sessions found!" };
          }

          const lines: string[] = [];
          lines.push("");
          lines.push(tc.primary.bold("  Available Sessions"));
          lines.push(tc.muted("  " + "-".repeat(50)));
          lines.push("");

          for (const session of sessions.slice(0, 10)) {
            const date = new Date(session.updatedAt).toLocaleString();
            lines.push(tc.dim(`  ${tc.primary(session.id)}`));
            lines.push(tc.dim(`    ${date} - ${session.messageCount} messages`));
            if (session.summary) {
              lines.push(tc.dim(`    ${session.summary.slice(0, 60)}...`));
            }
            lines.push("");
          }

          lines.push(tc.dim("  Use /load <session-id> to load a specific session"));

          return { handled: true, message: lines.join("\n") };
        }

        const sessionId = args.positional[0];
        const session = await loadSession(sessionId);

        if (!session) {
          return { handled: true, error: `Session not found: ${sessionId}` };
        }

        return {
          handled: true,
          loadSession: session,
          message: `Session loaded: ${sessionId} (${session.messages.length} messages)`,
        };
      },
    });

    this.register({
      name: "sessions",
      aliases: ["list", "history", "cups"],
      description: "List sessions - See all your saved coffee cups",
      category: "session",
      handler: async (_args, _context) => {
        const tc = getThemeChalk();
        const sessions = await listSessions();

        if (sessions.length === 0) {
          return { handled: true, message: "No saved sessions - time to brew some coffee!" };
        }

        const lines: string[] = [];
        lines.push("");
        lines.push(tc.primary.bold("  Saved Sessions"));
        lines.push(tc.muted("  " + "-".repeat(60)));
        lines.push("");

        for (const session of sessions) {
          const date = new Date(session.updatedAt);
          const dateStr = date.toLocaleDateString();
          const timeStr = date.toLocaleTimeString();
          const dir = basename(session.workingDirectory);

          lines.push(
            `  ${tc.primary(session.id)} ${tc.muted(`[${dir}]`)}`
          );
          lines.push(
            `    ${tc.dim(dateStr)} ${tc.dim(timeStr)} - ${tc.text(`${session.messageCount} messages`)} - ${tc.dim(session.provider)}/${tc.dim(session.model)}`
          );

          if (session.summary) {
            lines.push(`    ${tc.muted(session.summary.slice(0, 70))}...`);
          }
          lines.push("");
        }

        return { handled: true, message: lines.join("\n") };
      },
    });

    this.register({
      name: "rename",
      aliases: ["name", "label", "tag"],
      description: "Rename session - Give your coffee cup a label",
      usage: "/rename <new-name>",
      examples: ["/rename auth-feature", "/rename bug-fix-login"],
      category: "session",
      handler: async (args, context) => {
        if (args.positional.length === 0) {
          return { handled: true, error: "Please provide a name: /rename <name>" };
        }

        if (!context.session) {
          return { handled: true, error: "No active session to rename!" };
        }

        const newName = args.positional.join("-");
        const oldId = context.session.metadata.id;

        // Update summary as a "name"
        context.session.metadata.summary = newName;
        await saveSession(context.session);

        return {
          handled: true,
          message: `Session "${oldId}" labeled as: ${newName}`,
        };
      },
    });

    // ========================================================================
    // MODE COMMANDS - Brew style selection
    // ========================================================================

    this.register({
      name: "plan",
      aliases: ["readonly", "observe", "sniff"],
      description: "Toggle plan mode (read-only) - Just sniff, don't drink",
      category: "mode",
      handler: async (_args, context) => {
        const newMode = !context.planMode;
        context.updateContext?.({ planMode: newMode });

        return {
          handled: true,
          message: newMode
            ? "Plan mode ON - Kaldi will only observe and plan, not make changes"
            : "Plan mode OFF - Kaldi is ready to take action",
        };
      },
    });

    this.register({
      name: "autocompact",
      aliases: ["auto", "turbo"],
      description: "Toggle auto-compact mode - Automatic coffee grinding",
      category: "mode",
      handler: async (_args, context) => {
        const newMode = !context.compactMode;
        context.updateContext?.({ compactMode: newMode });

        return {
          handled: true,
          message: newMode
            ? "Auto-compact mode ON - Context will be automatically compacted"
            : "Auto-compact mode OFF - Manual context management",
        };
      },
    });

    this.register({
      name: "vim",
      aliases: ["vi", "modal"],
      description: "Toggle vim mode - For the keyboard purists",
      category: "mode",
      handler: async (_args, context) => {
        const newMode = !context.vimMode;
        context.updateContext?.({ vimMode: newMode });

        return {
          handled: true,
          message: newMode
            ? "Vim mode ON - hjkl your way through! (:wq to submit)"
            : "Vim mode OFF - Standard input restored",
        };
      },
    });

    this.register({
      name: "theme",
      aliases: ["colors", "style", "coat"],
      description: "Change theme - Give Kaldi a new coat",
      usage: "/theme [name]",
      examples: ["/theme", "/theme dark", "/theme light", "/theme highContrast"],
      category: "mode",
      handler: async (args, _context) => {
        const tc = getThemeChalk();

        if (args.positional.length === 0) {
          const currentTheme = getTheme();
          const availableThemes = Object.keys(themes);

          const lines: string[] = [];
          lines.push("");
          lines.push(tc.primary.bold("  Available Themes"));
          lines.push(tc.muted("  " + "-".repeat(30)));
          lines.push("");

          for (const name of availableThemes) {
            const isActive = themes[name] === currentTheme;
            const marker = isActive ? tc.success(" (active)") : "";
            lines.push(`    ${tc.text(name)}${marker}`);
          }

          lines.push("");
          lines.push(tc.dim("  Use /theme <name> to switch"));

          return { handled: true, message: lines.join("\n") };
        }

        const themeName = args.positional[0];

        if (!themes[themeName as keyof typeof themes]) {
          return {
            handled: true,
            error: `Unknown theme: ${themeName}. Available: ${Object.keys(themes).join(", ")}`,
          };
        }

        setTheme(themeName as keyof typeof themes);

        return {
          handled: true,
          message: `Theme changed to: ${themeName}`,
        };
      },
    });

    // ========================================================================
    // GIT COMMANDS - Bean tracking
    // ========================================================================

    this.register({
      name: "status",
      aliases: ["st", "gs", "track"],
      description: "Git status - Track your beans",
      category: "git",
      handler: async (_args, context) => {
        try {
          const result = execSync("git status --short --branch", {
            cwd: context.cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });

          return { handled: true, message: result || "Working tree clean" };
        } catch (error) {
          return {
            handled: true,
            error: "Not a git repository or git not installed",
          };
        }
      },
    });

    this.register({
      name: "diff",
      aliases: ["d", "changes", "grind"],
      description: "Git diff - See what beans have changed",
      usage: "/diff [--staged]",
      category: "git",
      handler: async (args, context) => {
        try {
          const staged = args.flags.has("staged") || args.flags.has("s");
          const command = staged ? "git diff --staged" : "git diff";

          const result = execSync(command, {
            cwd: context.cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });

          if (!result.trim()) {
            return {
              handled: true,
              message: staged ? "No staged changes" : "No unstaged changes",
            };
          }

          return { handled: true, message: result };
        } catch (error) {
          return {
            handled: true,
            error: "Not a git repository or git not installed",
          };
        }
      },
    });

    this.register({
      name: "commit",
      aliases: ["ci", "save-beans"],
      description: "Create commit - Package your beans",
      usage: "/commit [message]",
      examples: ["/commit", "/commit fix: resolve login bug"],
      category: "git",
      handler: async (args, context) => {
        const tc = getThemeChalk();

        try {
          // Check for staged changes
          const staged = execSync("git diff --staged --name-only", {
            cwd: context.cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          }).trim();

          if (!staged) {
            return {
              handled: true,
              error: "No staged changes to commit. Use 'git add' first.",
            };
          }

          const message = args.raw.trim();

          if (!message) {
            // Show what would be committed
            const status = execSync("git status --short", {
              cwd: context.cwd,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });

            const lines: string[] = [];
            lines.push("");
            lines.push(tc.primary.bold("  Staged Changes:"));
            lines.push(tc.muted("  " + "-".repeat(40)));
            lines.push("");
            lines.push(status);
            lines.push("");
            lines.push(tc.dim("  Provide a commit message: /commit <message>"));
            lines.push(tc.dim("  Or let Kaldi generate one - just ask!"));

            return { handled: true, message: lines.join("\n") };
          }

          // Create the commit
          execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
            cwd: context.cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });

          return {
            handled: true,
            message: `Committed: ${message}`,
          };
        } catch (error) {
          return {
            handled: true,
            error: `Commit failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    this.register({
      name: "pr",
      aliases: ["pull-request", "mr", "brew-pr"],
      description: "Create PR - Share your fresh brew",
      usage: "/pr [title]",
      category: "git",
      handler: async (args, context) => {
        const tc = getThemeChalk();

        try {
          // Check if gh is installed
          execSync("gh --version", { stdio: "pipe" });

          // Get current branch
          const branch = execSync("git branch --show-current", {
            cwd: context.cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          }).trim();

          if (branch === "main" || branch === "master") {
            return {
              handled: true,
              error: "Cannot create PR from main/master branch",
            };
          }

          const title = args.raw.trim();

          if (!title) {
            // Show PR preview
            const commits = execSync("git log --oneline main..HEAD 2>/dev/null || git log --oneline master..HEAD 2>/dev/null || echo 'No commits'", {
              cwd: context.cwd,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            }).trim();

            const lines: string[] = [];
            lines.push("");
            lines.push(tc.primary.bold("  PR Preview"));
            lines.push(tc.muted("  " + "-".repeat(40)));
            lines.push("");
            lines.push(tc.dim(`  Branch: ${tc.text(branch)}`));
            lines.push("");
            lines.push(tc.secondary("  Commits:"));
            lines.push(tc.dim(commits.split("\n").map(l => `    ${l}`).join("\n")));
            lines.push("");
            lines.push(tc.dim("  Provide a title: /pr <title>"));
            lines.push(tc.dim("  Or let Kaldi draft one for you!"));

            return { handled: true, message: lines.join("\n") };
          }

          // Create PR
          const result = execSync(`gh pr create --title "${title.replace(/"/g, '\\"')}" --body "Created with Kaldi CLI"`, {
            cwd: context.cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });

          return { handled: true, message: `PR created: ${result.trim()}` };
        } catch (error) {
          if (String(error).includes("gh")) {
            return {
              handled: true,
              error: "GitHub CLI (gh) not installed. Install from https://cli.github.com",
            };
          }
          return {
            handled: true,
            error: `PR creation failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    // ========================================================================
    // INFO COMMANDS - Menu board
    // ========================================================================

    this.register({
      name: "usage",
      aliases: ["stats", "metrics", "drink-count"],
      description: "Show usage stats - How much coffee have you had?",
      category: "info",
      handler: async (_args, context) => {
        const tc = getThemeChalk();

        const lines: string[] = [];
        lines.push("");
        lines.push(tc.primary.bold("  Session Statistics"));
        lines.push(tc.muted("  " + "-".repeat(40)));
        lines.push("");

        if (context.session) {
          lines.push(tc.dim(`  Session ID: ${tc.text(context.session.metadata.id)}`));
          lines.push(tc.dim(`  Started: ${tc.text(new Date(context.session.metadata.createdAt).toLocaleString())}`));
          lines.push(tc.dim(`  Messages: ${tc.text(String(context.session.messages.length))}`));
        }

        lines.push("");
        lines.push(tc.secondary("  Token Usage:"));
        lines.push(tc.dim(`    Input: ${context.usage.inputTokens.toLocaleString()}`));
        lines.push(tc.dim(`    Output: ${context.usage.outputTokens.toLocaleString()}`));
        lines.push(tc.dim(`    Total: ${(context.usage.inputTokens + context.usage.outputTokens).toLocaleString()}`));
        lines.push("");
        lines.push(tc.secondary("  Mode Status:"));
        lines.push(tc.dim(`    Vim mode: ${context.vimMode ? tc.success("ON") : tc.muted("OFF")}`));
        lines.push(tc.dim(`    Plan mode: ${context.planMode ? tc.success("ON") : tc.muted("OFF")}`));
        lines.push(tc.dim(`    Auto-compact: ${context.compactMode ? tc.success("ON") : tc.muted("OFF")}`));
        lines.push("");

        return { handled: true, message: lines.join("\n") };
      },
    });

    this.register({
      name: "model",
      aliases: ["m", "engine", "roast"],
      description: "Show/change model - Pick your roast level",
      usage: "/model [name]",
      examples: ["/model", "/model claude-3-opus-20240229", "/model gpt-4o"],
      category: "info",
      handler: async (args, context) => {
        const tc = getThemeChalk();

        if (args.positional.length === 0) {
          const lines: string[] = [];
          lines.push("");
          lines.push(tc.primary.bold("  Current Model"));
          lines.push(tc.muted("  " + "-".repeat(40)));
          lines.push("");
          lines.push(tc.dim(`  Provider: ${tc.text(context.provider)}`));
          lines.push(tc.dim(`  Model: ${tc.text(context.model)}`));
          lines.push("");
          lines.push(tc.dim("  Use /model <name> to change"));
          lines.push(tc.dim("  Common models:"));
          lines.push(tc.dim("    - claude-sonnet-4-20250514"));
          lines.push(tc.dim("    - claude-3-opus-20240229"));
          lines.push(tc.dim("    - gpt-4o"));
          lines.push(tc.dim("    - gpt-4-turbo"));
          lines.push("");

          return { handled: true, message: lines.join("\n") };
        }

        const newModel = args.positional[0];
        setModel(context.provider, newModel);
        context.updateContext?.({ model: newModel });

        return {
          handled: true,
          message: `Model changed to: ${newModel}`,
        };
      },
    });

    this.register({
      name: "version",
      aliases: ["v", "about", "pedigree"],
      description: "Show version - Kaldi's pedigree",
      category: "info",
      handler: async (_args, _context) => {
        const tc = getThemeChalk();

        const lines: string[] = [];
        lines.push("");
        printKaldiArt();
        lines.push("");
        lines.push(tc.primary.bold(`  Kaldi CLI v${VERSION}`));
        lines.push(tc.dim("  Your loyal AI coding companion"));
        lines.push("");
        lines.push(tc.muted("  Named after Kaldi, the Ethiopian goatherd"));
        lines.push(tc.muted("  who discovered coffee when his goats"));
        lines.push(tc.muted("  danced after eating coffee berries."));
        lines.push("");
        lines.push(tc.dim("  Built with love and lots of coffee."));
        lines.push("");

        return { handled: true, message: lines.join("\n") };
      },
    });

    // ========================================================================
    // UTILITY COMMANDS - Barista tools
    // ========================================================================

    this.register({
      name: "copy",
      aliases: ["cp", "clipboard", "grab"],
      description: "Copy last response to clipboard - Grab that cup",
      category: "utility",
      handler: async (_args, context) => {
        if (!context.lastResponse) {
          return { handled: true, error: "No response to copy!" };
        }

        try {
          const platform = process.platform;

          if (platform === "darwin") {
            const proc = spawnSync("pbcopy", {
              input: context.lastResponse,
              encoding: "utf-8",
            });
            if (proc.status !== 0) throw new Error("pbcopy failed");
          } else if (platform === "linux") {
            const proc = spawnSync("xclip", ["-selection", "clipboard"], {
              input: context.lastResponse,
              encoding: "utf-8",
            });
            if (proc.status !== 0) {
              // Try xsel
              const proc2 = spawnSync("xsel", ["--clipboard", "--input"], {
                input: context.lastResponse,
                encoding: "utf-8",
              });
              if (proc2.status !== 0) throw new Error("xclip/xsel failed");
            }
          } else if (platform === "win32") {
            const proc = spawnSync("clip", {
              input: context.lastResponse,
              encoding: "utf-8",
              shell: true,
            });
            if (proc.status !== 0) throw new Error("clip failed");
          } else {
            throw new Error("Unsupported platform");
          }

          return {
            handled: true,
            message: "Response copied to clipboard!",
          };
        } catch (error) {
          return {
            handled: true,
            error: `Failed to copy: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    this.register({
      name: "export",
      aliases: ["dump", "save-log", "pour"],
      description: "Export conversation - Pour your coffee into a file",
      usage: "/export [filename]",
      examples: ["/export", "/export chat-log.md", "/export session.json"],
      category: "utility",
      handler: async (args, context) => {
        if (!context.session || context.session.messages.length === 0) {
          return { handled: true, error: "No conversation to export!" };
        }

        const filename = args.positional[0] || `kaldi-export-${Date.now()}.md`;
        const isJson = filename.endsWith(".json");

        let content: string;

        if (isJson) {
          content = JSON.stringify(context.session, null, 2);
        } else {
          // Export as markdown
          const lines: string[] = [];
          lines.push(`# Kaldi Session Export`);
          lines.push("");
          lines.push(`- Session ID: ${context.session.metadata.id}`);
          lines.push(`- Date: ${new Date().toISOString()}`);
          lines.push(`- Provider: ${context.session.metadata.provider}`);
          lines.push(`- Model: ${context.session.metadata.model}`);
          lines.push("");
          lines.push("---");
          lines.push("");

          for (const msg of context.session.messages) {
            const role = msg.role === "user" ? "You" : "Kaldi";
            lines.push(`## ${role}`);
            lines.push("");

            if (typeof msg.content === "string") {
              lines.push(msg.content);
            } else {
              for (const block of msg.content) {
                if (block.type === "text") {
                  lines.push(block.text);
                } else if (block.type === "tool_use") {
                  lines.push(`*Used tool: ${block.name}*`);
                } else if (block.type === "tool_result") {
                  lines.push(`*Tool result*`);
                }
              }
            }

            lines.push("");
            lines.push("---");
            lines.push("");
          }

          content = lines.join("\n");
        }

        const filepath = join(context.cwd, filename);
        writeFileSync(filepath, content, "utf-8");

        return {
          handled: true,
          message: `Conversation exported to: ${filepath}`,
        };
      },
    });

    this.register({
      name: "init",
      aliases: ["setup", "start", "adopt"],
      description: "Initialize project (KALDI.md) - Adopt Kaldi for this project",
      category: "utility",
      handler: async (_args, context) => {
        const tc = getThemeChalk();
        const kaldiMdPath = join(context.cwd, KALDI_MD_FILENAME);

        if (existsSync(kaldiMdPath)) {
          const existing = readFileSync(kaldiMdPath, "utf-8");
          const lines: string[] = [];
          lines.push(tc.warning("  KALDI.md already exists!"));
          lines.push("");
          lines.push(tc.dim("  Current content:"));
          lines.push(tc.muted("  " + "-".repeat(40)));
          lines.push(tc.dim(existing.split("\n").slice(0, 10).map(l => `  ${l}`).join("\n")));
          if (existing.split("\n").length > 10) {
            lines.push(tc.muted("  ..."));
          }
          lines.push("");
          lines.push(tc.dim("  Delete the file and run /init again to regenerate."));

          return { handled: true, message: lines.join("\n") };
        }

        const projectName = basename(context.cwd);
        const template = `# ${projectName}

## Project Overview

*Describe your project here. Kaldi will use this to understand the context.*

## Tech Stack

- Language:
- Framework:
- Build tool:

## Code Style

- *Add any coding conventions or style guidelines*

## Important Files

- \`src/\` - Source code
- \`tests/\` - Test files

## Commands

\`\`\`bash
# Development
npm run dev

# Testing
npm test

# Build
npm run build
\`\`\`

## Notes for Kaldi

- *Add any special instructions or context for Kaldi here*
- *What should Kaldi know about this project?*
- *Any sensitive files or directories to avoid?*

---
*Generated by Kaldi CLI - Your loyal coding companion*
`;

        writeFileSync(kaldiMdPath, template, "utf-8");

        return {
          handled: true,
          message: `Created ${KALDI_MD_FILENAME} - Edit it to help Kaldi understand your project!`,
        };
      },
    });

    // ========================================================================
    // HIDDEN/FUN COMMANDS - Easter eggs
    // ========================================================================

    this.register({
      name: "coffee",
      aliases: ["brew", "espresso", "treat"],
      description: "Brew some coffee",
      category: "utility",
      hidden: true,
      handler: async (_args, _context) => {
        printCoffeeCup();
        return {
          handled: true,
          message: "\n  Here's a fresh cup of coffee! Keep coding!",
          silent: true,
        };
      },
    });

    this.register({
      name: "goodboy",
      aliases: ["pet", "scritch"],
      description: "Pet Kaldi",
      category: "utility",
      hidden: true,
      handler: async (_args, _context) => {
        printKaldiArt();
        return {
          handled: true,
          message: "\n  *happy tail wagging* Woof! Thanks for the pets!",
          silent: true,
        };
      },
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let registryInstance: CommandRegistry | null = null;

/**
 * Get the command registry singleton
 */
export function getCommandRegistry(): CommandRegistry {
  if (!registryInstance) {
    registryInstance = new CommandRegistry();
  }
  return registryInstance;
}

/**
 * Create a new command registry (for testing or isolated use)
 */
export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry();
}

/**
 * Create a default command context
 */
export function createDefaultContext(overrides?: Partial<CommandContext>): CommandContext {
  const config = getConfig();

  return {
    cwd: process.cwd(),
    provider: config.provider,
    model: config.model || "claude-sonnet-4-20250514",
    vimMode: false,
    planMode: false,
    compactMode: false,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
    },
    ...overrides,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { parseArgs as parseCommandArgs };
