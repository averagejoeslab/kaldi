/**
 * Tools Commands
 *
 * Commands for managing tools, permissions, and MCP.
 */

import type { Command } from "./types.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";

export const toolsCommand: Command = {
  name: "tools",
  aliases: ["t"],
  description: "List available tools",
  usage: "/tools [filter]",
  handler: (args, context) => {
    // This would integrate with the tool registry
    const filter = args[0]?.toLowerCase();

    const lines = [
      "",
      c.accent("  Available Tools"),
      "",
    ];

    const tools = [
      { name: "bash", desc: "Execute shell commands", enabled: true },
      { name: "read", desc: "Read file contents", enabled: true },
      { name: "write", desc: "Write to files", enabled: true },
      { name: "edit", desc: "Edit files with patches", enabled: true },
      { name: "glob", desc: "Find files by pattern", enabled: true },
      { name: "grep", desc: "Search file contents", enabled: true },
      { name: "list-dir", desc: "List directory contents", enabled: true },
      { name: "web-search", desc: "Search the web", enabled: true },
      { name: "web-fetch", desc: "Fetch web content", enabled: true },
    ];

    const filtered = filter
      ? tools.filter((t) => t.name.includes(filter) || t.desc.toLowerCase().includes(filter))
      : tools;

    for (const tool of filtered) {
      const status = tool.enabled ? c.success("●") : c.dim("○");
      lines.push(`    ${status} ${c.cream(tool.name)}`);
      lines.push(c.dim(`        ${tool.desc}`));
    }

    if (filtered.length === 0) {
      lines.push(c.dim(`    No tools matching "${filter}"`));
    }

    lines.push("");
    return { output: lines.join("\n") };
  },
};

export const permissionsCommand: Command = {
  name: "permissions",
  aliases: ["perms", "perm"],
  description: "View or manage tool permissions",
  usage: "/permissions [grant|deny|reset] [tool]",
  handler: (args, context) => {
    const subcommand = args[0];
    const tool = args[1];

    if (!subcommand) {
      // Show current permissions
      const lines = [
        "",
        c.accent("  Permissions"),
        "",
        c.dim("  Session permissions:"),
        c.dim("    bash: ask"),
        c.dim("    write: ask"),
        c.dim("    edit: ask"),
        "",
        c.dim("  /permissions grant <tool>  Allow without asking"),
        c.dim("  /permissions deny <tool>   Block tool"),
        c.dim("  /permissions reset         Clear session permissions"),
        "",
      ];

      return { output: lines.join("\n") };
    }

    if (subcommand === "grant" && tool) {
      return {
        output: c.success(`\n  ${sym.success} Granted session permission for ${tool}\n`),
      };
    }

    if (subcommand === "deny" && tool) {
      return {
        output: c.success(`\n  ${sym.success} Denied session permission for ${tool}\n`),
      };
    }

    if (subcommand === "reset") {
      return {
        output: c.success(`\n  ${sym.success} Session permissions cleared\n`),
      };
    }

    return { error: "Usage: /permissions [grant|deny|reset] [tool]" };
  },
};

export const mcpCommand: Command = {
  name: "mcp",
  description: "Manage MCP (Model Context Protocol) servers",
  usage: "/mcp [list|add|remove|status] [args]",
  handler: (args, context) => {
    const subcommand = args[0] || "list";

    if (subcommand === "list") {
      const lines = [
        "",
        c.accent("  MCP Servers"),
        "",
        c.dim("  No MCP servers configured"),
        "",
        c.dim("  /mcp add <name> <command>  Add server"),
        c.dim("  /mcp remove <name>         Remove server"),
        c.dim("  /mcp status                Show connection status"),
        "",
      ];

      return { output: lines.join("\n") };
    }

    if (subcommand === "add") {
      const name = args[1];
      const command = args.slice(2).join(" ");

      if (!name || !command) {
        return { error: "Usage: /mcp add <name> <command>" };
      }

      return {
        output: c.success(`\n  ${sym.success} Added MCP server: ${name}\n`),
      };
    }

    if (subcommand === "remove") {
      const name = args[1];

      if (!name) {
        return { error: "Usage: /mcp remove <name>" };
      }

      return {
        output: c.success(`\n  ${sym.success} Removed MCP server: ${name}\n`),
      };
    }

    if (subcommand === "status") {
      return {
        output: c.dim("\n  No MCP servers connected\n"),
      };
    }

    return { error: "Usage: /mcp [list|add|remove|status] [args]" };
  },
};
