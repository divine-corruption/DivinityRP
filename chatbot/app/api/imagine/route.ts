import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isR2Configured, uploadToR2 } from "@/lib/storage/r2";

export const maxDuration = 120;

const XAI_API_KEY = process.env.XAI_API_KEY;
// Fallback so existing Imagine/Vyro deployments keep working if XAI key is absent.
const IMAGINE_API_KEY = process.env.IMAGINE_API_KEY;

const XAI_IMAGE_MODEL = process.env.XAI_IMAGE_MODEL ?? "grok-2-image";

/**
 * Persist a generated image to R2 (if configured) so it doesn't rely on the
 * provider's temporary URL. Falls back to the original URL on any failure.
 */
async function persistToR2(srcUrl?: string): Promise<string | undefined> {
  if (!srcUrl || !isR2Configured()) return srcUrl;
  // Don't try to fetch base64 payloads as URLs.
  if (!/^https?:\/\//i.test(srcUrl)) return srcUrl;
  try {
    const resp = await fetch(srcUrl);
    if (!resp.ok) return srcUrl;
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") ?? "image/png";
    const ext = ct.includes("jpeg") ? "jpg" : ct.split("/")[1] ?? "png";
    const { url } = await uploadToR2(`generated/${randomUUID()}.${ext}`, buf, ct);
    return url;
  } catch {
    return srcUrl;
  }
}

export async function POST(request: Request) {
  try {
    const { prompt, negative_prompt, aspect_ratio, style } =
      await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Compose a richer prompt since xAI's image endpoint takes only a text prompt
    // (no separate style / aspect / negative params).
    const composed = [
      prompt,
      style && style !== "realistic" ? `Style: ${style}.` : null,
      aspect_ratio ? `Aspect ratio ${aspect_ratio}.` : null,
      negative_prompt ? `Avoid: ${negative_prompt}.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    // Preferred: xAI Grok Imagine (OpenAI-compatible image endpoint).
    if (XAI_API_KEY) {
      const response = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: XAI_IMAGE_MODEL,
          prompt: composed,
          n: 1,
          response_format: "url",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json(
          { error: `xAI image API error (${response.status}): ${errText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const rawUrl = data.data?.[0]?.url ?? data.data?.[0]?.b64_json;
      const url = await persistToR2(rawUrl);
      return NextResponse.json({ url, data: data.data });
    }

    // Fallback: legacy Vyro Imagine API.
    if (IMAGINE_API_KEY) {
      const response = await fetch(
        "https://api.vyro.ai/v1/imagine/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${IMAGINE_API_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            negative_prompt: negative_prompt ?? "",
            aspect_ratio: aspect_ratio ?? "1:1",
            style: style ?? "realistic",
            model: "flux-1.1-pro",
            response_format: "url",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Imagine API error: ${error}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      {
        error:
          "No image provider configured. Set XAI_API_KEY (Grok Imagine) or IMAGINE_API_KEY.",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Imagine API error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
