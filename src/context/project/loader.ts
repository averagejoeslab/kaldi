/**
 * Project Context Loader
 *
 * Find and load KALDI.md (or AGENTS.md) from the project.
 */

import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { ProjectContext, ProjectContextConfig } from "./types.js";
import { DEFAULT_FILENAMES } from "./types.js";

/**
 * Find KALDI.md in a project directory
 */
export function findProjectContext(
  projectPath: string = process.cwd(),
  filenames: string[] = DEFAULT_FILENAMES
): string | null {
  for (const filename of filenames) {
    const fullPath = join(projectPath, filename);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Load project context (KALDI.md)
 */
export function loadProjectContext(
  config: ProjectContextConfig = {}
): ProjectContext | null {
  const projectPath = config.projectPath || process.cwd();
  const filenames = config.filenames || DEFAULT_FILENAMES;

  const contextPath = findProjectContext(projectPath, filenames);
  if (!contextPath) {
    return null;
  }

  try {
    const content = readFileSync(contextPath, "utf-8");
    const stats = statSync(contextPath);

    return {
      content,
      path: contextPath,
      lastModified: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Check if project has context file
 */
export function hasProjectContext(
  projectPath: string = process.cwd()
): boolean {
  return findProjectContext(projectPath) !== null;
}

/**
 * Get the path where KALDI.md should be created
 */
export function getProjectContextPath(
  projectPath: string = process.cwd()
): string {
  return join(projectPath, "KALDI.md");
}
