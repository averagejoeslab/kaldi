/**
 * Bash Tool
 *
 * Execute shell commands.
 */

import { spawn } from "child_process";
import type { ToolDefinition, ToolContext } from "./types.js";

export const bashTool: ToolDefinition = {
  name: "bash",
  description:
    "Execute a bash command. Use for git, npm, and other CLI operations.",
  requiresPermission: true,
  parameters: {
    command: {
      type: "string",
      description: "The bash command to execute",
      required: true,
    },
    timeout: {
      type: "number",
      description: "Timeout in milliseconds (default: 120000)",
      required: false,
      default: 120000,
    },
  },
  async execute(args, context?: ToolContext) {
    const command = args.command as string;
    const timeout = (args.timeout as number) || 120000;

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let killed = false;

      const proc = spawn("bash", ["-c", command], {
        cwd: context?.cwd || process.cwd(),
        env: { ...process.env, ...context?.env },
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
      }, timeout);

      // Handle abort signal
      if (context?.abortSignal) {
        context.abortSignal.addEventListener("abort", () => {
          killed = true;
          proc.kill("SIGTERM");
        });
      }

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);

        if (killed) {
          resolve({
            success: false,
            output: stdout,
            error: context?.abortSignal?.aborted
              ? "Command aborted"
              : `Command timed out after ${timeout}ms`,
          });
          return;
        }

        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

        resolve({
          success: code === 0,
          output: output.slice(0, 30000), // Truncate long output
          error: code !== 0 ? `Exit code: ${code}` : undefined,
        });
      });

      proc.on("error", (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: "",
          error: error.message,
        });
      });
    });
  },
};
