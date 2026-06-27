import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

const arcSystemPrompt = `You are a Story Architect for an AI roleplay engine. Given a character, you design distinct, compelling STORY ARCS (scenarios) the user can choose to roleplay through.

Each arc must feel meaningfully different in tone, stakes and premise — not minor variations. Draw on the character's personality, scenario and lore.

Return ONLY valid JSON (no markdown, no code fences) in this exact shape:
{
  "arcs": [
    {
      "title": "Short evocative arc name",
      "tone": "One or two words, e.g. Romance, Mystery, Dark, Adventure, Slice-of-life",
      "summary": "1-2 sentence pitch of the arc and its central tension",
      "scenario": "A full scenario block (3-5 sentences) describing the setting, circumstances and the situation the user steps into. Written to be used as the character's active scenario.",
      "first_mes": "The character's immersive opening message for this arc, in-character, that hooks the user."
    }
  ]
}

Generate exactly 4 arcs. Make them diverse.`;

export async function POST(request: Request) {
  try {
    const { character } = await request.json();

    if (!character || !character.name) {
      return NextResponse.json(
        { error: "Character is required" },
        { status: 400 }
      );
    }

    const userInput = [
      `Name: ${character.name}`,
      character.description && `Description: ${character.description}`,
      character.personality && `Personality: ${character.personality}`,
      character.scenario && `Base Scenario: ${character.scenario}`,
      Array.isArray(character.tags) &&
        character.tags.length > 0 &&
        `Tags: ${character.tags.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const text = await xaiChat({
      system: arcSystemPrompt,
      messages: [
        {
          role: "user",
          content: `Design 4 distinct story arcs for this character:\n\n${userInput}`,
        },
      ],
      maxTokens: 4096,
    });

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const jsonStr =
      jsonStart !== -1 && jsonEnd !== -1
        ? text.slice(jsonStart, jsonEnd + 1)
        : text;

    const parsed = JSON.parse(jsonStr);
    const arcs = Array.isArray(parsed.arcs) ? parsed.arcs : [];

    return NextResponse.json({ arcs });
  } catch (error) {
    console.error("Story arcs API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate story arcs",
      },
      { status: 500 }
    );
  }
}
