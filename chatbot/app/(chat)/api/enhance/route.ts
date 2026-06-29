import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { enhanceResponse, workers } from "@/lib/workers";
import { getMessageById, updateMessage } from "@/lib/db/queries";

/**
 * POST /api/enhance
 * -----------------
 * Auto-upgrade pass for a roleplay reply. The chat UI streams the live draft as
 * usual, then (when enhancement is enabled) calls this endpoint with the
 * finished message; we ask the enhance-worker to enrich the dialogue and swap
 * the richer version back in.
 *
 * Body:
 *   { messageId?, draft, character?, recentContext?, intensity? }
 *
 * - If `messageId` is provided and resolves to a stored assistant message, the
 *   enriched text is persisted (the stored parts' text is replaced).
 * - Always returns { enhanced, fallback? } so the client can swap the displayed
 *   text even when persistence isn't applicable (e.g. guest/local threads).
 *
 * Safety: if the enhance-worker is unconfigured or errors, we return the
 * original draft with fallback:true and HTTP 200 — never break the chat.
 */

const ENABLED =
  (process.env.ENABLE_RESPONSE_ENHANCEMENT ?? "false").toLowerCase() === "true";

type Intensity = "subtle" | "normal" | "extreme";

function envIntensity(): Intensity {
  const v = (process.env.RESPONSE_ENHANCEMENT_INTENSITY ?? "normal").toLowerCase();
  return v === "subtle" || v === "extreme" ? v : "normal";
}

/** Replace the text in a message's parts with the enriched text. */
function applyEnhancedText(
  parts: unknown,
  enhanced: string
): unknown {
  if (!Array.isArray(parts)) return parts;
  let replaced = false;
  const next = parts.map((p) => {
    if (
      !replaced &&
      p &&
      typeof p === "object" &&
      (p as { type?: string }).type === "text"
    ) {
      replaced = true;
      return { ...(p as object), text: enhanced };
    }
    return p;
  });
  // If there was no text part, append one so the enriched content is not lost.
  if (!replaced) next.push({ type: "text", text: enhanced });
  return next;
}

export async function POST(request: Request) {
  let body: {
    messageId?: string;
    draft?: string;
    character?: string;
    recentContext?: string;
    intensity?: Intensity;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = (body.draft ?? "").trim();
  if (!draft) {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }

  // Feature off or worker not configured → no-op passthrough.
  if (!ENABLED || !workers.enhance) {
    return NextResponse.json({ enhanced: draft, fallback: true });
  }

  const result = await enhanceResponse({
    draft,
    character: body.character,
    recentContext: body.recentContext,
    intensity: body.intensity ?? envIntensity(),
  });

  const enhanced = result?.enhanced?.trim() || draft;
  const fallback = !result || result.fallback || enhanced === draft;

  // Best-effort persistence of the enriched text onto the stored message.
  if (!fallback && body.messageId) {
    try {
      const session = await auth();
      if (session?.user) {
        const existing = await getMessageById({ id: body.messageId });
        const msg = Array.isArray(existing) ? existing[0] : existing;
        if (msg && msg.role === "assistant") {
          await updateMessage({
            id: body.messageId,
            parts: applyEnhancedText(msg.parts, enhanced) as never,
          });
        }
      }
    } catch (err) {
      // Persistence is best-effort; the client still gets the enhanced text.
      console.error("enhance persist failed:", err);
    }
  }

  return NextResponse.json({ enhanced, fallback });
}
