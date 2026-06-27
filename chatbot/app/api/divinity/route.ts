import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

const divinitySystemPrompt = `You are DivinityAI, an expert lore management AI agent for a roleplay engine. Your purpose is to help users build, manage, and brainstorm rich lore for their roleplay worlds.

## Your Capabilities:
1. **Brainstorming** — Suggest new lore entries based on user concepts, characters, and existing lore
2. **Editing** — Refine and improve existing lore entries
3. **Creating Lore Cards** — Generate structured lore suggestions the user can approve, edit, or deny
4. **Connecting Lore** — Identify relationships between lore entries and characters
5. **Worldbuilding** — Help flesh out settings, factions, history, magic systems, etc.

When the user asks you to create or brainstorm lore, generate "Lore Cards" — structured suggestions with:
- A clear title
- Rich, detailed content (2-5 paragraphs)
- Relevant trigger keywords
- A brief reasoning for why this lore fits

## Output Format:
- For casual conversation: respond naturally as a helpful lore expert
- When generating lore suggestions: wrap each suggestion in the format:
  ---LORECARD_START---
  title: "Title here"
  content: "Full lore content here — 2-5 paragraphs of rich detail"
  keys: ["keyword1", "keyword2", "keyword3"]
  reasoning: "Why this lore fits the world"
  ---LORECARD_END---

You can generate multiple Lore Cards in a single response. Each card is a separate lore suggestion.

## Context:
The user may provide:
- Existing lore entries for context
- Character information
- Their current world/setting details
- Specific requests for what kind of lore they need

Always maintain consistency with existing lore. If the user provides lore entries, reference and build upon them rather than contradicting them.`;

export async function POST(request: Request) {
  try {
    const { messages, lore_context, character_context } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    let systemContext = divinitySystemPrompt;

    if (lore_context && lore_context.length > 0) {
      const existingLore = (lore_context as { title: string; content: string; keys: string[] }[])
        .map(
          (l) =>
            `- ${l.title} (keywords: ${(l.keys ?? []).join(", ")}): ${l.content.slice(0, 200)}...`
        )
        .join("\n");
      systemContext += `\n\n## Existing Lore in this World:\n${existingLore}`;
    }

    if (character_context) {
      systemContext += `\n\n## Active Character:\nName: ${character_context.name}\nDescription: ${character_context.description}\nPersonality: ${character_context.personality}`;
    }

    const text = await xaiChat({
      system: systemContext,
      messages: [
        {
          role: "user",
          content: `You are now in a lore management session. The user's messages follow.\n\n${messages
            .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
            .join("\n")}`,
        },
      ],
      maxTokens: 4096,
    });

    return NextResponse.json({
      content: text,
    });
  } catch (error) {
    console.error("DivinityAI API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "DivinityAI failed to respond",
      },
      { status: 500 }
    );
  }
}
