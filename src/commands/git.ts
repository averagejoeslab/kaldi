/**
 * Git Commands
 *
 * Commands for git operations.
 */

import { execSync } from "child_process";
import type { Command } from "./types.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";

export const gitStatusCommand: Command = {
  name: "status",
  aliases: ["st", "gs"],
  description: "Show git status",
  handler: (args, context) => {
    try {
      const result = execSync("git status --short --branch", {
        cwd: context.cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (!result.trim()) {
        return { output: c.dim("\n  Working tree clean\n") };
      }

      return { output: "\n" + result };
    } catch {
      return { error: "Not a git repository or git not installed" };
    }
  },
};

export const gitDiffCommand: Command = {
  name: "diff",
  aliases: ["d", "changes"],
  description: "Show git diff",
  usage: "/diff [--staged]",
  handler: (args, context) => {
    try {
      const staged = args.includes("--staged") || args.includes("-s");
      const command = staged ? "git diff --staged" : "git diff";

      const result = execSync(command, {
        cwd: context.cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (!result.trim()) {
        return {
          output: c.dim(staged ? "\n  No staged changes\n" : "\n  No unstaged changes\n"),
        };
      }

      return { output: "\n" + result };
    } catch {
      return { error: "Not a git repository or git not installed" };
    }
  },
};

export const gitCommitCommand: Command = {
  name: "commit",
  aliases: ["ci"],
  description: "Create a git commit",
  usage: "/commit [message]",
  handler: (args, context) => {
    try {
      // Check for staged changes
      const staged = execSync("git diff --staged --name-only", {
        cwd: context.cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      if (!staged) {
        return { error: "No staged changes to commit. Use 'git add' first." };
      }

      const message = args.join(" ").trim();

      if (!message) {
        // Show what would be committed
        const status = execSync("git status --short", {
          cwd: context.cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

        const lines = [
          "",
          c.accent("  Staged Changes:"),
          "",
          status,
          c.dim("  Provide a commit message: /commit <message>"),
          c.dim("  Or ask Kaldi to generate one for you!"),
          "",
        ];

        return { output: lines.join("\n") };
      }

      // Create the commit
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: context.cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      return {
        output: c.success(`\n  ${sym.success} Committed: ${message}\n`),
      };
    } catch (error) {
      return {
        error: `Commit failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const gitLogCommand: Command = {
  name: "log",
  aliases: ["gl", "commits"],
  description: "Show recent commits",
  usage: "/log [count]",
  handler: (args, context) => {
    try {
      const count = parseInt(args[0]) || 10;

      const result = execSync(
        `git log --oneline --decorate -n ${count}`,
        {
          cwd: context.cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      if (!result.trim()) {
        return { output: c.dim("\n  No commits yet\n") };
      }

      const lines = [
        "",
        c.accent("  Recent Commits"),
        "",
        result,
      ];

      return { output: lines.join("\n") };
    } catch {
      return { error: "Not a git repository or git not installed" };
    }
  },
};

export const gitBranchCommand: Command = {
  name: "branch",
  aliases: ["br", "branches"],
  description: "List or create branches",
  usage: "/branch [name]",
  handler: (args, context) => {
    try {
      if (args.length === 0) {
        // List branches
        const result = execSync("git branch -a", {
          cwd: context.cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

        const lines = [
          "",
          c.accent("  Branches"),
          "",
          result,
        ];

        return { output: lines.join("\n") };
      }

      // Create new branch
      const branchName = args[0];
      execSync(`git checkout -b ${branchName}`, {
        cwd: context.cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      return {
        output: c.success(`\n  ${sym.success} Created and switched to branch: ${branchName}\n`),
      };
    } catch (error) {
      return {
        error: `Branch operation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const prCommand: Command = {
  name: "pr",
  aliases: ["pull-request", "mr"],
  description: "Create a pull request",
  usage: "/pr [title]",
  handler: (args, context) => {
    try {
      // Check if gh is installed
      execSync("gh --version", { stdio: "pipe" });

      // Get current branch
      const branch = execSync("git branch --show-current", {
        cwd: context.cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      if (branch === "main" || branch === "master") {
        return { error: "Cannot create PR from main/master branch" };
      }

      const title = args.join(" ").trim();

      if (!title) {
        // Show PR preview
        let commits: string;
        try {
          commits = execSync("git log --oneline main..HEAD", {
            cwd: context.cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          }).trim();
        } catch {
          try {
            commits = execSync("git log --oneline master..HEAD", {
              cwd: context.cwd,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            }).trim();
          } catch {
            commits = "No commits";
          }
        }

        const lines = [
          "",
          c.accent("  PR Preview"),
          "",
          `  ${c.dim("Branch:")} ${branch}`,
          "",
          c.dim("  Commits:"),
          commits.split("\n").map((l) => `    ${c.dim(l)}`).join("\n"),
          "",
          c.dim("  Provide a title: /pr <title>"),
          c.dim("  Or ask Kaldi to draft one for you!"),
          "",
        ];

        return { output: lines.join("\n") };
      }

      // Create PR
      const result = execSync(
        `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "Created with Kaldi CLI"`,
        {
          cwd: context.cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      return {
        output: c.success(`\n  ${sym.success} PR created: ${result.trim()}\n`),
      };
    } catch (error) {
      if (String(error).includes("gh")) {
        return {
          error: "GitHub CLI (gh) not installed. Install from https://cli.github.com",
        };
      }
      return {
        error: `PR creation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
