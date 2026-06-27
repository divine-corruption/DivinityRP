"use client";

import { BookMarked, Hammer, Loader2, Play, Sparkles, Trash2, Upload } from "lucide-react";
import { CharacterForger } from "./character-forger";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type ActiveArc, saveActiveArc } from "@/lib/active-arc";
import {
  createArcThread,
  setActiveThreadId,
} from "@/lib/conversation-threads";
import { useRoleplay } from "@/lib/roleplay-store";
import type { Character, StoryNode } from "@/lib/types";

function CharacterCard({
  character,
  onSelect,
  onDelete,
}: {
  character: Character;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-xl border border-border/30 bg-card transition-all hover:border-border/60 hover:shadow-md">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col items-center p-4 text-center"
      >
        <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted">
          {character.avatar ? (
            <img
              src={character.avatar}
              alt={character.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold">{character.name.charAt(0)}</span>
          )}
        </div>
        <h3 className="text-sm font-medium truncate w-full">{character.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {character.description || "No description"}
        </p>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-2 hidden rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:block"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function CharactersView() {
  const {
    characters,
    selectCharacter,
    deleteCharacter,
    importCharacter,
    selectedCharacter,
  } = useRoleplay();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showForge, setShowForge] = useState(false);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const char = importCharacter(data);
        toast.success(`Imported: ${char.name}`);
      } catch {
        toast.error("Invalid character file format");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [importCharacter]
  );

  if (showForge) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <button
          type="button"
          onClick={() => setShowForge(false)}
          className="sticky top-0 z-10 flex items-center gap-1 bg-background p-4 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to characters
        </button>
        <CharacterForger />
      </div>
    );
  }

  if (selectedCharacter) {
    return (
      <CharacterDetailView
        character={selectedCharacter}
        onBack={() => selectCharacter(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Characters</h1>
          <p className="text-sm text-muted-foreground">
            {characters.length} character{characters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => setShowForge(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Hammer className="size-4" />
            Forge
          </button>
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="size-4" />
            Import JSON
          </button>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Upload className="mx-auto mb-4 size-12 text-muted-foreground/30" />
            <h3 className="text-lg font-medium">No characters yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Import a character card from Chub.ai or SillyTavern
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              onSelect={() => selectCharacter(char)}
              onDelete={() => deleteCharacter(char.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CharacterDetailView({
  character,
  onBack,
}: {
  character: Character;
  onBack: () => void;
}) {
  const { selectCharacter, setCurrentView, storyNodes, addStoryNode, deleteStoryNode } =
    useRoleplay();
  const [generatingArcs, setGeneratingArcs] = useState(false);

  const arcs = useMemo(
    () =>
      storyNodes
        .filter((n) => n.characterId === character.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [storyNodes, character.id]
  );

  const generateArcs = async () => {
    setGeneratingArcs(true);
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
        toast.error("Grok returned no arcs");
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
          chatId: "",
          createdAt: Date.now(),
        });
      }
      toast.success(`Grok forged ${generated.length} story arcs`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGeneratingArcs(false);
    }
  };

  const beginArc = (node: StoryNode) => {
    // Apply the arc scenario to the character and open the chat.
    if (typeof window !== "undefined") {
      const charData = JSON.stringify({
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: node.scenario || character.scenario,
        first_mes: node.firstMes || character.firstMes,
        mes_example: character.mesExample,
        system_prompt: character.systemPrompt,
        tags: character.tags,
        avatar: character.avatar,
        images: character.images,
        active_arc: node.title,
      });
      localStorage.setItem("divine_active_character", charData);

      // Beginning an arc creates a BRAND-NEW conversation thread so its full
      // history is stored separately (a new conversation), exactly like
      // starting a fresh chat dedicated to this arc.
      const thread = createArcThread({
        characterId: character.id,
        arcId: node.id,
        title: node.title,
      });

      // Persist the arc context against the new thread so the RP stays in-arc
      // and the banner resumes when the thread is reopened.
      const arc: ActiveArc = {
        nodeId: node.id,
        title: node.title,
        summary: node.summary,
        tone: node.tone,
        scenario: node.scenario,
        firstMes: node.firstMes,
        appliedAt: Date.now(),
      };
      saveActiveArc(thread.id, arc);

      // Seed + persist the arc's opening message so it loads on resume.
      if (node.firstMes) {
        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages/seed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: thread.id,
            title: node.title,
            message: { text: node.firstMes },
          }),
        }).catch(() => {
          /* non-critical */
        });
      }

      // Make this the active conversation.
      setActiveThreadId(thread.id);
    }
    selectCharacter(character);
    setCurrentView("characters");
    toast.success(`Starting arc: ${node.title}`);
  };

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to characters
      </button>

      <div className="mb-6 flex items-start gap-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
          {character.avatar ? (
            <img
              src={character.avatar}
              alt={character.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-3xl font-bold">
              {character.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{character.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
            {character.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {character.tags.slice(0, 8).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => selectCharacter(character)}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Play className="size-4" />
          Start Roleplay
        </button>
        <button
          type="button"
          onClick={generateArcs}
          disabled={generatingArcs}
          className="inline-flex items-center gap-2 rounded-lg border border-border/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          {generatingArcs ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {generatingArcs ? "Forging arcs…" : "Generate Story Arcs"}
        </button>
      </div>

      {/* Story Arcs (Character Story Nodes) */}
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <BookMarked className="size-4 text-primary" />
          <h2 className="text-sm font-medium">
            Story Arcs ({arcs.length})
          </h2>
        </div>
        {arcs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/30 p-5 text-center">
            <p className="text-xs text-muted-foreground">
              No story arcs yet. Generate distinct scenarios with Grok, then
              pick one to begin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {arcs.map((node) => (
              <div
                key={node.id}
                className="group relative flex flex-col rounded-xl border border-border/30 bg-card p-3 transition-colors hover:border-primary/40"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight">
                    {node.title}
                  </h3>
                  {node.tone && (
                    <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
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
                    onClick={() => beginArc(node)}
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
      </section>

      <div className="space-y-4">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Personality
          </h2>
          <p className="text-sm whitespace-pre-wrap">
            {character.personality || "No personality defined"}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Scenario
          </h2>
          <p className="text-sm whitespace-pre-wrap">
            {character.scenario || "No scenario defined"}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            First Message
          </h2>
          <div className="rounded-lg bg-muted/50 p-3 text-sm italic">
            {character.firstMes || "No first message defined"}
          </div>
        </section>

        {character.images.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Gallery ({character.images.length})
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {character.images.map((img, i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <img
                    src={img.url}
                    alt={img.caption || `Gallery ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
