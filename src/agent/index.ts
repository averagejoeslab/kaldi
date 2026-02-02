/**
 * Agent - API calls and agentic loop
 */

import { API_URL, MODEL, ANTHROPIC_KEY, OPENROUTER_KEY, SYSTEM_PROMPT } from "../config.js";
import { buildToolSchema, runTool } from "../tools/index.js";
import { printText, printToolStart, printToolResult, printError } from "../ui/index.js";

export interface Message {
  role: "user" | "assistant";
  content: any;
}

/**
 * Call the Claude API
 */
async function callAPI(messages: Message[]): Promise<any> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(OPENROUTER_KEY
        ? { Authorization: `Bearer ${OPENROUTER_KEY}` }
        : { "x-api-key": ANTHROPIC_KEY ?? "" }),
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
      tools: buildToolSchema(),
    }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Run the agentic loop for a single user message
 * Keeps calling API until no more tool calls
 */
export async function runAgentLoop(messages: Message[]): Promise<void> {
  while (true) {
    try {
      const { content } = await callAPI(messages);
      const toolResults: any[] = [];

      for (const block of content) {
        if (block.type === "text") {
          printText(block.text);
        } else if (block.type === "tool_use") {
          const preview = String(Object.values(block.input)[0] ?? "").slice(0, 40);
          printToolStart(block.name, preview);

          const result = await runTool(block.name, block.input);
          printToolResult(result);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "assistant", content });

      // If no tool calls, we're done
      if (toolResults.length === 0) break;

      // Otherwise, add tool results and continue
      messages.push({ role: "user", content: toolResults });
    } catch (e: any) {
      printError(e.message);
      break;
    }
  }
}
