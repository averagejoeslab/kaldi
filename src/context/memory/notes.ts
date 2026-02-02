/**
 * Notes Management
 *
 * CRUD operations for user notes and preferences.
 */

import type { Note, NoteCategory, NotesStore } from "./types.js";
import {
  loadGlobalNotes,
  loadProjectNotes,
  saveGlobalNotes,
  saveProjectNotes,
} from "./store.js";
import { c } from "../../ui/theme/colors.js";
import { sym } from "../../ui/theme/symbols.js";

/**
 * Generate a unique note ID
 */
function generateId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Load all notes (global + project-specific)
 */
export function loadNotes(projectPath?: string): Note[] {
  const globalStore = loadGlobalNotes();
  const projectStore = loadProjectNotes(projectPath);

  return [...globalStore.notes, ...projectStore.notes];
}

/**
 * Add a new note
 */
export function addNote(
  content: string,
  category: NoteCategory = "general",
  global: boolean = false,
  projectPath?: string
): Note {
  const note: Note = {
    id: generateId(),
    content,
    category,
    createdAt: new Date().toISOString(),
    projectPath: global ? undefined : projectPath || process.cwd(),
  };

  if (global) {
    const store = loadGlobalNotes();
    store.notes.push(note);
    saveGlobalNotes(store);
  } else {
    const store = loadProjectNotes(projectPath);
    store.notes.push(note);
    saveProjectNotes(store, projectPath);
  }

  return note;
}

/**
 * Remove a note by ID
 */
export function removeNote(id: string, projectPath?: string): boolean {
  // Try global first
  let store = loadGlobalNotes();
  const globalIdx = store.notes.findIndex((n) => n.id === id);
  if (globalIdx >= 0) {
    store.notes.splice(globalIdx, 1);
    saveGlobalNotes(store);
    return true;
  }

  // Try project-specific
  store = loadProjectNotes(projectPath);
  const projectIdx = store.notes.findIndex((n) => n.id === id);
  if (projectIdx >= 0) {
    store.notes.splice(projectIdx, 1);
    saveProjectNotes(store, projectPath);
    return true;
  }

  return false;
}

/**
 * Clear all notes
 */
export function clearNotes(
  global: boolean = false,
  projectPath?: string
): number {
  if (global) {
    const store = loadGlobalNotes();
    const count = store.notes.length;
    store.notes = [];
    saveGlobalNotes(store);
    return count;
  } else {
    const store = loadProjectNotes(projectPath);
    const count = store.notes.length;
    store.notes = [];
    saveProjectNotes(store, projectPath);
    return count;
  }
}

/**
 * Search notes by content
 */
export function searchNotes(query: string, projectPath?: string): Note[] {
  const notes = loadNotes(projectPath);
  const lowerQuery = query.toLowerCase();
  return notes.filter((n) => n.content.toLowerCase().includes(lowerQuery));
}

/**
 * Get notes by category
 */
export function getNotesByCategory(
  category: NoteCategory,
  projectPath?: string
): Note[] {
  const notes = loadNotes(projectPath);
  return notes.filter((n) => n.category === category);
}

// ============================================================================
// FORMATTING
// ============================================================================

const categoryColors: Record<NoteCategory, (text: string) => string> = {
  fact: c.info,
  preference: c.warning,
  learning: c.success,
  todo: c.error,
  general: c.secondary,
};

const categoryIcons: Record<NoteCategory, string> = {
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
    return c.dim("  No notes saved\n  Use /memory add <note> to add one");
  }

  const lines: string[] = [c.accent("  Memory Notes"), ""];

  // Group by category
  const byCategory = new Map<NoteCategory, Note[]>();
  for (const note of notes) {
    const list = byCategory.get(note.category) || [];
    list.push(note);
    byCategory.set(note.category, list);
  }

  for (const [category, categoryNotes] of byCategory) {
    const color = categoryColors[category];
    const icon = categoryIcons[category];

    lines.push(
      color(`  ${icon} ${category.charAt(0).toUpperCase() + category.slice(1)}`)
    );

    for (const note of categoryNotes) {
      const shortId = note.id.slice(-6);
      const isGlobal = !note.projectPath;
      const scope = isGlobal ? c.dim(" (global)") : "";
      lines.push(`    ${c.dim(shortId)} ${note.content}${scope}`);
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

  const sections: string[] = [
    "<user-memory>",
    "The user has saved these notes/preferences:",
  ];

  for (const note of notes) {
    sections.push(`- [${note.category}] ${note.content}`);
  }

  sections.push("</user-memory>");

  return sections.join("\n");
}
