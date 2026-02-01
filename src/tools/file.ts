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
      description: "Maximum number of lines to read",
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
        .map((line, i) => `${String(startLine + i).padStart(6)}  ${line}`)
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
    "Write content to a file. Creates the file if it doesn't exist, or overwrites if it does.",
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
    "Edit a file by replacing a specific string with a new string. The old_string must match exactly.",
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
  },
  async execute(args) {
    const path = args.path as string;
    const oldString = args.old_string as string;
    const newString = args.new_string as string;

    try {
      const content = await readFile(path, "utf-8");

      if (!content.includes(oldString)) {
        return {
          success: false,
          output: "",
          error: `String not found in file: "${oldString.slice(0, 50)}..."`,
        };
      }

      const occurrences = content.split(oldString).length - 1;
      if (occurrences > 1) {
        return {
          success: false,
          output: "",
          error: `String found ${occurrences} times. Please provide a more specific string to ensure only one match.`,
        };
      }

      const newContent = content.replace(oldString, newString);
      await writeFile(path, newContent, "utf-8");

      return {
        success: true,
        output: `Successfully edited ${path}`,
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
