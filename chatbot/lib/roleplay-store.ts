"use client";

import { createContext, useContext } from "react";
import type { Character, DivinityAIState, LoreBook, LoreDetection, LoreEntry, LoreSuggestion, SidebarView, StoryNode } from "./types";

export interface RoleplayState {
  characters: Character[];
  selectedCharacter: Character | null;
  loreEntries: LoreEntry[];
  loreBooks: LoreBook[];
  storyNodes: StoryNode[];
  currentView: SidebarView;
  galleryMedia: { url: string; type: "image" | "video" } | null;
  divinityAI: DivinityAIState;
  loreDetection: LoreDetection;
}

export interface RoleplayActions {
  setCurrentView: (view: SidebarView) => void;
  importCharacter: (data: unknown) => Character;
  selectCharacter: (character: Character | null) => void;
  deleteCharacter: (id: string) => void;
  addLoreEntry: (entry: LoreEntry) => void;
  updateLoreEntry: (id: string, entry: Partial<LoreEntry>) => void;
  deleteLoreEntry: (id: string) => void;
  addStoryNode: (node: StoryNode) => void;
  setGalleryMedia: (media: { url: string; type: "image" | "video" } | null) => void;
  // LoreBooks
  addLoreBook: (book: LoreBook) => void;
  updateLoreBook: (id: string, book: Partial<LoreBook>) => void;
  deleteLoreBook: (id: string) => void;
  // DivinityAI
  setDivinityAI: (state: Partial<DivinityAIState>) => void;
  addDivinitySuggestion: (suggestion: LoreSuggestion) => void;
  removeDivinitySuggestion: (id: string) => void;
  clearDivinitySuggestions: () => void;
  // Lore Detection
  setLoreDetection: (detection: Partial<LoreDetection>) => void;
  clearLoreDetection: () => void;
}

export type RoleplayContext = RoleplayState & RoleplayActions;

export const RoleplayCtx = createContext<RoleplayContext | null>(null);

export function useRoleplay(): RoleplayContext {
  const ctx = useContext(RoleplayCtx);
  if (!ctx) {
    throw new Error("useRoleplay must be used within a RoleplayProvider");
  }
  return ctx;
}
