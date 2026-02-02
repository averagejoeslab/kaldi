/**
 * Search Tools
 *
 * Glob and grep for finding files and content.
 */

import { glob } from "glob";
import { readFile } from "fs/promises";
import type { ToolDefinition } from "./types.js";

const DEFAULT_IGNORE = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"];

export const globTool: ToolDefinition = {
  name: "glob",
  description:
    "Find files matching a glob pattern. Returns a list of matching file paths.",
  parameters: {
    pattern: {
      type: "string",
      description: 'The glob pattern to match (e.g., "**/*.ts", "src/**/*.js")',
      required: true,
    },
    path: {
      type: "string",
      description: "The directory to search in (default: current directory)",
      required: false,
    },
  },
  async execute(args, context) {
    const pattern = args.pattern as string;
    const cwd = (args.path as string) || context?.cwd || process.cwd();

    try {
      const files = await glob(pattern, {
        cwd,
        nodir: true,
        ignore: DEFAULT_IGNORE,
      });

      if (files.length === 0) {
        return {
          success: true,
          output: "No files found matching pattern",
        };
      }

      // Sort by modification time would require stat calls, just return sorted by name
      const sorted = files.sort();

      return {
        success: true,
        output: sorted.slice(0, 200).join("\n") +
          (sorted.length > 200 ? `\n\n... and ${sorted.length - 200} more files` : ""),
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Glob failed: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};

export const grepTool: ToolDefinition = {
  name: "grep",
  description:
    "Search for a pattern in files. Returns matching lines with file paths and line numbers.",
  parameters: {
    pattern: {
      type: "string",
      description: "The regex pattern to search for",
      required: true,
    },
    path: {
      type: "string",
      description: "File or directory to search in (default: current directory)",
      required: false,
    },
    glob: {
      type: "string",
      description: 'Glob pattern to filter files (e.g., "*.ts", "**/*.tsx")',
      required: false,
    },
    case_insensitive: {
      type: "boolean",
      description: "Case insensitive search (default: false)",
      required: false,
    },
  },
  async execute(args, context) {
    const pattern = args.pattern as string;
    const searchPath = (args.path as string) || context?.cwd || process.cwd();
    const globPattern = (args.glob as string) || "**/*";
    const caseInsensitive = args.case_insensitive as boolean;

    try {
      const flags = caseInsensitive ? "gi" : "g";
      const regex = new RegExp(pattern, flags);

      const files = await glob(globPattern, {
        cwd: searchPath,
        nodir: true,
        ignore: DEFAULT_IGNORE,
        absolute: true,
      });

      const results: string[] = [];
      const maxResults = 100;
      const maxFiles = 100;

      for (const file of files.slice(0, maxFiles)) {
        try {
          const content = await readFile(file, "utf-8");
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              const line = lines[i].trim();
              const truncated = line.length > 200 ? line.slice(0, 200) + "..." : line;
              results.push(`${file}:${i + 1}: ${truncated}`);
              regex.lastIndex = 0; // Reset regex state
            }

            if (results.length >= maxResults) break;
          }
        } catch {
          // Skip files that can't be read (binary, permissions, etc.)
        }

        if (results.length >= maxResults) break;
      }

      if (results.length === 0) {
        return {
          success: true,
          output: "No matches found",
        };
      }

      return {
        success: true,
        output: results.join("\n"),
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Search failed: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};
