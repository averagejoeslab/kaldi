#!/usr/bin/env npx tsx
/**
 * kaldi - Mr. Boy's minimal coding assistant
 * A Great Pyrenees who loves coffee and coding.
 */

import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// --- Config ---
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const API_URL = OPENROUTER_KEY
  ? "https://openrouter.ai/api/v1/messages"
  : "https://api.anthropic.com/v1/messages";
const MODEL = process.env.MODEL || (OPENROUTER_KEY ? "anthropic/claude-sonnet-4" : "claude-sonnet-4-20250514");

// --- ANSI ---
const [RESET, BOLD, DIM] = ["\x1b[0m", "\x1b[1m", "\x1b[2m"];
const [BLUE, CYAN, GREEN, RED, YELLOW] = ["\x1b[34m", "\x1b[36m", "\x1b[32m", "\x1b[31m", "\x1b[33m"];

// --- Tools ---
const TOOLS: Record<string, { desc: string; params: string[]; fn: (a: any) => Promise<string> | string }> = {
  read: {
    desc: "Read file with line numbers",
    params: ["path"],
    fn: async (a) => {
      const lines = (await readFile(a.path, "utf-8")).split("\n");
      const start = a.offset ?? 0, end = start + (a.limit ?? lines.length);
      return lines.slice(start, end).map((l, i) => `${String(start + i + 1).padStart(4)}| ${l}`).join("\n");
    },
  },
  write: {
    desc: "Write content to file",
    params: ["path", "content"],
    fn: async (a) => { await writeFile(a.path, a.content, "utf-8"); return "ok"; },
  },
  edit: {
    desc: "Replace old with new in file (old must be unique unless all=true)",
    params: ["path", "old", "new"],
    fn: async (a) => {
      const txt = await readFile(a.path, "utf-8");
      if (!txt.includes(a.old)) return "error: old_string not found";
      const count = txt.split(a.old).length - 1;
      if (!a.all && count > 1) return `error: old_string appears ${count} times, use all=true`;
      await writeFile(a.path, a.all ? txt.split(a.old).join(a.new) : txt.replace(a.old, a.new), "utf-8");
      return "ok";
    },
  },
  glob: {
    desc: "Find files by pattern (recursive)",
    params: ["pattern"],
    fn: async (a) => {
      const results: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          if (f.startsWith(".") || f === "node_modules") continue;
          const p = join(dir, f);
          try {
            if (statSync(p).isDirectory()) walk(p);
            else if (new RegExp(a.pattern.replace(/\*/g, ".*")).test(f)) results.push(p);
          } catch {}
        }
      };
      walk(a.path || ".");
      return results.slice(0, 100).join("\n") || "none";
    },
  },
  grep: {
    desc: "Search files for regex pattern",
    params: ["pattern"],
    fn: async (a) => {
      const regex = new RegExp(a.pattern), hits: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          if (f.startsWith(".") || f === "node_modules") continue;
          const p = join(dir, f);
          try {
            if (statSync(p).isDirectory()) walk(p);
            else {
              const lines = readFileSync(p, "utf-8").split("\n");
              lines.forEach((l, i) => { if (regex.test(l)) hits.push(`${p}:${i + 1}:${l.trim()}`); });
            }
          } catch {}
        }
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
        const out = execSync(a.command, { encoding: "utf-8", timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
        return out.trim() || "(empty)";
      } catch (e: any) { return (e.stdout || e.stderr || String(e)).trim(); }
    },
  },
};

// Need sync version for grep
import { readFileSync } from "node:fs";

// --- API ---
function buildSchema() {
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

async function callAPI(messages: any[], system: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(OPENROUTER_KEY
        ? { Authorization: `Bearer ${OPENROUTER_KEY}` }
        : { "x-api-key": ANTHROPIC_KEY ?? "" }),
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 8192, system, messages, tools: buildSchema() }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- Main ---
async function main() {
  if (!ANTHROPIC_KEY && !OPENROUTER_KEY) {
    console.log(`${RED}Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY${RESET}`);
    process.exit(1);
  }

  console.log(`
${YELLOW}     ╱╲___╱╲${RESET}
${YELLOW}    ( ◠   ◠ )  ${BOLD}Kaldi Dovington${RESET}
${YELLOW}     ╲  ▼  ╱   ${DIM}The Mysterious Boy${RESET}
${YELLOW}      ╲──╱${RESET}
${DIM}─────────────────────────────────────${RESET}
${DIM}${MODEL} | ${process.cwd()}${RESET}
`);

  const messages: any[] = [];
  const system = `You are Kaldi Dovington, a Great Pyrenees dog who is an expert coding assistant.
You go by "Mr. Boy", "Mister", or "The Mysterious Boy". You're goofy but brilliant.
Be concise. Use tools proactively. Current directory: ${process.cwd()}`;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => new Promise<string>((r) => rl.question(`${YELLOW}🐕❯${RESET} `, (a) => r(a.trim())));
  const sep = () => console.log(`${DIM}${"─".repeat(50)}${RESET}`);

  while (true) {
    sep();
    const input = await prompt();
    if (!input) continue;
    if (input === "/q" || input === "exit") break;
    if (input === "/c") { messages.length = 0; console.log(`${GREEN}🐕 Cleared!${RESET}`); continue; }

    messages.push({ role: "user", content: input });

    // Agentic loop
    while (true) {
      try {
        const { content } = await callAPI(messages, system);
        const toolResults: any[] = [];

        for (const block of content) {
          if (block.type === "text") {
            console.log(`\n${CYAN}🐕${RESET} ${block.text}`);
          } else if (block.type === "tool_use") {
            const preview = String(Object.values(block.input)[0] ?? "").slice(0, 40);
            console.log(`\n${GREEN}● ${block.name}${RESET}(${DIM}${preview}${RESET})`);
            const tool = TOOLS[block.name];
            const result = tool ? await tool.fn(block.input) : `error: unknown tool`;
            const lines = result.split("\n");
            console.log(`  ${DIM}└─ ${lines[0].slice(0, 60)}${lines.length > 1 ? ` +${lines.length - 1}` : ""}${RESET}`);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }
        }

        messages.push({ role: "assistant", content });
        if (!toolResults.length) break;
        messages.push({ role: "user", content: toolResults });
      } catch (e: any) {
        console.log(`${RED}🐕 Error: ${e.message}${RESET}`);
        break;
      }
    }
    console.log();
  }

  console.log(`\n${YELLOW}🐕${RESET} ${DIM}Mr. Boy signing off!${RESET}\n`);
  rl.close();
}

main();
