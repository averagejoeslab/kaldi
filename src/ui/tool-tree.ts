/**
 * Tool Tree Display for Kaldi CLI
 *
 * Renders tool usage in a hierarchical tree format:
 * ├ Read src/index.ts (150 lines)
 * ├ Read src/utils.ts (80 lines)
 * └ Read package.json (45 lines)
 */

import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  startTime: number;
  endTime?: number;
  result?: string;
  resultLineCount?: number;
  isError?: boolean;
  children?: ToolCall[];
}

export interface ToolTreeOptions {
  /** Show full file paths vs just filename */
  showFullPaths?: boolean;
  /** Maximum visible items before collapsing */
  maxVisible?: number;
  /** Whether to show in verbose mode */
  verbose?: boolean;
  /** Indent level for nested calls */
  indent?: number;
}

// ============================================================================
// CONSTANTS - Pyrenees + Coffee Palette
// ============================================================================

const colors = {
  primary: chalk.hex("#C9A66B"),    // Latte
  secondary: chalk.hex("#DAA520"),  // Golden
  dim: chalk.hex("#A09080"),        // Muted
  text: chalk.hex("#F5F0E6"),       // Cream
  success: chalk.hex("#7CB342"),    // Green
  error: chalk.hex("#E57373"),      // Red
  info: chalk.hex("#64B5F6"),       // Blue
  muted: chalk.hex("#6B5B4F"),      // Dark coffee
};

// Tree characters
const TREE = {
  branch: "├",
  last: "└",
  pipe: "│",
  space: " ",
};

// Tool icons
const TOOL_ICONS: Record<string, string> = {
  read_file: "📖",
  write_file: "✏️",
  edit_file: "📝",
  glob: "🔍",
  grep: "🔎",
  bash: "⚡",
  list_dir: "📁",
  web_fetch: "🌐",
  task: "🚀",
  unknown: "⚙️",
};

// ============================================================================
// TOOL TREE RENDERER
// ============================================================================

/**
 * Format a list of tool calls as a tree
 */
export function formatToolTree(
  tools: ToolCall[],
  options: ToolTreeOptions = {}
): string {
  const {
    showFullPaths = false,
    maxVisible = 5,
    verbose = false,
    indent = 0,
  } = options;

  if (tools.length === 0) {
    return "";
  }

  const lines: string[] = [];
  const visibleTools = verbose ? tools : tools.slice(0, maxVisible);
  const hiddenCount = tools.length - visibleTools.length;
  const indentStr = "  ".repeat(indent);

  visibleTools.forEach((tool, index) => {
    const isLast = index === visibleTools.length - 1 && hiddenCount === 0;
    const prefix = isLast ? TREE.last : TREE.branch;
    const line = formatToolCall(tool, { showFullPaths, verbose });
    lines.push(`${indentStr}${colors.dim(prefix)} ${line}`);

    // Render children if any
    if (tool.children && tool.children.length > 0) {
      const childLines = formatToolTree(tool.children, {
        ...options,
        indent: indent + 1,
      });
      lines.push(childLines);
    }
  });

  // Show hidden count
  if (hiddenCount > 0) {
    const prefix = TREE.last;
    lines.push(
      `${indentStr}${colors.dim(prefix)} ${colors.dim(`+${hiddenCount} more`)} ${colors.muted("(ctrl+o to expand)")}`
    );
  }

  return lines.join("\n");
}

/**
 * Format a single tool call
 */
export function formatToolCall(
  tool: ToolCall,
  options: { showFullPaths?: boolean; verbose?: boolean } = {}
): string {
  const icon = getToolIcon(tool.name);
  const name = formatToolName(tool.name);
  const args = formatToolArgs(tool, options.showFullPaths);
  const duration = tool.endTime ? formatDuration(tool.endTime - tool.startTime) : "";
  const lineCount = tool.resultLineCount ? `(${tool.resultLineCount} lines)` : "";

  // Status indicator
  const status = tool.isError
    ? colors.error("✗")
    : tool.endTime
      ? colors.success("✓")
      : colors.secondary("●");

  // Build the line
  let line = `${status} ${colors.primary(name)}`;

  if (args) {
    line += ` ${colors.text(args)}`;
  }

  if (lineCount) {
    line += ` ${colors.dim(lineCount)}`;
  }

  if (duration && options.verbose) {
    line += ` ${colors.dim(`[${duration}]`)}`;
  }

  return line;
}

/**
 * Get icon for a tool
 */
function getToolIcon(toolName: string): string {
  const normalized = toolName.toLowerCase().replace(/-/g, "_");
  return TOOL_ICONS[normalized] || TOOL_ICONS.unknown;
}

/**
 * Format tool name for display
 */
function formatToolName(toolName: string): string {
  // Convert to readable format
  return toolName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^(Read|Write|Edit|List|Glob|Grep|Bash|Web)/i, (m) => m);
}

/**
 * Format tool arguments for display
 */
function formatToolArgs(tool: ToolCall, showFullPaths?: boolean): string {
  const args = tool.args;

  // Handle specific tools
  switch (tool.name.toLowerCase()) {
    case "read_file":
    case "write_file":
    case "edit_file": {
      const path = args.path || args.file_path || args.filePath;
      if (typeof path === "string") {
        return showFullPaths ? path : getFileName(path);
      }
      break;
    }

    case "glob": {
      const pattern = args.pattern;
      if (typeof pattern === "string") {
        return pattern;
      }
      break;
    }

    case "grep": {
      const pattern = args.pattern;
      const path = args.path;
      if (typeof pattern === "string") {
        let result = `"${truncate(pattern, 30)}"`;
        if (path) result += ` in ${showFullPaths ? path : getFileName(String(path))}`;
        return result;
      }
      break;
    }

    case "bash": {
      const command = args.command;
      if (typeof command === "string") {
        return truncate(command, 50);
      }
      break;
    }

    case "list_dir": {
      const path = args.path || ".";
      return showFullPaths ? String(path) : getFileName(String(path)) || ".";
    }

    case "task": {
      const agent = args.agent || args.subagent_type;
      const task = args.task || args.prompt;
      if (agent) {
        let result = `[${agent}]`;
        if (task) result += ` ${truncate(String(task), 40)}`;
        return result;
      }
      break;
    }
  }

  // Default: show first string argument
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.length < 60) {
      return truncate(value, 50);
    }
  }

  return "";
}

/**
 * Get filename from path
 */
function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Truncate string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// ============================================================================
// GROUPED TOOL TREE
// ============================================================================

/**
 * Group tools by category and render as tree
 */
export function formatGroupedToolTree(
  tools: ToolCall[],
  options: ToolTreeOptions = {}
): string {
  const groups: Record<string, ToolCall[]> = {
    read: [],
    write: [],
    search: [],
    execute: [],
    other: [],
  };

  // Categorize tools
  for (const tool of tools) {
    const name = tool.name.toLowerCase();
    if (name.includes("read")) {
      groups.read.push(tool);
    } else if (name.includes("write") || name.includes("edit")) {
      groups.write.push(tool);
    } else if (name.includes("glob") || name.includes("grep") || name.includes("search")) {
      groups.search.push(tool);
    } else if (name.includes("bash") || name.includes("task")) {
      groups.execute.push(tool);
    } else {
      groups.other.push(tool);
    }
  }

  const lines: string[] = [];
  const groupNames: Array<[string, string]> = [
    ["read", "Read files"],
    ["search", "Search"],
    ["write", "Write/Edit"],
    ["execute", "Execute"],
    ["other", "Other"],
  ];

  for (const [key, label] of groupNames) {
    const groupTools = groups[key];
    if (groupTools.length > 0) {
      lines.push(colors.secondary(`${label}:`));
      lines.push(formatToolTree(groupTools, options));
    }
  }

  return lines.join("\n");
}

// ============================================================================
// COLLAPSED SUMMARY
// ============================================================================

/**
 * Format a collapsed summary of tool usage
 */
export function formatToolSummary(tools: ToolCall[]): string {
  if (tools.length === 0) return "";

  // Count by type
  const counts: Record<string, number> = {};
  for (const tool of tools) {
    const name = tool.name.toLowerCase();
    if (name.includes("read")) {
      counts["Read"] = (counts["Read"] || 0) + 1;
    } else if (name.includes("write") || name.includes("edit")) {
      counts["Write"] = (counts["Write"] || 0) + 1;
    } else if (name.includes("glob") || name.includes("grep")) {
      counts["Search"] = (counts["Search"] || 0) + 1;
    } else if (name.includes("bash")) {
      counts["Bash"] = (counts["Bash"] || 0) + 1;
    } else {
      counts["Other"] = (counts["Other"] || 0) + 1;
    }
  }

  // Format summary
  const parts: string[] = [];
  for (const [type, count] of Object.entries(counts)) {
    parts.push(`${type} ${count} ${count === 1 ? "file" : "files"}`);
  }

  const summary = parts.join(", ");
  return `${colors.success("●")} ${colors.text(summary)} ${colors.muted("(ctrl+o to expand)")}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  colors as toolTreeColors,
  TREE,
  TOOL_ICONS,
};
