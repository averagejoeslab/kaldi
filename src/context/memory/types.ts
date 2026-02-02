/**
 * Memory Types
 *
 * User notes and preferences that persist across sessions.
 * Separate from KALDI.md which is project context.
 */

export type NoteCategory = "fact" | "preference" | "learning" | "todo" | "general";

export interface Note {
  id: string;
  content: string;
  category: NoteCategory;
  createdAt: string;
  projectPath?: string; // undefined = global note
}

export interface NotesStore {
  version: number;
  notes: Note[];
  lastUpdated: string;
}

export interface MemoryConfig {
  storePath?: string;
  projectPath?: string;
}
