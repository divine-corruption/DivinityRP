"use client";

import { Image as ImageIcon, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { toast } from "sonner";
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
  const { currentView, galleryItems, addGalleryItems, clearGalleryItems, selectedCharacter } = useRoleplay();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [visionList, setVisionList] = useState<MediaItem[] | null>(null);
  const [visionIndex, setVisionIndex] = useState(0);

  const openVision = (item: MediaItem, list: MediaItem[]) => {
    setVisionList(list);
    setVisionIndex(Math.max(0, list.findIndex((m) => m.id === item.id)));
  };

  const handleGalleryUpload = async (files: File[]) => {
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          if (selectedCharacter?.id) {
            formData.append("characterId", selectedCharacter.id);
          }
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/upload`,
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
              onUpload={handleGalleryUpload}
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
