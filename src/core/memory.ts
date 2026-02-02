/**
 * KALDI.md Memory System
 *
 * Persistent project-specific context that gets loaded into every conversation.
 * Similar to CLAUDE.md in Claude Code.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryFile {
  path: string;
  content: string;
  type: "project" | "global" | "user";
  lastModified?: Date;
}

export interface MemoryConfig {
  projectPath?: string;
  includeGlobal?: boolean;
  includeUser?: boolean;
}

export interface MemoryResult {
  files: MemoryFile[];
  combinedContext: string;
  totalSize: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MEMORY_FILENAMES = ["KALDI.md", ".kaldi/KALDI.md", ".kaldi/memory.md"];
const GLOBAL_MEMORY_PATH = join(homedir(), ".kaldi", "KALDI.md");
const USER_MEMORY_PATH = join(homedir(), ".kaldi", "user.md");

const DEFAULT_KALDI_MD = `# Project Context

<!--
This file provides context to Kaldi about your project.
Add information that helps Kaldi understand your codebase better.
-->

## Project Overview
<!-- Describe what this project does -->

## Tech Stack
<!-- List the main technologies used -->

## Important Files
<!-- List key files and their purposes -->

## Conventions
<!-- Coding conventions, naming patterns, etc. -->

## Notes
<!-- Any other important context -->
`;

const DEFAULT_GLOBAL_MD = `# Global Kaldi Context

<!--
This file is loaded for ALL projects.
Use it for personal preferences and global settings.
-->

## Preferences
<!-- Your coding preferences -->

## Common Patterns
<!-- Patterns you frequently use -->
`;

// ============================================================================
// MEMORY LOADING
// ============================================================================

/**
 * Find and load memory files for a project
 */
export function loadMemory(config: MemoryConfig = {}): MemoryResult {
  const files: MemoryFile[] = [];
  const projectPath = config.projectPath || process.cwd();

  // 1. Load project-specific memory
  for (const filename of MEMORY_FILENAMES) {
    const fullPath = join(projectPath, filename);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        files.push({
          path: fullPath,
          content,
          type: "project",
          lastModified: new Date(),
        });
        break; // Only load the first found
      } catch {
        // Skip if can't read
      }
    }
  }

  // 2. Load global memory (if enabled)
  if (config.includeGlobal !== false && existsSync(GLOBAL_MEMORY_PATH)) {
    try {
      const content = readFileSync(GLOBAL_MEMORY_PATH, "utf-8");
      files.push({
        path: GLOBAL_MEMORY_PATH,
        content,
        type: "global",
        lastModified: new Date(),
      });
    } catch {
      // Skip if can't read
    }
  }

  // 3. Load user memory (if enabled)
  if (config.includeUser !== false && existsSync(USER_MEMORY_PATH)) {
    try {
      const content = readFileSync(USER_MEMORY_PATH, "utf-8");
      files.push({
        path: USER_MEMORY_PATH,
        content,
        type: "user",
        lastModified: new Date(),
      });
    } catch {
      // Skip if can't read
    }
  }

  // Combine all memory into a single context string
  const sections: string[] = [];

  for (const file of files) {
    const label = file.type === "project" ? "Project Memory" :
                  file.type === "global" ? "Global Memory" : "User Memory";
    sections.push(`<!-- ${label}: ${file.path} -->\n${file.content}`);
  }

  const combinedContext = sections.join("\n\n---\n\n");
  const totalSize = combinedContext.length;

  return { files, combinedContext, totalSize };
}

/**
 * Check if project has a memory file
 */
export function hasMemory(projectPath?: string): boolean {
  const path = projectPath || process.cwd();
  return MEMORY_FILENAMES.some(f => existsSync(join(path, f)));
}

/**
 * Get the path where project memory would be stored
 */
export function getMemoryPath(projectPath?: string): string {
  const path = projectPath || process.cwd();

  // Check existing locations
  for (const filename of MEMORY_FILENAMES) {
    const fullPath = join(path, filename);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Default to .kaldi/KALDI.md
  return join(path, ".kaldi", "KALDI.md");
}

// ============================================================================
// MEMORY CREATION/EDITING
// ============================================================================

/**
 * Create a new memory file for the project
 */
export function createMemory(projectPath?: string, content?: string): string {
  const path = projectPath || process.cwd();
  const memoryPath = join(path, ".kaldi", "KALDI.md");
  const dir = dirname(memoryPath);

  // Create directory if needed
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write the file
  writeFileSync(memoryPath, content || DEFAULT_KALDI_MD, "utf-8");

  return memoryPath;
}

/**
 * Create or ensure global memory exists
 */
export function ensureGlobalMemory(): string {
  const dir = dirname(GLOBAL_MEMORY_PATH);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(GLOBAL_MEMORY_PATH)) {
    writeFileSync(GLOBAL_MEMORY_PATH, DEFAULT_GLOBAL_MD, "utf-8");
  }

  return GLOBAL_MEMORY_PATH;
}

/**
 * Update memory file content
 */
export function updateMemory(path: string, content: string): void {
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, content, "utf-8");
}

/**
 * Append to memory file
 */
export function appendToMemory(path: string, content: string): void {
  if (!existsSync(path)) {
    updateMemory(path, content);
    return;
  }

  const existing = readFileSync(path, "utf-8");
  writeFileSync(path, existing + "\n\n" + content, "utf-8");
}

// ============================================================================
// MEMORY FORMATTING
// ============================================================================

/**
 * Format memory info for display
 */
export function formatMemoryInfo(result: MemoryResult): string {
  const lines: string[] = [];
  const dim = chalk.dim;
  const accent = chalk.hex("#C9A66B");
  const success = chalk.hex("#7CB342");

  lines.push(accent("  Memory Files"));
  lines.push("");

  if (result.files.length === 0) {
    lines.push(dim("  No memory files found"));
    lines.push(dim("  Run /memory init to create one"));
  } else {
    for (const file of result.files) {
      const icon = file.type === "project" ? "◆" : file.type === "global" ? "◉" : "○";
      const size = `${(file.content.length / 1024).toFixed(1)}KB`;
      lines.push(`  ${success(icon)} ${dim(file.type.padEnd(8))} ${file.path} ${dim(`(${size})`)}`);
    }
    lines.push("");
    lines.push(dim(`  Total: ${(result.totalSize / 1024).toFixed(1)}KB`));
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Build system prompt addition from memory
 */
export function buildMemoryPrompt(result: MemoryResult): string {
  if (result.files.length === 0) {
    return "";
  }

  return `
<project-memory>
The following is persistent context about this project that the user has provided:

${result.combinedContext}
</project-memory>

Use this context to better understand the project, its conventions, and the user's preferences.
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_KALDI_MD,
  DEFAULT_GLOBAL_MD,
  MEMORY_FILENAMES,
  GLOBAL_MEMORY_PATH,
  USER_MEMORY_PATH,
};
