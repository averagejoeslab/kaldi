/**
 * Collapsible Output
 *
 * Manages collapsible tool output with expand/collapse functionality.
 */

import { c } from "../theme/colors.js";

export interface CollapsibleSection {
  id: string;
  title: string;
  content: string;
  lineCount: number;
  expanded: boolean;
  timestamp: number;
}

/**
 * Collapsible Output Manager
 */
export class CollapsibleOutputManager {
  private sections: Map<string, CollapsibleSection> = new Map();
  private maxCollapsedLines = 3;
  private stream = process.stderr;

  /**
   * Add a new collapsible section
   */
  addSection(id: string, title: string, content: string): CollapsibleSection {
    const lines = content.split("\n");
    const section: CollapsibleSection = {
      id,
      title,
      content,
      lineCount: lines.length,
      expanded: lines.length <= this.maxCollapsedLines,
      timestamp: Date.now(),
    };
    this.sections.set(id, section);
    return section;
  }

  /**
   * Toggle a section's expanded state
   */
  toggle(id: string): boolean {
    const section = this.sections.get(id);
    if (section) {
      section.expanded = !section.expanded;
      return section.expanded;
    }
    return false;
  }

  /**
   * Expand all sections
   */
  expandAll(): void {
    for (const section of this.sections.values()) {
      section.expanded = true;
    }
  }

  /**
   * Collapse all sections
   */
  collapseAll(): void {
    for (const section of this.sections.values()) {
      if (section.lineCount > this.maxCollapsedLines) {
        section.expanded = false;
      }
    }
  }

  /**
   * Get section by ID
   */
  getSection(id: string): CollapsibleSection | undefined {
    return this.sections.get(id);
  }

  /**
   * Format a section for display
   */
  formatSection(section: CollapsibleSection): string {
    const lines = section.content.split("\n");

    if (section.expanded || lines.length <= this.maxCollapsedLines) {
      // Show all content
      const formatted = lines.map((line) => `  │ ${line}`).join("\n");
      if (lines.length > this.maxCollapsedLines) {
        return formatted + `\n  └─ ${c.dim("(Ctrl+O collapse)")}`;
      }
      return formatted;
    }

    // Show collapsed preview
    const preview = lines.slice(0, this.maxCollapsedLines);
    const remaining = lines.length - this.maxCollapsedLines;
    const formatted = preview.map((line) => `  │ ${line}`).join("\n");

    return formatted + `\n  └─ ${c.dim(`+${remaining} lines (Ctrl+O expand)`)}`;
  }

  /**
   * Format tool output (convenience method)
   */
  formatToolOutput(
    toolName: string,
    output: string,
    success: boolean,
    duration: string
  ): string {
    const id = `tool-${Date.now()}`;
    const section = this.addSection(id, toolName, output);

    const icon = success ? c.success("✓") : c.error("✗");
    const header = `${icon} ${c.bold(toolName)} ${c.dim(`(${duration})`)}`;

    if (!output || output.trim() === "") {
      return header;
    }

    return `${header}\n${this.formatSection(section)}`;
  }

  /**
   * Format multiple collapsed tools
   */
  formatCollapsedTools(tools: Array<{ name: string; duration: string }>): string {
    if (tools.length === 0) return "";

    const lines = tools.map(
      (t) => `${c.success("✓")} ${t.name} ${c.dim(`(${t.duration})`)}`
    );

    if (tools.length <= 3) {
      return lines.join("\n");
    }

    // Show first 2 and collapse the rest
    const shown = lines.slice(0, 2);
    const remaining = tools.length - 2;

    return (
      shown.join("\n") +
      `\n  └─ ${c.dim(`+${remaining} tools (Ctrl+O expand all)`)}`
    );
  }

  /**
   * Clear old sections
   */
  clearOld(maxAge: number = 60000): void {
    const now = Date.now();
    for (const [id, section] of this.sections) {
      if (now - section.timestamp > maxAge) {
        this.sections.delete(id);
      }
    }
  }

  /**
   * Clear all sections
   */
  clear(): void {
    this.sections.clear();
  }
}

// Singleton instance
let outputManager: CollapsibleOutputManager | null = null;

export function getCollapsibleOutput(): CollapsibleOutputManager {
  if (!outputManager) {
    outputManager = new CollapsibleOutputManager();
  }
  return outputManager;
}

/**
 * Format output with collapse hint
 */
export function formatWithCollapseHint(
  content: string,
  maxLines: number = 3
): string {
  const lines = content.split("\n");

  if (lines.length <= maxLines) {
    return lines.map((l) => `  │ ${l}`).join("\n");
  }

  const preview = lines.slice(0, maxLines);
  const remaining = lines.length - maxLines;

  return (
    preview.map((l) => `  │ ${l}`).join("\n") +
    `\n  └─ ${c.dim(`+${remaining} lines (Ctrl+O expand)`)}`
  );
}

/**
 * Format a single line with tree connector
 */
export function formatTreeLine(line: string, isLast: boolean = false): string {
  const connector = isLast ? "└─" : "│";
  return `  ${connector} ${line}`;
}
