/**
 * Hook Executor
 *
 * Executes shell commands for hooks.
 */

import { execSync, spawn } from "child_process";
import type { HookConfig, HookContext, HookResult } from "./types.js";

/**
 * Execute a hook
 */
export async function executeHook(
  config: HookConfig,
  context: HookContext
): Promise<HookResult> {
  const timeout = config.timeout || 30000;

  // Build environment variables
  const env: Record<string, string> = {
    ...process.env,
    ...config.env,
    KALDI_HOOK_EVENT: context.event,
    KALDI_CWD: context.cwd,
  };

  if (context.sessionId) {
    env.KALDI_SESSION_ID = context.sessionId;
  }

  if (context.toolName) {
    env.KALDI_TOOL_NAME = context.toolName;
  }

  if (context.toolArgs) {
    env.KALDI_TOOL_ARGS = JSON.stringify(context.toolArgs);
  }

  if (context.toolResult !== undefined) {
    env.KALDI_TOOL_RESULT = JSON.stringify(context.toolResult);
  }

  if (context.userMessage) {
    env.KALDI_USER_MESSAGE = context.userMessage;
  }

  if (context.response) {
    env.KALDI_RESPONSE = context.response;
  }

  return new Promise((resolve) => {
    try {
      const proc = spawn(config.command, [], {
        shell: true,
        cwd: context.cwd,
        env: env as NodeJS.ProcessEnv,
        timeout,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        // Check if hook wants to block
        const blocked = code !== 0 && stderr.includes("KALDI_BLOCK:");
        const blockReason = blocked
          ? stderr.split("KALDI_BLOCK:")[1]?.trim()
          : undefined;

        // Check for modified context
        let modifiedContext: Partial<HookContext> | undefined;
        if (stdout.includes("KALDI_MODIFY:")) {
          try {
            const modifyJson = stdout.split("KALDI_MODIFY:")[1]?.split("\n")[0];
            modifiedContext = JSON.parse(modifyJson);
          } catch {
            // Invalid JSON, ignore
          }
        }

        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code ?? undefined,
          blocked,
          blockReason,
          modifiedContext,
        });
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          error: err.message,
          exitCode: 1,
        });
      });

      // Handle timeout
      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          error: "Hook execution timed out",
          exitCode: 1,
        });
      }, timeout);
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      });
    }
  });
}
