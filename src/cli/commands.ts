/**
 * CLI Subcommands
 *
 * Handlers for CLI subcommands like beans, doctor, etc.
 */

import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";
import {
  getConfig,
  setProvider,
  setApiKey,
  setModel,
  getAllProviderConfigs,
  getConfigPath,
  isConfigured,
} from "../config/store.js";
import type { ProviderType } from "../providers/types.js";
import type { CLIOptions } from "./types.js";

/**
 * Handle the 'beans' command - configure provider
 */
export async function handleBeans(options: CLIOptions): Promise<void> {
  // List configurations
  if (options.list) {
    const configs = getAllProviderConfigs();
    const current = getConfig();

    console.log("");
    console.log(c.honey("  Provider Configuration"));
    console.log("");
    console.log(`  ${c.dim("Config file:")} ${getConfigPath()}`);
    console.log(`  ${c.dim("Current provider:")} ${current.provider}`);
    console.log(`  ${c.dim("Current model:")} ${current.model}`);
    console.log("");

    for (const [provider, config] of Object.entries(configs)) {
      const isCurrent = provider === current.provider;
      const marker = isCurrent ? c.success("● ") : c.dim("○ ");
      const status = config.apiKey === "(not set)" ? c.error("not configured") : c.success("configured");

      console.log(`  ${marker}${provider}`);
      console.log(`    ${c.dim("Status:")} ${status}`);
      console.log(`    ${c.dim("Model:")} ${config.model}`);
    }
    console.log("");
    return;
  }

  // Set provider
  if (options.provider) {
    const validProviders = ["anthropic", "openai", "openrouter", "ollama"];
    if (!validProviders.includes(options.provider)) {
      console.error(c.error(`Invalid provider: ${options.provider}`));
      console.error(c.dim(`Valid providers: ${validProviders.join(", ")}`));
      process.exit(1);
    }

    setProvider(options.provider as ProviderType);
    console.log(c.success(`${sym.success} Provider set to ${options.provider}`));
  }

  // Set API key
  if (options.apiKey) {
    const provider = (options.provider || getConfig().provider) as ProviderType;
    setApiKey(provider, options.apiKey);
    console.log(c.success(`${sym.success} API key saved for ${provider}`));
  }

  // Set model
  if (options.model) {
    const provider = (options.provider || getConfig().provider) as ProviderType;
    setModel(provider, options.model);
    console.log(c.success(`${sym.success} Model set to ${options.model}`));
  }

  // Show help if no options provided
  if (!options.provider && !options.apiKey && !options.model && !options.list) {
    console.log("");
    console.log(c.honey("  kaldi beans - Configure your LLM provider"));
    console.log("");
    console.log(c.dim("  Usage:"));
    console.log(`    kaldi beans -p <provider> -k <api-key>  ${c.dim("Set provider and key")}`);
    console.log(`    kaldi beans -m <model>                  ${c.dim("Set model")}`);
    console.log(`    kaldi beans -l                          ${c.dim("List configurations")}`);
    console.log("");
    console.log(c.dim("  Providers: anthropic, openai, openrouter, ollama"));
    console.log("");
    console.log(c.dim("  Examples:"));
    console.log(`    kaldi beans -p anthropic -k sk-ant-xxx`);
    console.log(`    kaldi beans -p openai -k sk-xxx -m gpt-4o`);
    console.log(`    kaldi beans -l`);
    console.log("");
  }
}

/**
 * Handle the 'doctor' command - check health
 */
export async function handleDoctor(options: CLIOptions): Promise<void> {
  const checks: { name: string; status: "ok" | "warn" | "error"; message: string }[] = [];

  // Check config
  const config = getConfig();
  if (config.apiKey && config.apiKey !== "(not set)") {
    checks.push({
      name: "API Key",
      status: "ok",
      message: `${config.provider} configured`,
    });
  } else {
    checks.push({
      name: "API Key",
      status: "error",
      message: "Run: kaldi beans -p anthropic -k YOUR_KEY",
    });
  }

  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);
  if (majorVersion >= 20) {
    checks.push({ name: "Node.js", status: "ok", message: nodeVersion });
  } else {
    checks.push({ name: "Node.js", status: "warn", message: `${nodeVersion} (20+ recommended)` });
  }

  // Check model
  if (config.model) {
    checks.push({ name: "Model", status: "ok", message: config.model });
  } else {
    checks.push({ name: "Model", status: "warn", message: "Using default" });
  }

  console.log("");
  console.log(c.honey("  Kaldi Health Check"));
  console.log("");

  for (const check of checks) {
    const icon =
      check.status === "ok"
        ? c.success(`${sym.success}`)
        : check.status === "warn"
          ? c.warning(`${sym.warning}`)
          : c.error(`${sym.error}`);
    console.log(`  ${icon} ${check.name.padEnd(12)} ${c.dim(check.message)}`);
  }

  const hasErrors = checks.some((c) => c.status === "error");
  const hasWarns = checks.some((c) => c.status === "warn");

  console.log("");
  if (hasErrors) {
    console.log(c.error("  Some issues need attention."));
  } else if (hasWarns) {
    console.log(c.warning("  Mostly healthy with some warnings."));
  } else {
    console.log(c.success("  Kaldi is ready to brew!"));
  }
  console.log("");
}

/**
 * Handle the 'refill' command - resume session
 */
export async function handleRefill(options: CLIOptions): Promise<void> {
  console.log(c.dim("\n  Session resume not yet implemented.\n"));
  console.log(c.dim("  For now, start kaldi and use /history to see past sessions.\n"));
}

/**
 * Handle the 'roast' command - code review
 */
export async function handleRoast(options: CLIOptions): Promise<void> {
  console.log(c.dim("\n  Code review not yet implemented.\n"));
  console.log(c.dim("  For now, start kaldi and ask it to review your code.\n"));
}
