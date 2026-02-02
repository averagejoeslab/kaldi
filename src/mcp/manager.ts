/**
 * MCP Manager
 *
 * Manages multiple MCP server connections.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { MCPClient } from "./client.js";
import type {
  MCPServerConfig,
  MCPServerState,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCallRequest,
  MCPToolCallResult,
} from "./types.js";

/**
 * MCP configuration file structure
 */
interface MCPConfig {
  servers: MCPServerConfig[];
}

/**
 * MCP Manager - handles multiple MCP server connections
 */
export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath || join(homedir(), ".kaldi", "mcp.json");
  }

  /**
   * Load MCP configuration from disk
   */
  loadConfig(): MCPConfig {
    if (!existsSync(this.configPath)) {
      return { servers: [] };
    }

    try {
      const content = readFileSync(this.configPath, "utf-8");
      return JSON.parse(content) as MCPConfig;
    } catch {
      return { servers: [] };
    }
  }

  /**
   * Save MCP configuration to disk
   */
  saveConfig(config: MCPConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Add a new server configuration
   */
  addServer(config: MCPServerConfig): void {
    const mcpConfig = this.loadConfig();

    // Remove existing server with same name
    mcpConfig.servers = mcpConfig.servers.filter(
      (s) => s.name !== config.name
    );

    // Add new server
    mcpConfig.servers.push(config);

    this.saveConfig(mcpConfig);
  }

  /**
   * Remove a server configuration
   */
  removeServer(name: string): void {
    const mcpConfig = this.loadConfig();
    mcpConfig.servers = mcpConfig.servers.filter((s) => s.name !== name);
    this.saveConfig(mcpConfig);

    // Disconnect if connected
    this.disconnect(name);
  }

  /**
   * Connect to a server
   */
  async connect(name: string): Promise<void> {
    // Check if already connected
    if (this.clients.has(name)) {
      return;
    }

    // Find server config
    const config = this.loadConfig();
    const serverConfig = config.servers.find((s) => s.name === name);

    if (!serverConfig) {
      throw new Error(`Server not found: ${name}`);
    }

    if (serverConfig.enabled === false) {
      throw new Error(`Server is disabled: ${name}`);
    }

    // Create and connect client
    const client = new MCPClient(serverConfig);
    await client.connect();

    this.clients.set(name, client);
  }

  /**
   * Disconnect from a server
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  /**
   * Connect to all enabled servers
   */
  async connectAll(): Promise<void> {
    const config = this.loadConfig();

    const promises = config.servers
      .filter((s) => s.enabled !== false)
      .map(async (s) => {
        try {
          await this.connect(s.name);
        } catch (err) {
          // Log error but don't fail
          console.error(`Failed to connect to MCP server ${s.name}:`, err);
        }
      });

    await Promise.all(promises);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.keys()).map((name) =>
      this.disconnect(name)
    );
    await Promise.all(promises);
  }

  /**
   * Get all server states
   */
  getServerStates(): MCPServerState[] {
    const config = this.loadConfig();

    return config.servers.map((serverConfig) => {
      const client = this.clients.get(serverConfig.name);

      return {
        config: serverConfig,
        status: client?.getStatus() || "disconnected",
        error: client?.getError() || undefined,
        tools: client?.getTools() || [],
        resources: client?.getResources() || [],
        prompts: client?.getPrompts() || [],
      };
    });
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const client of this.clients.values()) {
      if (client.getStatus() === "connected") {
        tools.push(...client.getTools());
      }
    }

    return tools;
  }

  /**
   * Get all available resources from all connected servers
   */
  getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];

    for (const client of this.clients.values()) {
      if (client.getStatus() === "connected") {
        resources.push(...client.getResources());
      }
    }

    return resources;
  }

  /**
   * Get all available prompts from all connected servers
   */
  getAllPrompts(): MCPPrompt[] {
    const prompts: MCPPrompt[] = [];

    for (const client of this.clients.values()) {
      if (client.getStatus() === "connected") {
        prompts.push(...client.getPrompts());
      }
    }

    return prompts;
  }

  /**
   * Call a tool
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResult> {
    // Find which server has this tool
    for (const client of this.clients.values()) {
      if (client.getStatus() !== "connected") continue;

      const tool = client.getTools().find((t) => t.name === request.name);
      if (tool) {
        return client.callTool(request);
      }
    }

    return {
      success: false,
      error: `Tool not found: ${request.name}`,
      isError: true,
    };
  }

  /**
   * Check if a tool is available
   */
  hasTool(name: string): boolean {
    return this.getAllTools().some((t) => t.name === name);
  }

  /**
   * Get a specific client
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }
}

// Singleton instance
let managerInstance: MCPManager | null = null;

/**
 * Get the MCP manager singleton
 */
export function getMCPManager(): MCPManager {
  if (!managerInstance) {
    managerInstance = new MCPManager();
  }
  return managerInstance;
}

/**
 * Initialize MCP manager and connect to all servers
 */
export async function initializeMCP(): Promise<MCPManager> {
  const manager = getMCPManager();
  await manager.connectAll();
  return manager;
}
