/**
 * Equivalence harness for the prompt-layer refactor (GAP D).
 *
 * Proves the new layered `systemPrompt` produces byte-for-byte identical output
 * to the previous inline-concatenation implementation across every permutation
 * of optional layers (2^10) and both supportsTools states. Run with:
 *   npx tsx scripts/verify-prompt-layers.mts
 */
import type { RequestHints } from "../lib/ai/prompts";

const mod = await import("../lib/ai/prompts");
const {
  systemPrompt,
  getRequestPromptFromHints,
  regularPrompt,
  artifactsPrompt,
} = mod;

const requestHints: RequestHints = {
  latitude: "40.7",
  longitude: "-74.0",
  city: "New York",
  country: "US",
};

// Faithful copy of the ORIGINAL pre-refactor implementation.
function oldSystemPrompt(args: {
  requestHints: RequestHints;
  supportsTools: boolean;
  character?: string;
  customPrompt?: string;
  characterSystemPrompt?: string;
  globalSystemPrompt?: string;
  memoryData?: string;
  loreData?: string;
  arcData?: string;
  regenInstruction?: string;
  lengthDirective?: string;
}): string {
  const {
    requestHints,
    supportsTools,
    character,
    customPrompt,
    characterSystemPrompt,
    globalSystemPrompt,
    memoryData,
    loreData,
    arcData,
    regenInstruction,
    lengthDirective,
  } = args;
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const characterPrompt = character
    ? `\n\n## Character Definition — You are this character. Embody them completely:\n\n${character}`
    : "";
  const charSystemPrompt = characterSystemPrompt
    ? `\n\n## Character Directives — HIGHEST PRIORITY behavioral instructions for playing this specific character. Follow these above all else:\n\n${characterSystemPrompt}`
    : "";
  const globalPrompt = globalSystemPrompt?.trim()
    ? `\n\n## Global Directives — Universal rules that apply to every conversation in this engine:\n\n${globalSystemPrompt.trim()}`
    : "";
  const memoryPrompt = memoryData?.trim()
    ? `\n\n## Character Memory — This is what you (the character) remember from PAST conversations with the user. Treat it as established history you genuinely recall. Reference it naturally when relevant; never contradict it or claim you don't remember it:\n\n${memoryData.trim()}`
    : "";
  const userPrompt = customPrompt
    ? `\n\n## User's Custom Instructions:\n\n${customPrompt}`
    : "";
  let loreText = "";
  if (loreData) {
    try {
      const entries = JSON.parse(loreData) as {
        title: string;
        content: string;
        keys?: string[];
        importance?: number;
      }[];
      if (Array.isArray(entries) && entries.length > 0) {
        loreText = entries
          .map(
            (e, i) =>
              `${i + 1}. ${e.title}${typeof e.importance === "number" ? ` (priority ${e.importance})` : ""}${e.keys?.length ? ` [Keywords: ${e.keys.join(", ")}]` : ""}\n${e.content}`
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
  const regenPrompt = regenInstruction?.trim()
    ? `\n\n## REGENERATION DIRECTIVE — The user is asking you to redo your previous response with this specific guidance. Apply it faithfully while keeping all other rules (mandatory dialogue, length, MLA, in-character) intact:\n\n${regenInstruction.trim()}`
    : "";
  const lengthPrompt = lengthDirective?.trim()
    ? `\n\n${lengthDirective.trim()}`
    : "";
  if (!supportsTools) {
    return `${regularPrompt}${globalPrompt}\n\n${requestPrompt}${characterPrompt}${charSystemPrompt}${memoryPrompt}${userPrompt}${lorePrompt}${arcPrompt}${regenPrompt}${lengthPrompt}`;
  }
  return `${regularPrompt}${globalPrompt}\n\n${requestPrompt}${characterPrompt}${charSystemPrompt}${memoryPrompt}${userPrompt}${lorePrompt}${arcPrompt}${regenPrompt}${lengthPrompt}\n\n${artifactsPrompt}`;
}

// Sample non-empty values for each optional layer.
const samples = {
  character: "Aria, a cunning sorceress.",
  customPrompt: "Be extra descriptive.",
  characterSystemPrompt: "Always speak in riddles.",
  globalSystemPrompt: "  No breaking the fourth wall.  ",
  memoryData: "  The user once spared her life.  ",
  loreData: JSON.stringify([
    {
      title: "The Veil",
      content: "A barrier between worlds.",
      keys: ["veil"],
      importance: 8,
    },
    { title: "Plain", content: "no keys no importance" },
  ]),
  arcData: JSON.stringify({
    title: "Descent",
    tone: "dark",
    summary: "Into the abyss.",
    scenario: "A ruined temple.",
  }),
  regenInstruction: "  Make it angrier.  ",
  lengthDirective: "  ## LENGTH: aim long.  ",
};
const optionalKeys = Object.keys(samples) as (keyof typeof samples)[];

let cases = 0;
let mismatches = 0;
const firstMismatches: string[] = [];

for (let toolsBit = 0; toolsBit < 2; toolsBit++) {
  const supportsTools = toolsBit === 1;
  for (let mask = 0; mask < 1 << optionalKeys.length; mask++) {
    const args: Record<string, unknown> = { requestHints, supportsTools };
    for (let b = 0; b < optionalKeys.length; b++) {
      if (mask & (1 << b)) args[optionalKeys[b]] = samples[optionalKeys[b]];
    }
    const oldOut = oldSystemPrompt(
      args as Parameters<typeof oldSystemPrompt>[0]
    );
    const newOut = systemPrompt(args as Parameters<typeof systemPrompt>[0]);
    cases++;
    if (oldOut !== newOut) {
      mismatches++;
      if (firstMismatches.length < 3) {
        firstMismatches.push(
          `MISMATCH tools=${supportsTools} mask=${mask.toString(2).padStart(optionalKeys.length, "0")}\n  oldLen=${oldOut.length} newLen=${newOut.length}`
        );
      }
    }
  }
}

console.log(
  `Tested ${cases} permutations (2 tool states x ${1 << optionalKeys.length} layer masks).`
);
if (mismatches === 0) {
  console.log(
    "PASS: new layered systemPrompt is byte-identical to the old implementation in ALL cases."
  );
} else {
  console.log(`FAIL: ${mismatches} mismatches.`);
  for (const m of firstMismatches) console.log(m);
  process.exit(1);
}
