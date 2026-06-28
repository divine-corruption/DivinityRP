"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  ACTIVE_THREAD_EVENT,
  getActiveThreadId,
  touchThread,
} from "@/lib/conversation-threads";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import {
  getRpSettings,
  loreToPayload,
  selectRelevantLore,
} from "@/lib/rp-settings";
import type { ChatMessage, LoreEntry } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);

  // DIVINE roleplay is a single-page experience: the URL stays at `/`, so we
  // identify the current conversation by an "active thread id" set by the
  // roleplay layer (character/arc selection) rather than by route. This is what
  // makes history persist per conversation and lets a new story arc be its own
  // conversation thread. Falls back to URL routing, then a fresh ephemeral id.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() =>
    getActiveThreadId()
  );

  // React to thread switches dispatched by the roleplay layer (begin arc /
  // select character) without a route change.
  useEffect(() => {
    const handler = () => setActiveThreadId(getActiveThreadId());
    window.addEventListener(ACTIVE_THREAD_EVENT, handler);
    // Pick up a thread chosen before this provider mounted.
    setActiveThreadId(getActiveThreadId());
    return () => window.removeEventListener(ACTIVE_THREAD_EVENT, handler);
  }, []);

  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  const resolvedFromUrl = chatIdFromUrl ?? activeThreadId;
  // A thread id (from arc/character selection) or a URL chat id is a real,
  // resumable conversation. Only when neither exists is this a throwaway chat.
  const isNewChat = !resolvedFromUrl;

  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = resolvedFromUrl ?? newChatIdRef.current;

  // Keep the thread's "last opened" fresh so the sidebar/registry ordering is
  // sensible.
  useEffect(() => {
    if (activeThreadId) touchThread(activeThreadId);
  }, [activeThreadId]);

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);

  const { data: chatData, isLoading } = useSWR(
    isNewChat
      ? null
      : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (chatData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (chatData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            })
          );

        const customPrompt =
          typeof window !== "undefined"
            ? localStorage.getItem("divine_custom_prompt") ?? undefined
            : undefined;
        const characterData =
          typeof window !== "undefined"
            ? localStorage.getItem("divine_active_character") ?? undefined
            : undefined;

        // Per-character memory (overviewMemory) is stashed on the active
        // character payload by the roleplay provider. Inject it so the
        // character "remembers" across separate conversations.
        let memoryData: string | undefined;
        let activeCharacterId: string | undefined;
        if (characterData) {
          try {
            const parsed = JSON.parse(characterData) as {
              id?: string;
              memory?: string;
            };
            activeCharacterId = parsed.id;
            if (parsed.memory && parsed.memory.trim()) {
              memoryData = parsed.memory.trim();
            }
          } catch {
            // non-critical
          }
        }

        // Smart lore injection: filter the full lore set by importance +
        // keyword match against recent conversation text BEFORE sending,
        // instead of dumping every entry into the prompt.
        let loreData: string | undefined;
        if (typeof window !== "undefined") {
          const rawLore = localStorage.getItem("divine_lore");
          if (rawLore) {
            try {
              const allEntries = JSON.parse(rawLore) as LoreEntry[];
              const settings = getRpSettings();
              if (settings.autoInjectLore && Array.isArray(allEntries)) {
                // Scope to this character's lore (+ universal, characterId-less).
                const scoped = allEntries.filter(
                  (e) =>
                    e.approved !== false &&
                    (!e.characterId ||
                      !activeCharacterId ||
                      e.characterId === activeCharacterId)
                );
                // Scan the last few messages for keyword matches.
                const recentText = request.messages
                  .slice(-4)
                  .flatMap((m) =>
                    (m.parts ?? [])
                      .filter(
                        (p) => (p as { type?: string }).type === "text"
                      )
                      .map((p) => (p as { text?: string }).text ?? "")
                  )
                  .join(" ");
                const selected = selectRelevantLore({
                  entries: scoped,
                  recentText,
                  threshold: settings.loreImportanceThreshold,
                });
                if (selected.length > 0) {
                  loreData = loreToPayload(selected);
                }
              } else if (!settings.autoInjectLore) {
                loreData = undefined;
              } else {
                // Fallback: pass raw lore through unchanged.
                loreData = rawLore;
              }
            } catch {
              loreData = rawLore;
            }
          }
        }

        // Global system prompt (applies to every conversation).
        const settings =
          typeof window !== "undefined" ? getRpSettings() : undefined;

        const globalSystemPrompt =
          settings?.globalSystemPrompt || undefined;

        const temperature =
          typeof window !== "undefined" ? settings?.temperature : undefined;

        const arcData =
          typeof window !== "undefined"
            ? localStorage.getItem(`divine_chat_arc:${request.id}`) ?? undefined
            : undefined;
        // One-shot steering instruction for a guided regeneration. Read once
        // and immediately cleared so it only affects this single request.
        let regenInstruction: string | undefined;
        if (typeof window !== "undefined") {
          const v = localStorage.getItem("divine_regen_instruction");
          if (v) {
            regenInstruction = v;
            localStorage.removeItem("divine_regen_instruction");
          }
        }

        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibility,
            customPrompt,
            temperature,
            characterData,
            loreData,
            memoryData,
            globalSystemPrompt,
            arcData,
            regenInstruction,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error.message?.includes("AI Gateway requires a valid credit card")) {
        setShowCreditCardAlert(true);
      } else if (error instanceof ChatbotError) {
        toast({ type: "error", description: error.message });
      } else {
        toast({
          type: "error",
          description: error.message || "Oops, an error occurred!",
        });
      }
    },
  });

  const loadedChatIds = useRef(new Set<string>());

  if (isNewChat && !loadedChatIds.current.has(newChatIdRef.current)) {
    loadedChatIds.current.add(newChatIdRef.current);
  }

  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (chatData?.messages) {
      loadedChatIds.current.add(chatId);
      setMessages(chatData.messages);
    }
  }, [chatId, chatData?.messages, setMessages]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      const previousChatId = prevChatIdRef.current;
      prevChatIdRef.current = chatId;
      // Switching conversation threads (or starting a new chat): clear the
      // previous thread's messages immediately so its history never bleeds into
      // the newly opened thread. Persisted threads are then repopulated by the
      // load effect above once their messages arrive from the server.
      setMessages([]);
      // Drop the OUTGOING thread's load flag (not the incoming one) so that if
      // the user returns to it later it re-hydrates from the DB. Deleting the
      // INCOMING chatId here re-armed the load effect on every render and, with
      // SWR handing back a fresh messages array each revalidation, produced a
      // setMessages([]) <-> setMessages(data) ping-pong that froze the tab.
      if (previousChatId && previousChatId !== chatId) {
        loadedChatIds.current.delete(previousChatId);
      }
    }
  }, [chatId, setMessages]);

  useEffect(() => {
    if (chatData && !isNewChat) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];
      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [chatData, isNewChat]);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
    }
  }, [sendMessage, chatId]);

  useAutoResume({
    autoResume: !isNewChat && !!chatData,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly = isNewChat ? false : (chatData?.isReadonly ?? false);

  const { data: votes } = useSWR<Vote[]>(
    !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const value = useMemo<ActiveChatContextValue>(
    () => ({
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
      visibilityType: visibility,
      isReadonly,
      isLoading: !isNewChat && isLoading,
      votes,
      currentModelId,
      setCurrentModelId,
      showCreditCardAlert,
      setShowCreditCardAlert,
    }),
    [
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      votes,
      currentModelId,
      showCreditCardAlert,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
