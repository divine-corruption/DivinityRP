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

const forgePrompt = `You are the Character Forger — a master roleplay author and worldbuilder for an immersive AI roleplay engine. The user provides:
1. A character concept (with optional name, appearance, personality, backstory)
2. Up to 4 reference images (Portrait, Action, Environment, Mood)

STEP 1 — ANALYZE THE IMAGES. Study each image closely and describe concrete visual detail: facial features, expression, hair, eyes, clothing/armor, color palette, pose, body language, setting, props, weather, lighting, atmosphere, and the emotional mood it evokes. Weave these specifics into every field below — the character must visibly match the references.

STEP 2 — AUTHOR A DEEP, IMMERSIVE CHARACTER. Don't write a flat profile; write a person with interiority, contradictions, wants, fears, and a living world around them. Favor vivid, sensory, show-don't-tell prose. Avoid clichés and generic filler.

Return ONLY valid JSON (no markdown, no code fences) in EXACTLY this shape:
{
  "name": "Character Name",
  "description": "3-4 vivid sentences: who they are, what they look like (grounded in the images), and the single tension that defines them right now.",
  "personality": "A rich paragraph covering core traits, virtues AND flaws, contradictions, values, fears, desires, speech style, mannerisms and quirks. Make them feel real and specific.",
  "appearance": "A concrete physical description drawn directly from the reference images — features, build, attire, distinguishing marks, signature details.",
  "scenario": "The immersive present-moment setting (4-6 sentences): the world, the stakes, the relationships, and the situation the user is dropped into. Establish mood, time, place and what is at stake right now.",
  "first_mes": "The character's opening message — fully in-character, written in immersive RP prose with *action/scene beats in asterisks* and dialogue. 2-4 paragraphs that establish voice, set the scene and hook the user with an immediate choice, question or tension. Address the user naturally.",
  "mes_example": "An example exchange showing the character's voice. Use the format: <START>\\n{{user}}: ...\\n{{char}}: *action* \\"dialogue\\" ... (1-2 short exchanges).",
  "tags": ["6-10 specific, evocative tags: genre, archetype, tone, setting, themes"],
  "system_prompt_override": "Concrete directorial guidance for how the AI should play this character: voice, pacing, do's and don'ts, how they treat the user, narrative style.",
  "alternate_greetings": [
    "An alternate immersive opening for a DIFFERENT story arc/scenario (same character), in full RP prose.",
    "A second alternate opening for another distinct arc — different tone or premise.",
    "A third alternate opening for another distinct arc."
  ],
  "story_arcs": [
    { "title": "Evocative arc name", "tone": "Romance | Mystery | Dark | Adventure | Drama | etc.", "summary": "1-2 sentence pitch of this arc's premise and central tension.", "hook": "A specific inciting incident or opening situation that launches this arc." },
    { "title": "...", "tone": "...", "summary": "...", "hook": "..." },
    { "title": "...", "tone": "...", "summary": "...", "hook": "..." }
  ],
  "creator_notes": "A short note on the character's themes, intended dynamic with the user, and how to get the best roleplay out of them.",
  "image_analysis": [
    { "scene": "Portrait", "url": "URL", "description": "2-3 sentences on exactly what the portrait shows and what it reveals about the character." },
    { "scene": "Action", "url": "URL", "description": "2-3 sentences on the action image." },
    { "scene": "Environment", "url": "URL", "description": "2-3 sentences on the environment image." },
    { "scene": "Mood", "url": "URL", "description": "2-3 sentences on the mood image." }
  ]
}

Rules:
- Write at least 3 alternate_greetings and at least 3 story_arcs, each genuinely distinct in premise/tone.
- Only include image_analysis entries for images that were actually provided.
- Keep prose immersive and second-person-friendly. Never break character inside first_mes / greetings.
- Output MUST be a single valid JSON object and nothing else.`;

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

    const images = Array.isArray(reference_images)
      ? (reference_images as { scene: string; url: string }[]).filter(
          (r) => r && r.url
        )
      : [];

    if (images.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one reference image to forge a character" },
        { status: 400 }
      );
    }

    const imageParts = await Promise.all(
      images.map(async (img) => ({
        type: "image_url" as const,
        image_url: { url: await urlToDataUri(img.url) },
      }))
    );

    // Build message content: text + images (OpenAI-compatible format)
    const content = [
      {
        type: "text" as const,
        text: `Character concept:\n${userInput}\n\nAnalyze the ${images.length} reference image(s) (${images
          .map((i) => i.scene)
          .join(", ")}) and author a complete, immersive character card. Only include image_analysis entries for the images provided.`,
      },
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
