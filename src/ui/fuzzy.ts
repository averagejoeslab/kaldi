/**
 * Fuzzy Search and Autocomplete
 *
 * Provides fuzzy matching for commands and file paths.
 */

import chalk from "chalk";
import { readdirSync, statSync, existsSync } from "fs";
import { join, dirname, basename, sep } from "path";
import { homedir } from "os";

// ============================================================================
// TYPES
// ============================================================================

export interface FuzzyMatch<T> {
  item: T;
  score: number;
  matches: number[]; // Indices of matched characters
}

export interface AutocompleteItem {
  value: string;
  display: string;
  description?: string;
  type?: "command" | "file" | "directory" | "option" | "history";
  icon?: string;
}

export interface AutocompleteConfig {
  maxResults?: number;
  minScore?: number;
  caseSensitive?: boolean;
  showIcons?: boolean;
  showDescriptions?: boolean;
}

// ============================================================================
// FUZZY MATCHING
// ============================================================================

/**
 * Calculate fuzzy match score between query and target
 * Returns -1 if no match, higher scores are better matches
 */
export function fuzzyScore(query: string, target: string, caseSensitive: boolean = false): number {
  if (!query) return 0;

  const q = caseSensitive ? query : query.toLowerCase();
  const t = caseSensitive ? target : target.toLowerCase();

  if (q === t) return 1000; // Exact match
  if (t.startsWith(q)) return 900 + (q.length / t.length) * 100; // Prefix match
  if (t.includes(q)) return 500 + (q.length / t.length) * 100; // Substring match

  // Fuzzy character matching
  let qIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -2;

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      // Matched a character
      score += 10;

      // Bonus for consecutive matches
      if (tIdx === lastMatchIdx + 1) {
        consecutiveBonus += 5;
        score += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }

      // Bonus for matching at word boundaries
      if (tIdx === 0 || /[^a-zA-Z0-9]/.test(t[tIdx - 1])) {
        score += 20;
      }

      // Bonus for matching uppercase (camelCase)
      if (target[tIdx] === target[tIdx].toUpperCase() && /[a-zA-Z]/.test(target[tIdx])) {
        score += 10;
      }

      lastMatchIdx = tIdx;
      qIdx++;
    }
  }

  // All query characters must be matched
  if (qIdx < q.length) return -1;

  // Penalize longer targets
  score -= (t.length - q.length) * 2;

  return Math.max(0, score);
}

/**
 * Get indices of matched characters for highlighting
 */
export function fuzzyMatchIndices(query: string, target: string, caseSensitive: boolean = false): number[] {
  const q = caseSensitive ? query : query.toLowerCase();
  const t = caseSensitive ? target : target.toLowerCase();
  const indices: number[] = [];

  let qIdx = 0;
  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      indices.push(tIdx);
      qIdx++;
    }
  }

  return indices;
}

/**
 * Perform fuzzy search on a list of items
 */
export function fuzzySearch<T>(
  query: string,
  items: T[],
  accessor: (item: T) => string,
  config: AutocompleteConfig = {}
): FuzzyMatch<T>[] {
  const {
    maxResults = 10,
    minScore = 0,
    caseSensitive = false,
  } = config;

  const results: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const target = accessor(item);
    const score = fuzzyScore(query, target, caseSensitive);

    if (score >= minScore) {
      results.push({
        item,
        score,
        matches: fuzzyMatchIndices(query, target, caseSensitive),
      });
    }
  }

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

// ============================================================================
// COMMAND AUTOCOMPLETE
// ============================================================================

/**
 * Get command suggestions based on input
 */
export function getCommandSuggestions(
  input: string,
  commands: Record<string, string>,
  config: AutocompleteConfig = {}
): AutocompleteItem[] {
  if (!input.startsWith("/")) {
    return [];
  }

  const query = input.slice(1); // Remove leading /
  const items = Object.entries(commands).map(([cmd, desc]) => ({
    value: cmd,
    display: cmd,
    description: desc,
    type: "command" as const,
    icon: "❯",
  }));

  const matches = fuzzySearch(query, items, item => item.value.slice(1), config);

  return matches.map(m => ({
    ...m.item,
    display: highlightMatches(m.item.display, m.matches.map(i => i + 1)), // +1 for the /
  }));
}

// ============================================================================
// FILE PATH AUTOCOMPLETE
// ============================================================================

/**
 * Get file path suggestions based on partial path
 */
export function getPathSuggestions(
  partialPath: string,
  config: AutocompleteConfig = {}
): AutocompleteItem[] {
  const { maxResults = 10 } = config;

  // Expand ~ to home directory
  let expandedPath = partialPath;
  if (expandedPath.startsWith("~")) {
    expandedPath = join(homedir(), expandedPath.slice(1));
  }

  // Get the directory to search in
  let searchDir: string;
  let searchPrefix: string;

  if (expandedPath.endsWith(sep) || expandedPath === "") {
    searchDir = expandedPath || process.cwd();
    searchPrefix = "";
  } else {
    searchDir = dirname(expandedPath);
    searchPrefix = basename(expandedPath);
  }

  // Check if directory exists
  if (!existsSync(searchDir)) {
    // Try current directory
    searchDir = process.cwd();
    searchPrefix = partialPath;
  }

  try {
    const entries = readdirSync(searchDir);
    const items: AutocompleteItem[] = [];

    for (const entry of entries) {
      // Skip hidden files unless prefix starts with .
      if (entry.startsWith(".") && !searchPrefix.startsWith(".")) {
        continue;
      }

      const fullPath = join(searchDir, entry);
      let isDir = false;

      try {
        isDir = statSync(fullPath).isDirectory();
      } catch {
        continue;
      }

      const displayPath = partialPath.endsWith(sep)
        ? partialPath + entry
        : join(dirname(partialPath), entry);

      items.push({
        value: fullPath,
        display: displayPath + (isDir ? sep : ""),
        type: isDir ? "directory" : "file",
        icon: isDir ? "📁" : "📄",
      });
    }

    // Filter and sort by fuzzy match
    if (searchPrefix) {
      const matches = fuzzySearch(searchPrefix, items, item => basename(item.value), config);
      return matches.slice(0, maxResults).map(m => ({
        ...m.item,
        display: highlightMatches(m.item.display, m.matches),
      }));
    }

    // Return first N items sorted alphabetically
    return items
      .sort((a, b) => {
        // Directories first
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.display.localeCompare(b.display);
      })
      .slice(0, maxResults);
  } catch {
    return [];
  }
}

// ============================================================================
// HISTORY SEARCH
// ============================================================================

/**
 * Search through command history
 */
export function searchHistory(
  query: string,
  history: string[],
  config: AutocompleteConfig = {}
): AutocompleteItem[] {
  const items = history.map((cmd, i) => ({
    value: cmd,
    display: cmd,
    type: "history" as const,
    icon: "↻",
    _index: i,
  }));

  const matches = fuzzySearch(query, items, item => item.value, config);

  return matches.map(m => ({
    ...m.item,
    display: highlightMatches(m.item.display, m.matches),
  }));
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

const colors = {
  match: chalk.hex("#DAA520").bold,  // Golden highlight for matches
  normal: chalk.hex("#E8DCC8"),       // Cream
  dim: chalk.hex("#888888"),
  icon: chalk.hex("#C9A66B"),
  selected: chalk.bgHex("#3D3225"),
};

/**
 * Highlight matched characters in a string
 */
export function highlightMatches(text: string, indices: number[]): string {
  if (indices.length === 0) return colors.normal(text);

  const chars = text.split("");
  const indexSet = new Set(indices);

  return chars.map((char, i) =>
    indexSet.has(i) ? colors.match(char) : colors.normal(char)
  ).join("");
}

/**
 * Format autocomplete dropdown
 */
export function formatAutocompleteDropdown(
  items: AutocompleteItem[],
  selectedIndex: number = 0,
  config: AutocompleteConfig = {}
): string {
  const { showIcons = true, showDescriptions = true } = config;

  if (items.length === 0) {
    return colors.dim("  No matches");
  }

  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isSelected = i === selectedIndex;

    let line = "  ";

    if (showIcons && item.icon) {
      line += colors.icon(item.icon) + " ";
    }

    const display = isSelected
      ? colors.selected(item.display.padEnd(30))
      : item.display.padEnd(30);

    line += display;

    if (showDescriptions && item.description) {
      line += " " + colors.dim(item.description);
    }

    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Format inline suggestion (ghost text)
 */
export function formatInlineSuggestion(input: string, suggestion: string): string {
  if (!suggestion.toLowerCase().startsWith(input.toLowerCase())) {
    return "";
  }

  const completion = suggestion.slice(input.length);
  return colors.dim(completion);
}

// ============================================================================
// COMBINED AUTOCOMPLETE
// ============================================================================

/**
 * Get all autocomplete suggestions for input
 */
export function getAutocompleteSuggestions(
  input: string,
  context: {
    commands?: Record<string, string>;
    history?: string[];
    cwd?: string;
  },
  config: AutocompleteConfig = {}
): AutocompleteItem[] {
  const suggestions: AutocompleteItem[] = [];

  // Command completions
  if (input.startsWith("/") && context.commands) {
    suggestions.push(...getCommandSuggestions(input, context.commands, config));
  }

  // File path completions (if contains / or ~ or .)
  if (input.includes("/") || input.startsWith("~") || input.startsWith("./")) {
    suggestions.push(...getPathSuggestions(input, config));
  }

  // History search (if query is long enough)
  if (input.length >= 2 && context.history) {
    const historySuggestions = searchHistory(input, context.history, { ...config, maxResults: 3 });
    suggestions.push(...historySuggestions);
  }

  // Deduplicate by value
  const seen = new Set<string>();
  return suggestions.filter(s => {
    if (seen.has(s.value)) return false;
    seen.add(s.value);
    return true;
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  colors as fuzzyColors,
};
