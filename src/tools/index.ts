/**
 * Tools - File operations, search, and shell
 */

import { readFile, writeFile, readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

export type ToolFn = (args: Record<string, any>) => Promise<string> | string;

export interface Tool {
  desc: string;
  params: string[];
  fn: ToolFn;
}

export const TOOLS: Record<string, Tool> = {
  read: {
    desc: "Read file with line numbers",
    params: ["path"],
    fn: async (a) => {
      const lines = (await readFileAsync(a.path, "utf-8")).split("\n");
      const start = a.offset ?? 0;
      const end = start + (a.limit ?? lines.length);
      return lines.slice(start, end).map((l, i) => `${String(start + i + 1).padStart(4)}| ${l}`).join("\n");
    },
  },

  write: {
    desc: "Write content to file",
    params: ["path", "content"],
    fn: async (a) => {
      await writeFileAsync(a.path, a.content, "utf-8");
      return "ok";
    },
  },

  edit: {
    desc: "Replace old with new in file (old must be unique unless all=true)",
    params: ["path", "old", "new"],
    fn: async (a) => {
      const txt = await readFileAsync(a.path, "utf-8");
      if (!txt.includes(a.old)) return "error: old_string not found";
      const count = txt.split(a.old).length - 1;
      if (!a.all && count > 1) return `error: old_string appears ${count} times, use all=true`;
      await writeFileAsync(a.path, a.all ? txt.split(a.old).join(a.new) : txt.replace(a.old, a.new), "utf-8");
      return "ok";
    },
  },

  glob: {
    desc: "Find files by pattern (recursive)",
    params: ["pattern"],
    fn: async (a) => {
      const results: string[] = [];
      const walk = (dir: string) => {
        try {
          for (const f of readdirSync(dir)) {
            if (f.startsWith(".") || f === "node_modules") continue;
            const p = join(dir, f);
            try {
              if (statSync(p).isDirectory()) walk(p);
              else if (new RegExp(a.pattern.replace(/\*/g, ".*")).test(f)) results.push(p);
            } catch {}
          }
        } catch {}
      };
      walk(a.path || ".");
      return results.slice(0, 100).join("\n") || "none";
    },
  },

  grep: {
    desc: "Search files for regex pattern",
    params: ["pattern"],
    fn: async (a) => {
      const regex = new RegExp(a.pattern);
      const hits: string[] = [];
      const walk = (dir: string) => {
        try {
          for (const f of readdirSync(dir)) {
            if (f.startsWith(".") || f === "node_modules") continue;
            const p = join(dir, f);
            try {
              if (statSync(p).isDirectory()) walk(p);
              else {
                const lines = readFileSync(p, "utf-8").split("\n");
                lines.forEach((l, i) => {
                  if (regex.test(l)) hits.push(`${p}:${i + 1}:${l.trim()}`);
                });
              }
            } catch {}
          }
        } catch {}
      };
      walk(a.path || ".");
      return hits.slice(0, 50).join("\n") || "none";
    },
  },

  bash: {
    desc: "Run shell command",
    params: ["command"],
    fn: (a) => {
      try {
        const out = execSync(a.command, {
          encoding: "utf-8",
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        });
        return out.trim() || "(empty)";
      } catch (e: any) {
        return (e.stdout || e.stderr || String(e)).trim();
      }
    },
  },
};

/**
 * Build tool schema for API
 */
export function buildToolSchema() {
  return Object.entries(TOOLS).map(([name, { desc, params }]) => ({
    name,
    description: desc,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(params.map((p) => [p, { type: "string" }])),
      required: params,
    },
  }));
}

/**
 * Run a tool by name
 */
export async function runTool(name: string, args: Record<string, any>): Promise<string> {
  const tool = TOOLS[name];
  if (!tool) return `error: unknown tool ${name}`;
  try {
    return await tool.fn(args);
  } catch (e: any) {
    return `error: ${e.message}`;
  }
}
