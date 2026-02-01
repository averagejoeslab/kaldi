import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as readline from "readline";
import { createProvider } from "./providers/index.js";
import { createDefaultRegistry } from "./tools/index.js";
import { Agent, buildSystemPrompt } from "./agent/index.js";
import {
  getConfig,
  setProvider,
  setApiKey,
  setModel,
  isConfigured,
  getAllProviderConfigs,
  getConfigPath,
} from "./config/index.js";
import type { ProviderType } from "./providers/types.js";
import { PROVIDER_MODELS } from "./providers/index.js";

const VERSION = "0.1.0";

// Coffee-themed colors
const coffee = {
  brown: chalk.hex("#6F4E37"),
  cream: chalk.hex("#FFFDD0"),
  espresso: chalk.hex("#3C2415"),
  latte: chalk.hex("#C9A66B"),
};

function printBanner() {
  console.log(
    coffee.brown(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║   ☕  ${chalk.bold("KALDI")}  ☕                       ║
  ║   Your loyal coding companion         ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
`)
  );
}

function printHelp() {
  console.log(`
${chalk.bold("Commands:")}
  ${chalk.cyan("/help")}      Show this help message
  ${chalk.cyan("/clear")}     Clear conversation history
  ${chalk.cyan("/config")}    Show current configuration
  ${chalk.cyan("/quit")}      Exit Kaldi

${chalk.bold("Tips:")}
  - Just type your message and press Enter
  - Kaldi can read, write, and edit files
  - Kaldi can run bash commands
  - Use ${chalk.cyan("kaldi beans")} to configure providers
`);
}

async function runInteractiveSession() {
  printBanner();

  if (!isConfigured()) {
    console.log(
      chalk.yellow("\n⚠ No API key configured. Run 'kaldi beans' to set up a provider.\n")
    );
    return;
  }

  const config = getConfig();
  console.log(
    chalk.dim(`Provider: ${config.provider} | Model: ${config.model || "default"}\n`)
  );

  const provider = createProvider(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });

  const tools = createDefaultRegistry();
  const agent = new Agent({
    provider,
    tools,
    systemPrompt: buildSystemPrompt(process.cwd()),
    onText: (text) => process.stdout.write(text),
    onToolCall: (name, args) => {
      console.log(chalk.dim(`\n[${name}]`));
    },
    onToolResult: (name, result, isError) => {
      if (isError) {
        console.log(chalk.red(`Error: ${result}`));
      }
    },
    onTurnComplete: () => {
      console.log();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(coffee.latte("\n☕ > "), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith("/")) {
        const cmd = trimmed.toLowerCase();

        if (cmd === "/quit" || cmd === "/exit" || cmd === "/q") {
          console.log(chalk.dim("\nGoodbye! ☕\n"));
          rl.close();
          process.exit(0);
        }

        if (cmd === "/help" || cmd === "/h") {
          printHelp();
          prompt();
          return;
        }

        if (cmd === "/clear") {
          agent.clearHistory();
          console.log(chalk.dim("Conversation cleared."));
          prompt();
          return;
        }

        if (cmd === "/config") {
          const cfg = getConfig();
          console.log(chalk.dim(`\nProvider: ${cfg.provider}`));
          console.log(chalk.dim(`Model: ${cfg.model || "default"}`));
          console.log(chalk.dim(`Config file: ${getConfigPath()}`));
          prompt();
          return;
        }

        console.log(chalk.yellow(`Unknown command: ${trimmed}`));
        prompt();
        return;
      }

      // Run the agent
      const spinner = ora({ text: "Thinking...", color: "yellow" }).start();

      try {
        spinner.stop();
        console.log();
        await agent.run(trimmed);
      } catch (error) {
        spinner.stop();
        console.log(
          chalk.red(`\nError: ${error instanceof Error ? error.message : error}`)
        );
      }

      prompt();
    });
  };

  prompt();
}

// CLI setup
const program = new Command();

program
  .name("kaldi")
  .description("☕ Your loyal coding companion - a BYOK agentic coding CLI")
  .version(VERSION);

program
  .command("beans")
  .description("Configure your LLM provider (pick your beans)")
  .option("-p, --provider <provider>", "Set provider (anthropic, openai, ollama, openrouter)")
  .option("-k, --key <key>", "Set API key for current provider")
  .option("-m, --model <model>", "Set model for current provider")
  .option("-l, --list", "List all provider configurations")
  .action((options) => {
    if (options.list) {
      console.log(chalk.bold("\n☕ Provider Configurations:\n"));
      const configs = getAllProviderConfigs();
      const current = getConfig().provider;

      for (const [provider, cfg] of Object.entries(configs)) {
        const isCurrent = provider === current;
        const prefix = isCurrent ? chalk.green("→ ") : "  ";
        console.log(`${prefix}${chalk.bold(provider)}`);
        console.log(`    API Key: ${cfg.apiKey}`);
        console.log(`    Model: ${cfg.model}`);
        console.log();
      }

      console.log(chalk.dim(`Config file: ${getConfigPath()}\n`));
      return;
    }

    if (options.provider) {
      const validProviders: ProviderType[] = ["anthropic", "openai", "ollama", "openrouter"];
      if (!validProviders.includes(options.provider)) {
        console.log(chalk.red(`Invalid provider. Choose from: ${validProviders.join(", ")}`));
        return;
      }
      setProvider(options.provider);
      console.log(chalk.green(`✓ Provider set to ${options.provider}`));

      // Show available models
      const models = PROVIDER_MODELS[options.provider as ProviderType];
      console.log(chalk.dim(`Available models: ${models.join(", ")}`));
    }

    if (options.key) {
      const config = getConfig();
      setApiKey(config.provider, options.key);
      console.log(chalk.green(`✓ API key set for ${config.provider}`));
    }

    if (options.model) {
      const config = getConfig();
      setModel(config.provider, options.model);
      console.log(chalk.green(`✓ Model set to ${options.model}`));
    }

    if (!options.provider && !options.key && !options.model && !options.list) {
      // Interactive setup
      console.log(chalk.bold("\n☕ Kaldi Bean Selection\n"));
      console.log("Use the following options to configure:");
      console.log("  --provider, -p  Set provider (anthropic, openai, ollama, openrouter)");
      console.log("  --key, -k       Set API key");
      console.log("  --model, -m     Set model");
      console.log("  --list, -l      List all configurations");
      console.log("\nExample:");
      console.log(chalk.cyan("  kaldi beans -p anthropic -k sk-ant-xxx"));
      console.log();
    }
  });

program
  .command("roast")
  .description("Review and critique code in the current directory")
  .action(async () => {
    console.log(chalk.yellow("☕ Roast mode coming soon..."));
  });

program
  .command("refill")
  .description("Resume previous conversation")
  .action(async () => {
    console.log(chalk.yellow("☕ Session persistence coming soon..."));
  });

// Default action (no command) - start interactive session
program.action(() => {
  runInteractiveSession();
});

program.parse();
