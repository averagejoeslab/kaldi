#!/usr/bin/env npx tsx
/**
 * Kaldi - Mr. Boy's minimal coding assistant
 * A Great Pyrenees who loves coffee and coding.
 */

import { createInterface } from "node:readline";
import { ANTHROPIC_KEY, OPENROUTER_KEY, MODEL } from "./src/config.js";
import { runAgentLoop, type Message } from "./src/agent/index.js";
import {
  RED, RESET, YELLOW,
  separator, printWelcome, printGoodbye, printCleared,
} from "./src/ui/index.js";

async function main() {
  // Check for API key
  if (!ANTHROPIC_KEY && !OPENROUTER_KEY) {
    console.log(`${RED}Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY${RESET}`);
    process.exit(1);
  }

  printWelcome(MODEL);

  const messages: Message[] = [];
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => new Promise<string>((r) => rl.question(`${YELLOW}🐕❯${RESET} `, (a) => r(a.trim())));

  while (true) {
    separator();
    const input = await prompt();

    if (!input) continue;
    if (input === "/q" || input === "exit") break;
    if (input === "/c") {
      messages.length = 0;
      printCleared();
      continue;
    }

    messages.push({ role: "user", content: input });
    await runAgentLoop(messages);
    console.log();
  }

  printGoodbye();
  rl.close();
}

main();
