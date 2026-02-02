/**
 * Help Commands
 */

import type { Command } from "./types.js";
import { getAllCommands } from "./registry.js";
import { c } from "../ui/theme/colors.js";

export const helpCommand: Command = {
  name: "help",
  aliases: ["h", "?"],
  description: "Show available commands",
  usage: "/help [command]",
  handler: (args) => {
    if (args.length > 0) {
      // Show help for specific command
      const commands = getAllCommands();
      const cmd = commands.find(
        (c) => c.name === args[0] || c.aliases?.includes(args[0])
      );

      if (!cmd) {
        return { error: `Unknown command: ${args[0]}` };
      }

      const lines = [
        "",
        c.accent(`  /${cmd.name}`),
        `  ${cmd.description}`,
      ];

      if (cmd.usage) {
        lines.push("", c.dim(`  Usage: ${cmd.usage}`));
      }

      if (cmd.aliases?.length) {
        lines.push("", c.dim(`  Aliases: ${cmd.aliases.map((a) => "/" + a).join(", ")}`));
      }

      lines.push("");
      return { output: lines.join("\n") };
    }

    // Show all commands
    const commands = getAllCommands();
    const lines = ["", c.accent("  Available Commands"), ""];

    // Group by category
    const categories: Record<string, Command[]> = {
      Session: [],
      Config: [],
      Memory: [],
      Tools: [],
      Other: [],
    };

    for (const cmd of commands) {
      if (["clear", "history", "resume", "export"].includes(cmd.name)) {
        categories.Session.push(cmd);
      } else if (["config", "providers", "model"].includes(cmd.name)) {
        categories.Config.push(cmd);
      } else if (["init", "memory"].includes(cmd.name)) {
        categories.Memory.push(cmd);
      } else if (["tools", "permissions", "mcp"].includes(cmd.name)) {
        categories.Tools.push(cmd);
      } else {
        categories.Other.push(cmd);
      }
    }

    for (const [category, cmds] of Object.entries(categories)) {
      if (cmds.length === 0) continue;

      lines.push(c.dim(`  ${category}`));
      for (const cmd of cmds) {
        const aliasStr = cmd.aliases?.length
          ? c.dim(` (${cmd.aliases.map((a) => "/" + a).join(", ")})`)
          : "";
        lines.push(`    /${cmd.name}${aliasStr}`);
        lines.push(c.dim(`      ${cmd.description}`));
      }
      lines.push("");
    }

    return { output: lines.join("\n") };
  },
};

export const statusCommand: Command = {
  name: "status",
  description: "Show current session status",
  handler: (_, context) => {
    const lines = [
      "",
      c.accent("  Session Status"),
      "",
      `  ${c.dim("Provider:")} ${context.provider}`,
      `  ${c.dim("Model:")} ${context.model}`,
      `  ${c.dim("Directory:")} ${context.cwd}`,
    ];

    if (context.sessionId) {
      lines.push(`  ${c.dim("Session:")} ${context.sessionId}`);
    }

    lines.push("");
    return { output: lines.join("\n") };
  },
};
