/**
 * Subagents System for Kaldi CLI
 *
 * Provides isolated agent contexts for specialized tasks:
 * - Explore: Fast, read-only codebase search
 * - Plan: Research agent for planning implementations
 * - Custom agents loaded from ~/.kaldi/agents/ and .kaldi/agents/
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { Agent, type AgentCallbacks } from "../agent/loop.js";
import {
  DefaultToolRegistry,
  type ToolDefinition,
  type ToolRegistry,
} from "../tools/index.js";
import { readFileTool, writeFileTool, editFileTool } from "../tools/file.js";
import { bashTool } from "../tools/bash.js";
import { globTool, grepTool } from "../tools/search.js";
import { listDirTool } from "../tools/list-dir.js";
import { webFetchTool } from "../tools/web.js";
import type { Provider, ProviderType } from "../providers/types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Speed modes for the Explore subagent
 */
export type ExploreSpeed = "quick" | "medium" | "very_thorough";

/**
 * Permission modes for subagents
 */
export type PermissionMode = "auto" | "default" | "ask_always";

/**
 * Execution mode for subagent
 */
export type ExecutionMode = "foreground" | "background";

/**
 * Tool restriction rules
 */
export interface ToolRestrictions {
  /** Only allow these tools (whitelist) */
  allowOnly?: string[];
  /** Block these tools (blacklist) */
  block?: string[];
}

/**
 * Configuration for a subagent
 */
export interface SubAgentConfig {
  /** Unique identifier for the subagent */
  name: string;
  /** Human-readable description */
  description: string;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Tool restrictions */
  toolRestrictions?: ToolRestrictions;
  /** Override permission mode */
  permissionMode?: PermissionMode;
  /** Model to use (overrides parent) */
  model?: string;
  /** Provider to use (overrides parent) */
  providerType?: ProviderType;
  /** Maximum turns for the agent */
  maxTurns?: number;
  /** Default execution mode */
  defaultExecutionMode?: ExecutionMode;
}

/**
 * Result from a subagent execution
 */
export interface SubAgentResult {
  /** Whether the execution was successful */
  success: boolean;
  /** The final response from the subagent */
  response: string;
  /** Error message if unsuccessful */
  error?: string;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Options for running a subagent
 */
export interface SubAgentRunOptions {
  /** The task/query to send to the subagent */
  task: string;
  /** Execution mode */
  executionMode?: ExecutionMode;
  /** Additional context to prepend */
  context?: string;
  /** Working directory override */
  cwd?: string;
  /** Callbacks for streaming output */
  callbacks?: AgentCallbacks;
}

/**
 * Background task handle
 */
export interface BackgroundTask {
  /** Unique task ID */
  id: string;
  /** Subagent name */
  agentName: string;
  /** Task description */
  task: string;
  /** Promise that resolves when complete */
  promise: Promise<SubAgentResult>;
  /** Start time */
  startedAt: Date;
  /** Whether the task is complete */
  isComplete: boolean;
  /** Result (available when complete) */
  result?: SubAgentResult;
}

// ============================================================================
// Read-only Tools Set
// ============================================================================

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "glob",
  "grep",
  "list_dir",
]);

// ============================================================================
// SubAgent Class
// ============================================================================

/**
 * A subagent with isolated context and restricted capabilities
 */
export class SubAgent {
  private config: SubAgentConfig;
  private toolRegistry: ToolRegistry;
  private agent: Agent | null = null;

  constructor(config: SubAgentConfig, provider: Provider) {
    this.config = config;
    this.toolRegistry = this.createRestrictedRegistry(config.toolRestrictions);
  }

  /**
   * Create a tool registry with the specified restrictions
   */
  private createRestrictedRegistry(
    restrictions?: ToolRestrictions
  ): ToolRegistry {
    const registry = new DefaultToolRegistry();

    // All available tools
    const allTools: ToolDefinition[] = [
      readFileTool,
      writeFileTool,
      editFileTool,
      listDirTool,
      bashTool,
      globTool,
      grepTool,
      webFetchTool,
    ];

    for (const tool of allTools) {
      // Check if tool is allowed
      if (restrictions?.allowOnly) {
        if (!restrictions.allowOnly.includes(tool.name)) {
          continue;
        }
      }

      if (restrictions?.block) {
        if (restrictions.block.includes(tool.name)) {
          continue;
        }
      }

      registry.register(tool);
    }

    return registry;
  }

  /**
   * Get the subagent's configuration
   */
  getConfig(): SubAgentConfig {
    return { ...this.config };
  }

  /**
   * Get available tools for this subagent
   */
  getAvailableTools(): string[] {
    return this.toolRegistry.list().map((t) => t.name);
  }

  /**
   * Run the subagent with a task
   */
  async run(
    provider: Provider,
    options: SubAgentRunOptions
  ): Promise<SubAgentResult> {
    const startTime = Date.now();

    try {
      // Build the full prompt with context
      let fullPrompt = this.config.systemPrompt;
      if (options.cwd) {
        fullPrompt += `\n\nWorking directory: ${options.cwd}`;
      }
      if (options.context) {
        fullPrompt += `\n\nContext:\n${options.context}`;
      }

      // Create a fresh agent for this run (isolated context)
      const agent = new Agent({
        provider,
        tools: this.toolRegistry,
        systemPrompt: fullPrompt,
        maxTurns: this.config.maxTurns ?? 30,
        requirePermission: this.config.permissionMode === "ask_always",
        callbacks: options.callbacks,
      });

      // Run the agent
      const response = await agent.run(options.task);
      const usage = agent.getUsage();

      return {
        success: true,
        response,
        usage,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: "",
        error: error instanceof Error ? error.message : String(error),
        usage: { inputTokens: 0, outputTokens: 0 },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

// ============================================================================
// Built-in Subagent Prompts
// ============================================================================

const EXPLORE_PROMPT = `You are an exploration agent specialized in searching and understanding codebases.

## Your Purpose
Search through code to find relevant files, understand patterns, and answer questions about the codebase structure.

## Available Tools
- read_file: Read file contents
- glob: Find files by pattern (e.g., **/*.ts, src/**/*.js)
- grep: Search for text patterns in files
- list_dir: List directory contents

## Guidelines
1. Start with broad searches, then narrow down
2. Use glob to find files by extension or name pattern
3. Use grep to search for specific code patterns
4. Read files to understand implementation details
5. Be thorough but efficient - don't read unnecessary files

## Response Format
Provide clear, structured findings:
- List relevant files discovered
- Summarize key patterns or implementations
- Answer the specific question asked

You are READ-ONLY. You cannot modify any files.`;

const EXPLORE_QUICK_ADDENDUM = `

## Speed Mode: Quick
- Make at most 3-5 tool calls
- Focus on the most likely locations first
- Return partial findings if time is limited`;

const EXPLORE_MEDIUM_ADDENDUM = `

## Speed Mode: Medium
- Make up to 10-15 tool calls
- Search multiple potential locations
- Balance thoroughness with efficiency`;

const EXPLORE_THOROUGH_ADDENDUM = `

## Speed Mode: Very Thorough
- Be extremely comprehensive
- Search all relevant directories
- Cross-reference multiple files
- Don't stop until you've explored all angles`;

const PLAN_PROMPT = `You are a planning agent specialized in analyzing codebases and designing implementation approaches.

## Your Purpose
Research the codebase and create detailed implementation plans for features, fixes, or refactors.

## Available Tools
- read_file: Read file contents
- glob: Find files by pattern
- grep: Search for text patterns
- list_dir: List directory contents

## Guidelines
1. First understand the existing architecture
2. Identify all affected files and components
3. Consider edge cases and potential issues
4. Design a step-by-step implementation approach
5. Note any dependencies or prerequisites

## Response Format
Provide a structured plan:

### Analysis
- Current state of the codebase
- Relevant existing patterns

### Implementation Steps
1. Step one...
2. Step two...

### Files to Modify/Create
- List each file with changes needed

### Considerations
- Edge cases
- Potential risks
- Testing approach

You are READ-ONLY. You cannot modify any files.`;

// ============================================================================
// Factory Functions for Built-in Agents
// ============================================================================

/**
 * Create an Explore subagent
 */
export function createExploreAgent(speed: ExploreSpeed = "medium"): SubAgentConfig {
  let speedAddendum = "";
  let maxTurns = 15;

  switch (speed) {
    case "quick":
      speedAddendum = EXPLORE_QUICK_ADDENDUM;
      maxTurns = 5;
      break;
    case "medium":
      speedAddendum = EXPLORE_MEDIUM_ADDENDUM;
      maxTurns = 15;
      break;
    case "very_thorough":
      speedAddendum = EXPLORE_THOROUGH_ADDENDUM;
      maxTurns = 50;
      break;
  }

  return {
    name: "explore",
    description: `Fast, read-only codebase search (${speed} mode)`,
    systemPrompt: EXPLORE_PROMPT + speedAddendum,
    toolRestrictions: {
      allowOnly: ["read_file", "glob", "grep", "list_dir"],
    },
    permissionMode: "auto",
    maxTurns,
    defaultExecutionMode: "foreground",
  };
}

/**
 * Create a Plan subagent
 */
export function createPlanAgent(): SubAgentConfig {
  return {
    name: "plan",
    description: "Research agent for planning implementation approaches",
    systemPrompt: PLAN_PROMPT,
    toolRestrictions: {
      allowOnly: ["read_file", "glob", "grep", "list_dir"],
    },
    permissionMode: "auto",
    maxTurns: 30,
    defaultExecutionMode: "foreground",
  };
}

// ============================================================================
// SubAgentManager
// ============================================================================

/**
 * Manages loading and running subagents
 */
export class SubAgentManager {
  private agents: Map<string, SubAgentConfig> = new Map();
  private backgroundTasks: Map<string, BackgroundTask> = new Map();
  private taskIdCounter = 0;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.loadBuiltinAgents();
  }

  /**
   * Load the built-in agents
   */
  private loadBuiltinAgents(): void {
    // Register explore agents with different speeds
    this.agents.set("explore", createExploreAgent("medium"));
    this.agents.set("explore:quick", createExploreAgent("quick"));
    this.agents.set("explore:medium", createExploreAgent("medium"));
    this.agents.set("explore:thorough", createExploreAgent("very_thorough"));

    // Register plan agent
    this.agents.set("plan", createPlanAgent());
  }

  /**
   * Load custom agents from a directory
   */
  async loadAgentsFromDirectory(directory: string): Promise<void> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const agentDir = path.join(directory, entry.name);
          const agentFile = path.join(agentDir, "AGENT.md");

          try {
            const content = await fs.readFile(agentFile, "utf-8");
            const config = this.parseAgentMd(entry.name, content);
            if (config) {
              this.agents.set(config.name, config);
            }
          } catch {
            // AGENT.md doesn't exist or can't be read, skip
          }
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  /**
   * Load agents from user home directory (~/.kaldi/agents/)
   */
  async loadUserAgents(): Promise<void> {
    const userAgentsDir = path.join(os.homedir(), ".kaldi", "agents");
    await this.loadAgentsFromDirectory(userAgentsDir);
  }

  /**
   * Load agents from project directory (.kaldi/agents/)
   */
  async loadProjectAgents(): Promise<void> {
    const projectAgentsDir = path.join(this.cwd, ".kaldi", "agents");
    await this.loadAgentsFromDirectory(projectAgentsDir);
  }

  /**
   * Load all custom agents (user + project)
   */
  async loadAllCustomAgents(): Promise<void> {
    await this.loadUserAgents();
    await this.loadProjectAgents();
  }

  /**
   * Parse an AGENT.md file into a SubAgentConfig
   */
  private parseAgentMd(name: string, content: string): SubAgentConfig | null {
    const config: SubAgentConfig = {
      name,
      description: "",
      systemPrompt: "",
    };

    // Extract frontmatter (YAML between ---)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];

      // Parse simple YAML-like frontmatter
      const lines = frontmatter.split("\n");
      for (const line of lines) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();

        switch (key.trim()) {
          case "name":
            config.name = value || name;
            break;
          case "description":
            config.description = value;
            break;
          case "model":
            config.model = value;
            break;
          case "provider":
            config.providerType = value as ProviderType;
            break;
          case "maxTurns":
            config.maxTurns = parseInt(value, 10);
            break;
          case "permissionMode":
            config.permissionMode = value as PermissionMode;
            break;
          case "allowTools":
            config.toolRestrictions = config.toolRestrictions || {};
            config.toolRestrictions.allowOnly = value
              .split(",")
              .map((t) => t.trim());
            break;
          case "blockTools":
            config.toolRestrictions = config.toolRestrictions || {};
            config.toolRestrictions.block = value
              .split(",")
              .map((t) => t.trim());
            break;
          case "executionMode":
            config.defaultExecutionMode = value as ExecutionMode;
            break;
        }
      }

      // Rest of content is the system prompt
      config.systemPrompt = content.slice(frontmatterMatch[0].length).trim();
    } else {
      // No frontmatter, entire content is the system prompt
      config.systemPrompt = content.trim();
      config.description = `Custom agent: ${name}`;
    }

    return config;
  }

  /**
   * Get a subagent configuration by name
   */
  get(name: string): SubAgentConfig | undefined {
    return this.agents.get(name);
  }

  /**
   * List all available subagents
   */
  list(): SubAgentConfig[] {
    return Array.from(this.agents.values());
  }

  /**
   * List agent names
   */
  listNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Register a custom subagent config
   */
  register(config: SubAgentConfig): void {
    this.agents.set(config.name, config);
  }

  /**
   * Create and run a subagent
   */
  async runAgent(
    name: string,
    provider: Provider,
    options: SubAgentRunOptions
  ): Promise<SubAgentResult> {
    const config = this.agents.get(name);
    if (!config) {
      return {
        success: false,
        response: "",
        error: `Unknown subagent: ${name}`,
        usage: { inputTokens: 0, outputTokens: 0 },
        executionTimeMs: 0,
      };
    }

    const subagent = new SubAgent(config, provider);
    const effectiveOptions = {
      ...options,
      cwd: options.cwd ?? this.cwd,
    };

    const executionMode =
      options.executionMode ?? config.defaultExecutionMode ?? "foreground";

    if (executionMode === "background") {
      return this.runInBackground(name, subagent, provider, effectiveOptions);
    }

    return subagent.run(provider, effectiveOptions);
  }

  /**
   * Run a subagent in the background
   */
  private runInBackground(
    name: string,
    subagent: SubAgent,
    provider: Provider,
    options: SubAgentRunOptions
  ): SubAgentResult {
    const taskId = `task_${++this.taskIdCounter}`;

    const promise = subagent.run(provider, options).then((result) => {
      const task = this.backgroundTasks.get(taskId);
      if (task) {
        task.isComplete = true;
        task.result = result;
      }
      return result;
    });

    const task: BackgroundTask = {
      id: taskId,
      agentName: name,
      task: options.task,
      promise,
      startedAt: new Date(),
      isComplete: false,
    };

    this.backgroundTasks.set(taskId, task);

    // Return immediately with a pending result
    return {
      success: true,
      response: `Background task started: ${taskId}`,
      usage: { inputTokens: 0, outputTokens: 0 },
      executionTimeMs: 0,
    };
  }

  /**
   * Get a background task by ID
   */
  getBackgroundTask(taskId: string): BackgroundTask | undefined {
    return this.backgroundTasks.get(taskId);
  }

  /**
   * Wait for a background task to complete
   */
  async waitForTask(taskId: string): Promise<SubAgentResult | undefined> {
    const task = this.backgroundTasks.get(taskId);
    if (!task) {
      return undefined;
    }
    return task.promise;
  }

  /**
   * List all background tasks
   */
  listBackgroundTasks(): BackgroundTask[] {
    return Array.from(this.backgroundTasks.values());
  }

  /**
   * Clean up completed background tasks
   */
  cleanupCompletedTasks(): void {
    for (const [id, task] of this.backgroundTasks) {
      if (task.isComplete) {
        this.backgroundTasks.delete(id);
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _subAgentManager: SubAgentManager | null = null;

/**
 * Get or create the singleton SubAgentManager instance
 */
export function getSubAgentManager(cwd?: string): SubAgentManager {
  if (!_subAgentManager) {
    _subAgentManager = new SubAgentManager(cwd);
  }
  return _subAgentManager;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetSubAgentManager(): void {
  _subAgentManager = null;
}

/**
 * Default singleton export
 */
export const subAgentManager = {
  get instance(): SubAgentManager {
    return getSubAgentManager();
  },
};

// ============================================================================
// Task Tool Integration
// ============================================================================

/**
 * Create a tool definition for spawning subagents
 * This can be registered with the main agent's tool registry
 */
export function createTaskTool(
  manager: SubAgentManager,
  provider: Provider
): ToolDefinition {
  return {
    name: "task",
    description: `Spawn a subagent to perform a specialized task. Available agents: ${manager
      .listNames()
      .join(", ")}. Use 'explore' for fast codebase search, 'plan' for implementation planning.`,
    parameters: {
      agent: {
        type: "string" as const,
        description: `Name of the subagent to spawn (${manager.listNames().join(", ")})`,
        required: true,
      },
      task: {
        type: "string" as const,
        description: "The task or query to send to the subagent",
        required: true,
      },
      background: {
        type: "boolean" as const,
        description: "Run in background (default: false)",
        required: false,
      },
      context: {
        type: "string" as const,
        description: "Additional context to provide to the subagent",
        required: false,
      },
    },
    execute: async (args: Record<string, unknown>) => {
      const agentName = args.agent as string;
      const task = args.task as string;
      const background = args.background as boolean | undefined;
      const context = args.context as string | undefined;

      if (!agentName || !task) {
        return {
          success: false,
          output: "",
          error: "Both 'agent' and 'task' parameters are required",
        };
      }

      const result = await manager.runAgent(agentName, provider, {
        task,
        context,
        executionMode: background ? "background" : "foreground",
      });

      if (result.success) {
        return {
          success: true,
          output: result.response,
        };
      } else {
        return {
          success: false,
          output: "",
          error: result.error || "Subagent execution failed",
        };
      }
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ToolDefinition,
  ToolRegistry,
};
