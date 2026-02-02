/**
 * REPL (Read-Eval-Print Loop)
 *
 * Interactive command loop for the CLI.
 */

import * as readline from "readline";
import { getConfig } from "../config/store.js";
import { isCommand, executeCommand, type CommandContext } from "../commands/index.js";
import { AgentOrchestrator } from "../agent/orchestrator.js";
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
  private agent: AgentOrchestrator;
  private context: CommandContext;
  private running = false;
  private processing = false;

  constructor(options: CLIOptions) {
    const config = getConfig();

    this.context = {
      cwd: options.cwd || process.cwd(),
      provider: (options.provider as CommandContext["provider"]) || config.provider,
      model: options.model || config.model || "claude-sonnet-4-20250514",
      sessionId: options.resume,
    };

    this.agent = new AgentOrchestrator({
      provider: this.context.provider,
      model: this.context.model,
    });
  }

  /**
   * Start the REPL
   */
  async start(): Promise<void> {
    this.running = true;

    // Print welcome message
    printWelcome();

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
          this.agent = new AgentOrchestrator({
            provider: this.context.provider,
            model: this.context.model,
          });
        }
      } else {
        // Check for skills (commands that start with /)
        if (trimmed.startsWith("/")) {
          const parts = trimmed.slice(1).split(/\s+/);
          const skillName = parts[0];
          const skillArgs = parts.slice(1).join(" ");

          const registry = getSkillsRegistry();
          const skillResult = registry.executeSkill(skillName, skillArgs, {
            cwd: this.context.cwd,
            provider: this.context.provider,
            model: this.context.model,
            sessionId: this.context.sessionId,
          });

          if (skillResult) {
            await this.runAgent(skillResult.prompt);
          } else {
            console.log(c.error(`\n  ${sym.error} Unknown command or skill: ${skillName}\n`));
          }
        } else {
          // Regular message to agent
          await this.runAgent(trimmed);
        }
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
    const spinner = createSpinner("Thinking...");
    spinner.start();

    try {
      const result = await this.agent.run(message);

      spinner.stop();

      // Print response
      if (result.response) {
        console.log("");
        console.log(result.response);
        console.log("");
      }

      // Print tool results summary
      if (result.toolResults?.length) {
        const successful = result.toolResults.filter((r) => r.success).length;
        const failed = result.toolResults.length - successful;

        if (failed > 0) {
          console.log(c.dim(`  Tools: ${successful} succeeded, ${failed} failed`));
        }
      }
    } catch (error) {
      spinner.stop();
      throw error;
    }
  }

  /**
   * Run a single prompt and exit
   */
  async runOnce(prompt: string): Promise<void> {
    console.log("");
    await this.runAgent(prompt);
  }
}
