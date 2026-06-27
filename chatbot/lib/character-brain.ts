/**
 * Character Brain — per-character cross-session memory.
 *
 * Ported in concept from the Ooda Muse Engine. A character accumulates raw
 * "response chunks" from conversations. When a conversation is closed/compiled:
 *   - chunks are appended to recentResponses
 *   - every CHUNKS_PER_SUMMARY chunks distill into one memoryBank summary
 *   - short sessions (< CHUNKS_PER_SUMMARY) still produce one session summary
 *   - once memoryBank reaches OVERVIEW_MIN_SUMMARIES, a single overviewMemory
 *     is regenerated from all summaries
 *
 * The overviewMemory is injected into the system prompt so the character
 * "remembers" across separate conversations. Summarization is delegated to the
 * server (`/api/brain/compile`) which uses the same xAI plumbing as /api/compile.
 *
 * Brain lives on the Character object (persisted in localStorage alongside the
 * rest of the character via the roleplay store), matching how DivinityRP already
 * persists characters client-side.
 */

import type {
  CharacterBrain,
  CharacterMemoryChunk,
  CharacterMemorySummary,
} from "./types";
import { generateUUID } from "./utils";

/** Raw response chunks per distilled memoryBank summary. */
export const CHUNKS_PER_SUMMARY = 25;
/** Minimum memoryBank summaries before an overviewMemory is generated. */
export const OVERVIEW_MIN_SUMMARIES = 3;

export function emptyBrain(): CharacterBrain {
  return {
    recentResponses: [],
    memoryBank: [],
    overviewMemory: "",
    updatedAt: Date.now(),
  };
}

export function ensureBrain(brain: CharacterBrain | undefined): CharacterBrain {
  return brain ?? emptyBrain();
}

/** Server summarizer modes (mirrors the /api/brain/compile contract). */
type SummarizeFn = (
  characterName: string,
  chunks: string[],
  mode: "batch" | "overview",
  sessionTitle?: string
) => Promise<string>;

export interface CompileBrainParams {
  characterName: string;
  /** Existing brain (may be undefined for a first compile). */
  brain: CharacterBrain | undefined;
  /** Assistant response texts from the conversation being compiled. */
  responseChunks: string[];
  /** Title of the conversation/session being compiled (labels short sessions). */
  sessionTitle?: string;
  /** Calls the server to summarize. Injected so this stays pure/testable. */
  summarize: SummarizeFn;
}

/**
 * Compile a conversation's responses into the character's brain.
 * Returns the updated brain. Mirrors the Ooda Muse CharacterChat compile flow.
 */
export async function compileBrain({
  characterName,
  brain,
  responseChunks,
  sessionTitle,
  summarize,
}: CompileBrainParams): Promise<CharacterBrain> {
  const base = ensureBrain(brain);

  const newChunks: CharacterMemoryChunk[] = responseChunks.map((content) => ({
    id: generateUUID(),
    createdAt: Date.now(),
    content,
  }));

  const recentResponses = [...base.recentResponses, ...newChunks];
  const memoryBank: CharacterMemorySummary[] = [...base.memoryBank];

  // Distill every full batch of CHUNKS_PER_SUMMARY into a memoryBank summary.
  while (recentResponses.length >= CHUNKS_PER_SUMMARY) {
    const batch = recentResponses.splice(0, CHUNKS_PER_SUMMARY);
    const summary = await summarize(
      characterName,
      batch.map((b) => b.content),
      "batch"
    );
    memoryBank.push({
      id: generateUUID(),
      createdAt: Date.now(),
      content: summary,
      sourceCount: batch.length,
    });
  }

  // Short sessions still get committed to memory so small chats aren't lost.
  if (responseChunks.length > 0 && responseChunks.length < CHUNKS_PER_SUMMARY) {
    const sessionSummary = await summarize(
      characterName,
      responseChunks,
      "batch",
      sessionTitle
    );
    memoryBank.push({
      id: generateUUID(),
      createdAt: Date.now(),
      content: sessionTitle
        ? `[Session: ${sessionTitle}] ${sessionSummary}`
        : sessionSummary,
      sourceCount: responseChunks.length,
    });
  }

  // Regenerate the consolidated overview once enough summaries exist.
  let overviewMemory = base.overviewMemory || "";
  if (memoryBank.length >= OVERVIEW_MIN_SUMMARIES) {
    overviewMemory = await summarize(
      characterName,
      memoryBank.map((m) => m.content),
      "overview"
    );
  }

  return {
    recentResponses,
    memoryBank,
    overviewMemory,
    updatedAt: Date.now(),
  };
}

/**
 * The string injected into the system prompt for this character's memory.
 * Prefers the consolidated overview; falls back to the most recent summaries.
 */
export function brainToPromptMemory(brain: CharacterBrain | undefined): string {
  if (!brain) return "";
  if (brain.overviewMemory?.trim()) return brain.overviewMemory.trim();
  if (brain.memoryBank.length > 0) {
    return brain.memoryBank
      .slice(-OVERVIEW_MIN_SUMMARIES)
      .map((m) => m.content)
      .join("\n\n");
  }
  return "";
}
