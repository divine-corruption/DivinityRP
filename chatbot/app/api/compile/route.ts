import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

const compilePrompt = `You are a Story Compiler for an immersive AI roleplay engine. You are given a roleplay conversation (and optionally the title of the story arc it belongs to). Your job is to compile it into a durable MEMORY entry for the character, so future conversations can recall what happened.

Produce a faithful, well-organized memory of the events, decisions, relationships, and revelations in this arc. Write it so the character (and the AI portraying them) can naturally reference it later.

Return ONLY valid JSON (no markdown, no code fences) in EXACTLY this shape:
{
  "title": "A short, evocative title for this memory (3-7 words).",
  "summary": "A 4-8 sentence third-person summary of what happened in this arc: key events, emotional beats, choices made, and how relationships changed. Written in past tense.",
  "keys": ["3-8 short keywords/triggers that should recall this memory — names, places, objects, events"]
}

Rules:
- Third-person, past tense.
- Be specific: capture concrete events and outcomes, not vague impressions.
- Output MUST be a single valid JSON object and nothing else.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript, arcTitle, characterName } = body;

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { error: "Nothing to compile — the conversation is empty." },
        { status: 400 }
      );
    }

    const header = [
      characterName && `Character: ${characterName}`,
      arcTitle && `Story Arc: ${arcTitle}`,
    ]
      .filter(Boolean)
      .join("\n");

    const text = await xaiChat({
      system: compilePrompt,
      messages: [
        {
          role: "user",
          content: `${header ? header + "\n\n" : ""}Compile the following roleplay conversation into a memory entry:\n\n${transcript}`,
        },
      ],
      maxTokens: 2048,
      responseFormat: { type: "json_object" },
    });

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const jsonStr =
      jsonStart !== -1 && jsonEnd !== -1
        ? text.slice(jsonStart, jsonEnd + 1)
        : text;

    let parsed: { title?: string; summary?: string; keys?: string[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "xAI returned a malformed memory. Please try compiling again." },
        { status: 502 }
      );
    }

    if (!parsed.summary) {
      return NextResponse.json(
        { error: "xAI returned an empty memory. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      title: parsed.title || arcTitle || "Compiled Memory",
      summary: parsed.summary,
      keys: Array.isArray(parsed.keys) ? parsed.keys : [],
    });
  } catch (error) {
    console.error("Compile API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to compile memory",
      },
      { status: 500 }
    );
  }
}
