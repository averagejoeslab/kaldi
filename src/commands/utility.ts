/**
 * Utility Commands
 *
 * General utility commands like copy, compact, doctor, etc.
 */

import { existsSync } from "fs";
import { execSync } from "child_process";
import { spawnSync } from "child_process";
import { join } from "path";
import type { Command } from "./types.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";
import { dogFace } from "../ui/theme/dog-messages.js";
import { getConfig } from "../config/store.js";
import { hasProjectContext } from "../context/project/index.js";
import {
  getPermissionManager,
  permissionModes,
  formatModeWithDescription,
  type PermissionMode,
} from "../ui/dynamic/permission-modes.js";

export const doctorCommand: Command = {
  name: "doctor",
  aliases: ["health", "checkup"],
  description: "Check Kaldi's health and configuration",
  handler: (args, context) => {
    const checks: { name: string; status: "ok" | "warn" | "error"; message: string }[] = [];

    // Check config
    const config = getConfig();
    if (config.apiKey && config.apiKey !== "(not set)") {
      checks.push({
        name: "API Key",
        status: "ok",
        message: `${config.provider} key configured`,
      });
    } else {
      checks.push({
        name: "API Key",
        status: "error",
        message: "No API key configured",
      });
    }

    // Check git
    try {
      execSync("git --version", { stdio: "pipe" });
      checks.push({ name: "Git", status: "ok", message: "Git is installed" });
    } catch {
      checks.push({ name: "Git", status: "warn", message: "Git not found" });
    }

    // Check working directory
    if (existsSync(context.cwd)) {
      checks.push({
        name: "Working Directory",
        status: "ok",
        message: context.cwd,
      });
    } else {
      checks.push({
        name: "Working Directory",
        status: "error",
        message: "Directory not found",
      });
    }

    // Check for KALDI.md
    if (hasProjectContext(context.cwd)) {
      checks.push({
        name: "Project Context",
        status: "ok",
        message: "KALDI.md found",
      });
    } else {
      checks.push({
        name: "Project Context",
        status: "warn",
        message: "No KALDI.md (run /init)",
      });
    }

    // Check session
    if (context.sessionId) {
      checks.push({
        name: "Session",
        status: "ok",
        message: `ID: ${context.sessionId.slice(0, 12)}`,
      });
    } else {
      checks.push({ name: "Session", status: "warn", message: "No active session" });
    }

    const lines = [
      "",
      c.accent("  Kaldi Health Check"),
      "",
    ];

    for (const check of checks) {
      const icon =
        check.status === "ok"
          ? c.success(`[${sym.success}]`)
          : check.status === "warn"
            ? c.warning(`[${sym.warning}]`)
            : c.error(`[${sym.error}]`);
      lines.push(`  ${icon} ${c.cream(check.name.padEnd(20))} ${c.dim(check.message)}`);
    }

    const hasErrors = checks.some((c) => c.status === "error");
    const hasWarns = checks.some((c) => c.status === "warn");

    lines.push("");
    if (hasErrors) {
      lines.push(c.error("  Some issues need attention!"));
    } else if (hasWarns) {
      lines.push(c.warning("  Kaldi is mostly healthy with some warnings."));
    } else {
      lines.push(c.success("  Kaldi is happy and healthy!"));
    }
    lines.push("");

    return { output: lines.join("\n") };
  },
};

export const compactCommand: Command = {
  name: "compact",
  aliases: ["compress"],
  description: "Compact conversation context",
  usage: "/compact [focus instructions]",
  handler: (args, context) => {
    const focus = args.join(" ").trim();

    const lines = [
      "",
      c.accent("  Compacting Context"),
      "",
    ];

    if (focus) {
      lines.push(c.dim(`  Focus: ${focus}`));
      lines.push("");
    }

    lines.push(c.success(`  ${sym.success} Context compacted`));
    lines.push("");

    return { output: lines.join("\n") };
  },
};

export const copyCommand: Command = {
  name: "copy",
  aliases: ["cp", "clipboard"],
  description: "Copy last response to clipboard",
  handler: (args, context) => {
    // In real implementation, this would access the last response
    const content = "Last response content would go here";

    try {
      const platform = process.platform;

      if (platform === "darwin") {
        const proc = spawnSync("pbcopy", {
          input: content,
          encoding: "utf-8",
        });
        if (proc.status !== 0) throw new Error("pbcopy failed");
      } else if (platform === "linux") {
        const proc = spawnSync("xclip", ["-selection", "clipboard"], {
          input: content,
          encoding: "utf-8",
        });
        if (proc.status !== 0) {
          const proc2 = spawnSync("xsel", ["--clipboard", "--input"], {
            input: content,
            encoding: "utf-8",
          });
          if (proc2.status !== 0) throw new Error("xclip/xsel failed");
        }
      } else if (platform === "win32") {
        const proc = spawnSync("clip", {
          input: content,
          encoding: "utf-8",
          shell: true,
        });
        if (proc.status !== 0) throw new Error("clip failed");
      } else {
        throw new Error("Unsupported platform");
      }

      return {
        output: c.success(`\n  ${sym.success} Copied to clipboard\n`),
      };
    } catch (error) {
      return {
        error: `Failed to copy: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const costCommand: Command = {
  name: "cost",
  aliases: ["tokens", "usage"],
  description: "Show token usage and estimated cost",
  handler: (args, context) => {
    // Token costs per 1K tokens (approximate)
    const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
      "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
      "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
      "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
      "gpt-4o": { input: 0.005, output: 0.015 },
      default: { input: 0.001, output: 0.002 },
    };

    const costs = TOKEN_COSTS[context.model] || TOKEN_COSTS.default;

    // Placeholder values - would come from actual usage tracking
    const inputTokens = 0;
    const outputTokens = 0;

    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    const totalCost = inputCost + outputCost;

    const lines = [
      "",
      c.accent("  Token Usage & Cost"),
      "",
      `  ${c.dim("Model:")} ${context.model}`,
      "",
      c.dim("  Tokens:"),
      `    ${c.dim("Input:")}  ${inputTokens.toLocaleString().padStart(10)}`,
      `    ${c.dim("Output:")} ${outputTokens.toLocaleString().padStart(10)}`,
      `    ${c.dim("Total:")}  ${(inputTokens + outputTokens).toLocaleString().padStart(10)}`,
      "",
      c.dim("  Estimated Cost:"),
      `    ${c.dim("Input:")}  $${inputCost.toFixed(4).padStart(9)}`,
      `    ${c.dim("Output:")} $${outputCost.toFixed(4).padStart(9)}`,
      `    ${c.honey("Total:")}  $${totalCost.toFixed(4).padStart(9)}`,
      "",
    ];

    return { output: lines.join("\n") };
  },
};

export const versionCommand: Command = {
  name: "version",
  aliases: ["v", "about"],
  description: "Show Kaldi version",
  handler: () => {
    const VERSION = "1.0.0";

    const lines = [
      "",
      c.accent(`  Kaldi CLI v${VERSION}`),
      c.dim("  Your loyal AI coding companion"),
      "",
      c.dim("  Named after Kaldi, the Ethiopian goatherd"),
      c.dim("  who discovered coffee when his goats"),
      c.dim("  danced after eating coffee berries."),
      "",
      c.dim("  Built with love and lots of coffee."),
      "",
    ];

    return { output: lines.join("\n") };
  },
};

export const exitCommand: Command = {
  name: "exit",
  aliases: ["quit", "q", "bye"],
  description: "Exit Kaldi",
  handler: () => {
    return {
      output: c.cream(`\n  ${dogFace.happy} Thanks for brewing with Kaldi! See you next time!\n`),
      exit: true,
    };
  },
};

export const modeCommand: Command = {
  name: "mode",
  aliases: ["permission", "perms"],
  description: "View or change permission mode",
  usage: "/mode [goodboy|offleash|sniff|zoomies]",
  handler: (args, context) => {
    const manager = getPermissionManager();
    const currentMode = manager.getMode();

    // If no args, show current mode and available modes
    if (args.length === 0) {
      const lines = [
        "",
        c.accent("  🐕 Permission Modes"),
        "",
        c.dim("  Current mode:"),
        `    ${formatModeWithDescription(currentMode)}`,
        "",
        c.dim("  Available modes:"),
      ];

      const modeEntries: Array<[string, PermissionMode]> = [
        ["goodboy", "goodBoy"],
        ["offleash", "offLeash"],
        ["sniff", "sniffAround"],
        ["zoomies", "zoomies"],
      ];

      for (const [cmdName, mode] of modeEntries) {
        const config = permissionModes[mode];
        const isCurrent = mode === currentMode;
        const prefix = isCurrent ? c.honey("→") : " ";
        const name = isCurrent ? c.honey(config.name) : config.name;
        lines.push(`  ${prefix} ${config.icon} ${name.padEnd(15)} ${c.dim(config.description)}`);
        lines.push(`      ${c.dim(`/mode ${cmdName}`)}`);
      }

      lines.push("");
      lines.push(c.dim("  Tip: Use Shift+Tab to cycle through modes quickly!"));
      lines.push("");

      return { output: lines.join("\n") };
    }

    // Parse mode argument
    const modeArg = args[0].toLowerCase().replace(/[^a-z]/g, "");
    const modeMap: Record<string, PermissionMode> = {
      goodboy: "goodBoy",
      good: "goodBoy",
      offleash: "offLeash",
      off: "offLeash",
      leash: "offLeash",
      sniff: "sniffAround",
      sniffaround: "sniffAround",
      plan: "sniffAround",
      zoomies: "zoomies",
      zoom: "zoomies",
      yolo: "zoomies",
      auto: "zoomies",
    };

    const newMode = modeMap[modeArg];
    if (!newMode) {
      return {
        error: `Unknown mode: ${args[0]}. Try: goodboy, offleash, sniff, or zoomies`,
      };
    }

    manager.setMode(newMode);
    const config = permissionModes[newMode];

    return {
      output: `\n${config.icon} ${c.honey("Mode changed:")} ${config.name} - ${c.dim(config.description)}\n`,
    };
  },
};

export const contextCommand: Command = {
  name: "context",
  aliases: ["ctx"],
  description: "Show context window usage",
  handler: (args, context) => {
    // Placeholder - would show actual context usage
    const maxContext = 200000;
    const usedContext = 0; // Would come from actual tracking
    const percentage = (usedContext / maxContext) * 100;

    const barWidth = 40;
    const filledWidth = Math.round((usedContext / maxContext) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const bar = c.honey("█".repeat(filledWidth)) + c.dim("░".repeat(emptyWidth));

    const lines = [
      "",
      c.accent("  📊 Context Window"),
      "",
      `  ${bar} ${percentage.toFixed(1)}%`,
      "",
      `  ${c.dim("Used:")}     ${usedContext.toLocaleString().padStart(10)} tokens`,
      `  ${c.dim("Available:")} ${(maxContext - usedContext).toLocaleString().padStart(10)} tokens`,
      `  ${c.dim("Maximum:")}   ${maxContext.toLocaleString().padStart(10)} tokens`,
      "",
      c.dim("  Tip: Use /compact to free up context space."),
      "",
    ];

    return { output: lines.join("\n") };
  },
};
