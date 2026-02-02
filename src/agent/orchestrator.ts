/**
 * Agent Orchestrator
 *
 * Core agentic loop - handles conversation, tool execution, and streaming.
 */

import type {
  Provider,
  Message,
  ContentBlock,
  ToolUseContent,
  ToolResultContent,
} from "../providers/types.js";
import type { ToolRegistry, ToolContext } from "../tools/types.js";
import { toolToProviderFormat } from "../tools/types.js";
import type {
  AgentConfig,
  AgentState,
  AgentResult,
  AgentCallbacks,
  PermissionRequest,
} from "./types.js";

// Tools that are safe to run without permission
const SAFE_TOOLS = new Set([
  "read_file",
  "glob",
  "grep",
  "list_dir",
  "web_fetch",
]);

export class AgentOrchestrator {
  private config: AgentConfig;
  private state: AgentState;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      messages: [],
      isRunning: false,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      currentTurn: 0,
    };
  }

  /**
   * Run the agent with user input
   */
  async run(userMessage: string | ContentBlock[]): Promise<AgentResult> {
    this.state.isRunning = true;
    this.state.messages.push({ role: "user", content: userMessage });

    const tools = this.config.tools
      .list()
      .map((t) => toolToProviderFormat(t));

    let turns = 0;
    const maxTurns = this.config.maxTurns ?? 50;
    let finalResponse = "";

    try {
      while (turns < maxTurns && this.state.isRunning) {
        turns++;
        this.state.currentTurn = turns;
        this.config.callbacks?.onTurnStart?.(turns);

        // Get completion from provider
        const response = await this.config.provider.complete(
          {
            messages: this.state.messages,
            tools,
            systemPrompt: this.config.systemPrompt,
          },
          {
            onText: this.config.callbacks?.onText,
            onThinking: this.config.callbacks?.onThinking,
            onToolUse: (tool) => {
              this.config.callbacks?.onToolUse?.(tool.name, tool.input);
            },
            onError: this.config.callbacks?.onError,
          }
        );

        // Track usage
        if (response.usage) {
          this.state.totalInputTokens += response.usage.inputTokens;
          this.state.totalOutputTokens += response.usage.outputTokens;
          this.config.callbacks?.onUsage?.(
            response.usage.inputTokens,
            response.usage.outputTokens
          );
        }

        // Add assistant response to messages
        this.state.messages.push({
          role: "assistant",
          content: response.content,
        });

        // Extract text for final response
        const textBlocks = response.content.filter(
          (b): b is { type: "text"; text: string } => b.type === "text"
        );
        if (textBlocks.length > 0) {
          finalResponse = textBlocks.map((b) => b.text).join("");
        }

        // Check if we need to execute tools
        if (response.stopReason !== "tool_use") {
          this.config.callbacks?.onTurnComplete?.(turns);
          break;
        }

        // Execute tool calls
        const toolUses = response.content.filter(
          (b): b is ToolUseContent => b.type === "tool_use"
        );

        const toolResults = await this.executeTools(toolUses);

        // Add tool results to messages
        this.state.messages.push({
          role: "user",
          content: toolResults,
        });

        this.config.callbacks?.onTurnComplete?.(turns);
      }
    } catch (error) {
      this.config.callbacks?.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    } finally {
      this.state.isRunning = false;
    }

    return {
      response: finalResponse,
      messages: [...this.state.messages],
      usage: {
        inputTokens: this.state.totalInputTokens,
        outputTokens: this.state.totalOutputTokens,
      },
      turns,
    };
  }

  /**
   * Execute tool calls with permission checks
   */
  private async executeTools(
    toolUses: ToolUseContent[]
  ): Promise<ToolResultContent[]> {
    const results: ToolResultContent[] = [];
    const context: ToolContext = {
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    };

    for (const toolUse of toolUses) {
      // Check permission if required
      if (this.config.requirePermission && !SAFE_TOOLS.has(toolUse.name)) {
        const description = this.describeToolCall(toolUse.name, toolUse.input);
        const permitted = await this.config.callbacks?.onPermissionRequest?.({
          tool: toolUse.name,
          args: toolUse.input,
          description,
        });

        if (!permitted) {
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: "Permission denied by user",
            is_error: true,
          });
          continue;
        }
      }

      // Execute the tool
      const result = await this.config.tools.execute(
        toolUse.name,
        toolUse.input,
        context
      );

      this.config.callbacks?.onToolResult?.(
        toolUse.name,
        result.output || result.error || "",
        !result.success
      );

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result.success ? result.output : `Error: ${result.error}`,
        is_error: !result.success,
      });
    }

    return results;
  }

  /**
   * Describe a tool call for permission prompts
   */
  private describeToolCall(
    name: string,
    args: Record<string, unknown>
  ): string {
    switch (name) {
      case "bash":
        return `Run command: ${args.command}`;
      case "write_file":
        return `Write file: ${args.path}`;
      case "edit_file":
        return `Edit file: ${args.path}`;
      default:
        return `${name}: ${JSON.stringify(args).slice(0, 100)}`;
    }
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.state.isRunning = false;
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Get current messages
   */
  getMessages(): Message[] {
    return [...this.state.messages];
  }

  /**
   * Set messages (for session restore)
   */
  setMessages(messages: Message[]): void {
    this.state.messages = [...messages];
  }

  /**
   * Get usage stats
   */
  getUsage(): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: this.state.totalInputTokens,
      outputTokens: this.state.totalOutputTokens,
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.state.messages = [];
    this.state.totalInputTokens = 0;
    this.state.totalOutputTokens = 0;
    this.state.currentTurn = 0;
  }

  /**
   * Get current turn number
   */
  getCurrentTurn(): number {
    return this.state.currentTurn;
  }
}

/**
 * Create an agent with default configuration
 */
export function createAgent(config: AgentConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}
