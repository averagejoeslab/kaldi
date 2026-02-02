/**
 * Project Context Types
 *
 * KALDI.md is like AGENTS.md - project-specific instructions for the AI.
 */

export interface ProjectContext {
  content: string;
  path: string;
  lastModified?: Date;
}

export interface ProjectContextConfig {
  projectPath?: string;
  filenames?: string[];
}

export const DEFAULT_FILENAMES = [
  "KALDI.md",
  ".kaldi/KALDI.md",
  ".kaldi/context.md",
  "AGENTS.md", // Also support the standard
  ".agents/AGENTS.md",
];
