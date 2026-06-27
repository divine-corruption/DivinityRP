/**
 * Roleplay settings + lore relevance matching.
 *
 * Ported in concept from the Ooda Muse Engine AppSettings:
 *   - globalSystemPrompt: a universal instruction prepended to every chat
 *   - autoInjectLore:     toggle automatic lore injection
 *   - loreImportanceThreshold: only inject lore with importance >= threshold
 *
 * (The "custom bonus prompt" already exists in DivinityRP as the Custom System
 * Prompt — see settings-view.tsx getCustomPrompt — so we don't duplicate it.)
 *
 * Stored client-side in localStorage, consistent with how DivinityRP persists
 * characters/lore/threads on the client.
 */

import type { LoreEntry } from "./types";

const SETTINGS_KEY = "divine_rp_settings";

export interface RpSettings {
  globalSystemPrompt: string;
  autoInjectLore: boolean;
  /** 1-10. Only lore entries with importance >= this are auto-injected. */
  loreImportanceThreshold: number;
}

export const DEFAULT_RP_SETTINGS: RpSettings = {
  globalSystemPrompt: "",
  autoInjectLore: true,
  loreImportanceThreshold: 3,
};

export function getRpSettings(): RpSettings {
  if (typeof window === "undefined") return { ...DEFAULT_RP_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_RP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<RpSettings>;
    return { ...DEFAULT_RP_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_RP_SETTINGS };
  }
}

export function saveRpSettings(settings: Partial<RpSettings>): RpSettings {
  const next = { ...getRpSettings(), ...settings };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // storage full/unavailable — non-critical
    }
  }
  return next;
}

const LORE_IMPORTANCE_DEFAULT = 5;

/** Importance for an entry, defaulting to 5 when unset (matches Ooda Muse). */
export function loreImportance(entry: LoreEntry): number {
  return typeof entry.importance === "number"
    ? entry.importance
    : LORE_IMPORTANCE_DEFAULT;
}

export interface LoreMatchOptions {
  /** Lore entries to consider (already scoped to the active character/world). */
  entries: LoreEntry[];
  /** Recent conversation text to scan for keyword matches. */
  recentText: string;
  /** Minimum importance to include (from settings). */
  threshold: number;
  /** Max entries to inject (keeps the prompt bounded). */
  maxEntries?: number;
}

/**
 * Select the lore entries to inject for this turn.
 *
 * An entry qualifies when its importance >= threshold AND either:
 *   - it has no keys (always-on world lore), or
 *   - at least one of its keys appears in the recent conversation text.
 * Results are sorted by importance (desc) and capped at maxEntries.
 *
 * This is the client-side "before send" matcher: the chat route still receives
 * a loreData JSON string, but now pre-filtered & ranked instead of dumping all.
 */
export function selectRelevantLore({
  entries,
  recentText,
  threshold,
  maxEntries = 12,
}: LoreMatchOptions): LoreEntry[] {
  const haystack = recentText.toLowerCase();

  const qualifying = entries.filter((e) => {
    if (loreImportance(e) < threshold) return false;
    if (!e.keys || e.keys.length === 0) return true; // always-on lore
    return e.keys.some((k) => {
      const key = k.trim().toLowerCase();
      return key.length > 0 && haystack.includes(key);
    });
  });

  return qualifying
    .sort((a, b) => loreImportance(b) - loreImportance(a))
    .slice(0, maxEntries);
}

/** Serialize selected lore into the loreData JSON the chat route expects. */
export function loreToPayload(entries: LoreEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      title: e.title,
      content: e.content,
      keys: e.keys,
      importance: loreImportance(e),
    }))
  );
}
