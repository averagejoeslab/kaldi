import type { Provider, Message, ToolCall, StreamChunk } from "../providers/types.js";
import type { ToolRegistry } from "../tools/types.js";
import { toolsToProviderFormat, DefaultToolRegistry } from "../tools/index.js";

export interface AgentConfig {
  provider: Provider;
  tools: ToolRegistry;
  systemPrompt: string;
  maxTurns?: number;
  onText?: (text: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  onTurnComplete?: () => void;
}

export interface AgentSession {
  messages: Message[];
  isRunning: boolean;
}

export class Agent {
  private config: AgentConfig;
  private session: AgentSession;

  constructor(config: AgentConfig) {
    this.config = config;
    this.session = {
      messages: [],
      isRunning: false,
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

      let assistantContent = "";
      let pendingToolCalls: ToolCall[] = [];
      let currentToolCall: ToolCall | null = null;
      let toolArgumentsJson = "";

      // Stream the response
      for await (const chunk of this.config.provider.stream({
        messages: this.session.messages,
        tools,
        systemPrompt: this.config.systemPrompt,
      })) {
        if (chunk.type === "text" && chunk.content) {
          // Check if we're collecting tool arguments
          if (currentToolCall) {
            toolArgumentsJson += chunk.content;
          } else {
            assistantContent += chunk.content;
            this.config.onText?.(chunk.content);
          }
        } else if (chunk.type === "tool_call" && chunk.toolCall) {
          // Start of a new tool call
          if (currentToolCall && toolArgumentsJson) {
            // Finalize previous tool call
            try {
              currentToolCall.arguments = JSON.parse(toolArgumentsJson);
            } catch {
              currentToolCall.arguments = {};
            }
            pendingToolCalls.push(currentToolCall);
          }
          currentToolCall = chunk.toolCall;
          toolArgumentsJson = "";
        } else if (chunk.type === "done") {
          // Finalize any pending tool call
          if (currentToolCall) {
            try {
              if (toolArgumentsJson) {
                currentToolCall.arguments = JSON.parse(toolArgumentsJson);
              }
            } catch {
              // Arguments already set or empty
            }
            pendingToolCalls.push(currentToolCall);
          }
          break;
        } else if (chunk.type === "error") {
          throw new Error(chunk.error);
        }
      }

      // Add assistant message
      this.session.messages.push({ role: "assistant", content: assistantContent });
      finalResponse = assistantContent;

      // If no tool calls, we're done
      if (pendingToolCalls.length === 0) {
        this.config.onTurnComplete?.();
        break;
      }

      // Execute tool calls
      const toolResults: string[] = [];

      for (const toolCall of pendingToolCalls) {
        this.config.onToolCall?.(toolCall.name, toolCall.arguments);

        const result = await this.config.tools.execute(
          toolCall.name,
          toolCall.arguments
        );

        this.config.onToolResult?.(toolCall.name, result.output, !result.success);

        toolResults.push(
          `Tool: ${toolCall.name}\n` +
            (result.success
              ? `Result:\n${result.output}`
              : `Error: ${result.error}`)
        );
      }

      // Add tool results as user message for next turn
      this.session.messages.push({
        role: "user",
        content: `Tool results:\n\n${toolResults.join("\n\n")}`,
      });

      this.config.onTurnComplete?.();
      pendingToolCalls = [];
    }

    this.session.isRunning = false;
    return finalResponse;
  }

  stop(): void {
    this.session.isRunning = false;
  }

  getMessages(): Message[] {
    return [...this.session.messages];
  }

  clearHistory(): void {
    this.session.messages = [];
  }
}
