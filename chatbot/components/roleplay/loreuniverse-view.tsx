"use client";

import { nanoid } from "nanoid";
import {
  Plus, Trash2, Sparkles, Send, Loader2, Check, X, Edit3, BookOpen,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useRoleplay } from "@/lib/roleplay-store";
import type { LoreEntry, LoreBook } from "@/lib/types";

// --- Lore Book Manager ---

function LoreBookManager({
  books,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
}: {
  books: LoreBook[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string, desc: string) => void;
  onDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">LoreBooks</span>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="text-xs text-primary hover:underline"
        >
          {creating ? "Cancel" : "+ New Book"}
        </button>
      </div>

      {creating && (
        <div className="mb-3 space-y-2 rounded-lg border border-border/30 bg-card p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Book name"
            className="w-full rounded border border-border/20 bg-background px-2 py-1.5 text-xs"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Brief description"
            className="w-full rounded border border-border/20 bg-background px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (name.trim()) {
                onCreate(name.trim(), desc.trim());
                setName("");
                setDesc("");
                setCreating(false);
              }
            }}
            className="rounded bg-foreground px-3 py-1 text-xs text-background"
          >
            Create
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
            selectedId === null
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          All
        </button>
        {books.map((book) => (
          <div key={book.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelect(book.id)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                selectedId === book.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {book.name}
            </button>
            <button
              type="button"
              onClick={() => onDelete(book.id)}
              className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-[9px] text-destructive-foreground group-hover:block"
            >
              <X className="size-2.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Lore Card Component ---

function LoreCard({
  suggestion,
  onApprove,
  onEdit,
  onDeny,
}: {
  suggestion: {
    id: string;
    title: string;
    content: string;
    keys: string[];
    reasoning: string;
  };
  onApprove: (s: typeof suggestion) => void;
  onEdit: (s: typeof suggestion) => void;
  onDeny: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(suggestion.title);
  const [content, setContent] = useState(suggestion.content);
  const [keys, setKeys] = useState(suggestion.keys.join(", "));

  return (
    <div className="rounded-xl border border-primary/20 bg-card/80 p-4 shadow-sm">
      {editing ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-border/20 bg-background px-2 py-1.5 text-sm font-medium"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full rounded border border-border/20 bg-background px-2 py-1.5 text-xs resize-none"
          />
          <input
            value={keys}
            onChange={(e) => setKeys(e.target.value)}
            placeholder="Keywords (comma separated)"
            className="w-full rounded border border-border/20 bg-background px-2 py-1.5 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onApprove({
                  ...suggestion,
                  title: title.trim(),
                  content: content.trim(),
                  keys: keys.split(",").map((k) => k.trim()).filter(Boolean),
                });
                setEditing(false);
              }}
              className="rounded bg-foreground px-3 py-1 text-xs text-background"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-border/30 px-3 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium">{suggestion.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                {suggestion.content}
              </p>
              {suggestion.keys.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {suggestion.keys.map((k) => (
                    <span
                      key={k}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-[10px] italic text-muted-foreground/60">
                {suggestion.reasoning}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onApprove(suggestion)}
              className="inline-flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-[11px] text-white transition-opacity hover:opacity-90"
            >
              <Check className="size-3" />
              Approve
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded bg-muted px-2.5 py-1 text-[11px] transition-colors hover:bg-accent"
            >
              <Edit3 className="size-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDeny(suggestion.id)}
              className="inline-flex items-center gap-1 rounded bg-muted px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3" />
              Deny
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main LoreUniverse View ---

export function LoreUniverseView() {
  const {
    loreEntries, addLoreEntry, updateLoreEntry, deleteLoreEntry,
    loreBooks, addLoreBook, deleteLoreBook,
    divinityAI, setDivinityAI, addDivinitySuggestion, removeDivinitySuggestion, clearDivinitySuggestions,
    characters, selectedCharacter,
  } = useRoleplay();

  const [showForm, setShowForm] = useState(false);
  const [loreFilter, setLoreFilter] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [keys, setKeys] = useState("");
  const [characterId, setCharacterId] = useState("");

  // DivinityAI chat
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, divinityAI.suggestions]);

  // Parse Lore Cards from AI response
  const parseLoreCards = (text: string) => {
    const cards: { title: string; content: string; keys: string[]; reasoning: string }[] = [];
    const regex = /---LORECARD_START---\s*([\s\S]*?)---LORECARD_END---/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      try {
        const block = match[1];
        const titleMatch = block.match(/title:\s*"([^"]*)"/);
        const contentMatch = block.match(/content:\s*"([\s\S]*?)"(?=\s*keys:)/);
        const keysMatch = block.match(/keys:\s*\[([^\]]*)\]/);
        const reasoningMatch = block.match(/reasoning:\s*"([^"]*)"/);

        if (titleMatch || contentMatch) {
          cards.push({
            title: titleMatch?.[1]?.trim() ?? "Untitled Lore",
            content: contentMatch?.[1]?.trim() ?? "",
            keys: keysMatch
              ? keysMatch[1].split(",").map((k) => k.trim().replace(/"/g, ""))
              : [],
            reasoning: reasoningMatch?.[1]?.trim() ?? "",
          });
        }
      } catch {
        // skip malformed cards
      }
    }
    return cards;
  };

  const handleDivinityChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      // Optimistically add loading state
      const res = await fetch("/api/divinity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...chatMessages,
            { role: "user", content: userMsg },
          ],
          lore_context: loreEntries.map((e) => ({
            title: e.title,
            content: e.content,
            keys: e.keys,
          })),
          character_context: selectedCharacter
            ? {
                name: selectedCharacter.name,
                description: selectedCharacter.description,
                personality: selectedCharacter.personality,
              }
            : undefined,
        }),
      });

      if (!res.ok) throw new Error("DivinityAI failed");

      const data = await res.json();
      const aiContent = data.content as string;

      setChatMessages((prev) => [...prev, { role: "assistant", content: aiContent }]);

      // Parse Lore Cards
      const cards = parseLoreCards(aiContent);
      for (const card of cards) {
        addDivinitySuggestion({
          id: nanoid(),
          title: card.title,
          content: card.content,
          keys: card.keys,
          reasoning: card.reasoning,
          lorebookId: divinityAI.selectedLorebookId ?? undefined,
          createdAt: Date.now(),
        });
      }

      if (cards.length > 0) {
        toast.success(`${cards.length} Lore Card${cards.length > 1 ? "s" : ""} created`);
      }
    } catch {
      toast.error("DivinityAI failed to respond");
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  };

  const handleApproveSuggestion = (s: { id: string; title: string; content: string; keys: string[]; reasoning: string }) => {
    addLoreEntry({
      id: nanoid(),
      title: s.title,
      content: s.content,
      keys: s.keys,
      lorebookId: divinityAI.selectedLorebookId ?? undefined,
      approved: true,
      source: "divinity",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    removeDivinitySuggestion(s.id);
    toast.success(`Lore saved: ${s.title}`);
  };

  const handleEditSuggestion = (s: { id: string; title: string; content: string; keys: string[]; reasoning: string }) => {
    handleApproveSuggestion(s);
  };

  const handleDenySuggestion = (id: string) => {
    removeDivinitySuggestion(id);
    toast.info("Lore Card denied");
  };

  // Manual lore form
  const handleSubmitLore = () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    addLoreEntry({
      id: nanoid(),
      title: title.trim(),
      content: content.trim(),
      keys: keys.split(",").map((k) => k.trim()).filter(Boolean),
      characterId: characterId || undefined,
      lorebookId: divinityAI.selectedLorebookId ?? undefined,
      approved: true,
      source: "manual",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setTitle("");
    setContent("");
    setKeys("");
    setCharacterId("");
    setShowForm(false);
    toast.success("Lore entry added");
  };

  const filteredEntries = loreFilter
    ? loreEntries.filter((e) => e.lorebookId === loreFilter)
    : loreEntries;

  // Toggle DivinityAI panel
  const toggleDivinity = () => {
    setDivinityAI({ open: !divinityAI.open });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">LoreUniverse</h1>
          <p className="text-sm text-muted-foreground">
            {loreEntries.length} lore entr{loreEntries.length === 1 ? "y" : "ies"}
            {divinityAI.suggestions.length > 0 && (
              <span className="ml-2 text-primary">
                &middot; {divinityAI.suggestions.length} pending card{divinityAI.suggestions.length > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleDivinity}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 ${
              divinityAI.open
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            <Sparkles className="size-4" />
            DivinityAI
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            Add Lore
          </button>
        </div>
      </div>

      {/* LoreBook filter bar */}
      <LoreBookManager
        books={loreBooks}
        selectedId={divinityAI.selectedLorebookId}
        onSelect={(id) => {
          setDivinityAI({ selectedLorebookId: id });
          setLoreFilter(id);
        }}
        onCreate={(name, desc) =>
          addLoreBook({
            id: nanoid(),
            name,
            description: desc,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
        onDelete={(id) => {
          deleteLoreBook(id);
          if (loreFilter === id) setLoreFilter(null);
        }}
      />

      {/* Pending Lore Cards */}
      {divinityAI.suggestions.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-primary flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Pending Lore Cards
          </h3>
          <div className="space-y-3">
            {divinityAI.suggestions.map((s) => (
              <LoreCard
                key={s.id}
                suggestion={s}
                onApprove={(card) => handleApproveSuggestion({ ...card, id: s.id })}
                onEdit={(card) => handleEditSuggestion({ ...card, id: s.id })}
                onDeny={handleDenySuggestion}
              />
            ))}
          </div>
        </div>
      )}

      {/* DivinityAI Chat Panel */}
      {divinityAI.open && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-card/50">
          <div className="flex items-center justify-between border-b border-border/20 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-medium">DivinityAI</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {chatMessages.length} messages
              </span>
              <button
                type="button"
                onClick={() => {
                  setChatMessages([]);
                  clearDivinitySuggestions();
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>

          {loreBooks.length === 0 && (
            <div className="border-b border-border/20 px-4 py-2">
              <p className="text-[11px] text-muted-foreground">
                Tip: Create a LoreBook first to organize your lore entries
              </p>
            </div>
          )}

          <div className="h-64 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <BookOpen className="mx-auto mb-2 size-6 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">
                    Ask DivinityAI to brainstorm lore, create entries, or build your world
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {[
                      "Create a faction",
                      "Design a magic system",
                      "Write city lore",
                      "Character backstory",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setChatInput(suggestion);
                        }}
                        className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      msg.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-border/20 px-4 py-2.5">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleDivinityChat();
                }
              }}
              placeholder="Ask DivinityAI about lore..."
              className="flex-1 rounded-lg border border-border/30 bg-background px-3 py-2 text-xs"
              disabled={chatLoading}
            />
            <button
              type="button"
              onClick={handleDivinityChat}
              disabled={chatLoading || !chatInput.trim()}
              className="rounded-lg bg-foreground p-2 text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {chatLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Manual lore form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-border/40 bg-card p-4 space-y-3">
          <input
            placeholder="Entry title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Lore content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
          />
          <input
            placeholder="Trigger keywords (comma separated)"
            value={keys}
            onChange={(e) => setKeys(e.target.value)}
            className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
          />
          {loreBooks.length > 0 && (
            <select
              value={divinityAI.selectedLorebookId ?? ""}
              onChange={(e) => setDivinityAI({ selectedLorebookId: e.target.value || null })}
              className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
            >
              <option value="">No LoreBook</option>
              {loreBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {characters.length > 0 && (
            <select
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
            >
              <option value="">All characters</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border/30 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitLore}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Lore entries list */}
      {filteredEntries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium">No lore entries</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {loreFilter ? "This LoreBook is empty" : "Create lore entries to build your universe"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-border/30 bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{entry.title}</h3>
                    {entry.source && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {entry.source}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {entry.content}
                  </p>
                  {entry.keys.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.keys.map((key) => (
                        <span
                          key={key}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Edit: fill form with existing data
                      setTitle(entry.title);
                      setContent(entry.content);
                      setKeys(entry.keys.join(", "));
                      setCharacterId(entry.characterId ?? "");
                      setShowForm(true);
                      deleteLoreEntry(entry.id);
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLoreEntry(entry.id)}
                    className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
