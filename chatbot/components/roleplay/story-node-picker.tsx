"use client";

import {
  BookMarked,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRoleplay } from "@/lib/roleplay-store";
import type { Character, StoryNode } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_COLORS: Record<string, string> = {
  romance: "bg-pink-500/15 text-pink-400",
  mystery: "bg-indigo-500/15 text-indigo-400",
  dark: "bg-red-500/15 text-red-400",
  adventure: "bg-emerald-500/15 text-emerald-400",
  drama: "bg-amber-500/15 text-amber-400",
};

function toneClass(tone?: string) {
  if (!tone) return "bg-muted text-muted-foreground";
  const key = tone.toLowerCase().split(/[\s/]/)[0];
  return TONE_COLORS[key] ?? "bg-primary/15 text-primary";
}

/**
 * StoryNodePicker — floating selector of Character Story Nodes (story arcs /
 * scenarios). Lets the user browse, generate (via Grok), create and apply an
 * arc to the active character.
 */
export function StoryNodePicker({
  character,
  chatId,
  onApplyArc,
  onClose,
}: {
  character: Character;
  chatId: string;
  onApplyArc: (node: StoryNode) => void;
  onClose: () => void;
}) {
  const { storyNodes, addStoryNode, deleteStoryNode } = useRoleplay();
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    tone: "",
    summary: "",
    scenario: "",
    firstMes: "",
  });

  const arcs = useMemo(
    () =>
      storyNodes
        .filter((n) => n.characterId === character.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [storyNodes, character.id]
  );

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/story-arcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: {
            name: character.name,
            description: character.description,
            personality: character.personality,
            scenario: character.scenario,
            tags: character.tags,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to generate arcs");
      }
      const data = await res.json();
      const generated: {
        title: string;
        tone?: string;
        summary?: string;
        scenario?: string;
        first_mes?: string;
      }[] = data.arcs ?? [];

      if (generated.length === 0) {
        toast.error("Grok returned no arcs — try again");
        return;
      }

      for (const a of generated) {
        addStoryNode({
          id: nanoid(),
          characterId: character.id,
          title: a.title,
          tone: a.tone,
          summary: a.summary ?? "",
          scenario: a.scenario,
          firstMes: a.first_mes,
          kind: "arc",
          chatId,
          createdAt: Date.now(),
        });
      }
      toast.success(`Grok forged ${generated.length} story arcs`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = () => {
    if (!draft.title.trim()) {
      toast.error("Give the arc a title");
      return;
    }
    addStoryNode({
      id: nanoid(),
      characterId: character.id,
      title: draft.title.trim(),
      tone: draft.tone.trim() || undefined,
      summary: draft.summary.trim(),
      scenario: draft.scenario.trim() || undefined,
      firstMes: draft.firstMes.trim() || undefined,
      kind: "arc",
      chatId,
      createdAt: Date.now(),
    });
    setDraft({ title: "", tone: "", summary: "", scenario: "", firstMes: "" });
    setCreating(false);
    toast.success("Story arc saved");
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <BookMarked className="size-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Story Arcs</h2>
              <p className="text-[11px] text-muted-foreground">
                Choose a scenario for {character.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border/20 px-5 py-2.5">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {generating ? "Grok is writing arcs…" : "Generate with Grok"}
          </button>
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5" />
            New Arc
          </button>
        </div>

        {/* Manual create form */}
        {creating && (
          <div className="space-y-2 border-b border-border/20 bg-muted/30 px-5 py-3">
            <div className="grid grid-cols-3 gap-2">
              <input
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder="Arc title *"
                className="col-span-2 rounded-md border border-border/30 bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                value={draft.tone}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, tone: e.target.value }))
                }
                placeholder="Tone"
                className="rounded-md border border-border/30 bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
            <input
              value={draft.summary}
              onChange={(e) =>
                setDraft((d) => ({ ...d, summary: e.target.value }))
              }
              placeholder="One-line pitch"
              className="w-full rounded-md border border-border/30 bg-background px-2.5 py-1.5 text-xs"
            />
            <textarea
              value={draft.scenario}
              onChange={(e) =>
                setDraft((d) => ({ ...d, scenario: e.target.value }))
              }
              placeholder="Scenario (setting & situation)…"
              rows={2}
              className="w-full resize-none rounded-md border border-border/30 bg-background px-2.5 py-1.5 text-xs"
            />
            <textarea
              value={draft.firstMes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, firstMes: e.target.value }))
              }
              placeholder="Opening message (optional)…"
              rows={2}
              className="w-full resize-none rounded-md border border-border/30 bg-background px-2.5 py-1.5 text-xs"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background transition-opacity hover:opacity-90"
              >
                Save arc
              </button>
            </div>
          </div>
        )}

        {/* Arc list */}
        <div className="flex-1 overflow-y-auto p-4">
          {arcs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Sparkles className="size-8 text-muted-foreground/25" />
              <p className="text-xs text-muted-foreground">
                No story arcs yet. Generate some with Grok or create your own.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {arcs.map((node) => (
                <div
                  key={node.id}
                  className="group relative flex flex-col rounded-xl border border-border/30 bg-background p-3 transition-colors hover:border-primary/40"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-tight">
                      {node.title}
                    </h3>
                    {node.tone && (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                          toneClass(node.tone)
                        )}
                      >
                        {node.tone}
                      </span>
                    )}
                  </div>
                  <p className="mb-3 line-clamp-3 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                    {node.summary || node.scenario || "No description"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onApplyArc(node)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Play className="size-3" />
                      Begin Arc
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteStoryNode(node.id)}
                      className="rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      title="Delete arc"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
