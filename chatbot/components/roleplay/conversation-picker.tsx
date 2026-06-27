"use client";

import {
  Check,
  MessagesSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type ConversationThread,
  createNewThread,
  deleteThread,
  listThreadsForCharacter,
  renameThread,
  setActiveThreadId,
} from "@/lib/conversation-threads";
import type { Character } from "@/lib/types";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * ConversationPicker — replaces the old Story Arc picker. Lists every saved
 * conversation (thread) for the active character, lets the user open any one
 * (resuming its full history), start a brand-new conversation, rename, or
 * delete. This is the new "create new conversations when you select a
 * character" experience that supersedes Story Arcs.
 */
export function ConversationPicker({
  character,
  activeChatId,
  onOpenThread,
  onClose,
}: {
  character: Character;
  activeChatId: string;
  onOpenThread: (thread: ConversationThread) => void;
  onClose: () => void;
}) {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const refresh = () => setThreads(listThreadsForCharacter(character.id));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  const handleNew = () => {
    const thread = createNewThread({ characterId: character.id });
    setActiveThreadId(thread.id);
    onOpenThread(thread);
    toast.success("New conversation started");
    onClose();
  };

  const handleOpen = (thread: ConversationThread) => {
    setActiveThreadId(thread.id);
    onOpenThread(thread);
    onClose();
  };

  const handleDelete = (id: string) => {
    deleteThread(id);
    refresh();
    toast.success("Conversation removed");
  };

  const startRename = (t: ConversationThread) => {
    setEditingId(t.id);
    setDraftTitle(t.title);
  };

  const commitRename = (id: string) => {
    renameThread(id, draftTitle);
    setEditingId(null);
    refresh();
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="divine-panel flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <MessagesSquare className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Conversations
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {character.name} &middot; {threads.length} saved
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

        {/* New conversation */}
        <div className="border-b border-border/30 px-5 py-3">
          <button
            type="button"
            onClick={handleNew}
            className="divine-glow-btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <Plus className="size-4" />
            New Conversation
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto p-3">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <MessagesSquare className="size-8 text-muted-foreground/25" />
              <p className="text-xs text-muted-foreground">
                No conversations yet. Start one above — each is saved separately
                with its own history.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {threads.map((t) => {
                const isActive = t.id === activeChatId;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all",
                      isActive
                        ? "border-primary/50 bg-primary/10 shadow-[0_0_18px_-6px_var(--primary)]"
                        : "border-border/40 bg-background/40 hover:border-primary/40 hover:bg-background/70"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <MessagesSquare className="size-4" />
                    </div>

                    {editingId === t.id ? (
                      <div className="flex flex-1 items-center gap-1.5">
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(t.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          // biome-ignore lint/a11y/noAutofocus: inline rename UX
                          autoFocus
                          className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(t.id)}
                          className="rounded-md p-1 text-primary hover:bg-primary/10"
                        >
                          <Check className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpen(t)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium">
                          {t.title}
                          {isActive && (
                            <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                              Active
                            </span>
                          )}
                          {t.isClosed && (
                            <span className="ml-2 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
                              Compiled
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Last opened {timeAgo(t.lastOpenedAt)}
                        </p>
                      </button>
                    )}

                    {editingId !== t.id && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startRename(t)}
                          className="rounded-md p-1.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          className="rounded-md p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                          title="Remove from list"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
