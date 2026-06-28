import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

const generatorPrompt = `You are a System Prompt Generator for an immersive AI roleplay engine. Given a character's details, write a concise but powerful SYSTEM PROMPT that directs how the AI should portray this specific character in roleplay.

The system prompt you write is directorial guidance for the AI actor — NOT a character bio. It should cover:
- Voice & speech style (how they talk, vocabulary, cadence, verbal tics).
- Behavioral do's and don'ts (what this character would and would never do).
- How they treat and respond to the user.
- Narrative pacing and tone to maintain.
- Any hard rules that keep them in character.
- How to keep dialogue natural, varied, and story-forward rather than repetitive.

STYLE REQUIREMENTS for the portrayal you instruct:
- Narration must be third-person, present tense.
- ALL spoken dialogue must be wrapped in double quotation marks.
- Immersive, show-don't-tell prose.
- Favor fresh phrasing, avoid repeating the same adjectives or sentence patterns, and ensure each reply builds on the prior scene.

Output ONLY the system prompt text — no preamble, no markdown headers, no code fences, no quotes around the whole thing. Write it as direct second-person instructions to the AI (e.g. "You play X. You speak in...", "Always...", "Never..."). Keep it focused: 150-350 words.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, personality, scenario, tags, mesExample } = body;

    const details = [
      name && `Name: ${name}`,
      description && `Description: ${description}`,
      personality && `Personality: ${personality}`,
      scenario && `Scenario: ${scenario}`,
      Array.isArray(tags) && tags.length > 0 && `Tags: ${tags.join(", ")}`,
      mesExample && `Example dialogue: ${mesExample}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (!details) {
      return NextResponse.json(
        { error: "Provide at least a name or description to generate a system prompt." },
        { status: 400 }
      );
    }

    const text = await xaiChat({
      system: generatorPrompt,
      messages: [
        {
          role: "user",
          content: `Write a system prompt for portraying this character:\n\n${details}`,
        },
      ],
      maxTokens: 1024,
      temperature: 0.8,
    });

    const systemPrompt = text.trim();
    if (!systemPrompt) {
      return NextResponse.json(
        { error: "xAI returned an empty system prompt. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ systemPrompt });
  } catch (error) {
    console.error("System prompt generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate system prompt",
      },
      { status: 500 }
    );
  }
}
