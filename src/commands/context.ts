/**
 * Context Commands
 *
 * Commands for KALDI.md and memory/notes.
 */

import type { Command } from "./types.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";
import {
  hasProjectContext,
  loadProjectContext,
  createProjectContext,
  getProjectContextPath,
} from "../context/project/index.js";
import {
  loadNotes,
  addNote,
  removeNote,
  clearNotes,
  formatNotes,
  type NoteCategory,
} from "../context/memory/index.js";

export const initCommand: Command = {
  name: "init",
  description: "Create KALDI.md for this project",
  usage: "/init [--force]",
  handler: async (args, context) => {
    const force = args.includes("--force") || args.includes("-f");

    if (hasProjectContext(context.cwd) && !force) {
      const existing = loadProjectContext({ projectPath: context.cwd });
      return {
        output: [
          "",
          c.warning(`  ${sym.warning} KALDI.md already exists`),
          c.dim(`  ${existing?.path}`),
          "",
          c.dim("  Use /init --force to overwrite"),
          "",
        ].join("\n"),
      };
    }

    const path = await createProjectContext(context.cwd);

    return {
      output: [
        "",
        c.success(`  ${sym.success} Created KALDI.md`),
        c.dim(`  ${path}`),
        "",
        c.dim("  Edit this file to add project-specific context for the AI."),
        "",
      ].join("\n"),
    };
  },
};

export const memoryCommand: Command = {
  name: "memory",
  aliases: ["mem", "note"],
  description: "Manage notes and preferences",
  usage: "/memory [add|rm|clear|list] [args]",
  handler: (args, context) => {
    const subcommand = args[0] || "list";
    const rest = args.slice(1);

    switch (subcommand) {
      case "add": {
        if (rest.length === 0) {
          return { error: "Usage: /memory add <note> [--category <cat>] [--global]" };
        }

        // Parse flags
        const isGlobal = rest.includes("--global") || rest.includes("-g");
        const categoryIndex = rest.findIndex(
          (a) => a === "--category" || a === "-c"
        );

        let category: NoteCategory = "general";
        let content = rest
          .filter((_, i) => {
            if (rest[i] === "--global" || rest[i] === "-g") return false;
            if (i === categoryIndex || i === categoryIndex + 1) return false;
            return true;
          })
          .join(" ");

        if (categoryIndex >= 0 && rest[categoryIndex + 1]) {
          const cat = rest[categoryIndex + 1] as NoteCategory;
          if (
            ["fact", "preference", "learning", "todo", "general"].includes(cat)
          ) {
            category = cat;
          }
        }

        const note = addNote(content, category, isGlobal, context.cwd);
        const scope = isGlobal ? "global" : "project";

        return {
          output: [
            "",
            c.success(`  ${sym.success} Added ${scope} note (${note.id.slice(-6)})`),
            c.dim(`  [${category}] ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`),
            "",
          ].join("\n"),
        };
      }

      case "rm":
      case "remove":
      case "delete": {
        if (rest.length === 0) {
          return { error: "Usage: /memory rm <note-id>" };
        }

        const notes = loadNotes(context.cwd);
        const match = notes.find(
          (n) => n.id === rest[0] || n.id.endsWith(rest[0])
        );

        if (!match) {
          return { error: `Note not found: ${rest[0]}` };
        }

        const removed = removeNote(match.id, context.cwd);

        if (removed) {
          return {
            output: c.success(`\n  ${sym.success} Removed note ${match.id.slice(-6)}\n`),
          };
        } else {
          return { error: `Failed to remove note: ${rest[0]}` };
        }
      }

      case "clear": {
        const isGlobal = rest.includes("--global") || rest.includes("-g");
        const count = clearNotes(isGlobal, context.cwd);

        return {
          output: c.success(
            `\n  ${sym.success} Cleared ${count} ${isGlobal ? "global" : "project"} notes\n`
          ),
        };
      }

      case "list":
      default: {
        const notes = loadNotes(context.cwd);
        return { output: "\n" + formatNotes(notes) + "\n" };
      }
    }
  },
};
