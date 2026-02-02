/**
 * Dynamic UI Types
 */

export interface TerminalSize {
  columns: number;
  rows: number;
}

export interface WelcomeConfig {
  userName?: string;
  provider: string;
  model: string;
  workingDir: string;
  version: string;
  recentActivity?: RecentActivity[];
}

export interface RecentActivity {
  description: string;
  timestamp: Date;
}

export interface StatusBarConfig {
  inputTokens: number;
  outputTokens: number;
  version: string;
  mode?: "safe" | "auto" | "plan";
}

export interface ThinkingState {
  isThinking: boolean;
  text?: string;
}

export interface ToolState {
  name: string;
  args?: Record<string, unknown>;
  startTime: number;
  status: "running" | "success" | "error";
  result?: string;
  error?: string;
}
