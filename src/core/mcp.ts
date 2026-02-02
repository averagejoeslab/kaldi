/**
 * MCP (Model Context Protocol) Server Support
 *
 * Allows connecting to external MCP servers for extended tool capabilities.
 * MCP is an open protocol for providing context and tools to LLMs.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  description?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  server: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  server: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  server: string;
}

export interface MCPMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPServerState {
  config: MCPServerConfig;
  process: ChildProcess | null;
  connected: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  error?: string;
}

// ============================================================================
// MCP CLIENT
// ============================================================================

export class MCPClient extends EventEmitter {
  private servers: Map<string, MCPServerState> = new Map();
  private messageId = 0;
  private pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor() {
    super();
  }

  /**
   * Connect to an MCP server
   */
  async connect(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.name)) {
      throw new Error(`Server ${config.name} is already connected`);
    }

    const state: MCPServerState = {
      config,
      process: null,
      connected: false,
      tools: [],
      resources: [],
      prompts: [],
    };

    this.servers.set(config.name, state);

    try {
      // Spawn the server process
      const proc = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      state.process = proc;

      // Handle stdout (JSON-RPC messages)
      let buffer = "";
      proc.stdout?.on("data", (data: Buffer) => {
        buffer += data.toString();

        // Process complete messages (newline-delimited JSON)
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line) as MCPMessage;
              this.handleMessage(config.name, message);
            } catch {
              // Ignore malformed messages
            }
          }
        }
      });

      // Handle stderr (errors/logs)
      proc.stderr?.on("data", (data: Buffer) => {
        this.emit("serverLog", config.name, data.toString());
      });

      // Handle process exit
      proc.on("exit", (code) => {
        state.connected = false;
        state.process = null;
        this.emit("serverDisconnected", config.name, code);
      });

      proc.on("error", (error) => {
        state.error = error.message;
        state.connected = false;
        this.emit("serverError", config.name, error);
      });

      // Initialize the connection
      await this.initialize(config.name);

      // Discover capabilities
      await this.discoverCapabilities(config.name);

      state.connected = true;
      this.emit("serverConnected", config.name);
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      this.servers.delete(config.name);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(name: string): Promise<void> {
    const state = this.servers.get(name);
    if (!state) return;

    if (state.process) {
      state.process.kill();
    }

    this.servers.delete(name);
    this.emit("serverDisconnected", name, 0);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const names = Array.from(this.servers.keys());
    await Promise.all(names.map(name => this.disconnect(name)));
  }

  /**
   * Send a JSON-RPC request to a server
   */
  private async sendRequest(serverName: string, method: string, params?: unknown): Promise<unknown> {
    const state = this.servers.get(serverName);
    if (!state || !state.process) {
      throw new Error(`Server ${serverName} is not connected`);
    }

    const id = ++this.messageId;
    const message: MCPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const json = JSON.stringify(message) + "\n";
      state.process!.stdin?.write(json);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Handle incoming JSON-RPC message
   */
  private handleMessage(serverName: string, message: MCPMessage): void {
    if (message.id !== undefined) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // Notification from server
      this.emit("notification", serverName, message.method, message.params);
    }
  }

  /**
   * Initialize connection with server
   */
  private async initialize(serverName: string): Promise<void> {
    await this.sendRequest(serverName, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: "kaldi",
        version: "0.3.0",
      },
    });

    // Send initialized notification
    const state = this.servers.get(serverName);
    if (state?.process) {
      const notification: MCPMessage = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      };
      state.process.stdin?.write(JSON.stringify(notification) + "\n");
    }
  }

  /**
   * Discover server capabilities (tools, resources, prompts)
   */
  private async discoverCapabilities(serverName: string): Promise<void> {
    const state = this.servers.get(serverName);
    if (!state) return;

    // List tools
    try {
      const toolsResult = await this.sendRequest(serverName, "tools/list") as { tools: MCPTool[] };
      state.tools = (toolsResult.tools || []).map(t => ({ ...t, server: serverName }));
    } catch {
      // Server may not support tools
    }

    // List resources
    try {
      const resourcesResult = await this.sendRequest(serverName, "resources/list") as { resources: MCPResource[] };
      state.resources = (resourcesResult.resources || []).map(r => ({ ...r, server: serverName }));
    } catch {
      // Server may not support resources
    }

    // List prompts
    try {
      const promptsResult = await this.sendRequest(serverName, "prompts/list") as { prompts: MCPPrompt[] };
      state.prompts = (promptsResult.prompts || []).map(p => ({ ...p, server: serverName }));
    } catch {
      // Server may not support prompts
    }
  }

  /**
   * Call a tool on a server
   */
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest(serverName, "tools/call", {
      name: toolName,
      arguments: args,
    });
  }

  /**
   * Read a resource from a server
   */
  async readResource(serverName: string, uri: string): Promise<unknown> {
    return this.sendRequest(serverName, "resources/read", { uri });
  }

  /**
   * Get a prompt from a server
   */
  async getPrompt(serverName: string, promptName: string, args?: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest(serverName, "prompts/get", {
      name: promptName,
      arguments: args,
    });
  }

  /**
   * Get all connected servers
   */
  getServers(): MCPServerState[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get all available tools across all servers
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const state of this.servers.values()) {
      tools.push(...state.tools);
    }
    return tools;
  }

  /**
   * Get all available resources across all servers
   */
  getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];
    for (const state of this.servers.values()) {
      resources.push(...state.resources);
    }
    return resources;
  }

  /**
   * Check if a server is connected
   */
  isConnected(name: string): boolean {
    return this.servers.get(name)?.connected ?? false;
  }
}

// ============================================================================
// MCP CONFIG
// ============================================================================

const MCP_CONFIG_PATH = join(homedir(), ".kaldi", "mcp.json");

export interface MCPConfig {
  servers: MCPServerConfig[];
}

/**
 * Load MCP configuration
 */
export function loadMCPConfig(): MCPConfig {
  if (!existsSync(MCP_CONFIG_PATH)) {
    return { servers: [] };
  }

  try {
    const content = readFileSync(MCP_CONFIG_PATH, "utf-8");
    return JSON.parse(content) as MCPConfig;
  } catch {
    return { servers: [] };
  }
}

/**
 * Save MCP configuration
 */
export function saveMCPConfig(config: MCPConfig): void {
  writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Add a server to the configuration
 */
export function addMCPServer(server: MCPServerConfig): void {
  const config = loadMCPConfig();
  const existing = config.servers.findIndex(s => s.name === server.name);

  if (existing >= 0) {
    config.servers[existing] = server;
  } else {
    config.servers.push(server);
  }

  saveMCPConfig(config);
}

/**
 * Remove a server from the configuration
 */
export function removeMCPServer(name: string): void {
  const config = loadMCPConfig();
  config.servers = config.servers.filter(s => s.name !== name);
  saveMCPConfig(config);
}

// ============================================================================
// MCP MANAGER (Singleton)
// ============================================================================

let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}

export function resetMCPClient(): void {
  if (mcpClientInstance) {
    mcpClientInstance.disconnectAll();
    mcpClientInstance = null;
  }
}

/**
 * Initialize MCP servers from config
 */
export async function initializeMCPServers(): Promise<void> {
  const config = loadMCPConfig();
  const client = getMCPClient();

  for (const server of config.servers) {
    if (server.enabled !== false) {
      try {
        await client.connect(server);
      } catch (error) {
        console.error(chalk.dim(`  Failed to connect to MCP server ${server.name}: ${error}`));
      }
    }
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatMCPStatus(): string {
  const client = getMCPClient();
  const servers = client.getServers();
  const lines: string[] = [];

  const accent = chalk.hex("#C9A66B");
  const dim = chalk.dim;
  const success = chalk.hex("#7CB342");
  const error = chalk.hex("#E57373");

  lines.push(accent("  MCP Servers"));
  lines.push("");

  if (servers.length === 0) {
    lines.push(dim("  No MCP servers configured"));
    lines.push(dim("  Run /mcp add <name> <command> to add one"));
  } else {
    for (const server of servers) {
      const icon = server.connected ? success("●") : error("○");
      const status = server.connected ? success("connected") : error(server.error || "disconnected");
      lines.push(`  ${icon} ${server.config.name.padEnd(15)} ${status}`);

      if (server.connected) {
        if (server.tools.length > 0) {
          lines.push(dim(`      ${server.tools.length} tools`));
        }
        if (server.resources.length > 0) {
          lines.push(dim(`      ${server.resources.length} resources`));
        }
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MCPClient };
