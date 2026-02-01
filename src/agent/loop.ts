import type {
  Provider,
  Message,
  ContentBlock,
  ToolUseContent,
  ToolResultContent,
} from "../providers/types.js";
import type { ToolRegistry, ToolExecutionResult } from "../tools/types.js";
import { toolsToProviderFormat, DefaultToolRegistry } from "../tools/index.js";

export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

export interface AgentCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  onPermissionRequest?: (request: PermissionRequest) => Promise<boolean>;
  onTurnStart?: (turn: number) => void;
  onTurnComplete?: (turn: number) => void;
  onUsage?: (inputTokens: number, outputTokens: number) => void;
}

export interface AgentConfig {
  provider: Provider;
  tools: ToolRegistry;
  systemPrompt: string;
  maxTurns?: number;
  requirePermission?: boolean;
  callbacks?: AgentCallbacks;
}

export interface AgentSession {
  messages: Message[];
  isRunning: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// Tools that are safe to run without permission
const SAFE_TOOLS = new Set(["read_file", "glob", "grep"]);

export class Agent {
  private config: AgentConfig;
  private session: AgentSession;

  constructor(config: AgentConfig) {
    this.config = config;
    this.session = {
      messages: [],
      isRunning: false,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  async run(userMessage: string): Promise<string> {
    this.session.isRunning = true;
    this.session.messages.push({ role: "user", content: userMessage });

    const tools = toolsToProviderFormat(this.config.tools as DefaultToolRegistry);
    let turns = 0;
    const maxTurns = this.config.maxTurns ?? 50;
    let finalResponse = "";

    while (turns < maxTurns && this.session.isRunning) {
      turns++;
      this.config.callbacks?.onTurnStart?.(turns);

      // Get completion from provider
      const response = await this.config.provider.complete(
        {
          messages: this.session.messages,
          tools,
          systemPrompt: this.config.systemPrompt,
        },
        {
          onText: this.config.callbacks?.onText,
          onToolUse: (tool) => {
            this.config.callbacks?.onToolUse?.(tool.name, tool.input);
          },
        }
      );

      // Track usage
      if (response.usage) {
        this.session.totalInputTokens += response.usage.inputTokens;
        this.session.totalOutputTokens += response.usage.outputTokens;
        this.config.callbacks?.onUsage?.(
          response.usage.inputTokens,
          response.usage.outputTokens
        );
      }

      // Add assistant response to messages
      this.session.messages.push({
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

      const toolResults: ToolResultContent[] = [];

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
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: "Permission denied by user",
              is_error: true,
            });
            continue;
          }
        }

        // Execute the tool
        const result = await this.config.tools.execute(toolUse.name, toolUse.input);

        this.config.callbacks?.onToolResult?.(
          toolUse.name,
          result.output || result.error || "",
          !result.success
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.success
            ? result.output
            : `Error: ${result.error}`,
          is_error: !result.success,
        });
      }

      // Add tool results to messages
      this.session.messages.push({
        role: "user",
        content: toolResults,
      });

      this.config.callbacks?.onTurnComplete?.(turns);
    }

    this.session.isRunning = false;
    return finalResponse;
  }

  private describeToolCall(name: string, args: Record<string, unknown>): string {
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

  stop(): void {
    this.session.isRunning = false;
  }

  getMessages(): Message[] {
    return [...this.session.messages];
  }

  getUsage(): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: this.session.totalInputTokens,
      outputTokens: this.session.totalOutputTokens,
    };
  }

  clearHistory(): void {
    this.session.messages = [];
    this.session.totalInputTokens = 0;
    this.session.totalOutputTokens = 0;
  }
}
