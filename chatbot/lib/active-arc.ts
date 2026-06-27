/**
 * Per-chat active Story Arc persistence.
 *
 * The "active arc" is the scenario the user is currently roleplaying through in
 * a given chat. It must survive navigating away from and back to the chat, and
 * it must be sent to the chat API so it actively influences the roleplay.
 *
 * We persist it in localStorage keyed by chatId (rather than the global
 * `divine_active_character` key) so each chat keeps its own arc alongside its
 * own message history.
 */

export interface ActiveArc {
  /** Story node id this arc came from (if applied from the picker). */
  nodeId?: string;
  title: string;
  summary?: string;
  tone?: string;
  /** Full scenario block applied for this arc — drives the RP. */
  scenario?: string;
  /** The arc's opening message (already seeded into the chat). */
  firstMes?: string;
  appliedAt: number;
}

const PREFIX = "divine_chat_arc:";

function keyFor(chatId: string): string {
  return `${PREFIX}${chatId}`;
}

export function loadActiveArc(chatId: string): ActiveArc | null {
  if (typeof window === "undefined" || !chatId) return null;
  try {
    const raw = localStorage.getItem(keyFor(chatId));
    return raw ? (JSON.parse(raw) as ActiveArc) : null;
  } catch {
    return null;
  }
}

export function saveActiveArc(chatId: string, arc: ActiveArc): void {
  if (typeof window === "undefined" || !chatId) return;
  try {
    localStorage.setItem(keyFor(chatId), JSON.stringify(arc));
  } catch {
    // storage full / unavailable — non-critical
  }
}

export function clearActiveArc(chatId: string): void {
  if (typeof window === "undefined" || !chatId) return;
  try {
    localStorage.removeItem(keyFor(chatId));
  } catch {
    // non-critical
  }
}

/**
 * Serialize the active arc into the compact block injected into the system
 * prompt so the model actively roleplays within the chosen scenario.
 */
export function serializeArcForPrompt(arc: ActiveArc): string {
  const lines: string[] = [`Title: ${arc.title}`];
  if (arc.tone) lines.push(`Tone: ${arc.tone}`);
  if (arc.summary) lines.push(`Premise: ${arc.summary}`);
  if (arc.scenario) lines.push(`Scenario: ${arc.scenario}`);
  return lines.join("\n");
}
