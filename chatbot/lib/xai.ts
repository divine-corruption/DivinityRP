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
}

export async function xaiChat(options: XAIChatOptions): Promise<string> {
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
