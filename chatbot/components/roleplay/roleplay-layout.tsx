"use client";

import { useRoleplay } from "@/lib/roleplay-store";
import { DashboardView } from "./dashboard-view";
import { CharactersView } from "./characters-view";
import { LoreUniverseView } from "./loreuniverse-view";
import { DivineCorruptionView } from "./divinecorruption-view";
import { SettingsView } from "./settings-view";

export function RoleplayLayout() {
  const { currentView, galleryMedia, setGalleryMedia } = useRoleplay();

  const renderView = () => {
    switch (currentView) {
      case "characters":
        return <CharactersView />;
      case "loreuniverse":
        return <LoreUniverseView />;
      case "divinecorruption":
        return <DivineCorruptionView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-dvh w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderView()}
        </div>
      </div>

      {galleryMedia && (
        <div className="hidden w-80 shrink-0 border-l border-border/40 bg-card lg:block">
          <div className="flex h-14 items-center justify-between border-b border-border/20 px-4">
            <span className="text-sm font-medium">Gallery</span>
            <button
              type="button"
              onClick={() => setGalleryMedia(null)}
              className="rounded-lg p-1 text-muted-foreground/50 hover:text-foreground"
            >
              <span className="block rotate-45">+</span>
            </button>
          </div>
          <div className="flex items-center justify-center p-4">
            {galleryMedia.type === "video" ? (
              <video
                src={galleryMedia.url}
                controls
                className="max-h-[60vh] w-full rounded-lg object-contain"
              />
            ) : (
              <img
                src={galleryMedia.url}
                alt="Gallery media"
                className="max-h-[60vh] w-full rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
