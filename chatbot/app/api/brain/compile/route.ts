import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

/**
 * Character Brain summarizer.
 *
 * Two modes (ported from the Ooda Muse memory engine):
 *   - "batch":    distill a set of response chunks into a compact memory summary
 *   - "overview": consolidate memory-bank summaries into a single overview memory
 *
 * Uses the same xAI plumbing as /api/compile.
 */

const BATCH_SYSTEM = (characterName: string) =>
  `You are the Memory Engine for a roleplay character named ${characterName}.
Summarize the following roleplay excerpts into a concise, factual memory.
Rules:
- Use third person.
- Keep names, relationships, promises, conflicts, objectives, and key events.
- Avoid dialogue and prose; write compact memory notes.
- Do not include any content about the assistant being an AI.
- Keep it under 8 bullet points.
Return ONLY the memory notes (no preamble, no markdown fences).`;

const OVERVIEW_SYSTEM = (characterName: string) =>
  `You are the Memory Engine for a roleplay character named ${characterName}.
Create a comprehensive OVERVIEW memory from the provided memory-bank summaries.
Rules:
- Use third person.
- Consolidate recurring facts and timeline.
- Preserve key relationships, goals, conflicts, and unresolved threads.
- Avoid dialogue and prose; write compact memory notes.
- Keep it under 12 bullet points.
Return ONLY the overview memory (no preamble, no markdown fences).`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      characterName,
      chunks,
      mode,
      sessionTitle,
    }: {
      characterName?: string;
      chunks?: string[];
      mode?: "batch" | "overview";
      sessionTitle?: string;
    } = body;

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json(
        { error: "Nothing to summarize — no content provided." },
        { status: 400 }
      );
    }

    const name = characterName?.trim() || "the character";
    const isOverview = mode === "overview";
    const system = isOverview ? OVERVIEW_SYSTEM(name) : BATCH_SYSTEM(name);

    const header = sessionTitle ? `Session: ${sessionTitle}\n\n` : "";
    const userContent =
      header +
      chunks
        .map((c, i) => `${i + 1}. ${typeof c === "string" ? c : String(c)}`)
        .join("\n\n");

    const summary = await xaiChat({
      system,
      messages: [{ role: "user", content: userContent }],
      maxTokens: isOverview ? 1200 : 800,
    });

    const trimmed = (summary || "").trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "xAI returned an empty memory. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary: trimmed });
  } catch (error) {
    console.error("Brain compile API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to compile memory",
      },
      { status: 500 }
    );
  }
}
