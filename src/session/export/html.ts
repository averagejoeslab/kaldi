/**
 * HTML Export
 */

import type { Session } from "../store.js";
import type { Message, ContentBlock } from "../../providers/types.js";
import type { ExportOptions, ExportResult } from "./types.js";

export function exportToHtml(
  session: Session,
  options: ExportOptions = {}
): ExportResult {
  const { includeMetadata = true, includeToolCalls = true } = options;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaldi Conversation - ${session.metadata.id}</title>
  <style>
    :root {
      --cream: #F5F5DC;
      --coffee: #6F4E37;
      --honey: #DAA520;
      --sage: #7CB342;
      --coral: #E57373;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #1a1a1a;
      color: var(--cream);
    }
    h1 { color: var(--honey); }
    h2 { color: var(--cream); border-bottom: 1px solid var(--coffee); }
    .metadata { color: #888; font-size: 0.9rem; }
    .message { margin: 1rem 0; padding: 1rem; border-radius: 8px; }
    .user { background: #2a2a2a; border-left: 3px solid var(--honey); }
    .assistant { background: #252525; border-left: 3px solid var(--sage); }
    .role { font-weight: bold; color: var(--honey); margin-bottom: 0.5rem; }
    .assistant .role { color: var(--sage); }
    pre { background: #1a1a1a; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    code { font-family: 'Fira Code', monospace; }
    .tool-call { background: #2a2520; padding: 0.5rem; border-radius: 4px; margin: 0.5rem 0; }
    .tool-name { color: var(--coral); font-weight: bold; }
  </style>
</head>
<body>
  <h1>Kaldi Conversation</h1>

  ${includeMetadata ? formatMetadata(session) : ""}

  <h2>Conversation</h2>

  ${session.messages.map((msg) => formatMessage(msg, includeToolCalls)).join("\n")}

  <footer style="margin-top: 2rem; color: #666; font-size: 0.8rem;">
    Exported from Kaldi CLI
  </footer>
</body>
</html>`;

  return {
    content: html,
    format: "html",
    filename: `kaldi-${session.metadata.id}.html`,
  };
}

function formatMetadata(session: Session): string {
  return `
  <div class="metadata">
    <p><strong>Session ID:</strong> ${session.metadata.id}</p>
    <p><strong>Created:</strong> ${session.metadata.createdAt}</p>
    <p><strong>Directory:</strong> ${session.metadata.workingDirectory}</p>
    <p><strong>Model:</strong> ${session.metadata.model}</p>
    <p><strong>Messages:</strong> ${session.messages.length}</p>
  </div>`;
}

function formatMessage(message: Message, includeTools: boolean): string {
  const role = message.role;
  const roleClass = role === "user" ? "user" : "assistant";
  const roleLabel = role === "user" ? "User" : "Assistant";

  let content = "";

  if (typeof message.content === "string") {
    content = escapeHtml(message.content);
  } else {
    for (const block of message.content) {
      content += formatBlock(block, includeTools);
    }
  }

  return `
  <div class="message ${roleClass}">
    <div class="role">${roleLabel}</div>
    <div class="content">${content}</div>
  </div>`;
}

function formatBlock(block: ContentBlock, includeTools: boolean): string {
  switch (block.type) {
    case "text":
      return `<p>${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`;

    case "tool_use":
      if (!includeTools) return "";
      return `
        <div class="tool-call">
          <span class="tool-name">${block.name}</span>
          <pre><code>${escapeHtml(JSON.stringify(block.input, null, 2))}</code></pre>
        </div>`;

    case "tool_result":
      if (!includeTools) return "";
      const truncated = block.content.slice(0, 500);
      return `
        <div class="tool-call">
          <span class="tool-name">Result</span>
          <pre><code>${escapeHtml(truncated)}${block.content.length > 500 ? "\n...(truncated)" : ""}</code></pre>
        </div>`;

    default:
      return "";
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
