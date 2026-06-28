"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_RP_SETTINGS,
  getRpSettings,
  saveRpSettings,
} from "@/lib/rp-settings";

const PROMPT_STORAGE_KEY = "divine_custom_prompt";

export function getCustomPrompt(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(PROMPT_STORAGE_KEY) ?? "";
  }
  return "";
}

export function SettingsView() {
  const [apiKey, setApiKey] = useState(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem("imagine_api_key") ?? ""
        : ""
  );
  const [systemPrompt, setSystemPrompt] = useState(() => getCustomPrompt());

  const initialRp =
    typeof window !== "undefined" ? getRpSettings() : DEFAULT_RP_SETTINGS;
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState(
    initialRp.globalSystemPrompt
  );
  const [autoInjectLore, setAutoInjectLore] = useState(
    initialRp.autoInjectLore
  );
  const [loreThreshold, setLoreThreshold] = useState(
    initialRp.loreImportanceThreshold
  );
  const [temperature, setTemperature] = useState(initialRp.temperature);

  const handleSaveApiKey = () => {
    localStorage.setItem("imagine_api_key", apiKey);
    toast.success("API key saved");
  };

  const handleSavePrompt = () => {
    localStorage.setItem(PROMPT_STORAGE_KEY, systemPrompt);
    toast.success("Custom prompt saved");
  };

  const handleResetPrompt = () => {
    setSystemPrompt("");
    localStorage.removeItem(PROMPT_STORAGE_KEY);
    toast.success("Custom prompt reset");
  };

  const handleSaveGlobalPrompt = () => {
    saveRpSettings({ globalSystemPrompt });
    toast.success("Global prompt saved");
  };

  const handleSaveTemperature = () => {
    saveRpSettings({ temperature });
    toast.success("Response temperature saved");
  };

  const handleToggleAutoLore = (next: boolean) => {
    setAutoInjectLore(next);
    saveRpSettings({ autoInjectLore: next });
  };

  const handleThresholdChange = (next: number) => {
    setLoreThreshold(next);
    saveRpSettings({ loreImportanceThreshold: next });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your roleplay engine
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="text-sm font-medium mb-1">Imagine API Key</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Used for generating images with Imagine API (Vyro.ai)
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Save
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="text-sm font-medium mb-1">Custom System Prompt</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Add your own instructions for the AI. The engine already enforces
            minimum 6 paragraphs (7-10 sentences each) with 15+ paragraphs encouraged.
            Your custom instructions will be appended on top of that.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. Always speak in Old English. The world is a post-apocalyptic fantasy realm..."
            rows={6}
            className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSavePrompt}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Save Prompt
            </button>
            <button
              type="button"
              onClick={handleResetPrompt}
              className="rounded-lg border border-border/30 px-4 py-2 text-sm"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="text-sm font-medium mb-1">Global System Prompt</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            A universal instruction injected into EVERY character conversation
            (e.g. global roleplay rules or content guidelines). Applies on top
            of each character's own directives.
          </p>
          <textarea
            value={globalSystemPrompt}
            onChange={(e) => setGlobalSystemPrompt(e.target.value)}
            placeholder="e.g. This is an uncensored adult roleplay engine. Stay in character at all times..."
            rows={4}
            className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
          />
          <div className="mt-3">
            <button
              type="button"
              onClick={handleSaveGlobalPrompt}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Save Global Prompt
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="text-sm font-medium mb-1">Lore Injection</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Controls how world lore is added to the prompt. When auto-inject is
            on, only lore whose keywords appear in the recent conversation AND
            whose importance meets the threshold is injected, ranked by
            importance — keeping the prompt focused instead of dumping all lore.
          </p>
          <label className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm">Auto-inject relevant lore</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoInjectLore}
              onClick={() => handleToggleAutoLore(!autoInjectLore)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                autoInjectLore ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                  autoInjectLore ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm">Importance threshold</span>
              <span className="text-sm font-semibold text-primary">
                {loreThreshold}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={loreThreshold}
              disabled={!autoInjectLore}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
              className="w-full accent-primary disabled:opacity-40"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Only lore with importance &ge; {loreThreshold} is injected. Lower =
              richer context, higher = leaner prompt.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="text-sm font-medium mb-1">Model</h2>
          <p className="text-xs text-muted-foreground">
            All roleplay uses xAI Grok 4.3 via Vercel AI Gateway
          </p>
          <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            xai/grok-4.3
          </div>
        </section>

        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="text-sm font-medium mb-1">Hardcoded Response Rules</h2>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>Minimum: <strong className="text-foreground">6 paragraphs</strong> (7-10 sentences each)</p>
            <p>Encouraged: <strong className="text-foreground">15+ paragraphs</strong></p>
            <p>Format: Rich immersive prose, no bullet points or lists</p>
            <p>These rules cannot be overridden by the custom prompt.</p>
          </div>
        </section>

        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="text-sm font-medium mb-1">Data Storage</h2>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Chat history</strong> — stored
              in PostgreSQL (server-side, durable).
            </p>
            <p>
              <strong className="text-foreground">Characters, lore, gallery, story nodes, settings, conversation threads, arcs</strong> — stored
              in localStorage <em>and</em> synced to Cloudflare R2 (when
              configured) so they survive browser clears and follow you across
              devices.
            </p>
            <p>
              <strong className="text-foreground">Media uploads &amp; generated images</strong> — stored
              in Cloudflare R2 or Vercel Blob.
            </p>
            <p className="pt-1 text-[11px]">
              R2 sync fires on every change (debounced 1.5 s), on tab-hide, and
              on page-close — so nothing is lost even if you close the tab
              immediately after making a change.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
