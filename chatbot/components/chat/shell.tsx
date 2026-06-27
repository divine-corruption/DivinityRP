"use client";

import {
  BookOpen,
  Image,
  Info,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Edit3,
  Save,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { useRoleplay } from "@/lib/roleplay-store";
import { LoreNotification } from "@/components/roleplay/lore-notification";
import { DivineVision } from "@/components/roleplay/divine-vision";
import { MediaGallery } from "@/components/roleplay/media-gallery";
import { StoryNodePicker } from "@/components/roleplay/story-node-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import type { Attachment, ChatMessage, MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

type ActivePanel = "gallery" | "lore" | "info" | null;

const LORE_CATEGORY_STYLES: Record<string, { label: string; cls: string }> = {
  character: { label: "Character", cls: "bg-blue-500/15 text-blue-400" },
  location: { label: "Location", cls: "bg-emerald-500/15 text-emerald-400" },
  faction: { label: "Faction", cls: "bg-red-500/15 text-red-400" },
  item: { label: "Item", cls: "bg-amber-500/15 text-amber-400" },
  event: { label: "Event", cls: "bg-purple-500/15 text-purple-400" },
  concept: { label: "Concept", cls: "bg-cyan-500/15 text-cyan-400" },
  creature: { label: "Creature", cls: "bg-lime-500/15 text-lime-400" },
  other: { label: "Lore", cls: "bg-primary/15 text-primary" },
};

function LoreCategoryBadge({ category }: { category?: string }) {
  const s =
    LORE_CATEGORY_STYLES[category ?? "other"] ?? LORE_CATEGORY_STYLES.other;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide",
        s.cls
      )}
    >
      {s.label}
    </span>
  );
}

function LorePanel({
  loreEntries,
  loreBooks,
}: {
  loreEntries: import("@/lib/types").LoreEntry[];
  loreBooks: import("@/lib/types").LoreBook[];
}) {
  // "all" | "general" | <bookId>
  const [tab, setTab] = useState<string>("all");

  const approved = loreEntries.filter((e) => e.approved);
  const filtered =
    tab === "all"
      ? approved
      : tab === "general"
        ? approved.filter((e) => !e.lorebookId)
        : approved.filter((e) => e.lorebookId === tab);

  const bookName = (id?: string) =>
    id ? loreBooks.find((b) => b.id === id)?.name : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5 border-b border-border/20 px-3 py-2">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cn(
            "rounded-md px-2 py-1 text-xs transition-colors",
            tab === "all"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          All ({approved.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("general")}
          className={cn(
            "rounded-md px-2 py-1 text-xs transition-colors",
            tab === "general"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          General
        </button>
        {loreBooks.map((book) => {
          const count = approved.filter((e) => e.lorebookId === book.id).length;
          return (
            <button
              key={book.id}
              type="button"
              onClick={() => setTab(book.id)}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                tab === book.id
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {book.name} ({count})
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No lore here yet. Create entries in LoreUniverse — they'll appear in
            this chat automatically.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="overflow-hidden rounded-lg border border-border/20 bg-muted/30"
              >
                {entry.image && (
                  <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
                    <img
                      src={entry.image}
                      alt={entry.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-1.5 top-1.5">
                      <LoreCategoryBadge category={entry.category} />
                    </div>
                  </div>
                )}
                <div className="p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="text-xs font-medium">{entry.title}</h4>
                    {!entry.image && (
                      <LoreCategoryBadge category={entry.category} />
                    )}
                    {tab === "all" && bookName(entry.lorebookId) && (
                      <span className="rounded bg-muted px-1 py-0.5 text-[8px] text-muted-foreground">
                        {bookName(entry.lorebookId)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {entry.content}
                  </p>
                  {entry.keys.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {entry.keys.map((k) => (
                        <span
                          key={k}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoPanel({
  character,
  onClose,
}: {
  character: import("@/lib/types").Character;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [jsonText, setJsonText] = useState("");

  useEffect(() => {
    setJsonText(JSON.stringify(character, null, 2));
  }, [character]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof window !== "undefined") {
        localStorage.setItem("divine_active_character", JSON.stringify(parsed));
      }
      setEditing(false);
    } catch {
      // invalid json
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/20 px-4 py-2.5">
        <h3 className="text-sm font-medium">Character Info</h3>
        <button
          type="button"
          onClick={() => {
            if (editing) handleSave();
            else setEditing(true);
          }}
          className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          title={editing ? "Save" : "Edit JSON"}
        >
          {editing ? <Save className="size-3.5" /> : <Edit3 className="size-3.5" />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {editing ? (
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="h-full w-full resize-none rounded border border-border/30 bg-background p-2 font-mono text-[11px] leading-relaxed"
          />
        ) : (
          <div className="space-y-3">
            <Section label="Name" value={character.name} />
            <Section label="Description" value={character.description} />
            <Section label="Personality" value={character.personality} />
            <Section label="Scenario" value={character.scenario} />
            <Section label="First Message" value={character.firstMes} />
            <Section label="Example Dialogue" value={character.mesExample} />
            {character.tags.length > 0 && (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Tags
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {character.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {character.images.length > 0 && (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Media ({character.images.length})
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {character.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt={img.caption ?? ""}
                      className="aspect-square w-full rounded object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Source
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {character.source ?? "manual"} &middot;{" "}
                {new Date(character.importedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <p className="mt-0.5 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

const PANEL_WIDTH = 320;

export function ChatShell() {
  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
    showCreditCardAlert,
    setShowCreditCardAlert,
  } = useActiveChat();

  const {
    selectedCharacter,
    loreDetection,
    setLoreDetection,
    loreEntries,
    loreBooks,
    galleryItems,
    addGalleryItems,
    clearGalleryItems,
  } = useRoleplay();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [visionList, setVisionList] = useState<MediaItem[] | null>(null);
  const [visionIndex, setVisionIndex] = useState(0);
  const [storyPickerOpen, setStoryPickerOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const openVision = (item: MediaItem, list: MediaItem[]) => {
    setVisionList(list);
    setVisionIndex(Math.max(0, list.findIndex((m) => m.id === item.id)));
  };

  // Upload files from the Gallery panel; on success add them to the gallery
  // drawer as "uploaded" media tied to the active character.
  const handleGalleryUpload = async (files: File[]) => {
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
            { method: "POST", body: formData }
          );
          if (!res.ok) {
            const { error } = await res.json().catch(() => ({ error: "" }));
            toast.error(error || `Failed to upload ${file.name}`);
            return null;
          }
          const data = await res.json();
          if (!data?.url) {
            toast.error(`Failed to upload ${file.name}`);
            return null;
          }
          const item: MediaItem = {
            id: nanoid(),
            url: data.url,
            type: file.type.startsWith("video/") ? "video" : "image",
            caption: file.name,
            source: "uploaded",
            characterId: selectedCharacter?.id,
            createdAt: Date.now(),
          };
          return item;
        } catch {
          toast.error(`Failed to upload ${file.name}`);
          return null;
        }
      })
    );

    const uploaded = results.filter((r): r is MediaItem => r !== null);
    if (uploaded.length > 0) {
      addGalleryItems(uploaded);
      toast.success(
        uploaded.length === 1
          ? "Added to gallery"
          : `Added ${uploaded.length} items to gallery`
      );
    }
  };

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
      setActivePanel(null);
      setVisionList(null);
      setStoryPickerOpen(false);
    }
  }, [chatId, setArtifact]);
  const prevMessageCountRef = useRef(messages.length);

  // Aggregate media (character art + AI-generated images) into the Gallery.
  useEffect(() => {
    const collected: MediaItem[] = [];

    if (selectedCharacter) {
      for (const img of selectedCharacter.images ?? []) {
        if (!img.url) continue;
        const isVideo = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(img.url);
        collected.push({
          id: `char-${selectedCharacter.id}-${img.url}`,
          url: img.url,
          type: isVideo ? "video" : "image",
          caption: img.caption,
          source: "character",
          characterId: selectedCharacter.id,
          createdAt: selectedCharacter.importedAt,
        });
      }
    }

    for (const m of messages) {
      for (const part of m.parts ?? []) {
        // AI-generated images from the imagineImage tool.
        if (
          part.type === "tool-imagineImage" &&
          "output" in part &&
          part.output &&
          typeof part.output === "object" &&
          "url" in part.output &&
          typeof (part.output as { url?: unknown }).url === "string"
        ) {
          const out = part.output as { url: string; prompt?: string };
          collected.push({
            id: `gen-${m.id}-${out.url}`,
            url: out.url,
            type: "image",
            caption: out.prompt,
            source: "generated",
            characterId: selectedCharacter?.id,
            createdAt: Date.now(),
          });
        }
        // User-attached files (images / videos).
        if (
          part.type === "file" &&
          "url" in part &&
          typeof part.url === "string"
        ) {
          const mediaType = "mediaType" in part ? String(part.mediaType) : "";
          const isImg = mediaType.startsWith("image");
          const isVid = mediaType.startsWith("video");
          if (isImg || isVid) {
            collected.push({
              id: `att-${m.id}-${part.url}`,
              url: part.url,
              type: isVid ? "video" : "image",
              caption: "name" in part ? String(part.name) : undefined,
              source: "uploaded",
              characterId: selectedCharacter?.id,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    if (collected.length > 0) addGalleryItems(collected);
  }, [messages, selectedCharacter, addGalleryItems]);

  useEffect(() => {
    const newCount = messages.length;
    if (status !== "streaming" && newCount > prevMessageCountRef.current) {
      prevMessageCountRef.current = newCount;

      const lastMsg = messages[messages.length - 1];
      const lastText = lastMsg?.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (lastMsg?.role === "assistant" && lastText) {
        const timer = setTimeout(async () => {
          try {
            const res = await fetch("/api/divinity/detect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversation_history: messages.slice(-6).map((m) => ({
                  role: m.role,
                  content: m.parts
                    ?.filter((p) => p.type === "text")
                    .map((p) => p.text)
                    .join("") ?? "",
                })),
                existing_lore: loreEntries.map((e) => ({
                  title: e.title,
                  content: e.content,
                })),
              }),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.detected && data.suggestion) {
              setLoreDetection({
                active: true,
                suggestion: {
                  id: nanoid(),
                  title: data.suggestion.title,
                  content: data.suggestion.content,
                  keys: data.suggestion.keys ?? [],
                  category: data.suggestion.category,
                  imagePrompt: data.suggestion.image_prompt,
                  reasoning: data.suggestion.reasoning ?? "",
                  createdAt: Date.now(),
                },
                chatId,
                messageId: lastMsg.id,
              });
            }
          } catch {
            // lore detection is non-critical
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
    prevMessageCountRef.current = newCount;
  }, [messages, status, chatId, loreEntries, setLoreDetection]);

  // Lore shown in chat: this character's lore + general/world lore (no character).
  const characterLoreEntries = loreEntries.filter(
    (e) =>
      e.approved &&
      (!e.characterId || e.characterId === selectedCharacter?.id)
  );

  const handleTogglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setPanelCollapsed(false);
  };

  return (
    <>
      <div className="flex h-dvh w-full flex-row overflow-hidden">
        <div
          className={cn(
            "flex min-w-0 flex-col bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isArtifactVisible ? "w-[40%]" : "w-full"
          )}
        >
          {selectedCharacter && (
            <div className="flex h-14 items-center justify-between border-b border-border/20 bg-card px-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {selectedCharacter.avatar ? (
                    <img
                      src={selectedCharacter.avatar}
                      alt={selectedCharacter.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold">
                      {selectedCharacter.name.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium truncate">
                  {selectedCharacter.name}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTogglePanel("gallery")}
                  className={cn(
                    "relative rounded-lg p-2 transition-colors hover:bg-accent",
                    activePanel === "gallery"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground"
                  )}
                  title="Gallery"
                >
                  <Image className="size-4" />
                  {galleryItems.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                      {galleryItems.length > 99 ? "99+" : galleryItems.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePanel("lore")}
                  className={cn(
                    "rounded-lg p-2 transition-colors hover:bg-accent",
                    activePanel === "lore"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground"
                  )}
                  title="Loredex"
                >
                  <BookOpen className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePanel("info")}
                  className={cn(
                    "rounded-lg p-2 transition-colors hover:bg-accent",
                    activePanel === "info"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground"
                  )}
                  title="Info"
                >
                  <Info className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setStoryPickerOpen(true)}
                  className="rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                  title="Story Arcs"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          )}

          <ChatHeader
            chatId={chatId}
            isReadonly={isReadonly}
            selectedVisibilityType={visibilityType}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-tl-[12px] md:border-t md:border-l md:border-border/40">
            <Messages
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isArtifactVisible={isArtifactVisible}
              isLoading={isLoading}
              isReadonly={isReadonly}
              messages={messages}
              onEditMessage={(msg) => {
                const text = msg.parts
                  ?.filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("");
                setInput(text ?? "");
                setEditingMessage(msg);
              }}
              regenerate={regenerate}
              selectedModelId={currentModelId}
              setMessages={setMessages}
              status={status}
              votes={votes}
            />

            <div className="sticky bottom-0 z-10 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
              {!isReadonly && (
                <MultimodalInput
                  attachments={attachments}
                  chatId={chatId}
                  editingMessage={editingMessage}
                  input={input}
                  isLoading={isLoading}
                  messages={messages}
                  onCancelEdit={() => {
                    setEditingMessage(null);
                    setInput("");
                  }}
                  onModelChange={setCurrentModelId}
                  selectedModelId={currentModelId}
                  selectedVisibilityType={visibilityType}
                  sendMessage={
                    editingMessage
                      ? async () => {
                          const msg = editingMessage;
                          setEditingMessage(null);
                          await submitEditedMessage({
                            message: msg,
                            text: input,
                            setMessages,
                            regenerate,
                          });
                          setInput("");
                        }
                      : sendMessage
                  }
                  setAttachments={setAttachments}
                  setInput={setInput}
                  setMessages={setMessages}
                  status={status}
                  stop={stop}
                />
              )}
            </div>
          </div>
        </div>

        {activePanel && (
          <div
            className={cn(
              "hidden shrink-0 border-l border-border/40 bg-card transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              panelCollapsed ? "w-0 border-l-0 overflow-hidden" : "lg:flex lg:flex-col"
            )}
            style={{ width: panelCollapsed ? 0 : PANEL_WIDTH }}
          >
            <div className="flex h-14 items-center justify-between border-b border-border/20 px-4 shrink-0">
              <span className="text-sm font-medium">
                {activePanel === "gallery"
                  ? "Gallery"
                  : activePanel === "lore"
                  ? "Loredex"
                  : "Character Info"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPanelCollapsed(!panelCollapsed)}
                  className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:text-foreground"
                  title={panelCollapsed ? "Expand" : "Collapse"}
                >
                  {panelCollapsed ? (
                    <Maximize2 className="size-3.5" />
                  ) : (
                    <Minimize2 className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivePanel(null);
                    setVisionList(null);
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:text-foreground"
                  title="Close"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {activePanel === "gallery" && (
              <MediaGallery
                items={galleryItems}
                onSelect={openVision}
                onClear={clearGalleryItems}
                onUpload={handleGalleryUpload}
              />
            )}

            {activePanel === "lore" && selectedCharacter && (
              <LorePanel
                loreEntries={characterLoreEntries}
                loreBooks={loreBooks}
              />
            )}

            {activePanel === "info" && selectedCharacter && (
              <InfoPanel
                character={selectedCharacter}
                onClose={() => setActivePanel(null)}
              />
            )}
          </div>
        )}

        <Artifact
          addToolApprovalResponse={addToolApprovalResponse}
          attachments={attachments}
          chatId={chatId}
          input={input}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          selectedVisibilityType={visibilityType}
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
          votes={votes}
        />
      </div>

      {visionList && visionList[visionIndex] && (
        <DivineVision
          media={{
            url: visionList[visionIndex].url,
            type: visionList[visionIndex].type,
            caption: visionList[visionIndex].caption,
          }}
          playlist={visionList}
          index={visionIndex}
          onNavigate={(i) => setVisionIndex(i)}
          onClose={() => setVisionList(null)}
        />
      )}

      {storyPickerOpen && selectedCharacter && (
        <StoryNodePicker
          character={selectedCharacter}
          chatId={chatId}
          onApplyArc={(node) => {
            // Persist the chosen arc's scenario onto the active character so the
            // chat API picks it up on the next message.
            if (typeof window !== "undefined") {
              try {
                const raw = localStorage.getItem("divine_active_character");
                const base = raw ? JSON.parse(raw) : {};
                localStorage.setItem(
                  "divine_active_character",
                  JSON.stringify({
                    ...base,
                    scenario: node.scenario || base.scenario,
                    first_mes: node.firstMes || base.first_mes,
                    active_arc: node.title,
                  })
                );
              } catch {
                // non-critical
              }
            }
            // Seed the conversation with the arc's opening line.
            if (node.firstMes) {
              setMessages((prev) => [
                ...prev,
                {
                  id: nanoid(),
                  role: "assistant",
                  parts: [{ type: "text", text: node.firstMes as string }],
                  metadata: { createdAt: new Date().toISOString() },
                } as ChatMessage,
              ]);
            }
            setStoryPickerOpen(false);
          }}
          onClose={() => setStoryPickerOpen(false)}
        />
      )}

      <DataStreamHandler />

      <LoreNotification />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
