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
import { formatDiff } from "./ui/diff.js";
import { createReadlineWithAutocomplete } from "./ui/autocomplete.js";
import {
  status,
  startToolStatus,
  getThinkingMessage,
  formatDuration,
} from "./ui/status.js";
import type { ProviderType } from "./providers/types.js";

const VERSION = "0.1.0";

// Elegant colors
const c = {
  text: chalk.white,
  dim: chalk.gray,
  accent: chalk.hex("#D4A574"),
  success: chalk.hex("#8BC34A"),
  error: chalk.hex("#FF6B6B"),
  warn: chalk.hex("#FFD93D"),
};

// Symbols
const sym = {
  prompt: c.accent("❯"),
  dot: c.dim("·"),
  check: c.success("✓"),
  cross: c.error("✗"),
  arrow: c.dim("→"),
  coffee: "☕",
  dog: "🐕",
};

let rl: readline.Interface | null = null;
let isProcessing = false;
let turnStartTime = 0;

function getReadline(): readline.Interface {
  if (!rl) {
    rl = createReadlineWithAutocomplete();
  }
  return rl;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getReadline().question(question, resolve);
  });
}

async function askPermission(request: PermissionRequest): Promise<boolean> {
  status.clear();
  console.log();

  const tool = request.tool;

  if (tool === "bash") {
    const cmd = request.args.command as string;
    const display = cmd.length > 80 ? cmd.slice(0, 77) + "..." : cmd;
    console.log(c.dim(`  $ ${display}`));
  } else if (tool === "write_file") {
    console.log(c.dim(`  write ${sym.arrow} ${request.args.path}`));
  } else if (tool === "edit_file") {
    const path = request.args.path as string;
    try {
      const content = await readFile(path, "utf-8");
      const newContent = content.replace(
        request.args.old_string as string,
        request.args.new_string as string
      );
      console.log(formatDiff({ oldContent: content, newContent, filePath: path, context: 2 }));
    } catch {
      console.log(c.dim(`  edit ${sym.arrow} ${path}`));
    }
  } else if (tool === "web_fetch") {
    console.log(c.dim(`  fetch ${sym.arrow} ${request.args.url}`));
  }

  const answer = await ask(c.dim("  allow? ") + c.warn("[y/n] "));
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

function printWelcome() {
  console.log();
  console.log(`  ${c.accent(sym.coffee)} ${c.text("kaldi")} ${c.dim("— your loyal coding companion")}`);
  console.log();
}

function printHelp() {
  const cmds = [
    ["/help", "show help"],
    ["/clear", "clear history"],
    ["/compact", "auto-approve tools"],
    ["/usage", "token usage"],
    ["/save", "save session"],
    ["/load", "restore session"],
    ["/quit", "exit"],
  ];

  console.log();
  for (const [cmd, desc] of cmds) {
    console.log(`  ${c.accent(cmd.padEnd(12))} ${c.dim(desc)}`);
  }
  console.log(c.dim(`\n  also: /status /diff /init /doctor /sessions /config`));
  console.log();
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

function formatCost(input: number, output: number): string {
  const cost = (input / 1e6) * 3 + (output / 1e6) * 15;
  return `$${cost.toFixed(4)}`;
}

async function runSession(resumeSession?: Session) {
  printWelcome();

  if (!isConfigured()) {
    console.log(c.warn("  no api key configured"));
    console.log(c.dim(`  run: kaldi beans -p anthropic -k YOUR_KEY\n`));
    return;
  }

  const config = getConfig();
  const cwd = process.cwd();

  console.log(c.dim(`  ${config.provider} ${sym.dot} ${config.model || "default"}`));
  console.log(c.dim(`  ${cwd}\n`));

  const provider = createProvider(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });

  const tools = createDefaultRegistry();

  let session = resumeSession || createSession(cwd, config.provider, config.model || "default");
  let compactMode = false;

  if (resumeSession) {
    console.log(c.dim(`  ${sym.dog} resumed ${sym.dot} ${session.metadata.messageCount} messages\n`));
  }

  const agent = new Agent({
    provider,
    tools,
    systemPrompt: buildSystemPrompt(cwd),
    requirePermission: true,
    callbacks: {
      onText: (text) => {
        if (!isProcessing) return;
        status.clear();
        process.stdout.write(text);
      },
      onToolUse: (name, args) => {
        startToolStatus(name, args);
      },
      onToolResult: (name, _, isError) => {
        const completion = status.stop();
        if (isError) {
          console.log(`  ${sym.cross} ${c.dim(name)}`);
        } else if (!["read_file", "glob", "grep", "list_dir"].includes(name)) {
          console.log(`  ${sym.check} ${c.dim(name)} ${c.dim(sym.dot)} ${c.dim(completion)}`);
        }
      },
      onPermissionRequest: async (request) => {
        if (compactMode) {
          status.clear();
          const info = request.tool === "bash"
            ? (request.args.command as string).slice(0, 50)
            : request.args.path || request.args.url || "";
          console.log(c.dim(`  ${sym.arrow} ${request.tool} ${info}`));
          return true;
        }
        return askPermission(request);
      },
      onUsage: (input, output) => {
        session.totalInputTokens += input;
        session.totalOutputTokens += output;
      },
      onTurnStart: () => {
        turnStartTime = Date.now();
        status.start(getThinkingMessage(), false);
      },
      onTurnComplete: () => {
        status.clear();
      },
    },
  });

  // Ctrl+C handler
  process.on("SIGINT", () => {
    if (isProcessing) {
      status.clear();
      console.log(c.dim("\n  cancelled\n"));
      agent.stop();
      isProcessing = false;
      prompt();
    } else {
      console.log(c.dim("\n  bye 🐕\n"));
      process.exit(0);
    }
  });

  const prompt = () => {
    getReadline().question(`${sym.prompt} `, async (input) => {
      const text = input.trim();
      if (!text) return prompt();

      if (text.startsWith("/")) {
        await handleCommand(text, agent, session, {
          compactMode,
          setCompact: (v) => (compactMode = v),
        });
        return prompt();
      }

      isProcessing = true;
      turnStartTime = Date.now();
      console.log();

      try {
        status.start(getThinkingMessage(), false);
        await agent.run(text);
        session.messages = agent.getMessages();
        status.clear();

        // Show total time for the turn
        const totalTime = Date.now() - turnStartTime;
        if (totalTime > 2000) {
          console.log(c.dim(`\n  ${sym.coffee} ${formatDuration(totalTime)}`));
        }
      } catch (e) {
        status.clear();
        if (isProcessing) {
          console.log(`\n  ${sym.cross} ${c.dim(e instanceof Error ? e.message : String(e))}`);
        }
      }

      console.log();
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
  state: { compactMode: boolean; setCompact: (v: boolean) => void }
) {
  const [cmd, ...args] = input.toLowerCase().split(" ");

  const commands: Record<string, () => Promise<void> | void> = {
    "/quit": () => { console.log(c.dim("\n  bye 🐕\n")); process.exit(0); },
    "/exit": () => { console.log(c.dim("\n  bye 🐕\n")); process.exit(0); },
    "/q": () => { console.log(c.dim("\n  bye 🐕\n")); process.exit(0); },

    "/help": () => printHelp(),
    "/h": () => printHelp(),

    "/clear": () => {
      agent.clearHistory();
      session.messages = [];
      session.totalInputTokens = 0;
      session.totalOutputTokens = 0;
      console.log(c.dim("  cleared\n"));
    },

    "/config": () => {
      const cfg = getConfig();
      console.log(c.dim(`\n  provider  ${cfg.provider}`));
      console.log(c.dim(`  model     ${cfg.model || "default"}`));
      console.log(c.dim(`  config    ${getConfigPath()}\n`));
    },

    "/usage": () => {
      const u = agent.getUsage();
      console.log(c.dim(`\n  tokens  ${formatTokens(u.inputTokens)} in ${sym.dot} ${formatTokens(u.outputTokens)} out`));
      console.log(c.dim(`  cost    ~${formatCost(u.inputTokens, u.outputTokens)}\n`));
    },

    "/compact": () => {
      state.setCompact(!state.compactMode);
      console.log(state.compactMode
        ? c.warn("  compact on") + c.dim(" — tools auto-approved\n")
        : c.dim("  compact off\n")
      );
    },

    "/sessions": async () => {
      const list = await listSessions();
      if (!list.length) {
        console.log(c.dim("\n  no sessions\n"));
        return;
      }
      console.log();
      for (const s of list.slice(0, 5)) {
        const dir = s.workingDirectory.split("/").pop();
        console.log(c.dim(`  ${s.id.slice(0, 8)} ${sym.dot} ${dir} ${sym.dot} ${s.messageCount} msgs`));
      }
      console.log();
    },

    "/save": async () => {
      await saveSession(session);
      console.log(`  ${sym.check} ${c.dim(`saved ${session.metadata.id.slice(0, 8)}`)}\n`);
    },

    "/load": async () => {
      const id = args[0];
      let loaded = id ? await loadSession(id) : await getSessionForDirectory(process.cwd());
      if (!loaded) loaded = await getLatestSession();

      if (loaded) {
        console.log(`  ${sym.check} ${c.dim(`loaded ${loaded.metadata.id.slice(0, 8)}`)}\n`);
      } else {
        console.log(c.dim("  no session found\n"));
      }
    },

    "/init": async () => {
      console.log();
      isProcessing = true;
      turnStartTime = Date.now();
      try {
        status.start("Sniffing around the project", true);
        await agent.run("Describe this project briefly.");
        status.clear();
        const time = Date.now() - turnStartTime;
        if (time > 2000) console.log(c.dim(`\n  ${sym.coffee} ${formatDuration(time)}`));
      } catch {
        status.clear();
      }
      isProcessing = false;
      console.log("\n");
    },

    "/status": async () => {
      isProcessing = true;
      try {
        status.start("Checking the grounds", false);
        await agent.run("Run git status, output only.");
        status.clear();
      } catch {
        status.clear();
      }
      isProcessing = false;
      console.log("\n");
    },

    "/diff": async () => {
      isProcessing = true;
      try {
        status.start("Comparing brews", false);
        await agent.run("Run git diff, output only.");
        status.clear();
      } catch {
        status.clear();
      }
      isProcessing = false;
      console.log("\n");
    },

    "/doctor": async () => {
      console.log();
      const cfg = getConfig();
      console.log(cfg.apiKey ? `  ${sym.check} api key` : `  ${sym.cross} no api key`);

      const v = parseInt(process.version.slice(1).split(".")[0]);
      console.log(v >= 20 ? `  ${sym.check} node ${process.version}` : `  ${sym.cross} node ${process.version}`);

      try {
        (await import("child_process")).execSync("git --version", { stdio: "pipe" });
        console.log(`  ${sym.check} git`);
      } catch {
        console.log(`  ${sym.cross} git`);
      }
      console.log();
    },
  };

  const handler = commands[cmd];
  if (handler) {
    await handler();
  } else {
    console.log(c.dim(`  unknown: ${cmd}\n`));
  }
}

// CLI
const program = new Command()
  .name("kaldi")
  .description("☕ your loyal coding companion")
  .version(VERSION);

program
  .command("beans")
  .description("configure provider")
  .option("-p, --provider <name>", "anthropic, openai, ollama, openrouter")
  .option("-k, --key <key>", "api key")
  .option("-m, --model <model>", "model name")
  .option("-l, --list", "list configs")
  .action((opts) => {
    if (opts.list) {
      const configs = getAllProviderConfigs();
      const current = getConfig().provider;
      console.log();
      for (const [name, cfg] of Object.entries(configs)) {
        const mark = name === current ? c.success("→") : " ";
        console.log(`  ${mark} ${name}`);
        console.log(c.dim(`      ${cfg.apiKey} ${sym.dot} ${cfg.model}`));
      }
      console.log();
      return;
    }

    if (opts.provider) {
      if (!["anthropic", "openai", "ollama", "openrouter"].includes(opts.provider)) {
        console.log(c.error("  invalid provider"));
        return;
      }
      setProvider(opts.provider);
      console.log(`  ${sym.check} provider: ${opts.provider}`);
    }

    if (opts.key) {
      setApiKey(getConfig().provider, opts.key);
      console.log(`  ${sym.check} api key set`);
    }

    if (opts.model) {
      setModel(getConfig().provider, opts.model);
      console.log(`  ${sym.check} model: ${opts.model}`);
    }

    if (!opts.provider && !opts.key && !opts.model && !opts.list) {
      console.log(c.dim("\n  kaldi beans -p anthropic -k YOUR_KEY"));
      console.log(c.dim("  kaldi beans -l\n"));
    }
  });

program
  .command("roast [path]")
  .description("review code")
  .action(async (path) => {
    if (!isConfigured()) {
      console.log(c.error("  configure first: kaldi beans -p anthropic -k KEY"));
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
      await agent.run(`Review "${target}". Focus on bugs and issues. Be concise.`);
      const time = Date.now() - start;
      console.log(c.dim(`\n\n  ${sym.coffee} Roasted in ${formatDuration(time)}\n`));
    } catch (e) {
      console.log(c.error(`\n  error: ${e}`));
    }
  });

program
  .command("refill")
  .description("resume session")
  .action(async () => {
    let session = await getSessionForDirectory(process.cwd());
    if (!session) session = await getLatestSession();
    await runSession(session || undefined);
  });

program
  .command("doctor")
  .description("check setup")
  .action(async () => {
    console.log();
    const cfg = getConfig();
    console.log(cfg.apiKey ? `  ${sym.check} api key` : `  ${sym.cross} no api key`);
    console.log(c.dim(`    ${cfg.provider} ${sym.dot} ${cfg.model || "default"}`));

    const v = parseInt(process.version.slice(1).split(".")[0]);
    console.log(v >= 20 ? `  ${sym.check} node ${process.version}` : `  ${sym.cross} node ${process.version}`);

    try {
      (await import("child_process")).execSync("git --version", { stdio: "pipe" });
      console.log(`  ${sym.check} git`);
    } catch {
      console.log(`  ${sym.cross} git`);
    }

    console.log(c.dim(`\n  config   ${getConfigPath()}`));
    console.log(c.dim(`  sessions ${getSessionsDir()}\n`));
  });

program.action(() => runSession());
program.parse();
