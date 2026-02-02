/**
 * MCP Client
 *
 * Client for communicating with MCP servers via stdio.
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPRequest,
  MCPResponse,
  MCPToolCallRequest,
  MCPToolCallResult,
  MCPResourceReadResult,
  MCPPromptGetResult,
} from "./types.js";

/**
 * MCP Client for a single server
 */
export class MCPClient extends EventEmitter {
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private status: MCPServerStatus = "disconnected";
  private error: string | null = null;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];
  private requestId = 0;
  private pendingRequests = new Map<
    string | number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private buffer = "";

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.status === "connected" || this.status === "connecting") {
      return;
    }

    this.status = "connecting";
    this.emit("status", this.status);

    try {
      this.process = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        this.emit("stderr", data.toString());
      });

      this.process.on("close", (code) => {
        this.status = "disconnected";
        this.emit("status", this.status);
        this.emit("close", code);
        this.rejectPendingRequests(new Error(`Server closed with code ${code}`));
      });

      this.process.on("error", (err) => {
        this.status = "error";
        this.error = err.message;
        this.emit("status", this.status);
        this.emit("error", err);
        this.rejectPendingRequests(err);
      });

      // Initialize the connection
      await this.initialize();

      this.status = "connected";
      this.emit("status", this.status);
    } catch (err) {
      this.status = "error";
      this.error = err instanceof Error ? err.message : String(err);
      this.emit("status", this.status);
      throw err;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.status = "disconnected";
    this.emit("status", this.status);
    this.rejectPendingRequests(new Error("Client disconnected"));
  }

  /**
   * Get server name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get current status
   */
  getStatus(): MCPServerStatus {
    return this.status;
  }

  /**
   * Get error message
   */
  getError(): string | null {
    return this.error;
  }

  /**
   * Get available tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Get available resources
   */
  getResources(): MCPResource[] {
    return this.resources;
  }

  /**
   * Get available prompts
   */
  getPrompts(): MCPPrompt[] {
    return this.prompts;
  }

  /**
   * Call a tool
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResult> {
    const result = await this.sendRequest("tools/call", {
      name: request.name,
      arguments: request.arguments,
    });

    return result as MCPToolCallResult;
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<MCPResourceReadResult> {
    const result = await this.sendRequest("resources/read", { uri });
    return result as MCPResourceReadResult;
  }

  /**
   * Get a prompt
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>
  ): Promise<MCPPromptGetResult> {
    const result = await this.sendRequest("prompts/get", {
      name,
      arguments: args,
    });
    return result as MCPPromptGetResult;
  }

  /**
   * Initialize the connection
   */
  private async initialize(): Promise<void> {
    // Send initialize request
    const initResult = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: "kaldi",
        version: "1.0.0",
      },
    });

    // Send initialized notification
    this.sendNotification("notifications/initialized", {});

    // List tools
    const toolsResult = (await this.sendRequest("tools/list", {})) as {
      tools: Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }>;
    };

    this.tools = (toolsResult.tools || []).map((t) => ({
      ...t,
      serverName: this.config.name,
    }));

    // List resources
    try {
      const resourcesResult = (await this.sendRequest("resources/list", {})) as {
        resources: Array<{
          uri: string;
          name: string;
          description?: string;
          mimeType?: string;
        }>;
      };

      this.resources = (resourcesResult.resources || []).map((r) => ({
        ...r,
        serverName: this.config.name,
      }));
    } catch {
      // Resources may not be supported
      this.resources = [];
    }

    // List prompts
    try {
      const promptsResult = (await this.sendRequest("prompts/list", {})) as {
        prompts: Array<{
          name: string;
          description?: string;
          arguments?: Array<{
            name: string;
            description?: string;
            required?: boolean;
          }>;
        }>;
      };

      this.prompts = (promptsResult.prompts || []).map((p) => ({
        ...p,
        serverName: this.config.name,
      }));
    } catch {
      // Prompts may not be supported
      this.prompts = [];
    }
  }

  /**
   * Handle incoming data from server
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Process complete messages (newline-delimited JSON)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as MCPResponse;

        if ("id" in message && message.id !== undefined) {
          // This is a response
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            this.pendingRequests.delete(message.id);
            if (message.error) {
              pending.reject(new Error(message.error.message));
            } else {
              pending.resolve(message.result);
            }
          }
        } else {
          // This is a notification
          this.emit("notification", message);
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
  }

  /**
   * Send a request and wait for response
   */
  private sendRequest(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error("Not connected"));
        return;
      }

      const id = ++this.requestId;
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      this.process.stdin.write(JSON.stringify(request) + "\n");

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  private sendNotification(
    method: string,
    params: Record<string, unknown>
  ): void {
    if (!this.process?.stdin) {
      return;
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    this.process.stdin.write(JSON.stringify(notification) + "\n");
  }

  /**
   * Reject all pending requests
   */
  private rejectPendingRequests(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
