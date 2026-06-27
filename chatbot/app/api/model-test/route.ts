import { NextResponse } from "next/server";
import { xaiChat } from "@/lib/xai";

/**
 * Model Tester — run the same prompt across several models and return each
 * result with timing, so the user can compare roleplay quality side by side.
 * (Ported from the Ooda Muse Engine ModelTester.)
 *
 * DivinityRP serves via xAI, so the candidate set is xAI Grok variants. The
 * request may pass an explicit `models` list; otherwise a sensible default set
 * is used.
 */

const DEFAULT_MODELS = ["grok-4.3", "grok-3", "grok-3-mini"];
const MAX_MODELS = 5;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      systemPrompt,
      models,
    }: { prompt?: string; systemPrompt?: string; models?: string[] } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "A test prompt is required." },
        { status: 400 }
      );
    }

    const candidates = (
      Array.isArray(models) && models.length > 0 ? models : DEFAULT_MODELS
    )
      .map((m) => String(m).trim())
      .filter(Boolean)
      .slice(0, MAX_MODELS);

    const system =
      systemPrompt?.trim() ||
      "You are a roleplay engine. Respond in immersive third-person narrative prose.";

    const results = await Promise.all(
      candidates.map(async (model) => {
        const started = Date.now();
        try {
          const response = await xaiChat({
            model,
            system,
            messages: [{ role: "user", content: prompt }],
            maxTokens: 1024,
          });
          return {
            model,
            response: response.trim(),
            durationMs: Date.now() - started,
          };
        } catch (err) {
          return {
            model,
            response: "",
            error: err instanceof Error ? err.message : "Request failed",
            durationMs: Date.now() - started,
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Model test API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run model test",
      },
      { status: 500 }
    );
  }
}
