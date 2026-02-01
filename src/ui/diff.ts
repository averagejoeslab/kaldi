import chalk from "chalk";
import * as Diff from "diff";

export interface DiffOptions {
  oldContent: string;
  newContent: string;
  filePath: string;
  context?: number;
}

export function formatDiff(options: DiffOptions): string {
  const { oldContent, newContent, filePath, context = 3 } = options;

  const changes = Diff.structuredPatch(
    filePath,
    filePath,
    oldContent,
    newContent,
    "original",
    "modified",
    { context }
  );

  const lines: string[] = [];

  lines.push(chalk.bold(`\n📝 Changes to ${filePath}:`));
  lines.push(chalk.dim("─".repeat(60)));

  for (const hunk of changes.hunks) {
    lines.push(
      chalk.cyan(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`)
    );

    for (const line of hunk.lines) {
      if (line.startsWith("+")) {
        lines.push(chalk.green(line));
      } else if (line.startsWith("-")) {
        lines.push(chalk.red(line));
      } else {
        lines.push(chalk.dim(line));
      }
    }
  }

  lines.push(chalk.dim("─".repeat(60)));

  return lines.join("\n");
}

export function getChangeStats(oldContent: string, newContent: string): {
  additions: number;
  deletions: number;
  changes: number;
} {
  const changes = Diff.diffLines(oldContent, newContent);

  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    if (change.added) {
      additions += change.count || 0;
    } else if (change.removed) {
      deletions += change.count || 0;
    }
  }

  return {
    additions,
    deletions,
    changes: additions + deletions,
  };
}

export function formatChangeStats(stats: { additions: number; deletions: number }): string {
  const parts: string[] = [];

  if (stats.additions > 0) {
    parts.push(chalk.green(`+${stats.additions}`));
  }
  if (stats.deletions > 0) {
    parts.push(chalk.red(`-${stats.deletions}`));
  }

  return parts.join(", ") || "no changes";
}
