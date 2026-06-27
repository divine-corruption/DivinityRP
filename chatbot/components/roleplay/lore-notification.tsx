"use client";

import { BookOpen, Check, X, Edit3 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRoleplay } from "@/lib/roleplay-store";
import { nanoid } from "nanoid";

export function LoreNotification() {
  const {
    loreDetection, clearLoreDetection,
    addLoreEntry,
  } = useRoleplay();

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [keys, setKeys] = useState("");

  useEffect(() => {
    if (loreDetection.suggestion) {
      setExpanded(true);
      setTitle(loreDetection.suggestion.title);
      setContent(loreDetection.suggestion.content);
      setKeys(loreDetection.suggestion.keys.join(", "));
      setEditing(false);
    }
  }, [loreDetection.suggestion]);

  const handleApprove = useCallback(() => {
    if (!loreDetection.suggestion) return;
    addLoreEntry({
      id: nanoid(),
      title: title || loreDetection.suggestion.title,
      content: content || loreDetection.suggestion.content,
      keys: keys
        ? keys.split(",").map((k) => k.trim()).filter(Boolean)
        : loreDetection.suggestion.keys,
      approved: true,
      source: "detection",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    toast.success(`Lore saved: ${title || loreDetection.suggestion.title}`);
    clearLoreDetection();
    setExpanded(false);
  }, [loreDetection.suggestion, title, content, keys, addLoreEntry, clearLoreDetection]);

  const handleDeny = useCallback(() => {
    toast.info("Lore not saved");
    clearLoreDetection();
    setExpanded(false);
  }, [clearLoreDetection]);

  const handleExpandToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (!loreDetection.active || !loreDetection.suggestion) return null;

  const s = loreDetection.suggestion;

  return (
    <div className="fixed bottom-24 right-6 z-50 max-w-sm">
      <div className="rounded-xl border border-primary/30 bg-card shadow-xl">
        {/* Header bar */}
        <button
          type="button"
          onClick={handleExpandToggle}
          className="flex w-full items-center gap-2 rounded-t-xl bg-primary/10 px-4 py-2.5 text-left transition-colors hover:bg-primary/15"
        >
          <BookOpen className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium">
            Lore Detected
          </span>
          <span className="text-[10px] text-muted-foreground">
            {expanded ? "▼" : "▲"}
          </span>
        </button>

        {expanded && (
          <div className="p-4">
            <div className="space-y-2">
              {editing ? (
                <div className="space-y-2">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-sm font-medium"
                    placeholder="Title"
                  />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-xs resize-none"
                    placeholder="Lore content"
                  />
                  <input
                    value={keys}
                    onChange={(e) => setKeys(e.target.value)}
                    placeholder="Keywords (comma separated)"
                    className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-medium">{s.title}</h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {s.content}
                  </p>
                  {s.keys.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.keys.map((k) => (
                        <span
                          key={k}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] italic text-muted-foreground/60">
                    {s.reasoning}
                  </p>
                </>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleApprove}
                className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-90"
              >
                <Check className="size-3.5" />
                Save Lore
              </button>
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                className="inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                <Edit3 className="size-3.5" />
                {editing ? "Preview" : "Edit"}
              </button>
              <button
                type="button"
                onClick={handleDeny}
                className="inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
