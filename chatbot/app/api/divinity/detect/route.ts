import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

const detectLorePrompt = `You are a lore detection AI for a roleplay engine. Your job is to read roleplay conversation and detect if any new, noteworthy lore has been introduced that should be saved as a lore entry.

Look for:
- New locations, factions, items, or characters mentioned
- Historical events or backstory revealed
- Worldbuilding details (magic systems, rules, customs)
- Relationships or alliances revealed
- Prophecies, legends, or myths mentioned
- New species, creatures, or technologies

If NO significant new lore is introduced, respond with exactly: {"detected": false}

If lore IS detected, respond with:
{
  "detected": true,
  "suggestion": {
    "title": "Short title for the lore entry",
    "content": "2-4 paragraphs of rich lore content based on what was revealed",
    "keys": ["keyword1", "keyword2"],
    "reasoning": "Why this is important lore to save"
  }
}

Be selective — only flag genuinely new and significant lore, not minor details or obvious statements. If the lore was already established in previous entries provided in context, do not flag it again.`;

export async function POST(request: Request) {
  try {
    const { conversation_history, existing_lore } = await request.json();

    if (!conversation_history || !Array.isArray(conversation_history)) {
      return NextResponse.json(
        { error: "conversation_history array is required" },
        { status: 400 }
      );
    }

    let context = "";

    if (existing_lore && existing_lore.length > 0) {
      const loreSummary = (existing_lore as { title: string; content: string }[])
        .map((l) => `- ${l.title}: ${l.content.slice(0, 150)}...`)
        .join("\n");
      context = `## Already Established Lore:\n${loreSummary}\n\n`;
    }

    const recentMessages = conversation_history.slice(-6);
    const conversationText = recentMessages
      .map(
        (m: { role: string; content: string }) =>
          `${m.role === "assistant" ? "Character" : "User"}: ${m.content}`
      )
      .join("\n\n");

    const responseText = await xaiChat({
      system: detectLorePrompt,
      messages: [
        {
          role: "user",
          content: `${context}## Recent Conversation:\n${conversationText}\n\nDetect if new significant lore was introduced.`,
        },
      ],
      maxTokens: 2048,
    });

    const trimmed = responseText.trim();
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    const jsonStr =
      jsonStart !== -1 && jsonEnd !== -1
        ? trimmed.slice(jsonStart, jsonEnd + 1)
        : trimmed;

    const parsed = JSON.parse(jsonStr);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Lore detection error:", error);
    // Fail silently — lore detection is non-critical
    return NextResponse.json({ detected: false });
  }
}
