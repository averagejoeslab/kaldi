/**
 * Notes/Memory System
 *
 * Persistent notes and learnings that Kaldi remembers across sessions.
 * Separate from KALDI.md which is project context.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface Note {
  id: string;
  content: string;
  category: "fact" | "preference" | "learning" | "todo" | "general";
  createdAt: Date;
  projectPath?: string;
}

export interface NotesStore {
  version: number;
  notes: Note[];
  lastUpdated: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const NOTES_DIR = join(homedir(), ".kaldi", "notes");
const GLOBAL_NOTES_FILE = join(NOTES_DIR, "global.json");

// ============================================================================
// NOTES MANAGEMENT
// ============================================================================

function ensureNotesDir(): void {
  if (!existsSync(NOTES_DIR)) {
    mkdirSync(NOTES_DIR, { recursive: true });
  }
}

function getProjectNotesPath(projectPath?: string): string {
  const path = projectPath || process.cwd();
  // Create a safe filename from the path
  const safeName = path.replace(/[^a-zA-Z0-9]/g, "_").slice(-50);
  return join(NOTES_DIR, `project_${safeName}.json`);
}

function loadNotesFile(path: string): NotesStore {
  if (!existsSync(path)) {
    return { version: 1, notes: [], lastUpdated: new Date().toISOString() };
  }

  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as NotesStore;
  } catch {
    return { version: 1, notes: [], lastUpdated: new Date().toISOString() };
  }
}

function saveNotesFile(path: string, store: NotesStore): void {
  ensureNotesDir();
  store.lastUpdated = new Date().toISOString();
  writeFileSync(path, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Load all notes (global + project-specific)
 */
export function loadNotes(projectPath?: string): Note[] {
  const globalStore = loadNotesFile(GLOBAL_NOTES_FILE);
  const projectStore = loadNotesFile(getProjectNotesPath(projectPath));

  return [...globalStore.notes, ...projectStore.notes];
}

/**
 * Add a new note
 */
export function addNote(
  content: string,
  category: Note["category"] = "general",
  global: boolean = false,
  projectPath?: string
): Note {
  const note: Note = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    content,
    category,
    createdAt: new Date(),
    projectPath: global ? undefined : (projectPath || process.cwd()),
  };

  const path = global ? GLOBAL_NOTES_FILE : getProjectNotesPath(projectPath);
  const store = loadNotesFile(path);
  store.notes.push(note);
  saveNotesFile(path, store);

  return note;
}

/**
 * Remove a note by ID
 */
export function removeNote(id: string, projectPath?: string): boolean {
  // Try global first
  let store = loadNotesFile(GLOBAL_NOTES_FILE);
  const globalIdx = store.notes.findIndex(n => n.id === id);
  if (globalIdx >= 0) {
    store.notes.splice(globalIdx, 1);
    saveNotesFile(GLOBAL_NOTES_FILE, store);
    return true;
  }

  // Try project-specific
  const projectPath2 = getProjectNotesPath(projectPath);
  store = loadNotesFile(projectPath2);
  const projectIdx = store.notes.findIndex(n => n.id === id);
  if (projectIdx >= 0) {
    store.notes.splice(projectIdx, 1);
    saveNotesFile(projectPath2, store);
    return true;
  }

  return false;
}

/**
 * Clear all notes
 */
export function clearNotes(global: boolean = false, projectPath?: string): number {
  const path = global ? GLOBAL_NOTES_FILE : getProjectNotesPath(projectPath);
  const store = loadNotesFile(path);
  const count = store.notes.length;
  store.notes = [];
  saveNotesFile(path, store);
  return count;
}

/**
 * Search notes
 */
export function searchNotes(query: string, projectPath?: string): Note[] {
  const notes = loadNotes(projectPath);
  const lowerQuery = query.toLowerCase();
  return notes.filter(n => n.content.toLowerCase().includes(lowerQuery));
}

/**
 * Get notes by category
 */
export function getNotesByCategory(category: Note["category"], projectPath?: string): Note[] {
  const notes = loadNotes(projectPath);
  return notes.filter(n => n.category === category);
}

// ============================================================================
// FORMATTING
// ============================================================================

const colors = {
  fact: chalk.hex("#87CEEB"),
  preference: chalk.hex("#DAA520"),
  learning: chalk.hex("#7CB342"),
  todo: chalk.hex("#E57373"),
  general: chalk.hex("#C9A66B"),
  dim: chalk.hex("#888888"),
  accent: chalk.hex("#C9A66B"),
};

const categoryIcons: Record<Note["category"], string> = {
  fact: "◆",
  preference: "★",
  learning: "✦",
  todo: "○",
  general: "●",
};

/**
 * Format notes for display
 */
export function formatNotes(notes: Note[]): string {
  if (notes.length === 0) {
    return colors.dim("  No notes saved\n  Use /memory add <note> to add one");
  }

  const lines: string[] = [colors.accent("  Memory Notes"), ""];

  // Group by category
  const byCategory = new Map<Note["category"], Note[]>();
  for (const note of notes) {
    const list = byCategory.get(note.category) || [];
    list.push(note);
    byCategory.set(note.category, list);
  }

  for (const [category, categoryNotes] of byCategory) {
    const color = colors[category];
    const icon = categoryIcons[category];

    lines.push(color(`  ${icon} ${category.charAt(0).toUpperCase() + category.slice(1)}`));

    for (const note of categoryNotes) {
      const shortId = note.id.slice(-6);
      const isGlobal = !note.projectPath;
      const scope = isGlobal ? colors.dim(" (global)") : "";
      lines.push(`    ${colors.dim(shortId)} ${note.content}${scope}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Build prompt addition from notes
 */
export function buildNotesPrompt(notes: Note[]): string {
  if (notes.length === 0) {
    return "";
  }

  const sections: string[] = ["<user-notes>", "The user has saved these notes/preferences:"];

  for (const note of notes) {
    sections.push(`- [${note.category}] ${note.content}`);
  }

  sections.push("</user-notes>");

  return sections.join("\n");
}
