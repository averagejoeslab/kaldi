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
import { printWelcome, printGoodbye } from "../ui/components/welcome.js";
import { createSpinner } from "../ui/components/spinner.js";
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
          process.stdout.write(text);
        },
        onToolUse: (name, args) => {
          console.log(c.dim(`\n  ${sym.pending} Using tool: ${name}`));
          // Show command for bash tool
          if (name === "bash" && args.command) {
            console.log(c.dim(`    $ ${String(args.command).slice(0, 100)}`));
          }
        },
        onToolResult: (name, result, isError) => {
          if (isError) {
            console.log(c.error(`  ${sym.error} Tool error: ${result.slice(0, 200)}`));
          } else if (result && this.options.verbose) {
            // Only show result in verbose mode (can be noisy)
            const preview = result.slice(0, 500);
            console.log(c.dim(`  ${sym.success} Result: ${preview}${result.length > 500 ? "..." : ""}`));
          } else {
            console.log(c.success(`  ${sym.success} Done`));
          }
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
          console.error(c.error(`\n  ${sym.error} ${error.message}`));
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

    // Print welcome message
    printWelcome({
      provider: this.context.provider,
      model: this.context.model,
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

    try {
      const result = await this.agent.run(message);

      // Response is already streamed via callbacks
      console.log(""); // New line after response

      // Show usage if verbose
      if (this.options.verbose && result.usage) {
        console.log(c.dim(`  Tokens: ${result.usage.inputTokens} in, ${result.usage.outputTokens} out`));
      }
    } catch (error) {
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
      console.error(c.error(`\nError: ${error instanceof Error ? error.message : error}`));
      console.error(c.dim("\nMake sure you've configured your provider: kaldi beans -p anthropic -k YOUR_KEY\n"));
      process.exit(1);
    }

    await this.runAgent(prompt);
  }
}
