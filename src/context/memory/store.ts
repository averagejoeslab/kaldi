/**
 * Memory Store
 *
 * Persistence layer for user notes.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { NotesStore, MemoryConfig } from "./types.js";

const NOTES_DIR = join(homedir(), ".kaldi", "notes");
const GLOBAL_NOTES_FILE = join(NOTES_DIR, "global.json");

/**
 * Ensure notes directory exists
 */
function ensureNotesDir(dir: string = NOTES_DIR): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create a safe filename from a project path
 */
function getProjectNotesPath(projectPath: string): string {
  const safeName = projectPath.replace(/[^a-zA-Z0-9]/g, "_").slice(-50);
  return join(NOTES_DIR, `project_${safeName}.json`);
}

/**
 * Load notes from a file
 */
export function loadNotesFile(path: string): NotesStore {
  if (!existsSync(path)) {
    return {
      version: 1,
      notes: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as NotesStore;
  } catch {
    return {
      version: 1,
      notes: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Save notes to a file
 */
export function saveNotesFile(path: string, store: NotesStore): void {
  ensureNotesDir();
  store.lastUpdated = new Date().toISOString();
  writeFileSync(path, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Get the path for global notes
 */
export function getGlobalNotesPath(): string {
  return GLOBAL_NOTES_FILE;
}

/**
 * Get the path for project-specific notes
 */
export function getProjectNotesFilePath(
  projectPath: string = process.cwd()
): string {
  return getProjectNotesPath(projectPath);
}

/**
 * Load global notes store
 */
export function loadGlobalNotes(): NotesStore {
  return loadNotesFile(GLOBAL_NOTES_FILE);
}

/**
 * Load project-specific notes store
 */
export function loadProjectNotes(
  projectPath: string = process.cwd()
): NotesStore {
  return loadNotesFile(getProjectNotesPath(projectPath));
}

/**
 * Save global notes store
 */
export function saveGlobalNotes(store: NotesStore): void {
  saveNotesFile(GLOBAL_NOTES_FILE, store);
}

/**
 * Save project-specific notes store
 */
export function saveProjectNotes(
  store: NotesStore,
  projectPath: string = process.cwd()
): void {
  saveNotesFile(getProjectNotesPath(projectPath), store);
}
