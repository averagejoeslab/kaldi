/**
 * Project Context Generator
 *
 * Analyze a project and generate KALDI.md content.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { glob } from "glob";
import { getProjectContextPath } from "./loader.js";

export interface ProjectAnalysis {
  name: string;
  type: string;
  language: string;
  framework?: string;
  packageManager?: string;
  hasTests: boolean;
  hasTypeScript: boolean;
  structure: string[];
}

/**
 * Analyze a project to determine its characteristics
 */
export async function analyzeProject(
  projectPath: string = process.cwd()
): Promise<ProjectAnalysis> {
  const name = basename(projectPath);
  let type = "unknown";
  let language = "unknown";
  let framework: string | undefined;
  let packageManager: string | undefined;
  let hasTests = false;
  let hasTypeScript = false;

  // Check for package.json (Node.js project)
  const packageJsonPath = join(projectPath, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      language = "javascript";
      type = pkg.type === "module" ? "esm" : "commonjs";

      // Detect framework
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react) framework = "react";
      else if (deps.vue) framework = "vue";
      else if (deps.svelte) framework = "svelte";
      else if (deps.express) framework = "express";
      else if (deps.next) framework = "next.js";
      else if (deps.nuxt) framework = "nuxt";

      // Check for TypeScript
      if (deps.typescript || existsSync(join(projectPath, "tsconfig.json"))) {
        hasTypeScript = true;
        language = "typescript";
      }

      // Check for tests
      if (deps.jest || deps.vitest || deps.mocha) {
        hasTests = true;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check for Python project
  if (
    existsSync(join(projectPath, "requirements.txt")) ||
    existsSync(join(projectPath, "pyproject.toml")) ||
    existsSync(join(projectPath, "setup.py"))
  ) {
    language = "python";
    if (existsSync(join(projectPath, "pyproject.toml"))) {
      packageManager = "poetry";
    } else {
      packageManager = "pip";
    }
  }

  // Check for Rust project
  if (existsSync(join(projectPath, "Cargo.toml"))) {
    language = "rust";
    packageManager = "cargo";
  }

  // Check for Go project
  if (existsSync(join(projectPath, "go.mod"))) {
    language = "go";
    packageManager = "go";
  }

  // Detect package manager for Node
  if (language === "javascript" || language === "typescript") {
    if (existsSync(join(projectPath, "pnpm-lock.yaml"))) {
      packageManager = "pnpm";
    } else if (existsSync(join(projectPath, "yarn.lock"))) {
      packageManager = "yarn";
    } else if (existsSync(join(projectPath, "bun.lockb"))) {
      packageManager = "bun";
    } else if (existsSync(join(projectPath, "package-lock.json"))) {
      packageManager = "npm";
    }
  }

  // Get directory structure
  const structure: string[] = [];
  try {
    const topLevel = await glob("*", {
      cwd: projectPath,
      ignore: ["node_modules", ".git", "dist", "build"],
    });
    structure.push(...topLevel.slice(0, 20));
  } catch {
    // Ignore glob errors
  }

  return {
    name,
    type,
    language,
    framework,
    packageManager,
    hasTests,
    hasTypeScript,
    structure,
  };
}

/**
 * Generate KALDI.md content from project analysis
 */
export function generateProjectContext(analysis: ProjectAnalysis): string {
  const lines: string[] = [];

  lines.push(`# ${analysis.name}`);
  lines.push("");
  lines.push("## Project Overview");
  lines.push("");
  lines.push(`- **Language**: ${analysis.language}`);
  if (analysis.framework) {
    lines.push(`- **Framework**: ${analysis.framework}`);
  }
  if (analysis.packageManager) {
    lines.push(`- **Package Manager**: ${analysis.packageManager}`);
  }
  if (analysis.hasTypeScript) {
    lines.push(`- **TypeScript**: Yes`);
  }
  lines.push("");

  lines.push("## Development Commands");
  lines.push("");

  // Generate commands based on detected setup
  if (analysis.packageManager === "npm") {
    lines.push("```bash");
    lines.push("# Install dependencies");
    lines.push("npm install");
    lines.push("");
    lines.push("# Run development server");
    lines.push("npm run dev");
    lines.push("");
    if (analysis.hasTests) {
      lines.push("# Run tests");
      lines.push("npm test");
      lines.push("");
    }
    lines.push("# Build for production");
    lines.push("npm run build");
    lines.push("```");
  } else if (analysis.packageManager === "pnpm") {
    lines.push("```bash");
    lines.push("pnpm install");
    lines.push("pnpm dev");
    if (analysis.hasTests) lines.push("pnpm test");
    lines.push("pnpm build");
    lines.push("```");
  } else if (analysis.packageManager === "yarn") {
    lines.push("```bash");
    lines.push("yarn");
    lines.push("yarn dev");
    if (analysis.hasTests) lines.push("yarn test");
    lines.push("yarn build");
    lines.push("```");
  } else if (analysis.packageManager === "cargo") {
    lines.push("```bash");
    lines.push("cargo build");
    lines.push("cargo run");
    lines.push("cargo test");
    lines.push("```");
  } else if (analysis.packageManager === "go") {
    lines.push("```bash");
    lines.push("go build");
    lines.push("go run .");
    lines.push("go test ./...");
    lines.push("```");
  } else if (analysis.packageManager === "pip" || analysis.packageManager === "poetry") {
    lines.push("```bash");
    if (analysis.packageManager === "poetry") {
      lines.push("poetry install");
      lines.push("poetry run python main.py");
      lines.push("poetry run pytest");
    } else {
      lines.push("pip install -r requirements.txt");
      lines.push("python main.py");
      lines.push("pytest");
    }
    lines.push("```");
  }

  lines.push("");
  lines.push("## Project Structure");
  lines.push("");
  lines.push("```");
  for (const item of analysis.structure) {
    lines.push(item);
  }
  lines.push("```");

  lines.push("");
  lines.push("## Code Style");
  lines.push("");
  lines.push("<!-- Add your code style guidelines here -->");
  lines.push("");

  lines.push("## Notes for AI");
  lines.push("");
  lines.push("<!-- Add any special instructions for AI assistants -->");
  lines.push("");

  return lines.join("\n");
}

/**
 * Create KALDI.md for a project
 */
export async function createProjectContext(
  projectPath: string = process.cwd(),
  content?: string
): Promise<string> {
  const contextPath = getProjectContextPath(projectPath);

  if (!content) {
    const analysis = await analyzeProject(projectPath);
    content = generateProjectContext(analysis);
  }

  writeFileSync(contextPath, content, "utf-8");
  return contextPath;
}
