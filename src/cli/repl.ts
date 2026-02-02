/**
 * REPL (Read-Eval-Print Loop)
 *
 * Interactive command loop for Kaldi - the loyal coding companion.
 * Features dog-themed modes and coffee-inspired spinners.
 */

import * as readline from "readline";
import { getConfig } from "../config/store.js";
import { isCommand, executeCommand, type CommandContext } from "../commands/index.js";
import { AgentOrchestrator } from "../agent/orchestrator.js";
import { getProvider } from "../providers/index.js";
import { createDefaultRegistry } from "../tools/index.js";
import { buildSystemPrompt } from "../context/builder.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";
import { dogFace } from "../ui/theme/dog-messages.js";
import {
  getKaldiUI,
  getPermissionManager,
  printKaldiWelcome,
  printKaldiGoodbye,
} from "../ui/dynamic/index.js";
import type { CLIOptions } from "./types.js";

/**
 * Generate a fun session name
 */
function generateSessionName(): string {
  const adjectives = [
    "golden", "fresh", "morning", "smooth", "bold", "warm",
    "happy", "loyal", "fluffy", "cozy", "bright", "gentle",
  ];
  const nouns = [
    "roast", "brew", "blend", "bean", "cup", "sip",
    "paws", "woof", "tail", "fetch", "sniff", "bark",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const id = Math.random().toString(36).slice(2, 6);
  return `${adj}-${noun}-${id}`;
}

/**
 * REPL - Interactive command loop
 */
export class REPL {
  private rl: readline.Interface | null = null;
  private agent: AgentOrchestrator | null = null;
  private context: CommandContext;
  private running = false;
  private processing = false;
  private options: CLIOptions;
  private ui = getKaldiUI();
  private permissionManager = getPermissionManager();
  private sessionName: string;
  private sessionStartTime = Date.now();

  constructor(options: CLIOptions) {
    this.options = options;
    const config = getConfig();

    this.sessionName = generateSessionName();

    this.context = {
      cwd: options.cwd || process.cwd(),
      provider: (options.provider as CommandContext["provider"]) || config.provider,
      model: options.model || config.model || "claude-sonnet-4-20250514",
      sessionId: options.resume,
    };
  }

  /**
   * Initialize the agent
   */
  private initAgent(): AgentOrchestrator {
    const config = getConfig();

    // Get provider instance
    const provider = getProvider(this.context.provider, {
      [this.context.provider]: {
        apiKey: config.apiKey,
        model: this.context.model,
      },
    });

    // Get tools
    const tools = createDefaultRegistry();

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      projectPath: this.context.cwd,
    });

    return new AgentOrchestrator({
      provider,
      tools,
      systemPrompt,
      maxTurns: 50,
      requirePermission: true,
      callbacks: {
        onText: (text) => {
          this.ui.onText(text);
        },
        onThinking: (text) => {
          if (text) {
            this.ui.updateThinking(text);
          }
        },
        onToolUse: (name, args) => {
          this.ui.startTool(name, args as Record<string, unknown>);
        },
        onToolResult: (name, result, isError) => {
          this.ui.completeTool(!isError, result);
        },
        onPermissionRequest: async (request) => {
          // Determine action type
          let action: "edit" | "bash" | "read" = "read";
          if (["write_file", "edit_file"].includes(request.tool)) {
            action = "edit";
          } else if (request.tool === "bash") {
            action = "bash";
          }

          return this.ui.requestPermission(action, request.description);
        },
        onError: (error) => {
          this.ui.showError(error.message, "apiError");
        },
      },
    });
  }

  /**
   * Start the REPL
   */
  async start(): Promise<void> {
    this.running = true;

    // Initialize agent
    try {
      this.agent = this.initAgent();
    } catch (error) {
      console.error(c.error(`\n${dogFace.error} Error initializing agent: ${error instanceof Error ? error.message : error}`));
      console.error(c.dim("\nMake sure you've configured your provider: kaldi beans -p anthropic -k YOUR_KEY\n"));
      process.exit(1);
    }

    // Initialize UI with welcome screen
    this.ui.initialize({
      provider: this.context.provider,
      model: this.context.model,
      workingDir: this.context.cwd,
      version: "0.1.0",
      sessionName: this.sessionName,
    });

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Handle line input
    this.rl.on("line", async (line) => {
      await this.handleInput(line);
    });

    // Handle close (Ctrl+D)
    this.rl.on("close", () => {
      this.stop();
    });

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => {
      if (this.processing) {
        // Cancel current operation
        console.log(c.dim("\n\nCancelled."));
        this.processing = false;
        this.showPrompt();
      } else {
        this.stop();
      }
    });

    // Show initial prompt
    this.showPrompt();
  }

  /**
   * Stop the REPL
   */
  stop(): void {
    this.running = false;
    this.ui.goodbye();
    this.rl?.close();
    process.exit(0);
  }

  /**
   * Show the input prompt
   */
  private showPrompt(): void {
    if (!this.running) return;

    // Get current mode for prompt styling
    const mode = this.permissionManager.getMode();
    const config = this.permissionManager.getConfig();

    // Dog-themed prompt
    process.stdout.write(`${config.icon.split("▸")[0]}${c.honey("❯")} `);
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    const trimmed = input.trim();

    if (!trimmed) {
      this.showPrompt();
      return;
    }

    if (this.processing) {
      console.log(c.dim(`${dogFace.thinking} Please wait...`));
      return;
    }

    this.processing = true;

    try {
      // Check for special key commands
      if (trimmed === "\x1b\x1b") {
        // Esc Esc - rewind (TODO: implement)
        console.log(c.dim("\n*rewind not yet implemented*\n"));
      } else if (isCommand(trimmed)) {
        // Slash commands
        const result = await executeCommand(trimmed, this.context);

        if (result.error) {
          console.log(c.error(`\n${dogFace.sad} ${result.error}\n`));
        } else if (result.output) {
          console.log(result.output);
        }

        if (result.exit) {
          this.stop();
          return;
        }

        if (result.clear) {
          this.agent?.clearHistory();
          console.log(c.dim(`\n${dogFace.happy} Conversation cleared!\n`));
        }
      } else {
        // Regular message to agent
        await this.runAgent(trimmed);
      }
    } catch (error) {
      console.log(c.error(`\n${dogFace.error} Error: ${error instanceof Error ? error.message : String(error)}\n`));
    }

    this.processing = false;
    this.showPrompt();
  }

  /**
   * Run the agent with a message
   */
  private async runAgent(message: string): Promise<void> {
    if (!this.agent) {
      console.log(c.error(`\n${dogFace.confused} Agent not initialized\n`));
      return;
    }

    console.log(""); // New line before response

    // Start UI turn
    this.ui.startTurn();

    try {
      const result = await this.agent.run(message);

      // Update token counts
      if (result.usage) {
        this.ui.updateTokens(result.usage.inputTokens, result.usage.outputTokens);
      }

      // End UI turn (shows summary)
      this.ui.endTurn();
    } catch (error) {
      this.ui.showError(
        error instanceof Error ? error.message : String(error),
        "apiError"
      );
      throw error;
    }
  }

  /**
   * Run a single prompt and exit
   */
  async runOnce(prompt: string): Promise<void> {
    try {
      this.agent = this.initAgent();
    } catch (error) {
      console.error(c.error(`\n${dogFace.error} Error: ${error instanceof Error ? error.message : error}`));
      console.error(c.dim("\nMake sure you've configured your provider: kaldi beans -p anthropic -k YOUR_KEY\n"));
      process.exit(1);
    }

    // Show compact header for one-shot mode
    console.log("");
    console.log(`${c.honey("☕")} ${c.bold(c.cream("Kaldi"))} ${c.dim(`• ${this.context.provider}/${this.context.model}`)}`);
    console.log("");

    // Start turn
    this.ui.startTurn();

    try {
      const result = await this.agent.run(prompt);

      if (result.usage) {
        this.ui.updateTokens(result.usage.inputTokens, result.usage.outputTokens);
      }

      this.ui.endTurn();
    } catch (error) {
      this.ui.showError(
        error instanceof Error ? error.message : String(error),
        "apiError"
      );
    }
  }
}
