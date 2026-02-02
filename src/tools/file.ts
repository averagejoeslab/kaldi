/**
 * File Tools
 *
 * Read, write, and edit files.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";
import type { ToolDefinition } from "./types.js";

export const readFileTool: ToolDefinition = {
  name: "read_file",
  description:
    "Read the contents of a file. Returns the file content with line numbers.",
  parameters: {
    path: {
      type: "string",
      description: "The absolute path to the file to read",
      required: true,
    },
    offset: {
      type: "number",
      description: "Line number to start reading from (1-indexed)",
      required: false,
    },
    limit: {
      type: "number",
      description: "Maximum number of lines to read (default: 2000)",
      required: false,
    },
  },
  async execute(args) {
    const path = args.path as string;
    const offset = (args.offset as number) || 1;
    const limit = (args.limit as number) || 2000;

    try {
      const content = await readFile(path, "utf-8");
      const lines = content.split("\n");

      const startLine = Math.max(1, offset);
      const endLine = Math.min(lines.length, startLine + limit - 1);

      const numberedLines = lines
        .slice(startLine - 1, endLine)
        .map((line, i) => {
          const lineNum = String(startLine + i).padStart(6);
          // Truncate long lines
          const truncatedLine =
            line.length > 2000 ? line.slice(0, 2000) + "..." : line;
          return `${lineNum}\t${truncatedLine}`;
        })
        .join("\n");

      return {
        success: true,
        output: numberedLines,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to read file: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};

export const writeFileTool: ToolDefinition = {
  name: "write_file",
  description:
    "Write content to a file. Creates the file and directories if needed.",
  requiresPermission: true,
  parameters: {
    path: {
      type: "string",
      description: "The absolute path to the file to write",
      required: true,
    },
    content: {
      type: "string",
      description: "The content to write to the file",
      required: true,
    },
  },
  async execute(args) {
    const path = args.path as string;
    const content = args.content as string;

    try {
      const dir = dirname(path);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(path, content, "utf-8");

      return {
        success: true,
        output: `Successfully wrote ${content.length} characters to ${path}`,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to write file: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};

export const editFileTool: ToolDefinition = {
  name: "edit_file",
  description:
    "Edit a file by replacing a specific string with a new string. The old_string must be unique in the file.",
  requiresPermission: true,
  parameters: {
    path: {
      type: "string",
      description: "The absolute path to the file to edit",
      required: true,
    },
    old_string: {
      type: "string",
      description: "The exact string to find and replace",
      required: true,
    },
    new_string: {
      type: "string",
      description: "The string to replace it with",
      required: true,
    },
    replace_all: {
      type: "boolean",
      description: "Replace all occurrences (default: false)",
      required: false,
    },
  },
  async execute(args) {
    const path = args.path as string;
    const oldString = args.old_string as string;
    const newString = args.new_string as string;
    const replaceAll = args.replace_all as boolean;

    try {
      const content = await readFile(path, "utf-8");

      if (!content.includes(oldString)) {
        return {
          success: false,
          output: "",
          error: `String not found in file: "${oldString.slice(0, 50)}${oldString.length > 50 ? "..." : ""}"`,
        };
      }

      const occurrences = content.split(oldString).length - 1;
      if (occurrences > 1 && !replaceAll) {
        return {
          success: false,
          output: "",
          error: `String found ${occurrences} times. Use replace_all=true or provide a more specific string.`,
        };
      }

      const newContent = replaceAll
        ? content.replaceAll(oldString, newString)
        : content.replace(oldString, newString);

      await writeFile(path, newContent, "utf-8");

      return {
        success: true,
        output: replaceAll
          ? `Replaced ${occurrences} occurrences in ${path}`
          : `Successfully edited ${path}`,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to edit file: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};
