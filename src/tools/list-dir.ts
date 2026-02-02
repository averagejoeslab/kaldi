/**
 * List Directory Tool
 *
 * List contents of a directory.
 */

import { readdir, stat } from "fs/promises";
import { join } from "path";
import type { ToolDefinition } from "./types.js";

export const listDirTool: ToolDefinition = {
  name: "list_dir",
  description:
    "List the contents of a directory. Returns file names, types, and sizes.",
  parameters: {
    path: {
      type: "string",
      description: "The absolute path to the directory to list",
      required: true,
    },
  },
  async execute(args) {
    const dirPath = args.path as string;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const results: string[] = [];

      // Sort: directories first, then files
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of sorted.slice(0, 200)) {
        const fullPath = join(dirPath, entry.name);
        let info = "";

        try {
          const stats = await stat(fullPath);
          if (entry.isDirectory()) {
            info = `[DIR]  ${entry.name}/`;
          } else if (entry.isSymbolicLink()) {
            info = `[LINK] ${entry.name}`;
          } else {
            const size = formatSize(stats.size);
            info = `[FILE] ${entry.name} (${size})`;
          }
        } catch {
          info = `[????] ${entry.name}`;
        }

        results.push(info);
      }

      if (entries.length > 200) {
        results.push(`\n... and ${entries.length - 200} more entries`);
      }

      return {
        success: true,
        output: results.join("\n"),
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to list directory: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
