"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DivineVisionMedia {
  url: string;
  type: "image" | "video";
  caption?: string;
}

interface DivineVisionProps {
  /** The currently focused media item. */
  media: DivineVisionMedia;
  /** Optional playlist for prev/next navigation within the viewer. */
  playlist?: MediaItem[];
  /** Index of `media` within `playlist`. */
  index?: number;
  onNavigate?: (index: number) => void;
  onClose: () => void;
}

const MIN_W = 280;
const MIN_H = 220;
const HEADER_H = 36;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * DivineVision — a floating media viewer that can be dragged, resized and
 * minimized so the user can keep watching/looking while they read or type.
 */
export function DivineVision({
  media,
  playlist,
  index,
  onNavigate,
  onClose,
}: DivineVisionProps) {
  const [pos, setPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(window.innerWidth - 460, 24) : 80,
    y: 96,
  }));
  const [size, setSize] = useState({ w: 420, h: 320 });
  const [minimized, setMinimized] = useState(false);
  const [pinned, setPinned] = useState(false);
  const dragState = useRef<{
    mode: "move" | "resize" | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    origW: 0,
    origH: 0,
  });

  const hasPlaylist = !!playlist && playlist.length > 1 && index !== undefined;
  const canPrev = hasPlaylist && (index as number) > 0;
  const canNext = hasPlaylist && (index as number) < (playlist as MediaItem[]).length - 1;

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = dragState.current;
    if (!s.mode) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.mode === "move") {
      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - HEADER_H;
      setPos({
        x: clamp(s.origX + dx, -size.w + 120, maxX),
        y: clamp(s.origY + dy, 8, maxY),
      });
    } else if (s.mode === "resize") {
      setSize({
        w: clamp(s.origW + dx, MIN_W, window.innerWidth - 16),
        h: clamp(s.origH + dy, MIN_H, window.innerHeight - 16),
      });
    }
  }, [size.w]);

  const endDrag = useCallback(() => {
    dragState.current.mode = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    document.body.style.userSelect = "";
  }, [onPointerMove]);

  const beginDrag = useCallback(
    (mode: "move" | "resize", e: ReactPointerEvent) => {
      e.preventDefault();
      dragState.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        origW: size.w,
        origH: size.h,
      };
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
    },
    [pos.x, pos.y, size.w, size.h, onPointerMove, endDrag]
  );

  useEffect(() => () => endDrag(), [endDrag]);

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canPrev && index !== undefined)
        onNavigate?.(index - 1);
      if (e.key === "ArrowRight" && canNext && index !== undefined)
        onNavigate?.(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, canPrev, canNext, index]);

  return (
    <div
      className={cn(
        "fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl shadow-black/40 backdrop-blur",
        pinned && "ring-1 ring-primary/50"
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: minimized ? HEADER_H : size.h,
      }}
      role="dialog"
      aria-label="DivineVision media viewer"
    >
      {/* Title bar — drag handle */}
      <div
        className="flex h-9 shrink-0 cursor-grab items-center justify-between gap-2 border-b border-border/30 bg-gradient-to-r from-primary/10 to-transparent px-2.5 active:cursor-grabbing"
        onPointerDown={(e) => beginDrag("move", e)}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="truncate text-[11px] font-semibold tracking-wide text-foreground/90">
            DivineVision
          </span>
          {media.caption && (
            <span className="truncate text-[11px] text-muted-foreground">
              — {media.caption}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPinned((p) => !p)}
            className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            title={pinned ? "Unpin" : "Pin (keep on top)"}
          >
            {pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized((m) => !m)}
            className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            title={minimized ? "Restore" : "Minimize"}
          >
            {minimized ? (
              <Maximize2 className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-destructive/15 hover:text-destructive"
            title="Close"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/80">
            {media.type === "video" ? (
              <video
                key={media.url}
                src={media.url}
                controls
                autoPlay
                loop
                className="max-h-full max-w-full"
              />
            ) : (
              <img
                key={media.url}
                src={media.url}
                alt={media.caption ?? "DivineVision media"}
                className="max-h-full max-w-full object-contain"
              />
            )}

            {hasPlaylist && (
              <>
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() =>
                    index !== undefined && onNavigate?.(index - 1)
                  }
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white/90 transition-opacity hover:bg-black/70 disabled:opacity-20"
                  title="Previous"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() =>
                    index !== undefined && onNavigate?.(index + 1)
                  }
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white/90 transition-opacity hover:bg-black/70 disabled:opacity-20"
                  title="Next"
                >
                  <ChevronRight className="size-4" />
                </button>
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white/80">
                  {(index as number) + 1} / {(playlist as MediaItem[]).length}
                </div>
              </>
            )}
          </div>

          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            onPointerDown={(e) => beginDrag("resize", e)}
          >
            <svg
              className="absolute bottom-0.5 right-0.5 text-muted-foreground/50"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
            >
              <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
