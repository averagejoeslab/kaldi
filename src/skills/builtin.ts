/**
 * Built-in Skills
 *
 * Pre-defined skills that come with Kaldi.
 */

import type { Skill } from "./types.js";

/**
 * Built-in skills
 */
export const builtinSkills: Skill[] = [
  // Git Skills
  {
    name: "commit",
    description: "Create a git commit with a generated message",
    prompt: `Analyze the staged changes and create a commit.

1. First, run \`git status\` and \`git diff --staged\` to understand the changes
2. Write a concise, descriptive commit message following conventional commits format
3. Create the commit with the generated message

If there are no staged changes, suggest what files should be staged.`,
    aliases: ["ci"],
    category: "git",
    builtin: true,
  },
  {
    name: "pr",
    description: "Create a pull request with generated description",
    prompt: `Create a pull request for the current branch.

1. Run \`git log main..HEAD\` (or master) to see commits
2. Run \`git diff main..HEAD --stat\` to see changed files
3. Generate a PR title and description summarizing the changes
4. Create the PR using \`gh pr create\`

Include a clear summary, key changes, and any testing notes.`,
    aliases: ["pull-request"],
    category: "git",
    builtin: true,
  },
  {
    name: "review",
    description: "Review code changes in current branch or PR",
    prompt: `Review the code changes in this branch.

1. Get the diff: \`git diff main..HEAD\` (or from PR if number provided)
2. Analyze the changes for:
   - Code quality and best practices
   - Potential bugs or edge cases
   - Security concerns
   - Performance implications
   - Test coverage

Provide constructive feedback with specific suggestions.`,
    aliases: ["code-review", "cr"],
    optionalArgs: ["pr-number"],
    category: "git",
    builtin: true,
  },

  // Code Skills
  {
    name: "explain",
    description: "Explain code in a file or selection",
    prompt: `Explain the code in detail.

Read the specified file and provide a clear explanation of:
- What the code does at a high level
- Key functions/classes and their purposes
- Important algorithms or patterns used
- How different parts connect together

{args}`,
    requiredArgs: ["file"],
    category: "code",
    builtin: true,
  },
  {
    name: "refactor",
    description: "Suggest refactoring improvements",
    prompt: `Analyze the code and suggest refactoring improvements.

Read the specified file and identify:
- Code duplication that could be extracted
- Complex functions that should be split
- Naming improvements
- Better patterns or approaches
- Performance optimizations

Provide specific, actionable suggestions with code examples.

{args}`,
    requiredArgs: ["file"],
    category: "code",
    builtin: true,
  },
  {
    name: "fix",
    description: "Fix a bug or issue",
    prompt: `Fix the described bug or issue.

1. Understand the problem from the description
2. Search the codebase for relevant files
3. Identify the root cause
4. Implement a fix
5. Verify the fix doesn't break other functionality

Problem: {args}`,
    requiredArgs: ["description"],
    category: "code",
    builtin: true,
  },

  // Test Skills
  {
    name: "test",
    description: "Generate tests for code",
    prompt: `Generate tests for the specified code.

1. Read the file to understand the code
2. Identify functions/methods that need testing
3. Write comprehensive tests including:
   - Happy path cases
   - Edge cases
   - Error handling
   - Boundary conditions

Use the project's existing test framework and patterns.

{args}`,
    requiredArgs: ["file"],
    category: "test",
    builtin: true,
  },
  {
    name: "coverage",
    description: "Analyze test coverage and suggest improvements",
    prompt: `Analyze test coverage and suggest improvements.

1. Run the test suite with coverage
2. Identify areas with low coverage
3. Suggest specific tests to add
4. Prioritize by importance and risk

Provide actionable recommendations for improving coverage.`,
    category: "test",
    builtin: true,
  },

  // Docs Skills
  {
    name: "docs",
    description: "Generate documentation for code",
    prompt: `Generate documentation for the specified code.

1. Read the file to understand the code
2. Add/update documentation including:
   - File-level description
   - Function/method docstrings
   - Parameter descriptions
   - Return value descriptions
   - Usage examples where helpful

Follow the project's documentation style.

{args}`,
    requiredArgs: ["file"],
    category: "docs",
    builtin: true,
  },
  {
    name: "readme",
    description: "Generate or update README",
    prompt: `Generate or update the README for this project.

1. Analyze the project structure
2. Read existing README if present
3. Generate/update with:
   - Project description
   - Installation instructions
   - Usage examples
   - Configuration options
   - Contributing guidelines

Keep it clear and helpful for new users.`,
    category: "docs",
    builtin: true,
  },

  // Utility Skills
  {
    name: "summarize",
    description: "Summarize the current conversation",
    prompt: `Summarize the conversation so far.

Provide a concise summary including:
- Main topics discussed
- Key decisions made
- Code changes implemented
- Outstanding questions or tasks

Keep it brief but comprehensive.`,
    category: "util",
    builtin: true,
  },
  {
    name: "plan",
    description: "Create a plan for implementing a feature",
    prompt: `Create an implementation plan for the requested feature.

1. Understand the requirements
2. Analyze the existing codebase
3. Create a step-by-step plan including:
   - Files to create/modify
   - Key implementation details
   - Testing approach
   - Potential challenges

Present the plan for review before implementing.

Feature: {args}`,
    requiredArgs: ["description"],
    category: "util",
    builtin: true,
  },
];

/**
 * Get a built-in skill by name
 */
export function getBuiltinSkill(name: string): Skill | undefined {
  return builtinSkills.find(
    (s) => s.name === name || s.aliases?.includes(name)
  );
}

/**
 * Get all built-in skills
 */
export function getAllBuiltinSkills(): Skill[] {
  return builtinSkills;
}

/**
 * Get built-in skills by category
 */
export function getBuiltinSkillsByCategory(category: Skill["category"]): Skill[] {
  return builtinSkills.filter((s) => s.category === category);
}
