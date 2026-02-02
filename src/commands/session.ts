/**
 * Session Commands
 */

import type { Command } from "./types.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";
import {
  listSessions,
  loadSession,
  deleteSession,
  exportToFile,
  type ExportFormat,
} from "../session/index.js";
import { formatRelativeTime } from "../ui/format/duration.js";

export const clearCommand: Command = {
  name: "clear",
  aliases: ["c"],
  description: "Clear conversation history",
  handler: () => {
    return { output: c.success(`\n  ${sym.success} Conversation cleared\n`) };
  },
};

export const historyCommand: Command = {
  name: "history",
  description: "List past sessions",
  usage: "/history [count]",
  handler: async (args) => {
    const count = parseInt(args[0]) || 10;
    const sessions = await listSessions();

    if (sessions.length === 0) {
      return { output: c.dim("\n  No sessions found\n") };
    }

    const lines = ["", c.accent("  Recent Sessions"), ""];

    for (const session of sessions.slice(0, count)) {
      const time = formatRelativeTime(session.updatedAt);
      const shortPath = session.workingDirectory.replace(
        process.env.HOME || "",
        "~"
      );

      lines.push(`  ${c.dim(session.id.slice(0, 12))}`);
      lines.push(`    ${shortPath}`);
      lines.push(`    ${c.dim(`${session.messageCount} messages • ${time}`)}`);
      lines.push("");
    }

    if (sessions.length > count) {
      lines.push(c.dim(`  ... and ${sessions.length - count} more`));
      lines.push("");
    }

    return { output: lines.join("\n") };
  },
};

export const resumeCommand: Command = {
  name: "resume",
  aliases: ["r"],
  description: "Resume a previous session",
  usage: "/resume [session-id]",
  handler: async (args) => {
    if (!args[0]) {
      return { error: "Please provide a session ID. Use /history to see available sessions." };
    }

    const sessions = await listSessions();
    const match = sessions.find((s) => s.id.startsWith(args[0]));

    if (!match) {
      return { error: `Session not found: ${args[0]}` };
    }

    const session = await loadSession(match.id);
    if (!session) {
      return { error: `Failed to load session: ${match.id}` };
    }

    return {
      output: c.success(
        `\n  ${sym.success} Resumed session ${match.id}\n  ${session.messages.length} messages loaded\n`
      ),
    };
  },
};

export const exportCommand: Command = {
  name: "export",
  description: "Export conversation",
  usage: "/export [format] - format: md, json, html",
  handler: async (args, context) => {
    const format = (args[0] || "md") as ExportFormat;
    const validFormats = ["md", "markdown", "json", "html"];

    if (!validFormats.includes(format)) {
      return { error: `Invalid format. Use: ${validFormats.join(", ")}` };
    }

    const exportFormat: ExportFormat =
      format === "md" ? "markdown" : (format as ExportFormat);

    if (!context.sessionId) {
      return { error: "No active session to export" };
    }

    const session = await loadSession(context.sessionId);
    if (!session) {
      return { error: "Failed to load session for export" };
    }

    const path = await exportToFile(session, exportFormat, context.cwd);

    return {
      output: c.success(`\n  ${sym.success} Exported to ${path}\n`),
    };
  },
};

export const deleteCommand: Command = {
  name: "delete",
  description: "Delete a session",
  usage: "/delete <session-id>",
  handler: async (args) => {
    if (!args[0]) {
      return { error: "Please provide a session ID" };
    }

    const sessions = await listSessions();
    const match = sessions.find((s) => s.id.startsWith(args[0]));

    if (!match) {
      return { error: `Session not found: ${args[0]}` };
    }

    const success = await deleteSession(match.id);

    if (success) {
      return {
        output: c.success(`\n  ${sym.success} Deleted session ${match.id}\n`),
      };
    } else {
      return { error: `Failed to delete session: ${match.id}` };
    }
  },
};
