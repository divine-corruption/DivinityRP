/**
 * Conversation thread registry.
 *
 * DIVINE roleplay chats are a single-page experience (the URL stays at `/`),
 * so we cannot rely on `/chat/<id>` routing to give each conversation a stable,
 * persistent identity. Without a stable id every chat was treated as a brand-new
 * throwaway chat: history never resumed and "begin a new story arc" silently
 * dumped its opening line into whatever chat happened to be open.
 *
 * This module gives every conversation a STABLE chatId (a real UUID, because the
 * DB `Message_v2.chatId` column is a uuid) and records it in localStorage so:
 *
 *   - Selecting a character resumes that character's existing conversation.
 *   - Beginning a story arc opens a SEPARATE conversation thread (a brand-new
 *     conversation) whose full history is stored under that thread.
 *   - Reloading the page resumes the exact same thread (history persists).
 *
 * The actual messages live server-side in the database keyed by the thread's
 * chatId; this registry only maps (character, arc) -> chatId on the client.
 */

import { generateUUID } from "@/lib/utils";

export interface ConversationThread {
  /** Stable UUID used as the chat/thread id (also the DB chatId). */
  id: string;
  /** Owning character id. */
  characterId: string;
  /** Story-arc node id, or undefined for the character's default thread. */
  arcId?: string;
  /** Human label for the thread (arc title, or "Free Roleplay"). */
  title: string;
  createdAt: number;
  lastOpenedAt: number;
}

const REGISTRY_KEY = "divine_conversation_threads";
/** Remembers the most-recently active thread id per character. */
const LAST_THREAD_PREFIX = "divine_last_thread:";

function readRegistry(): ConversationThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ConversationThread[]) : [];
  } catch {
    return [];
  }
}

function writeRegistry(threads: ConversationThread[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(threads));
  } catch {
    // storage full / unavailable — non-critical
  }
}

/** All threads belonging to a character, most-recent first. */
export function listThreadsForCharacter(
  characterId: string
): ConversationThread[] {
  return readRegistry()
    .filter((t) => t.characterId === characterId)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/**
 * Find the existing thread for a (character, arc) pair, or null. An arc thread
 * is matched by arcId; the default thread is the one with no arcId.
 */
export function findThread(
  characterId: string,
  arcId?: string
): ConversationThread | null {
  const threads = readRegistry();
  const match = threads.find(
    (t) => t.characterId === characterId && t.arcId === arcId
  );
  return match ?? null;
}

/**
 * Get the stable thread for a (character, arc) pair, creating it if needed.
 * Returns the thread and whether it was freshly created (so callers can decide
 * to seed an opening message).
 */
export function ensureThread(params: {
  characterId: string;
  arcId?: string;
  title: string;
}): { thread: ConversationThread; created: boolean } {
  const { characterId, arcId, title } = params;
  const threads = readRegistry();
  const existing = threads.find(
    (t) => t.characterId === characterId && t.arcId === arcId
  );
  if (existing) {
    existing.lastOpenedAt = Date.now();
    if (title) existing.title = title;
    writeRegistry(threads);
    rememberLastThread(characterId, existing.id);
    return { thread: existing, created: false };
  }
  const thread: ConversationThread = {
    id: generateUUID(),
    characterId,
    arcId,
    title: title || (arcId ? "Story Arc" : "Free Roleplay"),
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  };
  threads.push(thread);
  writeRegistry(threads);
  rememberLastThread(characterId, thread.id);
  return { thread, created: true };
}

/**
 * Force-create a brand-new arc thread even if one already exists for that arc.
 * Used when the user explicitly wants to (re)start an arc as a fresh
 * conversation. The arcId is suffixed with the timestamp so multiple
 * playthroughs of the same arc each get their own history.
 */
export function createArcThread(params: {
  characterId: string;
  arcId: string;
  title: string;
}): ConversationThread {
  const { characterId, arcId, title } = params;
  const threads = readRegistry();
  const thread: ConversationThread = {
    id: generateUUID(),
    characterId,
    // Keep the base arcId so the active-arc context still resolves, but make the
    // thread key unique per playthrough.
    arcId: `${arcId}:${Date.now()}`,
    title: title || "Story Arc",
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  };
  threads.push(thread);
  writeRegistry(threads);
  rememberLastThread(characterId, thread.id);
  return thread;
}

/**
 * Force-create a brand-new conversation thread for a character (NOT tied to a
 * story arc). This is the primary "New Conversation" path: every call yields a
 * fresh, independently-persisted chat with its own history. The thread carries
 * no arcId, so it resolves as a normal free-roleplay conversation.
 */
export function createNewThread(params: {
  characterId: string;
  title?: string;
}): ConversationThread {
  const { characterId, title } = params;
  const threads = readRegistry();
  const count = threads.filter((t) => t.characterId === characterId).length;
  const thread: ConversationThread = {
    id: generateUUID(),
    characterId,
    arcId: undefined,
    title: title?.trim() || `Conversation ${count + 1}`,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  };
  threads.push(thread);
  writeRegistry(threads);
  rememberLastThread(characterId, thread.id);
  return thread;
}

/** Rename a thread (used by the conversation list inline rename). */
export function renameThread(id: string, title: string): void {
  const threads = readRegistry();
  const t = threads.find((x) => x.id === id);
  if (t) {
    t.title = title.trim() || t.title;
    writeRegistry(threads);
  }
}

export function touchThread(id: string): void {
  const threads = readRegistry();
  const t = threads.find((x) => x.id === id);
  if (t) {
    t.lastOpenedAt = Date.now();
    writeRegistry(threads);
    rememberLastThread(t.characterId, t.id);
  }
}

export function deleteThread(id: string): void {
  writeRegistry(readRegistry().filter((t) => t.id !== id));
}

export function rememberLastThread(characterId: string, threadId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LAST_THREAD_PREFIX}${characterId}`, threadId);
  } catch {
    // non-critical
  }
}

export function getLastThreadId(characterId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${LAST_THREAD_PREFIX}${characterId}`);
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------------------
 * Active thread signal.
 *
 * The roleplay layer (character/arc selection) needs to tell the chat hook
 * which thread to open. Because they live in sibling React trees we bridge them
 * through localStorage + a custom event rather than threading props everywhere.
 * ------------------------------------------------------------------------- */

const ACTIVE_THREAD_KEY = "divine_active_thread";
export const ACTIVE_THREAD_EVENT = "divine:active-thread";

export function setActiveThreadId(threadId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_THREAD_KEY, threadId);
    window.dispatchEvent(
      new CustomEvent(ACTIVE_THREAD_EVENT, { detail: threadId })
    );
  } catch {
    // non-critical
  }
}

export function getActiveThreadId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_THREAD_KEY);
  } catch {
    return null;
  }
}
