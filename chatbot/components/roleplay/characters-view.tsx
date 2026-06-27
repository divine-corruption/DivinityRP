"use client";

import { Hammer, ImageIcon, Info, Plus, Trash2, Upload } from "lucide-react";
import { CharacterForger } from "./character-forger";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useRoleplay } from "@/lib/roleplay-store";
import type { Character } from "@/lib/types";

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
  const { setCurrentView } = useRoleplay();

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
          onClick={() => setCurrentView("characters")}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          New Story Node
        </button>
      </div>

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
