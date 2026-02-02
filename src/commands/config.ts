/**
 * Config Commands
 */

import type { Command } from "./types.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";
import {
  getConfig,
  setProvider,
  setApiKey,
  setModel,
  getAllProviderConfigs,
  getConfigPath,
} from "../config/store.js";
import { validateApiKey, formatValidationResult } from "../providers/validation.js";
import { PROVIDER_MODELS, type ProviderType } from "../providers/types.js";

export const configCommand: Command = {
  name: "config",
  description: "Show or modify configuration",
  usage: "/config [key] [value]",
  handler: (args) => {
    if (args.length === 0) {
      // Show all config
      const cfg = getConfig();
      const allConfigs = getAllProviderConfigs();

      const lines = [
        "",
        c.accent("  Configuration"),
        "",
        `  ${c.dim("Config file:")} ${getConfigPath()}`,
        "",
        `  ${c.dim("Current provider:")} ${cfg.provider}`,
        `  ${c.dim("Current model:")} ${cfg.model}`,
        "",
        c.dim("  Providers:"),
      ];

      for (const [provider, config] of Object.entries(allConfigs)) {
        const isCurrent = provider === cfg.provider;
        const marker = isCurrent ? c.success("●") : c.dim("○");
        lines.push(`    ${marker} ${provider}`);
        lines.push(c.dim(`        Key: ${config.apiKey}`));
        lines.push(c.dim(`        Model: ${config.model}`));
      }

      lines.push("");
      return { output: lines.join("\n") };
    }

    return {
      output: c.dim("\n  Use /providers to manage providers\n  Use /model to change model\n"),
    };
  },
};

export const providersCommand: Command = {
  name: "providers",
  aliases: ["provider"],
  description: "Manage LLM providers",
  usage: "/providers [set <name>] [key <provider> <key>]",
  handler: async (args) => {
    const subcommand = args[0];

    if (subcommand === "set") {
      const provider = args[1] as ProviderType;

      if (!["anthropic", "openai", "openrouter", "ollama"].includes(provider)) {
        return {
          error: "Valid providers: anthropic, openai, openrouter, ollama",
        };
      }

      setProvider(provider);
      return {
        output: c.success(`\n  ${sym.success} Provider set to ${provider}\n`),
      };
    }

    if (subcommand === "key") {
      const provider = args[1] as ProviderType;
      const key = args[2];

      if (!provider || !key) {
        return { error: "Usage: /providers key <provider> <api-key>" };
      }

      // Validate the key first
      const result = await validateApiKey(provider, key);
      console.log(formatValidationResult(result));

      if (result.valid) {
        setApiKey(provider, key);
        return {
          output: c.success(`\n  ${sym.success} API key saved for ${provider}\n`),
        };
      } else {
        return { error: "API key validation failed. Key not saved." };
      }
    }

    // Show providers
    const allConfigs = getAllProviderConfigs();
    const current = getConfig().provider;

    const lines = ["", c.accent("  Providers"), ""];

    for (const [provider, config] of Object.entries(allConfigs)) {
      const isCurrent = provider === current;
      const marker = isCurrent ? c.success("● ") : "  ";
      const status =
        config.apiKey === "(not set)"
          ? c.error("not configured")
          : c.success("configured");

      lines.push(`${marker}${provider}`);
      lines.push(c.dim(`    Status: ${status}`));
      lines.push(c.dim(`    Model: ${config.model}`));
      lines.push("");
    }

    lines.push(c.dim("  /providers set <name>        Switch provider"));
    lines.push(c.dim("  /providers key <name> <key>  Set API key"));
    lines.push("");

    return { output: lines.join("\n") };
  },
};

export const modelCommand: Command = {
  name: "model",
  description: "Change the current model",
  usage: "/model [name]",
  handler: (args) => {
    const cfg = getConfig();

    if (args.length === 0) {
      // List available models
      const models = PROVIDER_MODELS[cfg.provider] || [];

      const lines = [
        "",
        c.accent(`  Models for ${cfg.provider}`),
        "",
        `  ${c.dim("Current:")} ${cfg.model}`,
        "",
        c.dim("  Available:"),
      ];

      for (const model of models) {
        const isCurrent = model === cfg.model;
        const marker = isCurrent ? c.success("●") : c.dim("○");
        lines.push(`    ${marker} ${model}`);
      }

      lines.push("");
      return { output: lines.join("\n") };
    }

    const model = args[0];
    setModel(cfg.provider, model);

    return {
      output: c.success(`\n  ${sym.success} Model set to ${model}\n`),
    };
  },
};
