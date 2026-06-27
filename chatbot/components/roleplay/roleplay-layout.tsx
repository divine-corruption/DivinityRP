"use client";

import { Image as ImageIcon, X } from "lucide-react";
import { useState } from "react";
import { useRoleplay } from "@/lib/roleplay-store";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DashboardView } from "./dashboard-view";
import { CharactersView } from "./characters-view";
import { DivineVision } from "./divine-vision";
import { LoreUniverseView } from "./loreuniverse-view";
import { DivineCorruptionView } from "./divinecorruption-view";
import { MediaGallery } from "./media-gallery";
import { ModelTesterView } from "./modeltester-view";
import { SettingsView } from "./settings-view";

export function RoleplayLayout() {
  const { currentView, galleryItems, clearGalleryItems } = useRoleplay();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [visionList, setVisionList] = useState<MediaItem[] | null>(null);
  const [visionIndex, setVisionIndex] = useState(0);

  const openVision = (item: MediaItem, list: MediaItem[]) => {
    setVisionList(list);
    setVisionIndex(Math.max(0, list.findIndex((m) => m.id === item.id)));
  };

  const renderView = () => {
    switch (currentView) {
      case "characters":
        return <CharactersView />;
      case "loreuniverse":
        return <LoreUniverseView />;
      case "divinecorruption":
        return <DivineCorruptionView />;
      case "modeltester":
        return <ModelTesterView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-dvh w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar with global Gallery toggle */}
        <div className="flex h-12 items-center justify-end gap-1 border-b border-border/20 px-3 shrink-0">
          <button
            type="button"
            onClick={() => setGalleryOpen((o) => !o)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
              galleryOpen
                ? "bg-accent text-foreground"
                : "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
            )}
            title="Gallery"
          >
            <ImageIcon className="size-4" />
            <span className="hidden sm:inline">Gallery</span>
            {galleryItems.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {galleryItems.length > 99 ? "99+" : galleryItems.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderView()}
        </div>
      </div>

      {galleryOpen && (
        <div className="hidden w-80 shrink-0 flex-col border-l border-border/40 bg-card lg:flex">
          <div className="flex h-12 items-center justify-between border-b border-border/20 px-4 shrink-0">
            <span className="text-sm font-medium">Gallery</span>
            <button
              type="button"
              onClick={() => setGalleryOpen(false)}
              className="rounded-lg p-1 text-muted-foreground/50 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <MediaGallery
              items={galleryItems}
              onSelect={openVision}
              onClear={clearGalleryItems}
            />
          </div>
        </div>
      )}

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
    </div>
  );
}
