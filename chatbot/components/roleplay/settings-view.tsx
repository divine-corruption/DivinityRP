"use client";

import { useState } from "react";
import { toast } from "sonner";

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
          <p className="text-xs text-muted-foreground">
            Characters, lore, and story nodes are stored in your browser
            (localStorage). Chat messages are stored in the database.
            Published characters are stored in-memory (production uses a
            subdomain-backed database).
          </p>
        </section>
      </div>
    </div>
  );
}
