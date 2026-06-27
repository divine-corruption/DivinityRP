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
import { useRoleplay } from "@/lib/roleplay-store";
import { LoreNotification } from "@/components/roleplay/lore-notification";
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
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

type ActivePanel = "gallery" | "lore" | "info" | null;

function FloatingViewer({
  url,
  type,
  onClose,
}: {
  url: string;
  type: "image" | "video";
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative max-h-[90vh] max-w-[90vw]">
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 rounded-full bg-background p-1.5 shadow-lg transition-colors hover:bg-accent"
        >
          <X className="size-4" />
        </button>
        {type === "video" ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[85vw] rounded-lg"
          />
        ) : (
          <img
            src={url}
            alt="Gallery media"
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
          />
        )}
      </div>
    </div>
  );
}

function LorePanel({
  loreEntries,
  loreBooks,
}: {
  loreEntries: import("@/lib/types").LoreEntry[];
  loreBooks: import("@/lib/types").LoreBook[];
}) {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const filtered = selectedBookId
    ? loreEntries.filter((e) => e.lorebookId === selectedBookId && e.approved)
    : loreEntries.filter((e) => !e.lorebookId && e.approved);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5 border-b border-border/20 px-3 py-2">
        <button
          type="button"
          onClick={() => setSelectedBookId(null)}
          className={cn(
            "rounded-md px-2 py-1 text-xs transition-colors",
            !selectedBookId
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          General
        </button>
        {loreBooks.map((book) => (
          <button
            key={book.id}
            type="button"
            onClick={() => setSelectedBookId(book.id)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              selectedBookId === book.id
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {book.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No lore entries yet.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-border/20 bg-muted/30 p-2.5"
              >
                <h4 className="text-xs font-medium">{entry.title}</h4>
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
  } = useRoleplay();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [floatingViewer, setFloatingViewer] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

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
      setFloatingViewer(null);
    }
  }, [chatId, setArtifact]);
  const prevMessageCountRef = useRef(messages.length);

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

  const characterLoreEntries = selectedCharacter
    ? loreEntries.filter(
        (e) => e.characterId === selectedCharacter.id && e.approved
      )
    : [];

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
                {selectedCharacter.images && selectedCharacter.images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleTogglePanel("gallery")}
                    className={cn(
                      "rounded-lg p-2 transition-colors hover:bg-accent",
                      activePanel === "gallery"
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground/60 hover:text-foreground"
                    )}
                    title="Gallery"
                  >
                    <Image className="size-4" />
                  </button>
                )}
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
                  className="rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                  title="New Story Node"
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
                    setFloatingViewer(null);
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:text-foreground"
                  title="Close"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {activePanel === "gallery" && selectedCharacter && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">
                  {selectedCharacter.images.map((img, i) => {
                    const isVideo =
                      img.url.match(/\.(mp4|webm|ogg|mov|gif)$/i) !== null;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setFloatingViewer({
                            url: img.url,
                            type: isVideo ? "video" : "image",
                          })
                        }
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border/20 transition-transform hover:scale-[1.02]"
                      >
                        <img
                          src={img.url}
                          alt={img.caption ?? `Media ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {isVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <span className="text-2xl text-white">▶</span>
                          </div>
                        )}
                        {img.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                            <span className="text-[10px] text-white">
                              {img.caption}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
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

      {floatingViewer && (
        <FloatingViewer
          url={floatingViewer.url}
          type={floatingViewer.type}
          onClose={() => setFloatingViewer(null)}
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
