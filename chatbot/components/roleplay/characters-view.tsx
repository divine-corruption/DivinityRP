"use client";

import {
  Hammer,
  Loader2,
  MessagesSquare,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createNewThread,
  listThreadsForCharacter,
  setActiveThreadId,
} from "@/lib/conversation-threads";
import { useRoleplay } from "@/lib/roleplay-store";
import type { Character } from "@/lib/types";
import { CharacterForger } from "./character-forger";

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
    <div className="divine-card group relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col items-center p-5 text-center"
      >
        <div className="relative mb-3.5">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-primary/40 via-fuchsia-500/30 to-transparent opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60 transition-all group-hover:ring-primary/60">
            {character.avatar ? (
              // biome-ignore lint/performance/noImgElement: user-supplied avatar
              <img
                src={character.avatar}
                alt={character.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="bg-gradient-to-br from-primary to-fuchsia-400 bg-clip-text text-2xl font-bold text-transparent">
                {character.name.charAt(0)}
              </span>
            )}
          </div>
        </div>
        <h3 className="w-full truncate text-sm font-semibold tracking-tight">
          {character.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
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
          className="sticky top-0 z-10 flex items-center gap-1 bg-background/80 p-4 text-sm text-muted-foreground backdrop-blur hover:text-foreground"
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
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Characters</h1>
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
            className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <Hammer className="size-4" />
            Forge
          </button>
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="divine-glow-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
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
  const { selectCharacter, updateCharacter, loreBooks, updateLoreBook } = useRoleplay();
  const [editing, setEditing] = useState(false);

  const threads = listThreadsForCharacter(character.id);

  const characterLoreBooks = loreBooks.filter((b) => b.characterId === character.id);
  const availableLoreBooks = loreBooks.filter((b) => b.characterId !== character.id);

  const handleNewConversation = () => {
    const thread = createNewThread({ characterId: character.id });
    setActiveThreadId(thread.id);
    selectCharacter(character);
    toast.success("New conversation started");
  };

  const handleAttachLoreBook = useCallback((bookId: string) => {
    updateLoreBook(bookId, { characterId: character.id });
  }, [character.id, updateLoreBook]);

  const handleDetachLoreBook = useCallback((bookId: string) => {
    updateLoreBook(bookId, { characterId: undefined });
  }, [updateLoreBook]);

  if (editing) {
    return (
      <CharacterEditView
        character={character}
        onClose={() => setEditing(false)}
        onSave={(patch) => {
          updateCharacter(character.id, patch);
          setEditing(false);
          toast.success("Character updated");
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to characters
      </button>

      <div className="mb-6 flex items-start gap-6">
        <div className="relative shrink-0">
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-primary/40 via-fuchsia-500/25 to-transparent blur-md" />
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60">
            {character.avatar ? (
              // biome-ignore lint/performance/noImgElement: user-supplied avatar
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
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {character.name}
          </h1>
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {character.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {character.tags.slice(0, 8).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectCharacter(character)}
          className="divine-glow-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          <Play className="size-4" />
          {threads.length > 0 ? "Resume Roleplay" : "Start Roleplay"}
        </button>
        <button
          type="button"
          onClick={handleNewConversation}
          className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent"
        >
          <MessagesSquare className="size-4" />
          New Conversation
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent"
        >
          <Pencil className="size-4" />
          Edit
        </button>
      </div>

      {threads.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <MessagesSquare className="size-4 text-primary" />
            <h2 className="text-sm font-medium">
              Conversations ({threads.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveThreadId(t.id);
                  selectCharacter(character);
                }}
                className="divine-card group flex items-center gap-3 rounded-xl p-3 text-left"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <MessagesSquare className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Continue this thread
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* LoreBooks Section */}
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Attached LoreBooks ({characterLoreBooks.length})
        </h2>
        {characterLoreBooks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No LoreBooks attached to this character.</p>
        ) : (
          <div className="space-y-1.5">
            {characterLoreBooks.map((book) => (
              <div key={book.id} className="flex items-center justify-between rounded-lg border border-border/20 bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{book.name}</p>
                  {book.description && (
                    <p className="text-xs text-muted-foreground truncate">{book.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDetachLoreBook(book.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Detach"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {availableLoreBooks.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Attach existing LoreBook...
            </summary>
            <div className="mt-1.5 space-y-1">
              {availableLoreBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => handleAttachLoreBook(book.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                >
                  <Plus className="size-3 shrink-0" />
                  <span className="truncate">{book.name}</span>
                </button>
              ))}
            </div>
          </details>
        )}
      </section>

      <div className="space-y-4">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Personality
          </h2>
          <p className="whitespace-pre-wrap text-sm">
            {character.personality || "No personality defined"}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Scenario
          </h2>
          <p className="whitespace-pre-wrap text-sm">
            {character.scenario || "No scenario defined"}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            First Message
          </h2>
          <div className="rounded-lg bg-muted/50 p-3 text-sm italic">
            {character.firstMes || "No first message defined"}
          </div>
        </section>

        {character.images.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Gallery ({character.images.length})
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {character.images.map((img, i) => (
                <div
                  key={`${img.url}-${i}`}
                  className="aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  {/* biome-ignore lint/performance/noImgElement: gallery thumb */}
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

function CharacterEditView({
  character,
  onClose,
  onSave,
}: {
  character: Character;
  onClose: () => void;
  onSave: (patch: Partial<Character>) => void;
}) {
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description);
  const [personality, setPersonality] = useState(character.personality);
  const [scenario, setScenario] = useState(character.scenario);
  const [firstMes, setFirstMes] = useState(character.firstMes);
  const [tags, setTags] = useState(character.tags.join(", "));
  const [avatar, setAvatar] = useState(character.avatar ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setAvatarUploading(true);
    // Optimistic local preview while the upload completes.
    const localPreview = URL.createObjectURL(file);
    setAvatar(localPreview);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/upload`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (!data?.url) throw new Error("Upload failed");
      setAvatar(data.url);
      toast.success("Avatar uploaded");
    } catch {
      setAvatar(character.avatar ?? "");
      toast.error("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    onSave({
      name: name.trim(),
      description,
      personality,
      scenario,
      firstMes,
      avatar: avatar || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Edit Character</h1>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Avatar upload */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-sm font-medium text-muted-foreground">
          Avatar
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary/40 via-fuchsia-500/25 to-transparent blur-md" />
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60">
              {avatarUploading ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : avatar ? (
                // biome-ignore lint/performance/noImgElement: avatar preview
                <img
                  src={avatar}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold">
                  {name.charAt(0) || "?"}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelected}
            />
            <button
              type="button"
              disabled={avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
            >
              {avatarUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {avatarUploading ? "Uploading…" : "Upload image"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              Or paste an image URL below.
            </p>
            <input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://…"
              className="w-72 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>
      </section>

      <div className="grid max-w-2xl gap-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border/40 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Personality">
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-border/40 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Scenario">
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-border/40 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="First Message">
          <textarea
            value={firstMes}
            onChange={(e) => setFirstMes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-border/40 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Tags (comma separated)">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="mt-6 flex max-w-2xl justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border/40 px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="divine-glow-btn rounded-xl px-5 py-2 text-sm font-semibold"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
