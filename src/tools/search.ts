import { glob } from "glob";
import { readFile } from "fs/promises";
import type { ToolDefinition } from "./types.js";

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
  async execute(args) {
    const pattern = args.pattern as string;
    const cwd = (args.path as string) || process.cwd();

    try {
      const files = await glob(pattern, {
        cwd,
        nodir: true,
        ignore: ["**/node_modules/**", "**/.git/**"],
      });

      if (files.length === 0) {
        return {
          success: true,
          output: "No files found matching pattern",
        };
      }

      return {
        success: true,
        output: files.slice(0, 100).join("\n"),
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
    glob_pattern: {
      type: "string",
      description: 'Glob pattern to filter files (e.g., "*.ts")',
      required: false,
    },
  },
  async execute(args) {
    const pattern = args.pattern as string;
    const searchPath = (args.path as string) || process.cwd();
    const globPattern = (args.glob_pattern as string) || "**/*";

    try {
      const regex = new RegExp(pattern, "gi");

      const files = await glob(globPattern, {
        cwd: searchPath,
        nodir: true,
        ignore: ["**/node_modules/**", "**/.git/**"],
        absolute: true,
      });

      const results: string[] = [];

      for (const file of files.slice(0, 50)) {
        try {
          const content = await readFile(file, "utf-8");
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
              regex.lastIndex = 0; // Reset regex state
            }
          }
        } catch {
          // Skip files that can't be read
        }

        if (results.length >= 100) break;
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
