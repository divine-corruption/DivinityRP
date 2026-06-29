"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import { deleteTrailingMessages } from "@/app/(chat)/actions";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import {
  MessageAction as Action,
  MessageActions as Actions,
} from "../ai-elements/message";
import {
  CopyIcon,
  PencilEditIcon,
  RedoIcon,
  SparklesIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "./icons";

const REGEN_INSTRUCTION_KEY = "divine_regen_instruction";

/**
 * Store a one-shot steering instruction that the chat transport picks up for
 * the very next request and clears afterwards. Lets the user guide a
 * regeneration ("make her angrier", "add more dialogue", etc.) without adding
 * a visible message to the transcript.
 */
function setRegenInstruction(instruction: string) {
  if (typeof window === "undefined") return;
  if (instruction.trim()) {
    localStorage.setItem(REGEN_INSTRUCTION_KEY, instruction.trim());
  } else {
    localStorage.removeItem(REGEN_INSTRUCTION_KEY);
  }
}

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  onEdit,
  setMessages,
  regenerate,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  onEdit?: () => void;
  setMessages?: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate?: UseChatHelpers<ChatMessage>["regenerate"];
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [guiding, setGuiding] = useState(false);
  const [guideText, setGuideText] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  // Regenerate the assistant response for this message. Optionally steer it
  // with a one-shot instruction the model follows for this regeneration only.
  const handleRegenerate = async (instruction?: string) => {
    if (!regenerate) return;
    setBusy(true);
    try {
      setRegenInstruction(instruction ?? "");
      // Drop this assistant message (and anything after it) before re-rolling.
      await deleteTrailingMessages({ id: message.id }).catch(() => {
        // best-effort; message may be local-only / not yet persisted
      });
      if (setMessages) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === message.id);
          return idx === -1 ? prev : prev.slice(0, idx);
        });
      }
      await regenerate();
    } catch {
      toast.error("Failed to regenerate response");
    } finally {
      setBusy(false);
      setGuiding(false);
      setGuideText("");
    }
  };

  // Resend a user message as-is: clear any responses after it and re-run.
  const handleResend = async () => {
    if (!regenerate) return;
    setBusy(true);
    try {
      setRegenInstruction("");
      await deleteTrailingMessages({ id: message.id }).catch(() => {
        // best-effort
      });
      if (setMessages) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === message.id);
          // keep the user message, drop everything after it
          return idx === -1 ? prev : prev.slice(0, idx + 1);
        });
      }
      await regenerate({ messageId: message.id });
    } catch {
      toast.error("Failed to resend message");
    } finally {
      setBusy(false);
    }
  };

  // Enrich this assistant reply via the enhance-worker (/api/enhance): richer,
  // more lust-filled dialogue. Swaps the enhanced text into the message in place.
  const handleEnhance = async () => {
    if (!setMessages || !textFromParts) return;
    setBusy(true);
    const run = (async () => {
      const recentContext =
        typeof window !== "undefined"
          ? (localStorage.getItem("divine_active_character") ?? undefined)
          : undefined;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/enhance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: message.id,
            draft: textFromParts,
            character: recentContext,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        enhanced?: string;
        fallback?: boolean;
      };
      if (!res.ok || !data.enhanced) {
        throw new Error("enhance failed");
      }
      if (data.fallback || data.enhanced === textFromParts) {
        return "No changes — enhancement unavailable or already rich.";
      }
      const enhanced = data.enhanced;
      // Swap the enriched text into this message's first text part.
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m;
          let replaced = false;
          const parts = (m.parts ?? []).map((p) => {
            if (!replaced && p.type === "text") {
              replaced = true;
              return { ...p, text: enhanced };
            }
            return p;
          });
          return { ...m, parts };
        })
      );
      return "Enhanced ✨";
    })();
    toast.promise(run, {
      loading: "Enhancing dialogue…",
      success: (msg) => msg,
      error: "Failed to enhance response",
    });
    try {
      await run;
    } catch {
      /* toast already surfaced it */
    } finally {
      setBusy(false);
    }
  };

  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
        <div className="flex items-center gap-0.5">
          {onEdit && (
            <Action
              className="size-7 text-muted-foreground/50 hover:text-foreground"
              data-testid="message-edit-button"
              onClick={onEdit}
              tooltip="Edit"
            >
              <PencilEditIcon />
            </Action>
          )}
          {regenerate && (
            <Action
              className="size-7 text-muted-foreground/50 hover:text-foreground disabled:opacity-40"
              data-testid="message-resend-button"
              disabled={busy}
              onClick={handleResend}
              tooltip="Resend"
            >
              <RedoIcon />
            </Action>
          )}
          <Action
            className="size-7 text-muted-foreground/50 hover:text-foreground"
            onClick={handleCopy}
            tooltip="Copy"
          >
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Actions className="-ml-0.5 opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
        <Action
          className="text-muted-foreground/50 hover:text-foreground"
          onClick={handleCopy}
          tooltip="Copy"
        >
          <CopyIcon />
        </Action>

        {process.env.NEXT_PUBLIC_ENABLE_RESPONSE_ENHANCEMENT === "true" &&
          setMessages && (
            <Action
              className="text-muted-foreground/50 hover:text-primary disabled:opacity-40"
              data-testid="message-enhance-button"
              disabled={busy}
              onClick={handleEnhance}
              tooltip="Enhance — richer, more intense dialogue"
            >
              <SparklesIcon />
            </Action>
          )}

        {regenerate && (
          <Action
            className="text-muted-foreground/50 hover:text-foreground disabled:opacity-40"
            data-testid="message-regenerate-button"
            disabled={busy}
            onClick={() => handleRegenerate()}
            tooltip="Regenerate"
          >
            <RedoIcon />
          </Action>
        )}

        {regenerate && (
          <Action
            className="text-muted-foreground/50 hover:text-foreground disabled:opacity-40"
            data-testid="message-guide-button"
            disabled={busy}
            onClick={() => setGuiding((g) => !g)}
            tooltip="Regenerate with instructions"
          >
            <PencilEditIcon />
          </Action>
        )}

        <Action
          className="text-muted-foreground/50 hover:text-foreground"
          data-testid="message-upvote"
          disabled={vote?.isUpvoted}
          onClick={() => {
            const upvote = fetch(
              `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  chatId,
                  messageId: message.id,
                  type: "up",
                }),
              }
            );

            toast.promise(upvote, {
              loading: "Upvoting Response...",
              success: () => {
                mutate<Vote[]>(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
                  (currentVotes) => {
                    if (!currentVotes) {
                      return [];
                    }

                    const votesWithoutCurrent = currentVotes.filter(
                      (currentVote) => currentVote.messageId !== message.id
                    );

                    return [
                      ...votesWithoutCurrent,
                      {
                        chatId,
                        messageId: message.id,
                        isUpvoted: true,
                      },
                    ];
                  },
                  { revalidate: false }
                );

                return "Upvoted Response!";
              },
              error: "Failed to upvote response.",
            });
          }}
          tooltip="Upvote Response"
        >
          <ThumbUpIcon />
        </Action>

        <Action
          className="text-muted-foreground/50 hover:text-foreground"
          data-testid="message-downvote"
          disabled={vote && !vote.isUpvoted}
          onClick={() => {
            const downvote = fetch(
              `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  chatId,
                  messageId: message.id,
                  type: "down",
                }),
              }
            );

            toast.promise(downvote, {
              loading: "Downvoting Response...",
              success: () => {
                mutate<Vote[]>(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
                  (currentVotes) => {
                    if (!currentVotes) {
                      return [];
                    }

                    const votesWithoutCurrent = currentVotes.filter(
                      (currentVote) => currentVote.messageId !== message.id
                    );

                    return [
                      ...votesWithoutCurrent,
                      {
                        chatId,
                        messageId: message.id,
                        isUpvoted: false,
                      },
                    ];
                  },
                  { revalidate: false }
                );

                return "Downvoted Response!";
              },
              error: "Failed to downvote response.",
            });
          }}
          tooltip="Downvote Response"
        >
          <ThumbDownIcon />
        </Action>
      </Actions>

      {guiding && (
        <div className="flex items-center gap-1.5 opacity-100">
          <input
            autoFocus
            className="w-full max-w-md rounded-lg border border-border/40 bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/50"
            disabled={busy}
            onChange={(e) => setGuideText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && guideText.trim()) {
                handleRegenerate(guideText);
              } else if (e.key === "Escape") {
                setGuiding(false);
                setGuideText("");
              }
            }}
            placeholder="Guide the rewrite — e.g. 'more dialogue', 'make her angrier'…"
            value={guideText}
          />
          <button
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={busy || !guideText.trim()}
            onClick={() => handleRegenerate(guideText)}
            type="button"
          >
            Rewrite
          </button>
        </div>
      )}
    </div>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }

    return true;
  }
);
