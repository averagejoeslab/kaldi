/**
 * Kaldi Skills and Memory System
 *
 * A comprehensive system for:
 * - KALDI.md memory files (like CLAUDE.md)
 * - Custom skills (slash commands) with templates
 * - Skill discovery and execution
 *
 * Named after Kaldi's loyal goats who discovered coffee -
 * these skills help you navigate your coding journey with
 * the energy of coffee-fueled exploration.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { getThemeChalk } from "../ui/terminal.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Skill configuration parsed from SKILL.md
 */
export interface SkillConfig {
  /** Skill name (directory name) */
  name: string;
  /** Display name from markdown */
  displayName: string;
  /** Description of what the skill does */
  description: string;
  /** The prompt template with $ARGUMENTS, $1, $2, etc. */
  prompt: string;
  /** Tool restrictions */
  tools: {
    /** If set, only these tools are allowed */
    allowed?: string[];
    /** If set, these tools are blocked */
    blocked?: string[];
  };
  /** Source path of the skill */
  sourcePath: string;
  /** Whether this is a user-level skill (~/.kaldi) or project-level */
  isUserLevel: boolean;
}

/**
 * Skill definition for registration
 */
export interface Skill {
  /** Skill name (used in /<name>) */
  name: string;
  /** Display name */
  displayName: string;
  /** Description */
  description: string;
  /** The parsed config */
  config: SkillConfig;
  /** Execute the skill with arguments */
  execute: (args: string) => SkillExecutionResult;
}

/**
 * Result of skill execution
 */
export interface SkillExecutionResult {
  /** The processed prompt to inject */
  prompt: string;
  /** System prompt additions */
  systemPromptAddition?: string;
  /** Tool restrictions to apply */
  toolRestrictions?: {
    allowed?: string[];
    blocked?: string[];
  };
  /** Whether execution was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Memory file content
 */
export interface MemoryFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Type: user, project, or local */
  type: "user" | "project" | "local";
}

/**
 * Memory system result
 */
export interface MemoryResult {
  /** Combined content from all memory files */
  combinedContent: string;
  /** Individual memory files loaded */
  files: MemoryFile[];
  /** System prompt addition */
  systemPromptAddition: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** User-level Kaldi directory */
const USER_KALDI_DIR = join(homedir(), ".kaldi");

/** Project-level Kaldi directory */
const PROJECT_KALDI_DIR = ".kaldi";

/** Memory file names */
const MEMORY_FILE = "KALDI.md";
const LOCAL_MEMORY_FILE = "KALDI.local.md";

/** Skill directory name */
const SKILLS_DIR = "skills";

/** Skill config file */
const SKILL_FILE = "SKILL.md";

// ============================================================================
// MEMORY SYSTEM
// ============================================================================

/**
 * Load all KALDI.md memory files from various locations
 *
 * Priority (later overrides earlier):
 * 1. ~/.kaldi/KALDI.md (user-level)
 * 2. .kaldi/KALDI.md (project-level)
 * 3. .kaldi/KALDI.local.md (personal, gitignored)
 */
export function loadKaldiMemory(cwd: string = process.cwd()): MemoryResult {
  const tc = getThemeChalk();
  const files: MemoryFile[] = [];
  const contentParts: string[] = [];

  // 1. User-level memory (~/.kaldi/KALDI.md)
  const userMemoryPath = join(USER_KALDI_DIR, MEMORY_FILE);
  if (existsSync(userMemoryPath)) {
    try {
      const content = readFileSync(userMemoryPath, "utf-8");
      files.push({ path: userMemoryPath, content, type: "user" });
      contentParts.push(`<!-- User Memory (${userMemoryPath}) -->\n${content}`);
    } catch (error) {
      // Silently ignore read errors
    }
  }

  // 2. Project-level memory (.kaldi/KALDI.md)
  const projectMemoryPath = join(cwd, PROJECT_KALDI_DIR, MEMORY_FILE);
  if (existsSync(projectMemoryPath)) {
    try {
      const content = readFileSync(projectMemoryPath, "utf-8");
      files.push({ path: projectMemoryPath, content, type: "project" });
      contentParts.push(`<!-- Project Memory (${projectMemoryPath}) -->\n${content}`);
    } catch (error) {
      // Silently ignore read errors
    }
  }

  // 3. Local memory (.kaldi/KALDI.local.md) - personal, gitignored
  const localMemoryPath = join(cwd, PROJECT_KALDI_DIR, LOCAL_MEMORY_FILE);
  if (existsSync(localMemoryPath)) {
    try {
      const content = readFileSync(localMemoryPath, "utf-8");
      files.push({ path: localMemoryPath, content, type: "local" });
      contentParts.push(`<!-- Local Memory (${localMemoryPath}) -->\n${content}`);
    } catch (error) {
      // Silently ignore read errors
    }
  }

  const combinedContent = contentParts.join("\n\n---\n\n");

  // Build system prompt addition
  let systemPromptAddition = "";
  if (combinedContent.trim()) {
    systemPromptAddition = `
## Project Context (from KALDI.md)

The following context has been loaded from KALDI.md memory files:

${combinedContent}

Use this information to better understand the project and user preferences.
`;
  }

  return {
    combinedContent,
    files,
    systemPromptAddition,
  };
}

/**
 * Edit or create a memory file
 */
export function editMemory(
  type: "user" | "project" | "local",
  cwd: string = process.cwd()
): { path: string; exists: boolean; content: string } {
  let memoryPath: string;

  switch (type) {
    case "user":
      memoryPath = join(USER_KALDI_DIR, MEMORY_FILE);
      break;
    case "project":
      memoryPath = join(cwd, PROJECT_KALDI_DIR, MEMORY_FILE);
      break;
    case "local":
      memoryPath = join(cwd, PROJECT_KALDI_DIR, LOCAL_MEMORY_FILE);
      break;
  }

  // Ensure directory exists
  const dir = dirname(memoryPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const exists = existsSync(memoryPath);
  const content = exists ? readFileSync(memoryPath, "utf-8") : getDefaultMemoryTemplate(type);

  return { path: memoryPath, exists, content };
}

/**
 * Save memory file content
 */
export function saveMemory(
  type: "user" | "project" | "local",
  content: string,
  cwd: string = process.cwd()
): string {
  let memoryPath: string;

  switch (type) {
    case "user":
      memoryPath = join(USER_KALDI_DIR, MEMORY_FILE);
      break;
    case "project":
      memoryPath = join(cwd, PROJECT_KALDI_DIR, MEMORY_FILE);
      break;
    case "local":
      memoryPath = join(cwd, PROJECT_KALDI_DIR, LOCAL_MEMORY_FILE);
      break;
  }

  // Ensure directory exists
  const dir = dirname(memoryPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(memoryPath, content, "utf-8");

  // If local, ensure it's gitignored
  if (type === "local") {
    ensureGitignored(cwd, LOCAL_MEMORY_FILE);
  }

  return memoryPath;
}

/**
 * Get default memory template
 */
function getDefaultMemoryTemplate(type: "user" | "project" | "local"): string {
  switch (type) {
    case "user":
      return `# User Preferences

## About Me

*Add information about yourself that Kaldi should remember across all projects.*

## Coding Style

- Preferred language:
- Indentation:
- Naming conventions:

## Common Patterns

*Add patterns you commonly use that Kaldi should remember.*

## Notes

*Any other notes for Kaldi.*
`;

    case "project":
      return `# Project Context

## Overview

*Describe your project here.*

## Tech Stack

- Language:
- Framework:
- Build tool:

## Important Files

- \`src/\` - Source code
- \`tests/\` - Test files

## Commands

\`\`\`bash
# Development
npm run dev

# Testing
npm test

# Build
npm run build
\`\`\`

## Notes for Kaldi

*Add any special instructions or context for Kaldi here.*
`;

    case "local":
      return `# Local Notes (Personal, Gitignored)

## Current Focus

*What are you working on right now?*

## TODO

- [ ]

## Personal Notes

*Notes that shouldn't be committed to version control.*
`;
  }
}

/**
 * Ensure a file is in .gitignore
 */
function ensureGitignored(cwd: string, filename: string): void {
  const gitignorePath = join(cwd, ".gitignore");
  const kaldiGitignorePath = join(cwd, PROJECT_KALDI_DIR, ".gitignore");

  // Try to add to project's .kaldi/.gitignore first
  const dir = join(cwd, PROJECT_KALDI_DIR);
  if (existsSync(dir)) {
    try {
      let content = existsSync(kaldiGitignorePath)
        ? readFileSync(kaldiGitignorePath, "utf-8")
        : "";

      if (!content.includes(filename)) {
        content = content.trim() + "\n" + filename + "\n";
        writeFileSync(kaldiGitignorePath, content, "utf-8");
      }
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================================
// SKILL PARSING
// ============================================================================

/**
 * Parse a SKILL.md file into a SkillConfig
 */
function parseSkillFile(content: string, name: string, sourcePath: string, isUserLevel: boolean): SkillConfig {
  const lines = content.split("\n");
  let displayName = name;
  let description = "";
  let prompt = "";
  let allowedTools: string[] | undefined;
  let blockedTools: string[] | undefined;

  let currentSection = "";
  let sectionContent: string[] = [];

  const processSection = () => {
    const text = sectionContent.join("\n").trim();

    switch (currentSection.toLowerCase()) {
      case "prompt":
        prompt = text;
        break;
      case "tools":
        // Parse tool restrictions
        for (const line of sectionContent) {
          const trimmed = line.trim();
          if (trimmed.startsWith("- allowed:")) {
            allowedTools = trimmed
              .slice("- allowed:".length)
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t);
          } else if (trimmed.startsWith("- blocked:")) {
            blockedTools = trimmed
              .slice("- blocked:".length)
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t);
          }
        }
        break;
    }
  };

  for (const line of lines) {
    // Check for headers
    if (line.startsWith("# ")) {
      // Main title - display name
      displayName = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("## ")) {
      // Section header - process previous section first
      if (currentSection) {
        processSection();
      }

      currentSection = line.slice(3).trim();
      sectionContent = [];
      continue;
    }

    // If we're at the start (before any section), this is the description
    if (!currentSection && line.trim() && !line.startsWith("#")) {
      if (description) {
        description += " " + line.trim();
      } else {
        description = line.trim();
      }
      continue;
    }

    // Add to current section
    if (currentSection) {
      sectionContent.push(line);
    }
  }

  // Process final section
  if (currentSection) {
    processSection();
  }

  return {
    name,
    displayName,
    description,
    prompt,
    tools: {
      allowed: allowedTools,
      blocked: blockedTools,
    },
    sourcePath,
    isUserLevel,
  };
}

/**
 * Process prompt template with arguments
 */
function processPromptTemplate(template: string, args: string): string {
  let result = template;

  // Replace $ARGUMENTS with full argument string
  result = result.replace(/\$ARGUMENTS/g, args);

  // Split args for positional replacement
  const argParts = args.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const cleanedArgs = argParts.map((a) => a.replace(/^"|"$/g, ""));

  // Replace $1, $2, etc. with positional arguments
  for (let i = 0; i < cleanedArgs.length; i++) {
    const placeholder = new RegExp(`\\$${i + 1}`, "g");
    result = result.replace(placeholder, cleanedArgs[i]);
  }

  // Remove any remaining positional placeholders
  result = result.replace(/\$\d+/g, "");

  return result.trim();
}

// ============================================================================
// SKILLS MANAGER
// ============================================================================

/**
 * SkillsManager - Discovers, loads, and executes skills
 *
 * Like a well-trained barista who knows all the secret menu items,
 * this manager keeps track of all available skills and serves them up
 * when requested.
 */
export class SkillsManager {
  private skills: Map<string, Skill> = new Map();
  private cwd: string;
  private loaded: boolean = false;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Set the current working directory
   */
  setCwd(cwd: string): void {
    if (cwd !== this.cwd) {
      this.cwd = cwd;
      this.loaded = false; // Force reload on next access
    }
  }

  /**
   * Discover and load all skills
   */
  load(): void {
    this.skills.clear();

    // Load user-level skills (~/.kaldi/skills/*)
    const userSkillsDir = join(USER_KALDI_DIR, SKILLS_DIR);
    if (existsSync(userSkillsDir)) {
      this.loadSkillsFromDir(userSkillsDir, true);
    }

    // Load project-level skills (.kaldi/skills/*)
    const projectSkillsDir = join(this.cwd, PROJECT_KALDI_DIR, SKILLS_DIR);
    if (existsSync(projectSkillsDir)) {
      this.loadSkillsFromDir(projectSkillsDir, false);
    }

    this.loaded = true;
  }

  /**
   * Load skills from a directory
   */
  private loadSkillsFromDir(skillsDir: string, isUserLevel: boolean): void {
    try {
      const entries = readdirSync(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillName = entry.name;
        const skillPath = join(skillsDir, skillName);
        const skillFile = join(skillPath, SKILL_FILE);

        if (!existsSync(skillFile)) continue;

        try {
          const content = readFileSync(skillFile, "utf-8");
          const config = parseSkillFile(content, skillName, skillPath, isUserLevel);

          const skill: Skill = {
            name: config.name,
            displayName: config.displayName,
            description: config.description,
            config,
            execute: (args: string) => this.executeSkill(config, args),
          };

          // Project-level skills override user-level skills with same name
          this.skills.set(skillName, skill);
        } catch (error) {
          // Skip skills with parse errors
          console.error(`Failed to load skill ${skillName}:`, error);
        }
      }
    } catch (error) {
      // Directory read error
    }
  }

  /**
   * Execute a skill with the given arguments
   */
  private executeSkill(config: SkillConfig, args: string): SkillExecutionResult {
    const processedPrompt = processPromptTemplate(config.prompt, args);

    return {
      prompt: processedPrompt,
      systemPromptAddition: config.description
        ? `\n\n## Active Skill: ${config.displayName}\n\n${config.description}\n`
        : undefined,
      toolRestrictions:
        config.tools.allowed || config.tools.blocked
          ? {
              allowed: config.tools.allowed,
              blocked: config.tools.blocked,
            }
          : undefined,
      success: true,
    };
  }

  /**
   * Ensure skills are loaded
   */
  private ensureLoaded(): void {
    if (!this.loaded) {
      this.load();
    }
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    this.ensureLoaded();
    return this.skills.get(name);
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    this.ensureLoaded();
    return this.skills.has(name);
  }

  /**
   * Execute a skill by name with arguments
   */
  execute(name: string, args: string = ""): SkillExecutionResult {
    this.ensureLoaded();

    const skill = this.skills.get(name);
    if (!skill) {
      return {
        prompt: "",
        success: false,
        error: `Unknown skill: ${name}`,
      };
    }

    return skill.execute(args);
  }

  /**
   * List all available skills
   */
  list(): Skill[] {
    this.ensureLoaded();
    return Array.from(this.skills.values());
  }

  /**
   * Get all skill names for autocomplete
   */
  getNames(): string[] {
    this.ensureLoaded();
    return Array.from(this.skills.keys());
  }

  /**
   * Get formatted list for display
   */
  getFormattedList(): string {
    this.ensureLoaded();
    const tc = getThemeChalk();

    if (this.skills.size === 0) {
      return tc.dim("No skills installed. Create skills in ~/.kaldi/skills/ or .kaldi/skills/");
    }

    const lines: string[] = [];
    lines.push("");
    lines.push(tc.primary.bold("  Available Skills"));
    lines.push(tc.muted("  " + "-".repeat(50)));
    lines.push("");

    // Group by source
    const userSkills: Skill[] = [];
    const projectSkills: Skill[] = [];

    for (const skill of Array.from(this.skills.values())) {
      if (skill.config.isUserLevel) {
        userSkills.push(skill);
      } else {
        projectSkills.push(skill);
      }
    }

    if (userSkills.length > 0) {
      lines.push(tc.secondary("  User Skills (~/.kaldi/skills/)"));
      for (const skill of userSkills) {
        lines.push(
          `    ${tc.primary(`/${skill.name.padEnd(15)}`)} ${tc.dim(skill.description || skill.displayName)}`
        );
      }
      lines.push("");
    }

    if (projectSkills.length > 0) {
      lines.push(tc.secondary("  Project Skills (.kaldi/skills/)"));
      for (const skill of projectSkills) {
        lines.push(
          `    ${tc.primary(`/${skill.name.padEnd(15)}`)} ${tc.dim(skill.description || skill.displayName)}`
        );
      }
      lines.push("");
    }

    lines.push(tc.dim("  Use /<skill-name> [arguments] to invoke a skill"));

    return lines.join("\n");
  }

  /**
   * Create a new skill
   */
  createSkill(
    name: string,
    options: {
      displayName?: string;
      description?: string;
      prompt?: string;
      allowedTools?: string[];
      blockedTools?: string[];
      isUserLevel?: boolean;
    } = {}
  ): string {
    const baseDir = options.isUserLevel
      ? join(USER_KALDI_DIR, SKILLS_DIR)
      : join(this.cwd, PROJECT_KALDI_DIR, SKILLS_DIR);

    const skillDir = join(baseDir, name);
    const skillFile = join(skillDir, SKILL_FILE);

    // Create directory
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    // Build SKILL.md content
    const lines: string[] = [];
    lines.push(`# ${options.displayName || name}`);
    lines.push("");
    lines.push(options.description || "A custom skill for Kaldi.");
    lines.push("");
    lines.push("## Prompt");
    lines.push("");
    lines.push(options.prompt || "$ARGUMENTS");
    lines.push("");

    if (options.allowedTools || options.blockedTools) {
      lines.push("## Tools");
      lines.push("");
      if (options.allowedTools && options.allowedTools.length > 0) {
        lines.push(`- allowed: ${options.allowedTools.join(", ")}`);
      }
      if (options.blockedTools && options.blockedTools.length > 0) {
        lines.push(`- blocked: ${options.blockedTools.join(", ")}`);
      }
      lines.push("");
    }

    writeFileSync(skillFile, lines.join("\n"), "utf-8");

    // Force reload
    this.loaded = false;

    return skillFile;
  }

  /**
   * Delete a skill
   */
  deleteSkill(name: string): boolean {
    this.ensureLoaded();

    const skill = this.skills.get(name);
    if (!skill) {
      return false;
    }

    try {
      const skillDir = skill.config.sourcePath;
      // Use rm -rf to delete the directory
      execSync(`rm -rf "${skillDir}"`, { stdio: "pipe" });
      this.skills.delete(name);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let skillsManagerInstance: SkillsManager | null = null;

/**
 * Get the skills manager singleton
 */
export function getSkillsManager(cwd?: string): SkillsManager {
  if (!skillsManagerInstance) {
    skillsManagerInstance = new SkillsManager(cwd);
  } else if (cwd) {
    skillsManagerInstance.setCwd(cwd);
  }
  return skillsManagerInstance;
}

/**
 * Create a new skills manager (for testing or isolated use)
 */
export function createSkillsManager(cwd?: string): SkillsManager {
  return new SkillsManager(cwd);
}

// ============================================================================
// BUILT-IN SKILL TEMPLATES
// ============================================================================

/**
 * Install built-in skills
 */
export function installBuiltinSkills(cwd: string): string[] {
  const manager = getSkillsManager(cwd);
  const installed: string[] = [];

  // Code Review skill
  manager.createSkill("review", {
    displayName: "Code Review",
    description: "Review code for issues, style, and improvements.",
    prompt: `Please review the following code or files for:
- Bugs and potential issues
- Code style and best practices
- Performance concerns
- Security vulnerabilities
- Suggestions for improvement

$ARGUMENTS`,
    allowedTools: ["read_file", "glob", "grep", "list_dir"],
    isUserLevel: true,
  });
  installed.push("review");

  // Explain skill
  manager.createSkill("explain", {
    displayName: "Explain Code",
    description: "Explain how code works in detail.",
    prompt: `Please explain the following code or concept in detail:

$ARGUMENTS

Provide:
- High-level overview
- Step-by-step breakdown
- Key concepts and patterns used
- Any potential gotchas`,
    allowedTools: ["read_file", "glob", "grep", "list_dir"],
    isUserLevel: true,
  });
  installed.push("explain");

  // Test skill
  manager.createSkill("test", {
    displayName: "Write Tests",
    description: "Generate tests for the specified code.",
    prompt: `Please write comprehensive tests for:

$ARGUMENTS

Include:
- Unit tests for individual functions
- Edge cases
- Error handling tests
- Mocks where appropriate`,
    isUserLevel: true,
  });
  installed.push("test");

  // Fix skill
  manager.createSkill("fix", {
    displayName: "Fix Bug",
    description: "Debug and fix the described issue.",
    prompt: `Please help fix the following bug or issue:

$ARGUMENTS

Steps:
1. Understand the problem
2. Locate the relevant code
3. Identify the root cause
4. Implement a fix
5. Verify the fix works`,
    isUserLevel: true,
  });
  installed.push("fix");

  // Refactor skill
  manager.createSkill("refactor", {
    displayName: "Refactor Code",
    description: "Refactor code for better structure and maintainability.",
    prompt: `Please refactor the following code to improve:
- Readability
- Maintainability
- Performance (if applicable)
- Following best practices

$ARGUMENTS`,
    isUserLevel: true,
  });
  installed.push("refactor");

  // Document skill
  manager.createSkill("doc", {
    displayName: "Add Documentation",
    description: "Add or improve documentation for code.",
    prompt: `Please add or improve documentation for:

$ARGUMENTS

Include:
- Function/method documentation
- Parameter descriptions
- Return value documentation
- Usage examples where helpful`,
    isUserLevel: true,
  });
  installed.push("doc");

  return installed;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Format memory file info for display
 */
export function formatMemoryInfo(result: MemoryResult): string {
  const tc = getThemeChalk();
  const lines: string[] = [];

  lines.push("");
  lines.push(tc.primary.bold("  KALDI.md Memory Files"));
  lines.push(tc.muted("  " + "-".repeat(50)));
  lines.push("");

  if (result.files.length === 0) {
    lines.push(tc.dim("  No memory files found."));
    lines.push("");
    lines.push(tc.dim("  Create memory files at:"));
    lines.push(tc.dim(`    ~/.kaldi/KALDI.md (user-level)`));
    lines.push(tc.dim(`    .kaldi/KALDI.md (project-level)`));
    lines.push(tc.dim(`    .kaldi/KALDI.local.md (personal, gitignored)`));
  } else {
    for (const file of result.files) {
      const icon =
        file.type === "user"
          ? tc.info("[U]")
          : file.type === "project"
          ? tc.success("[P]")
          : tc.warning("[L]");
      const label =
        file.type === "user"
          ? "User"
          : file.type === "project"
          ? "Project"
          : "Local";

      lines.push(`  ${icon} ${tc.text(label)}`);
      lines.push(`      ${tc.dim(file.path)}`);

      // Show preview
      const preview = file.content.split("\n").slice(0, 3).join(" ").slice(0, 60);
      lines.push(`      ${tc.muted(preview)}...`);
      lines.push("");
    }
  }

  lines.push(tc.dim("  Use /memory to edit memory files"));

  return lines.join("\n");
}

// ============================================================================
// SKILL COMMAND INTEGRATION
// ============================================================================

/**
 * Check if input is a skill command
 */
export function isSkillCommand(input: string, cwd: string = process.cwd()): boolean {
  if (!input.startsWith("/")) return false;

  const parts = input.slice(1).split(/\s+/);
  const name = parts[0];

  const manager = getSkillsManager(cwd);
  return manager.has(name);
}

/**
 * Execute a skill command
 */
export function executeSkillCommand(
  input: string,
  cwd: string = process.cwd()
): SkillExecutionResult {
  if (!input.startsWith("/")) {
    return { prompt: "", success: false, error: "Not a command" };
  }

  const parts = input.slice(1).split(/\s+/);
  const name = parts[0];
  const args = parts.slice(1).join(" ");

  const manager = getSkillsManager(cwd);
  return manager.execute(name, args);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Singleton export
export const skillsManager = getSkillsManager();
