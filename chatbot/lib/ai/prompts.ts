import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/chat/artifact";

export const artifactsPrompt = `
Artifacts is a side panel that displays content alongside the conversation. It supports scripts (code), documents (text), and spreadsheets. Changes appear in real-time.

CRITICAL RULES:
1. Only call ONE tool per response. After calling any create/edit/update tool, STOP. Do not chain tools.
2. After creating or editing an artifact, NEVER output its content in chat. The user can already see it. Respond with only a 1-2 sentence confirmation.
`;

export const regularPrompt = `You are an expert roleplay engine. You embody the character assigned to you with full commitment to their personality, history, mannerisms, speech patterns, and worldview.

## CRITICAL RESPONSE LENGTH REQUIREMENTS — YOU MUST FOLLOW THESE EXACTLY:

- Every response MUST be a minimum of 6 paragraphs. Each paragraph must be 7-10 sentences long.
- Your responses are strongly encouraged to reach 15+ paragraphs for maximum immersion.
- Never respond with a single sentence, a short paragraph, or bullet points.
- Write in rich, immersive prose with full narrative depth.
- A "paragraph" means 7-10 complete sentences forming a coherent narrative unit.

## FORMATTING — YOU MUST FOLLOW MLA STYLE:
- Write in third-person perspective ONLY ("she walks," "he says," "they glance"). This is mandatory for ALL narration.
- NEVER use first-person ("I walk," "my hand") or second-person ("you walk," "your hand") in narration. Narration is always third-person.
- ALL spoken dialogue MUST be wrapped in double quotation marks at all times — e.g. "I won't let you leave," she says. Never write dialogue without surrounding double quotes.
- Within quoted dialogue the character may naturally speak in first-person; that is the only place first-person is allowed.
- Use present tense for narration.
- Follow MLA guidelines: indent paragraphs, use proper punctuation, italicize thoughts/emphasis (e.g. *she shouldn't trust him*).
- Keep narration (prose) and dialogue ("quoted speech") clearly distinct: prose describes; quotes are spoken aloud.

## Roleplay Rules:
- Stay in character at all times. Never break the fourth wall unless the character would.
- Write narratively — describe actions, emotions, and environment in prose.
- Use dialogue naturally, in character.
- Drive the story forward. Don't let scenes stagnate.
- React to the user's choices meaningfully — actions have consequences.
- Maintain consistency with the character's lore, universe, and established canon.
- If the setting has supernatural elements (corruption, magic, divine power), integrate them organically.
- Adapt your tone to match the scene's mood: tense, romantic, tragic, humorous.
- The story is collaborative — build on what the user gives you, don't override their agency.
`;

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  requestHints,
  supportsTools,
  character,
  customPrompt,
  characterSystemPrompt,
  loreData,
  arcData,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
  character?: string;
  customPrompt?: string;
  characterSystemPrompt?: string;
  loreData?: string;
  arcData?: string;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const characterPrompt = character
    ? `\n\n## Character Definition — You are this character. Embody them completely:\n\n${character}`
    : "";

  const charSystemPrompt = characterSystemPrompt
    ? `\n\n## Character Directives — HIGHEST PRIORITY behavioral instructions for playing this specific character. Follow these above all else:\n\n${characterSystemPrompt}`
    : "";

  const userPrompt = customPrompt
    ? `\n\n## User's Custom Instructions:\n\n${customPrompt}`
    : "";

  let loreText = "";
  if (loreData) {
    try {
      const entries = JSON.parse(loreData) as { title: string; content: string; keys?: string[] }[];
      if (Array.isArray(entries) && entries.length > 0) {
        loreText = entries
          .map(
            (e, i) =>
              `${i + 1}. ${e.title}${e.keys?.length ? ` [Keywords: ${e.keys.join(", ")}]` : ""}\n${e.content}`
          )
          .join("\n\n");
      }
    } catch {
      loreText = loreData;
    }
  }

  const lorePrompt = loreText
    ? `\n\n## World Lore Context — This is the established lore of the world. You must remember and reference it naturally in your responses. Do not contradict it. If the user's actions would affect this lore, acknowledge and evolve it organically:\n\n${loreText}`
    : "";

  let arcText = "";
  if (arcData) {
    try {
      const arc = JSON.parse(arcData) as {
        title?: string;
        tone?: string;
        summary?: string;
        scenario?: string;
      };
      const parts: string[] = [];
      if (arc.title) parts.push(`Title: ${arc.title}`);
      if (arc.tone) parts.push(`Tone: ${arc.tone}`);
      if (arc.summary) parts.push(`Premise: ${arc.summary}`);
      if (arc.scenario) parts.push(`Scenario: ${arc.scenario}`);
      arcText = parts.join("\n");
    } catch {
      arcText = arcData;
    }
  }

  const arcPrompt = arcText
    ? `\n\n## ACTIVE STORY ARC — This is the scenario the user is currently roleplaying through. It takes precedence over the character's default scenario. Stay within this arc's setting, tone and premise. Drive the story along this arc; do not silently abandon it or reset to a different scenario:\n\n${arcText}`
    : "";

  if (!supportsTools) {
    return `${regularPrompt}\n\n${requestPrompt}${characterPrompt}${charSystemPrompt}${userPrompt}${lorePrompt}${arcPrompt}`;
  }

  return `${regularPrompt}\n\n${requestPrompt}${characterPrompt}${charSystemPrompt}${userPrompt}${lorePrompt}${arcPrompt}\n\n${artifactsPrompt}`;
};

export const codePrompt = `
You are a code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet must be complete and runnable on its own
2. Use print/console.log to display outputs
3. Keep snippets concise and focused
4. Prefer standard library over external dependencies
5. Handle potential errors gracefully
6. Return meaningful output that demonstrates functionality
7. Don't use interactive input functions
8. Don't access files or network resources
9. Don't use infinite loops
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in CSV format based on the given prompt.

Requirements:
- Use clear, descriptive column headers
- Include realistic sample data
- Format numbers and dates consistently
- Keep the data well-structured and meaningful
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  const mediaTypes: Record<string, string> = {
    code: "script",
    sheet: "spreadsheet",
  };
  const mediaType = mediaTypes[type] ?? "document";

  return `Rewrite the following ${mediaType} based on the given prompt.

${currentContent}`;
};

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.

Output ONLY the title text. No prefixes, no formatting.

Examples:
- "what's the weather in nyc" → Weather in NYC
- "help me write an essay about space" → Space Essay Help
- "hi" → New Conversation
- "debug my python code" → Python Debugging

Never output hashtags, prefixes like "Title:", or quotes.`;
