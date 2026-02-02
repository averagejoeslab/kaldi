/**
 * REPL (Read-Eval-Print Loop)
 *
 * Interactive command loop for the CLI.
 */

import * as readline from "readline";
import { getConfig } from "../config/store.js";
import { isCommand, executeCommand, type CommandContext } from "../commands/index.js";
import { AgentOrchestrator } from "../agent/orchestrator.js";
import { getProvider } from "../providers/index.js";
import { createDefaultRegistry } from "../tools/index.js";
import { buildSystemPrompt } from "../context/builder.js";
import { getSkillsRegistry } from "../skills/index.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";
import { printGoodbye } from "../ui/components/welcome.js";
import {
  printWelcomeScreen,
  getToolDisplay,
  createAnimatedSpinner,
  spinnerFrames,
} from "../ui/dynamic/index.js";
import type { CLIOptions } from "./types.js";

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
  private tokenUsage = { input: 0, output: 0 };
  private toolDisplay = getToolDisplay();
  private currentSpinner: ReturnType<typeof createAnimatedSpinner> | null = null;

  constructor(options: CLIOptions) {
    this.options = options;
    const config = getConfig();

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
          // Stop any spinner when text starts
          if (this.currentSpinner) {
            this.currentSpinner.stop();
            this.currentSpinner = null;
          }
          process.stdout.write(text);
        },
        onThinking: (text) => {
          // Update spinner with thinking indicator
          if (this.currentSpinner && text) {
            const preview = text.length > 50 ? text.slice(0, 47) + "..." : text;
            this.currentSpinner.update(`Thinking... ${c.dim(preview)}`);
          }
        },
        onToolUse: (name, args) => {
          // Stop spinner when starting tool
          if (this.currentSpinner) {
            this.currentSpinner.stop();
            this.currentSpinner = null;
          }

          // Start tool display
          this.toolDisplay.start(name, args as Record<string, unknown>);

          // Also show in console for clarity
          console.log("");
          console.log(`${c.honey("⚙")} ${c.bold(name)}`);

          // Show command for bash tool
          if (name === "bash" && args.command) {
            const cmd = String(args.command);
            const preview = cmd.length > 80 ? cmd.slice(0, 77) + "..." : cmd;
            console.log(c.dim(`  $ ${preview}`));
          } else if (name === "read_file" && args.path) {
            console.log(c.dim(`  ${args.path}`));
          } else if (name === "edit_file" && args.path) {
            console.log(c.dim(`  ${args.path}`));
          } else if (name === "write_file" && args.path) {
            console.log(c.dim(`  ${args.path}`));
          }
        },
        onToolResult: (name, result, isError) => {
          // Complete tool display
          this.toolDisplay.complete(!isError, result);

          if (isError) {
            console.log(`${c.error("✗")} ${c.error("Error")}`);
            if (this.options.verbose) {
              console.log(c.dim(`  ${result.slice(0, 300)}`));
            }
          } else {
            console.log(`${c.success("✓")} ${c.dim("Done")}`);
            if (this.options.verbose && result) {
              const preview = result.slice(0, 200);
              console.log(c.dim(`  ${preview}${result.length > 200 ? "..." : ""}`));
            }
          }
          console.log("");
        },
        onPermissionRequest: async (request) => {
          // For now, auto-approve read operations
          if (["read_file", "glob", "grep", "list_dir", "web_fetch"].includes(request.tool)) {
            return true;
          }
          // TODO: Implement proper permission prompt
          console.log(c.warning(`\n  ${sym.warning} Permission requested: ${request.description}`));
          return true;
        },
        onError: (error) => {
          // Stop any active spinner
          if (this.currentSpinner) {
            this.currentSpinner.stop();
            this.currentSpinner = null;
          }
          console.error(c.error(`\n${sym.error} ${error.message}`));
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
      console.error(c.error(`\nError initializing agent: ${error instanceof Error ? error.message : error}`));
      console.error(c.dim("\nMake sure you've configured your provider: kaldi beans -p anthropic -k YOUR_KEY\n"));
      process.exit(1);
    }

    // Print welcome screen
    printWelcomeScreen({
      provider: this.context.provider,
      model: this.context.model,
      workingDir: this.context.cwd,
      version: "0.1.0",
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

    // Handle close
    this.rl.on("close", () => {
      this.stop();
    });

    // Show initial prompt
    this.showPrompt();
  }

  /**
   * Stop the REPL
   */
  stop(): void {
    this.running = false;
    printGoodbye();
    this.rl?.close();
    process.exit(0);
  }

  /**
   * Show the input prompt
   */
  private showPrompt(): void {
    if (!this.running) return;
    process.stdout.write(c.honey(`${sym.prompt} `));
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
      console.log(c.dim("Please wait..."));
      return;
    }

    this.processing = true;

    try {
      // Check for commands
      if (isCommand(trimmed)) {
        const result = await executeCommand(trimmed, this.context);

        if (result.error) {
          console.log(c.error(`\n  ${sym.error} ${result.error}\n`));
        } else if (result.output) {
          console.log(result.output);
        }

        if (result.exit) {
          this.stop();
          return;
        }

        if (result.clear) {
          // Clear conversation
          this.agent?.clearHistory();
        }
      } else {
        // Regular message to agent
        await this.runAgent(trimmed);
      }
    } catch (error) {
      console.log(c.error(`\n  ${sym.error} Error: ${error instanceof Error ? error.message : String(error)}\n`));
    }

    this.processing = false;
    this.showPrompt();
  }

  /**
   * Run the agent with a message
   */
  private async runAgent(message: string): Promise<void> {
    if (!this.agent) {
      console.log(c.error("\n  Agent not initialized\n"));
      return;
    }

    console.log(""); // New line before response

    // Start thinking spinner (only use spinner, not both)
    this.currentSpinner = createAnimatedSpinner({
      frames: spinnerFrames.dots,
      color: c.honey,
    });
    this.currentSpinner.start("Thinking...");

    try {
      const result = await this.agent.run(message);

      // Stop spinner
      if (this.currentSpinner) {
        this.currentSpinner.stop();
        this.currentSpinner = null;
      }

      // Response is already streamed via callbacks
      console.log(""); // New line after response

      // Track token usage
      if (result.usage) {
        this.tokenUsage.input += result.usage.inputTokens;
        this.tokenUsage.output += result.usage.outputTokens;
      }

      // Show usage summary
      if (result.usage) {
        const input = this.formatTokens(result.usage.inputTokens);
        const output = this.formatTokens(result.usage.outputTokens);
        console.log(c.dim(`  ${c.dim("↑")}${input} ${c.dim("↓")}${output}`));
      }
    } catch (error) {
      // Stop spinner on error
      if (this.currentSpinner) {
        this.currentSpinner.stop();
        this.currentSpinner = null;
      }
      throw error;
    }
  }

  /**
   * Format token count
   */
  private formatTokens(count: number): string {
    if (count < 1000) return String(count);
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(2)}M`;
  }

  /**
   * Run a single prompt and exit
   */
  async runOnce(prompt: string): Promise<void> {
    try {
      this.agent = this.initAgent();
    } catch (error) {
      console.error(c.error(`\nError: ${error instanceof Error ? error.message : error}`));
      console.error(c.dim("\nMake sure you've configured your provider: kaldi beans -p anthropic -k YOUR_KEY\n"));
      process.exit(1);
    }

    // Show compact header for one-shot mode
    console.log(`\n${c.honey("☕")} ${c.bold(c.cream("Kaldi"))} ${c.dim(`• ${this.context.provider}/${this.context.model}`)}\n`);

    await this.runAgent(prompt);
  }
}
