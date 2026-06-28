const XAI_API_KEY = process.env.XAI_API_KEY ?? "";

type XAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface XAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string | XAIContentPart[];
}

interface XAIChatOptions {
  model?: string;
  system?: string;
  messages: XAIChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Optional OpenAI-compatible response_format (e.g. { type: "json_object" }). */
  responseFormat?: { type: "json_object" | "text" };
}

/** Default xAI model used for vision + reasoning (Grok 4.3 is multimodal). */
export const XAI_DEFAULT_MODEL = "grok-4.3";

export async function xaiChat(options: XAIChatOptions): Promise<string> {
  if (!XAI_API_KEY) {
    throw new Error(
      "XAI_API_KEY is not configured. Add it to your environment (.env.local) to use the Character Forger and xAI features."
    );
  }

  const messages: Record<string, unknown>[] = [];

  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }

  messages.push(
    ...options.messages.map((m) => ({ role: m.role, content: m.content }))
  );

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model ?? "grok-4.3",
      messages,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.responseFormat
        ? { response_format: options.responseFormat }
        : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let detail = errText;
    try {
      const errJson = JSON.parse(errText);
      detail = errJson.error?.message ?? errJson.message ?? errText;
    } catch {}
    throw new Error(`xAI API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content ?? "";
}
