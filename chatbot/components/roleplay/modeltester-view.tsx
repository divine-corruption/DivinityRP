"use client";

import { Loader2, Play, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Model Tester — compare roleplay output across xAI Grok variants side by side.
 * (Ported from the Ooda Muse Engine ModelTester.)
 */

const AVAILABLE_MODELS = [
  { id: "grok-4.3", label: "Grok 4.3" },
  { id: "grok-3", label: "Grok 3" },
  { id: "grok-3-mini", label: "Grok 3 Mini" },
  { id: "grok-2-1212", label: "Grok 2" },
];

interface ModelResult {
  model: string;
  response: string;
  error?: string;
  durationMs: number;
}

export function ModelTesterView() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>(["grok-4.3", "grok-3"]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ModelResult[]>([]);

  const toggleModel = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : prev.length >= 5
          ? prev
          : [...prev, id]
    );
  };

  const handleRun = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a test prompt first");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one model");
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/model-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            systemPrompt: systemPrompt.trim() || undefined,
            models: selected,
          }),
        }
      );
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        throw new Error(error || "Model test failed");
      }
      const data = (await res.json()) as { results: ModelResult[] };
      setResults(data.results ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Model test failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Model Tester</h1>
        <p className="text-sm text-muted-foreground">
          Run the same prompt across models and compare roleplay quality side by
          side.
        </p>
      </div>

      <div className="max-w-5xl space-y-4">
        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Models</h2>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_MODELS.map((m) => {
              const on = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModel(m.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/40 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Select up to 5 models. {selected.length} selected.
          </p>
        </section>

        <section className="rounded-xl border border-border/30 bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">
            System Prompt (optional)
          </h2>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Leave blank to use the default roleplay system prompt..."
            rows={2}
            className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
          />
          <h2 className="mb-2 mt-4 text-sm font-medium">Test Prompt</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. The tavern door creaks open as a hooded stranger steps in from the storm..."
            rows={4}
            className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
          />
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? "Running…" : "Run Comparison"}
          </button>
        </section>

        {results.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((r) => (
              <div
                key={r.model}
                className="rounded-xl border border-border/30 bg-card p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.model}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Zap className="size-3" />
                    {(r.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
                {r.error ? (
                  <p className="text-xs text-destructive">{r.error}</p>
                ) : (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                    {r.response}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
