import { NextResponse } from "next/server";

export const maxDuration = 120;

const IMAGINE_API_KEY = process.env.IMAGINE_API_KEY;

export async function POST(request: Request) {
  try {
    const { prompt, negative_prompt, aspect_ratio, style } =
      await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!IMAGINE_API_KEY) {
      return NextResponse.json(
        { error: "IMAGINE_API_KEY not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.vyro.ai/v1/imagine/generations", {
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
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Imagine API error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Imagine API error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
