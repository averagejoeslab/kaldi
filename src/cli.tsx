import { Command } from "commander";
import chalk from "chalk";
import * as readline from "readline";
import { readFile } from "fs/promises";
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
import { formatDiff, getChangeStats, formatChangeStats } from "./ui/diff.js";
import { createSpinner } from "./ui/spinner.js";
import type { ProviderType } from "./providers/types.js";
import { PROVIDER_MODELS } from "./providers/index.js";

const VERSION = "0.1.0";

// Coffee-themed colors
const coffee = {
  brown: chalk.hex("#6F4E37"),
  cream: chalk.hex("#FFFDD0"),
  espresso: chalk.hex("#3C2415"),
  latte: chalk.hex("#C9A66B"),
  roast: chalk.hex("#5C4033"),
};

// Readline interface
let rl: readline.Interface | null = null;
let isProcessing = false;
let currentAgent: Agent | null = null;

function getReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    getReadline().question(question, resolve);
  });
}

async function askPermission(request: PermissionRequest): Promise<boolean> {
  console.log();
  console.log(chalk.yellow("⚠ Permission required:"));
  console.log(chalk.white(`  ${request.description}`));

  if (request.tool === "bash") {
    const cmd = request.args.command as string;
    console.log(chalk.dim(`  $ ${cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd}`));
  } else if (request.tool === "write_file") {
    console.log(chalk.dim(`  Path: ${request.args.path}`));
  } else if (request.tool === "edit_file") {
    // Show diff preview for edits
    const path = request.args.path as string;
    const oldString = request.args.old_string as string;
    const newString = request.args.new_string as string;

    try {
      const content = await readFile(path, "utf-8");
      const newContent = content.replace(oldString, newString);
      const diff = formatDiff({
        oldContent: content,
        newContent,
        filePath: path,
      });
      console.log(diff);

      const stats = getChangeStats(content, newContent);
      console.log(chalk.dim(`  Changes: ${formatChangeStats(stats)}`));
    } catch {
      console.log(chalk.dim(`  Path: ${path}`));
      console.log(chalk.dim(`  Replace: "${oldString.slice(0, 50)}..."`));
    }
  }

  const answer = await askQuestion(chalk.yellow("  Allow? [y/N/a(ll)] "));
  const lower = answer.toLowerCase();

  if (lower === "a" || lower === "all") {
    return true; // Will be handled by compact mode toggle
  }

  return lower === "y" || lower === "yes";
}

function printBanner() {
  console.log(
    coffee.brown(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ☕  ${chalk.bold("KALDI")}  ☕                                          ║
  ║   ${chalk.dim("Your loyal coding companion")}                            ║
  ║                                                           ║
  ║   ${chalk.dim("\"Like a good cup of coffee and a faithful dog,\"")}       ║
  ║   ${chalk.dim("always there when you need it.\"")}                        ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
`)
  );
}

function printHelp() {
  console.log(`
${chalk.bold("☕ Kaldi Commands:")}

${chalk.cyan("/help")}         Show this help message
${chalk.cyan("/clear")}        Clear conversation history
${chalk.cyan("/config")}       Show current configuration
${chalk.cyan("/usage")}        Show token usage and cost estimate
${chalk.cyan("/compact")}      Toggle compact mode (auto-approve tools)
${chalk.cyan("/sessions")}     List saved sessions
${chalk.cyan("/save")}         Save current session
${chalk.cyan("/load [id]")}    Load a session (or latest for this directory)
${chalk.cyan("/init")}         Initialize project context (reads key files)
${chalk.cyan("/status")}       Show git status
${chalk.cyan("/diff")}         Show git diff
${chalk.cyan("/doctor")}       Check Kaldi setup and dependencies
${chalk.cyan("/quit")}         Exit Kaldi

${chalk.bold("Tips:")}
  ${chalk.dim("•")} Just type your message and press Enter
  ${chalk.dim("•")} Kaldi asks before running commands or editing files
  ${chalk.dim("•")} Use ${chalk.cyan("/compact")} to auto-approve (faster but less safe)
  ${chalk.dim("•")} Press ${chalk.cyan("Ctrl+C")} to cancel current operation
`);
}

function formatCost(inputTokens: number, outputTokens: number): string {
  // Approximate pricing (Claude Sonnet)
  const inputCost = (inputTokens / 1000000) * 3;
  const outputCost = (outputTokens / 1000000) * 15;
  const total = inputCost + outputCost;

  return `$${total.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

async function runInteractiveSession(resumeSession?: Session) {
  printBanner();

  if (!isConfigured()) {
    console.log(
      chalk.yellow("\n⚠ No API key configured.\n")
    );
    console.log(chalk.dim("Quick setup:"));
    console.log(chalk.cyan("  kaldi beans -p anthropic -k your-api-key\n"));
    console.log(chalk.dim("Or set environment variable:"));
    console.log(chalk.cyan("  export ANTHROPIC_API_KEY=your-api-key\n"));
    return;
  }

  const config = getConfig();
  const cwd = process.cwd();

  console.log(chalk.dim(`☕ Provider: ${config.provider} | Model: ${config.model || "default"}`));
  console.log(chalk.dim(`📂 Working: ${cwd}\n`));

  const provider = createProvider(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });

  const tools = createDefaultRegistry();

  // Create or resume session
  let session: Session;
  if (resumeSession) {
    session = resumeSession;
    console.log(chalk.green(`☕ Resumed session from ${new Date(session.metadata.updatedAt).toLocaleString()}`));
    console.log(chalk.dim(`   ${session.metadata.messageCount} messages, ${formatTokens(session.totalInputTokens + session.totalOutputTokens)} tokens\n`));
  } else {
    session = createSession(cwd, config.provider, config.model || "default");
  }

  let compactMode = false;

  const agent = new Agent({
    provider,
    tools,
    systemPrompt: buildSystemPrompt(cwd),
    requirePermission: true,
    callbacks: {
      onText: (text) => {
        if (!isProcessing) return;
        process.stdout.write(text);
      },
      onToolUse: (name, args) => {
        if (name === "read_file" || name === "glob" || name === "grep" || name === "list_dir") {
          console.log(chalk.dim(`\n📖 [${name}] ${(args.path as string) || (args.pattern as string) || ""}`));
        }
      },
      onToolResult: (name, result, isError) => {
        if (isError) {
          console.log(chalk.red(`\n✗ ${name} failed`));
        } else if (!["read_file", "glob", "grep", "list_dir"].includes(name)) {
          console.log(chalk.green(`\n✓ ${name} completed`));
        }
      },
      onPermissionRequest: async (request) => {
        if (compactMode) {
          console.log(chalk.dim(`\n⚡ [${request.tool}] ${request.description}`));
          return true;
        }
        const result = await askPermission(request);
        return result;
      },
      onUsage: (input, output) => {
        session.totalInputTokens += input;
        session.totalOutputTokens += output;
      },
    },
  });

  currentAgent = agent;

  // Restore messages if resuming
  if (resumeSession && resumeSession.messages.length > 0) {
    // The agent needs to be initialized with previous messages
    // For now, we just show that we resumed
  }

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    if (isProcessing) {
      console.log(chalk.yellow("\n\n⚠ Cancelled. Type your next message or /quit to exit.\n"));
      agent.stop();
      isProcessing = false;
      prompt();
    } else {
      console.log(chalk.dim("\n\nGoodbye! ☕\n"));
      process.exit(0);
    }
  });

  const prompt = () => {
    getReadline().question(coffee.latte("\n☕ > "), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle slash commands
      if (trimmed.startsWith("/")) {
        await handleCommand(trimmed, agent, session, { compactMode, setCompactMode: (v) => compactMode = v });
        prompt();
        return;
      }

      // Run the agent
      isProcessing = true;

      try {
        console.log();
        await agent.run(trimmed);

        // Update session
        session.messages = agent.getMessages();

        console.log();
      } catch (error) {
        if (!isProcessing) {
          // Was cancelled
        } else {
          console.log(
            chalk.red(`\n☕ Error: ${error instanceof Error ? error.message : error}\n`)
          );
        }
      }

      isProcessing = false;
      prompt();
    });
  };

  console.log(chalk.dim("Type /help for commands, or just start chatting.\n"));
  prompt();
}

async function handleCommand(
  input: string,
  agent: Agent,
  session: Session,
  state: { compactMode: boolean; setCompactMode: (v: boolean) => void }
): Promise<void> {
  const [cmd, ...args] = input.toLowerCase().split(" ");

  switch (cmd) {
    case "/quit":
    case "/exit":
    case "/q":
      console.log(chalk.dim("\nGoodbye! ☕\n"));
      rl?.close();
      process.exit(0);

    case "/help":
    case "/h":
      printHelp();
      break;

    case "/clear":
      agent.clearHistory();
      session.messages = [];
      session.totalInputTokens = 0;
      session.totalOutputTokens = 0;
      console.log(chalk.dim("☕ Conversation cleared."));
      break;

    case "/config":
      const cfg = getConfig();
      console.log(chalk.dim(`\n☕ Provider: ${cfg.provider}`));
      console.log(chalk.dim(`   Model: ${cfg.model || "default"}`));
      console.log(chalk.dim(`   Config: ${getConfigPath()}`));
      break;

    case "/usage":
      const usage = agent.getUsage();
      console.log(chalk.dim(`\n☕ Token Usage:`));
      console.log(chalk.dim(`   Input:  ${formatTokens(usage.inputTokens)}`));
      console.log(chalk.dim(`   Output: ${formatTokens(usage.outputTokens)}`));
      console.log(chalk.dim(`   Est. cost: ${formatCost(usage.inputTokens, usage.outputTokens)}`));
      break;

    case "/compact":
      state.setCompactMode(!state.compactMode);
      console.log(
        state.compactMode
          ? chalk.yellow("⚡ Compact mode ON - tools run without asking")
          : chalk.green("🛡️ Compact mode OFF - will ask before running tools")
      );
      break;

    case "/sessions":
      const sessions = await listSessions();
      if (sessions.length === 0) {
        console.log(chalk.dim("\n☕ No saved sessions."));
      } else {
        console.log(chalk.dim("\n☕ Saved Sessions:\n"));
        for (const s of sessions.slice(0, 10)) {
          const date = new Date(s.updatedAt).toLocaleString();
          const dir = s.workingDirectory.split("/").pop();
          console.log(chalk.dim(`   ${s.id} - ${dir} (${s.messageCount} msgs) - ${date}`));
        }
      }
      break;

    case "/save":
      await saveSession(session);
      console.log(chalk.green(`☕ Session saved: ${session.metadata.id}`));
      break;

    case "/load":
      const sessionId = args[0];
      let loadedSession: Session | null = null;

      if (sessionId) {
        loadedSession = await loadSession(sessionId);
      } else {
        loadedSession = await getSessionForDirectory(process.cwd());
        if (!loadedSession) {
          loadedSession = await getLatestSession();
        }
      }

      if (loadedSession) {
        console.log(chalk.green(`☕ Loaded session: ${loadedSession.metadata.id}`));
        // Would need to reinitialize agent with messages
      } else {
        console.log(chalk.yellow("☕ No session found to load."));
      }
      break;

    case "/init":
      console.log(chalk.dim("\n☕ Initializing project context...\n"));
      isProcessing = true;
      try {
        await agent.run(
          "Please read the project structure to understand this codebase. Look for README, package.json, and key source files. Give me a brief summary of what this project is."
        );
      } catch (e) {
        console.log(chalk.red("Failed to initialize."));
      }
      isProcessing = false;
      break;

    case "/status":
      console.log(chalk.dim("\n☕ Git status:\n"));
      isProcessing = true;
      try {
        await agent.run("Run `git status` and show me the output.");
      } catch (e) {
        console.log(chalk.red("Failed to get status."));
      }
      isProcessing = false;
      break;

    case "/diff":
      console.log(chalk.dim("\n☕ Git diff:\n"));
      isProcessing = true;
      try {
        await agent.run("Run `git diff` and show me the changes.");
      } catch (e) {
        console.log(chalk.red("Failed to get diff."));
      }
      isProcessing = false;
      break;

    case "/doctor":
      console.log(chalk.bold("\n☕ Kaldi Health Check\n"));

      // Check config
      const doctorConfig = getConfig();
      console.log(
        doctorConfig.apiKey
          ? chalk.green("✓ API key configured")
          : chalk.red("✗ No API key configured")
      );
      console.log(chalk.dim(`  Provider: ${doctorConfig.provider}`));
      console.log(chalk.dim(`  Model: ${doctorConfig.model || "default"}`));

      // Check Node version
      const nodeVersion = process.version;
      const major = parseInt(nodeVersion.slice(1).split(".")[0]);
      console.log(
        major >= 20
          ? chalk.green(`✓ Node.js ${nodeVersion}`)
          : chalk.yellow(`⚠ Node.js ${nodeVersion} (recommend 20+)`)
      );

      // Check git
      try {
        const { execSync } = await import("child_process");
        execSync("git --version", { stdio: "pipe" });
        console.log(chalk.green("✓ Git available"));
      } catch {
        console.log(chalk.yellow("⚠ Git not found"));
      }

      // Check sessions dir
      console.log(chalk.dim(`  Sessions: ${getSessionsDir()}`));
      console.log(chalk.dim(`  Config: ${getConfigPath()}`));
      console.log();
      break;

    default:
      console.log(chalk.yellow(`☕ Unknown command: ${cmd}. Type /help for commands.`));
  }
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
      console.log(chalk.bold("\n☕ Kaldi Bean Selection\n"));
      console.log("Configure your preferred LLM provider:\n");
      console.log("  --provider, -p  Set provider (anthropic, openai, ollama, openrouter)");
      console.log("  --key, -k       Set API key");
      console.log("  --model, -m     Set model");
      console.log("  --list, -l      List all configurations");
      console.log("\nExamples:");
      console.log(chalk.cyan("  kaldi beans -p anthropic -k sk-ant-xxx"));
      console.log(chalk.cyan("  kaldi beans -m claude-sonnet-4-20250514"));
      console.log();
    }
  });

program
  .command("roast [path]")
  .description("Review and critique code")
  .action(async (path) => {
    if (!isConfigured()) {
      console.log(chalk.red("☕ Configure a provider first: kaldi beans -p anthropic -k your-key"));
      return;
    }

    const targetPath = path || process.cwd();
    console.log(chalk.bold(`\n☕ Roasting code in ${targetPath}...\n`));

    const config = getConfig();
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
      requirePermission: false,
      callbacks: {
        onText: (text) => process.stdout.write(text),
      },
    });

    try {
      await agent.run(
        `Please review the code in "${targetPath}". Look for:
1. Potential bugs or issues
2. Code quality and style concerns
3. Security vulnerabilities
4. Performance issues
5. Suggestions for improvement

Be constructive but thorough. Focus on the most important issues.`
      );
      console.log("\n");
    } catch (error) {
      console.log(chalk.red(`\n☕ Error: ${error instanceof Error ? error.message : error}\n`));
    }
  });

program
  .command("refill")
  .description("Resume previous conversation")
  .option("-l, --latest", "Load the most recent session")
  .action(async (options) => {
    let session: Session | null = null;

    if (options.latest) {
      session = await getLatestSession();
    } else {
      session = await getSessionForDirectory(process.cwd());
      if (!session) {
        session = await getLatestSession();
      }
    }

    if (session) {
      await runInteractiveSession(session);
    } else {
      console.log(chalk.yellow("☕ No previous session found. Starting fresh...\n"));
      await runInteractiveSession();
    }
  });

program
  .command("doctor")
  .description("Check Kaldi setup and dependencies")
  .action(async () => {
    console.log(chalk.bold("\n☕ Kaldi Health Check\n"));

    const config = getConfig();
    console.log(
      config.apiKey
        ? chalk.green("✓ API key configured")
        : chalk.red("✗ No API key configured")
    );
    console.log(chalk.dim(`  Provider: ${config.provider}`));
    console.log(chalk.dim(`  Model: ${config.model || "default"}`));

    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0]);
    console.log(
      major >= 20
        ? chalk.green(`✓ Node.js ${nodeVersion}`)
        : chalk.yellow(`⚠ Node.js ${nodeVersion} (recommend 20+)`)
    );

    try {
      const { execSync } = await import("child_process");
      execSync("git --version", { stdio: "pipe" });
      console.log(chalk.green("✓ Git available"));
    } catch {
      console.log(chalk.yellow("⚠ Git not found"));
    }

    console.log(chalk.dim(`\n  Sessions dir: ${getSessionsDir()}`));
    console.log(chalk.dim(`  Config file: ${getConfigPath()}`));
    console.log();
  });

// Default action - start interactive session
program.action(() => {
  runInteractiveSession();
});

program.parse();
