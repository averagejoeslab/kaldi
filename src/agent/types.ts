/**
 * Agent Types
 */

import type { Provider, Message, ContentBlock } from "../providers/types.js";
import type { ToolRegistry } from "../tools/types.js";

export interface AgentCallbacks {
  onText?: (text: string) => void;
  onThinking?: (thinking: string) => void;
  onToolUse?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  onPermissionRequest?: (request: PermissionRequest) => Promise<boolean>;
  onTurnStart?: (turn: number) => void;
  onTurnComplete?: (turn: number) => void;
  onUsage?: (inputTokens: number, outputTokens: number) => void;
  onError?: (error: Error) => void;
}

export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

export interface AgentConfig {
  provider: Provider;
  tools: ToolRegistry;
  systemPrompt: string;
  maxTurns?: number;
  requirePermission?: boolean;
  callbacks?: AgentCallbacks;
}

export interface AgentState {
  messages: Message[];
  isRunning: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  currentTurn: number;
}

export interface AgentResult {
  response: string;
  messages: Message[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  turns: number;
}
