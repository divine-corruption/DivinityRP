import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

async function urlToDataUri(url: string): Promise<string> {
  // If already a data URI, return as-is
  if (url.startsWith("data:")) return url;
  // If https, pass through (xAI supports it)
  if (url.startsWith("https://")) return url;
  // For http (local dev), fetch server-side and convert to base64 data URI
  const resp = await fetch(url);
  const buf = Buffer.from(await resp.arrayBuffer());
  const mime = resp.headers.get("content-type") ?? "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const forgePrompt = `You are a Character Forger for an AI roleplay engine. The user has provided:
1. A character concept with optional name, appearance, personality, backstory
2. Exactly 4 reference images (Portrait, Action, Environment, Mood)

Carefully analyze each image. Describe what you see: appearance, expression, clothing, colors, pose, setting, mood, lighting, atmosphere. Use the visual details from ALL four images to inform every part of the character card.

Generate a complete character card in valid JSON:
{
  "name": "Character Name",
  "description": "2-3 sentence summary of who they are, informed by the images and concept",
  "personality": "Detailed personality description covering traits, flaws, quirks, values, and demeanor",
  "scenario": "The current situation or world they exist in — setting, circumstances, relationships",
  "first_mes": "The character's first message — immersive, in-character, hooks the user immediately",
  "mes_example": "A short example dialogue, written as EXAMPLE: followed by dialogue",
  "tags": ["tag1", "tag2", "tag3"],
  "system_prompt_override": "Any specific behavior instructions",
  "alternate_greetings": ["Alternative first message 1", "Alternative first message 2", "Alternative first message 3"],
  "creator_notes": "Notes about this character's creation",
  "image_analysis": [
    { "scene": "Portrait", "url": "URL", "description": "2-3 sentences describing what the portrait image shows" },
    { "scene": "Action", "url": "URL", "description": "2-3 sentences describing what the action image shows" },
    { "scene": "Environment", "url": "URL", "description": "2-3 sentences describing what the environment image shows" },
    { "scene": "Mood", "url": "URL", "description": "2-3 sentences describing what the mood image shows" }
  ]
}

Return ONLY valid JSON with no markdown formatting, no code blocks, no explanation.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { concept, name, appearance, personality, backstory, reference_images } = body;

    const userInput = [
      concept && `Concept: ${concept}`,
      name && `Desired Name: ${name}`,
      appearance && `Appearance: ${appearance}`,
      personality && `Personality: ${personality}`,
      backstory && `Backstory: ${backstory}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (!userInput) {
      return NextResponse.json(
        { error: "At least a concept is required" },
        { status: 400 }
      );
    }

    if (!reference_images || reference_images.length !== 4) {
      return NextResponse.json(
        { error: "Exactly 4 reference images (Portrait, Action, Environment, Mood) are required" },
        { status: 400 }
      );
    }

    const imageParts = await Promise.all(
      (reference_images as { scene: string; url: string }[]).map(
        async (img) => ({
          type: "image_url" as const,
          image_url: { url: await urlToDataUri(img.url) },
        })
      )
    );

    // Build message content: text + 4 images (OpenAI-compatible format)
    const content = [
      { type: "text" as const, text: `Character concept:\n${userInput}\n\nAnalyze these 4 reference images and generate the character card using the image analysis fields.` },
      ...imageParts,
    ];

    const text = await xaiChat({
      system: forgePrompt,
      messages: [{ role: "user", content }],
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    });

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const jsonStr =
      jsonStart !== -1 && jsonEnd !== -1
        ? text.slice(jsonStart, jsonEnd + 1)
        : text;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        {
          error:
            "Grok returned a malformed character card. Please try forging again.",
        },
        { status: 502 }
      );
    }

    const imageAnalysis = parsed.image_analysis;
    if (Array.isArray(imageAnalysis) && reference_images) {
      parsed.image_analysis = (
        imageAnalysis as { scene: string; url: string; description: string }[]
      ).map((ia) => {
        const match = (reference_images as { scene: string; url: string }[]).find(
          (r) => r.scene === ia.scene
        );
        return { ...ia, url: match?.url ?? ia.url ?? "" };
      });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Forge API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to forge character",
      },
      { status: 500 }
    );
  }
}
