/**
 * Conversation Export
 *
 * Export conversations to various formats (Markdown, JSON, HTML).
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface ExportMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  toolCalls?: ToolCallExport[];
}

export interface ToolCallExport {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  duration?: number;
  error?: boolean;
}

export interface ExportMetadata {
  title?: string;
  createdAt: Date;
  model: string;
  provider: string;
  projectPath: string;
  totalTokens?: {
    input: number;
    output: number;
  };
  duration?: number;
}

export interface ExportConfig {
  format: "markdown" | "json" | "html";
  includeMetadata?: boolean;
  includeToolCalls?: boolean;
  includeTimestamps?: boolean;
  includeSystemMessages?: boolean;
  codeHighlighting?: boolean;
}

export interface ExportResult {
  content: string;
  format: string;
  path?: string;
  size: number;
}

// ============================================================================
// EXPORTERS
// ============================================================================

/**
 * Export conversation to Markdown
 */
export function exportToMarkdown(
  messages: ExportMessage[],
  metadata: ExportMetadata,
  config: Partial<ExportConfig> = {}
): string {
  const opts = {
    includeMetadata: true,
    includeToolCalls: true,
    includeTimestamps: false,
    includeSystemMessages: false,
    ...config,
  };

  const lines: string[] = [];

  // Header
  lines.push(`# ${metadata.title || "Kaldi Conversation"}`);
  lines.push("");

  // Metadata
  if (opts.includeMetadata) {
    lines.push("## Metadata");
    lines.push("");
    lines.push(`- **Date**: ${metadata.createdAt.toLocaleString()}`);
    lines.push(`- **Model**: ${metadata.provider} / ${metadata.model}`);
    lines.push(`- **Project**: ${metadata.projectPath}`);

    if (metadata.totalTokens) {
      lines.push(`- **Tokens**: ${metadata.totalTokens.input} in / ${metadata.totalTokens.output} out`);
    }

    if (metadata.duration) {
      lines.push(`- **Duration**: ${formatDuration(metadata.duration)}`);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Messages
  lines.push("## Conversation");
  lines.push("");

  for (const msg of messages) {
    // Skip system messages if configured
    if (msg.role === "system" && !opts.includeSystemMessages) {
      continue;
    }

    const roleLabel = msg.role === "user" ? "**User**" :
                      msg.role === "assistant" ? "**Kaldi**" : "*System*";

    const timestamp = opts.includeTimestamps && msg.timestamp
      ? ` _(${new Date(msg.timestamp).toLocaleTimeString()})_`
      : "";

    lines.push(`### ${roleLabel}${timestamp}`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");

    // Tool calls
    if (opts.includeToolCalls && msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push("<details>");
      lines.push("<summary>Tool calls</summary>");
      lines.push("");

      for (const tool of msg.toolCalls) {
        const status = tool.error ? "❌" : "✓";
        const duration = tool.duration ? ` (${tool.duration}ms)` : "";

        lines.push(`- ${status} **${tool.name}**${duration}`);

        if (Object.keys(tool.args).length > 0) {
          lines.push("  ```json");
          lines.push(`  ${JSON.stringify(tool.args, null, 2).replace(/\n/g, "\n  ")}`);
          lines.push("  ```");
        }
      }

      lines.push("");
      lines.push("</details>");
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  // Footer
  lines.push("");
  lines.push("---");
  lines.push(`_Exported from Kaldi on ${new Date().toLocaleString()}_`);

  return lines.join("\n");
}

/**
 * Export conversation to JSON
 */
export function exportToJSON(
  messages: ExportMessage[],
  metadata: ExportMetadata,
  config: Partial<ExportConfig> = {}
): string {
  const opts = {
    includeMetadata: true,
    includeToolCalls: true,
    includeSystemMessages: false,
    ...config,
  };

  const filteredMessages = opts.includeSystemMessages
    ? messages
    : messages.filter(m => m.role !== "system");

  const exportData = {
    metadata: opts.includeMetadata ? {
      title: metadata.title || "Kaldi Conversation",
      createdAt: metadata.createdAt.toISOString(),
      model: metadata.model,
      provider: metadata.provider,
      projectPath: metadata.projectPath,
      totalTokens: metadata.totalTokens,
      duration: metadata.duration,
      exportedAt: new Date().toISOString(),
    } : undefined,
    messages: filteredMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : undefined,
      toolCalls: opts.includeToolCalls ? msg.toolCalls : undefined,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export conversation to HTML
 */
export function exportToHTML(
  messages: ExportMessage[],
  metadata: ExportMetadata,
  config: Partial<ExportConfig> = {}
): string {
  const opts = {
    includeMetadata: true,
    includeToolCalls: true,
    includeTimestamps: true,
    includeSystemMessages: false,
    codeHighlighting: true,
    ...config,
  };

  const title = metadata.title || "Kaldi Conversation";

  const css = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background: #1a1a1a;
        color: #e8dcc8;
      }
      h1 { color: #c9a66b; }
      h2 { color: #daa520; border-bottom: 1px solid #3d3225; padding-bottom: 10px; }
      .metadata { background: #2a2015; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
      .metadata dt { color: #888; }
      .metadata dd { color: #e8dcc8; margin-left: 0; margin-bottom: 10px; }
      .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
      .message.user { background: #2d2820; border-left: 3px solid #c9a66b; }
      .message.assistant { background: #1d2520; border-left: 3px solid #7cb342; }
      .message.system { background: #2d2525; border-left: 3px solid #888; font-style: italic; }
      .role { font-weight: bold; margin-bottom: 10px; }
      .role.user { color: #c9a66b; }
      .role.assistant { color: #7cb342; }
      .timestamp { color: #666; font-size: 0.85em; }
      pre { background: #0d0d0d; padding: 10px; border-radius: 4px; overflow-x: auto; }
      code { font-family: 'SF Mono', Monaco, monospace; font-size: 0.9em; }
      .tool-calls { background: #1a1515; padding: 10px; border-radius: 4px; margin-top: 10px; }
      .tool-call { margin: 5px 0; }
      .tool-name { color: #87ceeb; }
      .tool-success { color: #7cb342; }
      .tool-error { color: #e57373; }
    </style>
  `;

  const head = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      ${css}
    </head>
    <body>
  `;

  const lines: string[] = [head];

  lines.push(`<h1>☕ ${escapeHtml(title)}</h1>`);

  // Metadata
  if (opts.includeMetadata) {
    lines.push('<div class="metadata">');
    lines.push("<dl>");
    lines.push(`<dt>Date</dt><dd>${metadata.createdAt.toLocaleString()}</dd>`);
    lines.push(`<dt>Model</dt><dd>${escapeHtml(metadata.provider)} / ${escapeHtml(metadata.model)}</dd>`);
    lines.push(`<dt>Project</dt><dd>${escapeHtml(metadata.projectPath)}</dd>`);

    if (metadata.totalTokens) {
      lines.push(`<dt>Tokens</dt><dd>${metadata.totalTokens.input} in / ${metadata.totalTokens.output} out</dd>`);
    }

    lines.push("</dl>");
    lines.push("</div>");
  }

  lines.push("<h2>Conversation</h2>");

  // Messages
  for (const msg of messages) {
    if (msg.role === "system" && !opts.includeSystemMessages) {
      continue;
    }

    const roleClass = msg.role;
    const roleLabel = msg.role === "user" ? "User" :
                      msg.role === "assistant" ? "Kaldi" : "System";

    const timestamp = opts.includeTimestamps && msg.timestamp
      ? `<span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>`
      : "";

    lines.push(`<div class="message ${roleClass}">`);
    lines.push(`<div class="role ${roleClass}">${roleLabel} ${timestamp}</div>`);
    lines.push(`<div class="content">${formatContentAsHtml(msg.content, opts.codeHighlighting)}</div>`);

    // Tool calls
    if (opts.includeToolCalls && msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push('<div class="tool-calls">');
      lines.push("<strong>Tool calls:</strong>");

      for (const tool of msg.toolCalls) {
        const statusClass = tool.error ? "tool-error" : "tool-success";
        const statusIcon = tool.error ? "❌" : "✓";

        lines.push(`<div class="tool-call">`);
        lines.push(`<span class="${statusClass}">${statusIcon}</span> `);
        lines.push(`<span class="tool-name">${escapeHtml(tool.name)}</span>`);

        if (tool.duration) {
          lines.push(` <span class="timestamp">(${tool.duration}ms)</span>`);
        }

        lines.push("</div>");
      }

      lines.push("</div>");
    }

    lines.push("</div>");
  }

  // Footer
  lines.push(`<p style="color: #666; text-align: center; margin-top: 40px;">Exported from Kaldi on ${new Date().toLocaleString()}</p>`);
  lines.push("</body></html>");

  return lines.join("\n");
}

// ============================================================================
// FILE EXPORT
// ============================================================================

/**
 * Export conversation to a file
 */
export function exportToFile(
  messages: ExportMessage[],
  metadata: ExportMetadata,
  config: ExportConfig,
  outputPath?: string
): ExportResult {
  let content: string;

  switch (config.format) {
    case "markdown":
      content = exportToMarkdown(messages, metadata, config);
      break;
    case "json":
      content = exportToJSON(messages, metadata, config);
      break;
    case "html":
      content = exportToHTML(messages, metadata, config);
      break;
  }

  // Determine output path
  const ext = config.format === "markdown" ? "md" : config.format;
  const filename = `kaldi-export-${Date.now()}.${ext}`;
  const defaultDir = join(homedir(), ".kaldi", "exports");
  const filePath = outputPath || join(defaultDir, filename);

  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write file
  writeFileSync(filePath, content, "utf-8");

  return {
    content,
    format: config.format,
    path: filePath,
    size: content.length,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatContentAsHtml(content: string, codeHighlighting: boolean): string {
  let html = escapeHtml(content);

  // Convert code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  });

  // Convert inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// ============================================================================
// FORMATTING
// ============================================================================

const colors = {
  accent: chalk.hex("#C9A66B"),
  success: chalk.hex("#7CB342"),
  dim: chalk.hex("#888888"),
};

/**
 * Format export result for display
 */
export function formatExportResult(result: ExportResult): string {
  const sizeKB = (result.size / 1024).toFixed(1);

  return [
    "",
    colors.success(`  ✓ Exported conversation`),
    colors.dim(`    Format: ${result.format}`),
    colors.dim(`    Size: ${sizeKB}KB`),
    result.path ? colors.dim(`    Path: ${result.path}`) : "",
    "",
  ].filter(Boolean).join("\n");
}

/**
 * Format export options menu
 */
export function formatExportOptions(): string {
  return [
    colors.accent("  Export Options"),
    "",
    `  ${colors.accent("1.")} Markdown (.md)`,
    `  ${colors.accent("2.")} JSON (.json)`,
    `  ${colors.accent("3.")} HTML (.html)`,
    "",
  ].join("\n");
}
