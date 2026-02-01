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
import type { ProviderType } from "./providers/types.js";
import { PROVIDER_MODELS } from "./providers/index.js";

const VERSION = "0.1.0";

// Clean, minimal colors
const colors = {
  primary: chalk.hex("#C9A66B"),    // Warm latte
  dim: chalk.dim,
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
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

  if (request.tool === "bash") {
    const cmd = request.args.command as string;
    console.log(colors.dim(`  $ ${cmd.length > 100 ? cmd.slice(0, 100) + "..." : cmd}`));
  } else if (request.tool === "write_file") {
    console.log(colors.dim(`  Write: ${request.args.path}`));
  } else if (request.tool === "edit_file") {
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
        context: 2,
      });
      console.log(diff);
    } catch {
      console.log(colors.dim(`  Edit: ${path}`));
    }
  } else if (request.tool === "web_fetch") {
    console.log(colors.dim(`  Fetch: ${request.args.url}`));
  }

  const answer = await askQuestion(colors.warn("  Allow? [y/n] "));
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

function printWelcome() {
  console.log();
  console.log(colors.primary("  ☕ kaldi"));
  console.log(colors.dim("  Your coding companion"));
  console.log();
}

function printHelp() {
  console.log(`
${colors.primary("Commands:")}
  /help      Show this help
  /clear     Clear conversation
  /compact   Toggle auto-approve mode
  /usage     Show token usage
  /save      Save session
  /load      Load previous session
  /quit      Exit

${colors.dim("Shortcuts: /status /diff /init /doctor")}
`);
}

function formatCost(inputTokens: number, outputTokens: number): string {
  const inputCost = (inputTokens / 1000000) * 3;
  const outputCost = (outputTokens / 1000000) * 15;
  return `$${(inputCost + outputCost).toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

async function runInteractiveSession(resumeSession?: Session) {
  printWelcome();

  if (!isConfigured()) {
    console.log(colors.warn("  No API key configured.\n"));
    console.log(colors.dim("  Quick setup:"));
    console.log(colors.info("  kaldi beans -p anthropic -k your-api-key\n"));
    return;
  }

  const config = getConfig();
  const cwd = process.cwd();

  console.log(colors.dim(`  ${config.provider} · ${config.model || "default"}`));
  console.log(colors.dim(`  ${cwd}`));
  console.log();

  const provider = createProvider(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });

  const tools = createDefaultRegistry();

  let session: Session;
  if (resumeSession) {
    session = resumeSession;
    console.log(colors.dim(`  Resumed · ${session.metadata.messageCount} messages\n`));
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
        // Show tool activity inline
        if (name === "read_file") {
          console.log(colors.dim(`\n  Reading ${(args.path as string).split('/').pop()}...`));
        } else if (name === "glob") {
          console.log(colors.dim(`\n  Finding ${args.pattern}...`));
        } else if (name === "grep") {
          console.log(colors.dim(`\n  Searching for ${args.pattern}...`));
        } else if (name === "list_dir") {
          console.log(colors.dim(`\n  Listing ${args.path}...`));
        }
      },
      onToolResult: (name, result, isError) => {
        if (isError) {
          console.log(colors.error(`  ✗ ${name} failed`));
        } else if (!["read_file", "glob", "grep", "list_dir"].includes(name)) {
          // Only show completion for mutation tools
          console.log(colors.success(`  ✓ ${name}`));
        }
      },
      onPermissionRequest: async (request) => {
        if (compactMode) {
          if (request.tool === "bash") {
            console.log(colors.dim(`\n  $ ${(request.args.command as string).slice(0, 60)}...`));
          }
          return true;
        }
        return askPermission(request);
      },
      onUsage: (input, output) => {
        session.totalInputTokens += input;
        session.totalOutputTokens += output;
      },
    },
  });

  currentAgent = agent;

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    if (isProcessing) {
      console.log(colors.dim("\n\n  Cancelled.\n"));
      agent.stop();
      isProcessing = false;
      prompt();
    } else {
      console.log(colors.dim("\n  Goodbye.\n"));
      process.exit(0);
    }
  });

  const prompt = () => {
    getReadline().question(colors.primary("> "), async (input) => {
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
        session.messages = agent.getMessages();
        console.log("\n");
      } catch (error) {
        if (isProcessing) {
          console.log(colors.error(`\n  Error: ${error instanceof Error ? error.message : error}\n`));
        }
      }

      isProcessing = false;
      prompt();
    });
  };

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
      console.log(colors.dim("\n  Goodbye.\n"));
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
      console.log(colors.dim("  Cleared.\n"));
      break;

    case "/config":
      const cfg = getConfig();
      console.log(colors.dim(`\n  Provider: ${cfg.provider}`));
      console.log(colors.dim(`  Model: ${cfg.model || "default"}`));
      console.log(colors.dim(`  Config: ${getConfigPath()}\n`));
      break;

    case "/usage":
      const usage = agent.getUsage();
      console.log(colors.dim(`\n  Tokens: ${formatTokens(usage.inputTokens)} in, ${formatTokens(usage.outputTokens)} out`));
      console.log(colors.dim(`  Cost: ~${formatCost(usage.inputTokens, usage.outputTokens)}\n`));
      break;

    case "/compact":
      state.setCompactMode(!state.compactMode);
      console.log(state.compactMode
        ? colors.warn("  Compact mode on - tools auto-approved\n")
        : colors.dim("  Compact mode off - will ask for approval\n")
      );
      break;

    case "/sessions":
      const sessions = await listSessions();
      if (sessions.length === 0) {
        console.log(colors.dim("\n  No saved sessions.\n"));
      } else {
        console.log(colors.dim("\n  Sessions:"));
        for (const s of sessions.slice(0, 5)) {
          const dir = s.workingDirectory.split("/").pop();
          console.log(colors.dim(`    ${s.id.slice(0, 8)} · ${dir} · ${s.messageCount} msgs`));
        }
        console.log();
      }
      break;

    case "/save":
      await saveSession(session);
      console.log(colors.success(`  Saved: ${session.metadata.id.slice(0, 8)}\n`));
      break;

    case "/load":
      const sessionId = args[0];
      let loadedSession: Session | null = null;

      if (sessionId) {
        loadedSession = await loadSession(sessionId);
      } else {
        loadedSession = await getSessionForDirectory(process.cwd());
        if (!loadedSession) loadedSession = await getLatestSession();
      }

      if (loadedSession) {
        console.log(colors.success(`  Loaded: ${loadedSession.metadata.id.slice(0, 8)}\n`));
      } else {
        console.log(colors.dim("  No session found.\n"));
      }
      break;

    case "/init":
      console.log();
      isProcessing = true;
      try {
        await agent.run("Briefly describe this project structure. Be concise.");
      } catch {}
      isProcessing = false;
      console.log("\n");
      break;

    case "/status":
      isProcessing = true;
      try {
        await agent.run("Run git status, show output only.");
      } catch {}
      isProcessing = false;
      console.log("\n");
      break;

    case "/diff":
      isProcessing = true;
      try {
        await agent.run("Run git diff, show output only.");
      } catch {}
      isProcessing = false;
      console.log("\n");
      break;

    case "/doctor":
      console.log(colors.dim("\n  Checking setup..."));
      const doctorConfig = getConfig();
      console.log(doctorConfig.apiKey
        ? colors.success("  ✓ API key configured")
        : colors.error("  ✗ No API key")
      );
      console.log(colors.dim(`    ${doctorConfig.provider} · ${doctorConfig.model || "default"}`));

      const nodeVersion = process.version;
      const major = parseInt(nodeVersion.slice(1).split(".")[0]);
      console.log(major >= 20
        ? colors.success(`  ✓ Node ${nodeVersion}`)
        : colors.warn(`  ⚠ Node ${nodeVersion} (20+ recommended)`)
      );

      try {
        const { execSync } = await import("child_process");
        execSync("git --version", { stdio: "pipe" });
        console.log(colors.success("  ✓ Git available"));
      } catch {
        console.log(colors.warn("  ⚠ Git not found"));
      }
      console.log();
      break;

    default:
      console.log(colors.dim(`  Unknown: ${cmd}. Try /help\n`));
  }
}

// CLI setup
const program = new Command();

program
  .name("kaldi")
  .description("☕ Your coding companion")
  .version(VERSION);

program
  .command("beans")
  .description("Configure LLM provider")
  .option("-p, --provider <provider>", "Provider: anthropic, openai, ollama, openrouter")
  .option("-k, --key <key>", "API key")
  .option("-m, --model <model>", "Model name")
  .option("-l, --list", "List configurations")
  .action((options) => {
    if (options.list) {
      console.log(colors.dim("\n  Providers:\n"));
      const configs = getAllProviderConfigs();
      const current = getConfig().provider;

      for (const [provider, cfg] of Object.entries(configs)) {
        const isCurrent = provider === current;
        const prefix = isCurrent ? colors.success("→") : " ";
        console.log(`  ${prefix} ${provider}`);
        console.log(colors.dim(`      Key: ${cfg.apiKey}`));
        console.log(colors.dim(`      Model: ${cfg.model}`));
      }
      console.log();
      return;
    }

    if (options.provider) {
      const validProviders: ProviderType[] = ["anthropic", "openai", "ollama", "openrouter"];
      if (!validProviders.includes(options.provider)) {
        console.log(colors.error(`  Invalid provider. Use: ${validProviders.join(", ")}`));
        return;
      }
      setProvider(options.provider);
      console.log(colors.success(`  ✓ Provider: ${options.provider}`));
    }

    if (options.key) {
      const config = getConfig();
      setApiKey(config.provider, options.key);
      console.log(colors.success(`  ✓ API key set`));
    }

    if (options.model) {
      const config = getConfig();
      setModel(config.provider, options.model);
      console.log(colors.success(`  ✓ Model: ${options.model}`));
    }

    if (!options.provider && !options.key && !options.model && !options.list) {
      console.log(colors.dim("\n  Configure your LLM:\n"));
      console.log("    kaldi beans -p anthropic -k your-key");
      console.log("    kaldi beans -m claude-sonnet-4-20250514");
      console.log("    kaldi beans -l\n");
    }
  });

program
  .command("roast [path]")
  .description("Review code")
  .action(async (path) => {
    if (!isConfigured()) {
      console.log(colors.error("  Configure first: kaldi beans -p anthropic -k your-key"));
      return;
    }

    const targetPath = path || ".";
    console.log(colors.dim(`\n  Reviewing ${targetPath}...\n`));

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
      await agent.run(`Review the code in "${targetPath}". Focus on bugs, security issues, and improvements. Be direct and concise.`);
      console.log("\n");
    } catch (error) {
      console.log(colors.error(`\n  Error: ${error instanceof Error ? error.message : error}\n`));
    }
  });

program
  .command("refill")
  .description("Resume previous session")
  .action(async () => {
    let session = await getSessionForDirectory(process.cwd());
    if (!session) session = await getLatestSession();

    if (session) {
      await runInteractiveSession(session);
    } else {
      console.log(colors.dim("  No previous session. Starting fresh.\n"));
      await runInteractiveSession();
    }
  });

program
  .command("doctor")
  .description("Check setup")
  .action(async () => {
    console.log(colors.dim("\n  Checking setup...\n"));

    const config = getConfig();
    console.log(config.apiKey
      ? colors.success("  ✓ API key configured")
      : colors.error("  ✗ No API key")
    );

    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0]);
    console.log(major >= 20
      ? colors.success(`  ✓ Node ${nodeVersion}`)
      : colors.warn(`  ⚠ Node ${nodeVersion}`)
    );

    try {
      const { execSync } = await import("child_process");
      execSync("git --version", { stdio: "pipe" });
      console.log(colors.success("  ✓ Git"));
    } catch {
      console.log(colors.warn("  ⚠ Git not found"));
    }

    console.log(colors.dim(`\n  Config: ${getConfigPath()}`));
    console.log(colors.dim(`  Sessions: ${getSessionsDir()}\n`));
  });

// Default - start interactive session
program.action(() => {
  runInteractiveSession();
});

program.parse();
