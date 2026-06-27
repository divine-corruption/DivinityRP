"use client";

/**
 * Client helper for compiling a conversation into a character's brain.
 * Calls /api/brain/compile (server xAI summarizer) and applies the rollup
 * logic in lib/character-brain.ts.
 */

import { compileBrain } from "@/lib/character-brain";
import type { CharacterBrain } from "@/lib/types";

async function summarizeViaApi(
  characterName: string,
  chunks: string[],
  mode: "batch" | "overview",
  sessionTitle?: string
): Promise<string> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/brain/compile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterName, chunks, mode, sessionTitle }),
    }
  );
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    throw new Error(error || "Brain compile failed");
  }
  const data = (await res.json()) as { summary?: string };
  return data.summary ?? "";
}

/**
 * Compile a conversation's assistant responses into the character's brain.
 * Returns the updated brain (caller persists it via updateCharacter).
 */
export async function compileConversationToBrain(params: {
  characterName: string;
  brain: CharacterBrain | undefined;
  /** Assistant response texts from the conversation. */
  responseChunks: string[];
  sessionTitle?: string;
}): Promise<CharacterBrain> {
  return compileBrain({
    characterName: params.characterName,
    brain: params.brain,
    responseChunks: params.responseChunks,
    sessionTitle: params.sessionTitle,
    summarize: summarizeViaApi,
  });
}
