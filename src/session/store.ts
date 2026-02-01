import { readFile, writeFile, mkdir, readdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Message } from "../providers/types.js";

export interface SessionMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  workingDirectory: string;
  provider: string;
  model: string;
  messageCount: number;
  summary?: string;
}

export interface Session {
  metadata: SessionMetadata;
  messages: Message[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

const SESSIONS_DIR = join(homedir(), ".kaldi", "sessions");

async function ensureSessionsDir(): Promise<void> {
  if (!existsSync(SESSIONS_DIR)) {
    await mkdir(SESSIONS_DIR, { recursive: true });
  }
}

export function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const random = Math.random().toString(36).slice(2, 6);
  return `${date}-${time}-${random}`;
}

export async function saveSession(session: Session): Promise<void> {
  await ensureSessionsDir();

  const filePath = join(SESSIONS_DIR, `${session.metadata.id}.json`);
  session.metadata.updatedAt = new Date().toISOString();
  session.metadata.messageCount = session.messages.length;

  await writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Session;
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<SessionMetadata[]> {
  await ensureSessionsDir();

  const files = await readdir(SESSIONS_DIR);
  const sessions: SessionMetadata[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    try {
      const content = await readFile(join(SESSIONS_DIR, file), "utf-8");
      const session = JSON.parse(content) as Session;
      sessions.push(session.metadata);
    } catch {
      // Skip invalid sessions
    }
  }

  // Sort by most recent first
  sessions.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return sessions;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);

  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getLatestSession(): Promise<Session | null> {
  const sessions = await listSessions();
  if (sessions.length === 0) return null;

  return loadSession(sessions[0].id);
}

export async function getSessionForDirectory(dir: string): Promise<Session | null> {
  const sessions = await listSessions();

  for (const metadata of sessions) {
    if (metadata.workingDirectory === dir) {
      return loadSession(metadata.id);
    }
  }

  return null;
}

export function createSession(
  workingDirectory: string,
  provider: string,
  model: string
): Session {
  return {
    metadata: {
      id: generateSessionId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workingDirectory,
      provider,
      model,
      messageCount: 0,
    },
    messages: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };
}

export function getSessionsDir(): string {
  return SESSIONS_DIR;
}
