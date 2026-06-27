"use client";

import { Film, ImageIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "image" | "video";

const SOURCE_LABEL: Record<MediaItem["source"], string> = {
  character: "Character",
  generated: "Generated",
  uploaded: "Uploaded",
  forge: "Forge",
};

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

/**
 * MediaGallery — grid of all collected media (character art, AI-generated
 * images, uploaded attachments). Clicking an item opens it in DivineVision.
 */
export function MediaGallery({
  items,
  onSelect,
  onClear,
}: {
  items: MediaItem[];
  onSelect: (item: MediaItem, list: MediaItem[]) => void;
  onClear?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === "all") return sorted;
    return sorted.filter((m) => m.type === filter);
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      all: items.length,
      image: items.filter((m) => m.type === "image").length,
      video: items.filter((m) => m.type === "video").length,
    }),
    [items]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/20 px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "image", "video"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2 py-1 text-xs capitalize transition-colors",
                filter === f
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>
        {onClear && items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Clear gallery"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <ImageIcon className="size-8 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground">
            No media yet. Generated images, character art and uploads will
            appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">
          {filtered.map((item) => {
            const isVideo = item.type === "video" || isVideoUrl(item.url);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item, filtered)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border/20 bg-muted transition-transform hover:scale-[1.02]"
              >
                {isVideo ? (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={item.caption ?? "media"}
                    className="h-full w-full object-cover"
                  />
                )}

                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/10">
                    <Film className="size-6 text-white drop-shadow" />
                  </div>
                )}

                <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
                  {SOURCE_LABEL[item.source]}
                </span>

                {item.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                    <span className="line-clamp-2 text-[10px] leading-tight text-white">
                      {item.caption}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
