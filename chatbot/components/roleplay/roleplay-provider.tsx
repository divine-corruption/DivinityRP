"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureThread,
  setActiveThreadId,
} from "@/lib/conversation-threads";
import { RoleplayCtx } from "@/lib/roleplay-store";
import { restoreExtra, useStateSync } from "@/hooks/use-state-sync";
import type { Character, CharacterImage, DivinityAIState, LoreBook, LoreDetection, LoreEntry, LoreSuggestion, MediaItem, SidebarView, StoryNode } from "@/lib/types";

function parseSillyTavern(data: Record<string, unknown>): Character {
  const char: Record<string, unknown> = (data?.data as Record<string, unknown> | undefined) || data;
  const images: { url: string; caption?: string }[] = [];

  const charAvatar = char?.avatar;
  if (Array.isArray(charAvatar)) {
    for (const img of charAvatar) {
      if (typeof img === "string") {
        images.push({ url: img });
      } else if (img && typeof img === "object" && "path" in (img as Record<string, unknown>)) {
        const imgObj = img as Record<string, unknown>;
        images.push({ url: String(imgObj.path), caption: imgObj.caption as string | undefined });
      }
    }
  }

  const charGallery = char?.gallery;
  if (charGallery) {
    const gallery = Array.isArray(charGallery) ? charGallery : [charGallery];
    for (const item of gallery) {
      if (typeof item === "string") {
        images.push({ url: item });
      } else if (item && typeof item === "object" && "path" in (item as Record<string, unknown>)) {
        const itemObj = item as Record<string, unknown>;
        images.push({ url: String(itemObj.path), caption: itemObj.caption as string | undefined });
      }
    }
  }

  return {
    id: nanoid(),
    name: String(char?.name ?? data?.name ?? "Unknown"),
    description: String(char?.description ?? data?.description ?? ""),
    personality: String(char?.personality ?? data?.personality ?? ""),
    scenario: String(char?.scenario ?? data?.scenario ?? ""),
    firstMes: String(char?.first_mes ?? data?.first_mes ?? char?.firstMes ?? ""),
    mesExample: String(char?.mes_example ?? data?.mes_example ?? char?.mesExample ?? ""),
    systemPrompt:
      (char?.system_prompt as string | undefined) ??
      (char?.system_prompt_override as string | undefined) ??
      (data?.system_prompt as string | undefined) ??
      (char?.systemPrompt as string | undefined) ??
      undefined,
    avatar: images[0]?.url,
    images,
    tags: Array.isArray(char?.tags) ? (char.tags as string[]) : [],
    metadata: char ?? {},
    importedAt: Date.now(),
  };
}

function parseChub(data: Record<string, unknown>): Character {
  const node: Record<string, unknown> = (data?.node as Record<string, unknown> | undefined) || data;
  const char: Record<string, unknown> = (node?.character as Record<string, unknown> | undefined) || node;

  const images: { url: string; caption?: string }[] = [];

  const avatarUrl = char?.avatar_url;
  if (typeof avatarUrl === "string") {
    images.push({ url: avatarUrl });
  }

  const charImages = char?.images;
  if (Array.isArray(charImages)) {
    for (const img of charImages) {
      if (typeof img === "string") {
        images.push({ url: img });
      } else if (img && typeof img === "object") {
        const imgObj = img as Record<string, unknown>;
        const imgUrl = imgObj.url || imgObj.path;
        if (typeof imgUrl === "string") {
          images.push({ url: imgUrl, caption: imgObj.caption as string | undefined });
        }
      }
    }
  }

  return {
    id: nanoid(),
    name: String(char?.name ?? "Unknown"),
    description: String(char?.description ?? ""),
    personality: String(char?.personality ?? ""),
    scenario: String(char?.scenario ?? ""),
    firstMes: String(char?.first_mes ?? char?.firstMes ?? ""),
    mesExample: String(char?.mes_example ?? char?.mesExample ?? ""),
    avatar: images[0]?.url,
    images,
    tags: Array.isArray(char?.tags) ? (char.tags as string[]) : [],
    metadata: data,
    importedAt: Date.now(),
  };
}

export function detectImportFormat(data: unknown): "chub" | "sillytavern" | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  const dNode = d.node as Record<string, unknown> | undefined;
  const dCharacter = d.character as Record<string, unknown> | undefined;
  const dData = d.data as Record<string, unknown> | undefined;

  if (dNode?.character || dCharacter?.name) return "chub";
  if (dData?.name || d.name) return "sillytavern";

  return null;
}

export function importCharacterFromJson(data: unknown): Character {
  const format = detectImportFormat(data);
  if (format === "chub") return parseChub(data as Record<string, unknown>);
  return parseSillyTavern(data as Record<string, unknown>);
}

const STORAGE_KEY_CHARACTERS = "divine_characters";
const STORAGE_KEY_LORE = "divine_lore";
const STORAGE_KEY_NODES = "divine_nodes";
const STORAGE_KEY_LOREBOOKS = "divine_lorebooks";
const STORAGE_KEY_GALLERY = "divine_gallery";

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

const defaultDivinityAI: DivinityAIState = {
  open: false,
  messages: [],
  suggestions: [],
  loading: false,
  selectedLorebookId: null,
};

const defaultLoreDetection: LoreDetection = {
  active: false,
  suggestion: null,
  chatId: "",
  messageId: "",
};

export function RoleplayProvider({ children }: { children: React.ReactNode }) {
  const [characters, setCharacters] = useState<Character[]>(() =>
    loadJSON<Character[]>(STORAGE_KEY_CHARACTERS, [])
  );
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>(() =>
    loadJSON<LoreEntry[]>(STORAGE_KEY_LORE, [])
  );
  const [loreBooks, setLoreBooks] = useState<LoreBook[]>(() =>
    loadJSON<LoreBook[]>(STORAGE_KEY_LOREBOOKS, [])
  );
  const [storyNodes, setStoryNodes] = useState<StoryNode[]>(() =>
    loadJSON<StoryNode[]>(STORAGE_KEY_NODES, [])
  );
  const [currentView, setCurrentView] = useState<SidebarView>("dashboard");
  const [galleryMedia, setGalleryMedia] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>(() =>
    loadJSON<MediaItem[]>(STORAGE_KEY_GALLERY, [])
  );
  const [divinityAI, setDivinityAIState] = useState<DivinityAIState>(defaultDivinityAI);
  const [loreDetection, setLoreDetectionState] = useState<LoreDetection>(defaultLoreDetection);

  // ---- Cross-device persistence (Cloudflare R2 via /api/state) -------------
  // Snapshot of everything we want to survive across devices / browser clears.
  const syncSnapshot = useMemo(
    () => ({
      characters,
      galleryItems,
      loreBooks,
      loreEntries,
      storyNodes,
    }),
    [characters, galleryItems, loreBooks, loreEntries, storyNodes]
  );

  // Apply a snapshot pulled from the server: update both React state and the
  // localStorage cache so a reload stays consistent.
  const applyRemoteState = useCallback(
    (remote: {
      characters: unknown[];
      galleryItems: unknown[];
      loreBooks: unknown[];
      loreEntries: unknown[];
      storyNodes: unknown[];
      extra?: Record<string, unknown>;
    }) => {
      const chars = remote.characters as Character[];
      const gallery = remote.galleryItems as MediaItem[];
      const books = remote.loreBooks as LoreBook[];
      const entries = remote.loreEntries as LoreEntry[];
      const nodes = remote.storyNodes as StoryNode[];

      setCharacters(chars);
      setGalleryItems(gallery);
      setLoreBooks(books);
      setLoreEntries(entries);
      setStoryNodes(nodes);

      saveJSON(STORAGE_KEY_CHARACTERS, chars);
      saveJSON(STORAGE_KEY_GALLERY, gallery);
      saveJSON(STORAGE_KEY_LOREBOOKS, books);
      saveJSON(STORAGE_KEY_LORE, entries);
      saveJSON(STORAGE_KEY_NODES, nodes);

      // Restore extra localStorage keys (settings, threads, arcs, etc.).
      // Only fills in keys not already present locally so a freshly-written
      // local value is never overwritten by an older server snapshot.
      if (remote.extra) {
        restoreExtra(remote.extra, false);
      }
    },
    []
  );

  useStateSync(syncSnapshot, applyRemoteState);


  const handleImportCharacter = useCallback((data: unknown): Character => {
    const char = importCharacterFromJson(data);
    setCharacters((prev) => {
      const updated = [...prev, char];
      saveJSON(STORAGE_KEY_CHARACTERS, updated);
      return updated;
    });
    return char;
  }, []);

  const handleSelectCharacter = useCallback((character: Character | null) => {
    setSelectedCharacter(character);
    if (character) {
      setCurrentView("characters");
      if (typeof window !== "undefined") {
        const charData = JSON.stringify({
          id: character.id,
          name: character.name,
          description: character.description,
          personality: character.personality,
          scenario: character.scenario,
          first_mes: character.firstMes,
          mes_example: character.mesExample,
          system_prompt: character.systemPrompt,
          tags: character.tags,
          avatar: character.avatar,
          images: character.images,
          memory: character.brain?.overviewMemory ?? "",
        });
        localStorage.setItem("divine_active_character", charData);
        // Open (or resume) this character's default conversation thread so its
        // history persists and is restored when re-selected. Seed the opening
        // message into the thread the first time it's created.
        const { thread, created } = ensureThread({
          characterId: character.id,
          title: `${character.name} — Free Roleplay`,
        });
        setActiveThreadId(thread.id);
        if (created && character.firstMes) {
          fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages/seed`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chatId: thread.id,
                title: thread.title,
                message: { text: character.firstMes },
              }),
            }
          ).catch(() => {
            /* non-critical: opener will simply be absent on resume */
          });
        }
      }
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("divine_active_character");
      }
    }
  }, []);

  const handleUpdateCharacter = useCallback(
    (id: string, patch: Partial<Character>) => {
      let nextChar: Character | null = null;
      setCharacters((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== id) return c;
          const merged = { ...c, ...patch };
          nextChar = merged;
          return merged;
        });
        saveJSON(STORAGE_KEY_CHARACTERS, updated);
        return updated;
      });
      // Keep the selected character + the chat's active-character payload in
      // sync so edits (e.g. a new avatar or name) take effect immediately.
      setSelectedCharacter((prev) => {
        if (prev?.id !== id || !nextChar) return prev;
        if (typeof window !== "undefined") {
          const c = nextChar;
          localStorage.setItem(
            "divine_active_character",
            JSON.stringify({
              id: c.id,
              name: c.name,
              description: c.description,
              personality: c.personality,
              scenario: c.scenario,
              first_mes: c.firstMes,
              mes_example: c.mesExample,
              system_prompt: c.systemPrompt,
              tags: c.tags,
              avatar: c.avatar,
              images: c.images,
              memory: c.brain?.overviewMemory ?? "",
            })
          );
        }
        return nextChar;
      });
    },
    []
  );

  const handleDeleteCharacter = useCallback((id: string) => {
    setCharacters((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveJSON(STORAGE_KEY_CHARACTERS, updated);
      return updated;
    });
    setSelectedCharacter((prev) => (prev?.id === id ? null : prev));
  }, []);

  // Attach an image to one character's own gallery (character.images) AND mirror
  // it into the aggregated gallery tagged with characterId, so per-character and
  // global views stay in sync. De-duplicated by url.
  const handleAddImageToCharacter = useCallback(
    (
      characterId: string,
      image: CharacterImage,
      opts?: { type?: "image" | "video"; setAvatar?: boolean }
    ) => {
      if (!image?.url) return;
      let updatedChar: Character | null = null;
      setCharacters((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== characterId) return c;
          const exists = c.images?.some((img) => img.url === image.url);
          const images = exists ? c.images : [...(c.images ?? []), image];
          const merged: Character = {
            ...c,
            images,
            avatar: opts?.setAvatar ? image.url : c.avatar ?? image.url,
          };
          updatedChar = merged;
          return merged;
        });
        saveJSON(STORAGE_KEY_CHARACTERS, updated);
        return updated;
      });
      // Keep selection + active-character payload current if this is the open char.
      setSelectedCharacter((prev) =>
        prev?.id === characterId && updatedChar ? updatedChar : prev
      );
      // Mirror into the aggregated gallery, tagged with the character.
      setGalleryItems((prev) => {
        if (prev.some((m) => m.url === image.url)) return prev;
        const item: MediaItem = {
          id: nanoid(),
          url: image.url,
          type: opts?.type ?? "image",
          source: "character",
          characterId,
          caption: image.caption,
          createdAt: Date.now(),
        };
        const updated = [...prev, item];
        saveJSON(STORAGE_KEY_GALLERY, updated);
        return updated;
      });
    },
    []
  );

  const handleRemoveImageFromCharacter = useCallback(
    (characterId: string, url: string) => {
      let updatedChar: Character | null = null;
      setCharacters((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== characterId) return c;
          const images = (c.images ?? []).filter((img) => img.url !== url);
          const merged: Character = {
            ...c,
            images,
            avatar: c.avatar === url ? images[0]?.url : c.avatar,
          };
          updatedChar = merged;
          return merged;
        });
        saveJSON(STORAGE_KEY_CHARACTERS, updated);
        return updated;
      });
      setSelectedCharacter((prev) =>
        prev?.id === characterId && updatedChar ? updatedChar : prev
      );
      // Remove the mirrored gallery item too.
      setGalleryItems((prev) => {
        const updated = prev.filter(
          (m) => !(m.url === url && m.characterId === characterId)
        );
        if (updated.length === prev.length) return prev;
        saveJSON(STORAGE_KEY_GALLERY, updated);
        return updated;
      });
    },
    []
  );

  const handleAddLoreEntry = useCallback((entry: LoreEntry) => {
    setLoreEntries((prev) => {
      const updated = [...prev, entry];
      saveJSON(STORAGE_KEY_LORE, updated);
      return updated;
    });
  }, []);

  const handleUpdateLoreEntry = useCallback(
    (id: string, entry: Partial<LoreEntry>) => {
      setLoreEntries((prev) => {
        const updated = prev.map((e) =>
          e.id === id ? { ...e, ...entry, updatedAt: Date.now() } : e
        );
        saveJSON(STORAGE_KEY_LORE, updated);
        return updated;
      });
    },
    []
  );

  const handleDeleteLoreEntry = useCallback((id: string) => {
    setLoreEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      saveJSON(STORAGE_KEY_LORE, updated);
      return updated;
    });
  }, []);

  const handleAddStoryNode = useCallback((node: StoryNode) => {
    setStoryNodes((prev) => {
      const updated = [...prev, node];
      saveJSON(STORAGE_KEY_NODES, updated);
      return updated;
    });
  }, []);

  const handleUpdateStoryNode = useCallback(
    (id: string, node: Partial<StoryNode>) => {
      setStoryNodes((prev) => {
        const updated = prev.map((n) => (n.id === id ? { ...n, ...node } : n));
        saveJSON(STORAGE_KEY_NODES, updated);
        return updated;
      });
    },
    []
  );

  const handleDeleteStoryNode = useCallback((id: string) => {
    setStoryNodes((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveJSON(STORAGE_KEY_NODES, updated);
      return updated;
    });
  }, []);

  const handleAddGalleryItems = useCallback((items: MediaItem[]) => {
    if (items.length === 0) return;
    setGalleryItems((prev) => {
      const seen = new Set(prev.map((m) => m.url));
      const fresh = items.filter((m) => m.url && !seen.has(m.url));
      if (fresh.length === 0) return prev;
      const updated = [...prev, ...fresh];
      saveJSON(STORAGE_KEY_GALLERY, updated);
      return updated;
    });
  }, []);

  const handleClearGalleryItems = useCallback(() => {
    setGalleryItems([]);
    saveJSON(STORAGE_KEY_GALLERY, []);
  }, []);

  // LoreBook handlers
  const handleAddLoreBook = useCallback((book: LoreBook) => {
    setLoreBooks((prev) => {
      const updated = [...prev, book];
      saveJSON(STORAGE_KEY_LOREBOOKS, updated);
      return updated;
    });
  }, []);

  const handleUpdateLoreBook = useCallback((id: string, book: Partial<LoreBook>) => {
    setLoreBooks((prev) => {
      const updated = prev.map((b) =>
        b.id === id ? { ...b, ...book, updatedAt: Date.now() } : b
      );
      saveJSON(STORAGE_KEY_LOREBOOKS, updated);
      return updated;
    });
  }, []);

  const handleDeleteLoreBook = useCallback((id: string) => {
    setLoreBooks((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      saveJSON(STORAGE_KEY_LOREBOOKS, updated);
      return updated;
    });
    // Also remove lorebookId from entries
    setLoreEntries((prev) => {
      const updated = prev.map((e) =>
        e.lorebookId === id ? { ...e, lorebookId: undefined } : e
      );
      saveJSON(STORAGE_KEY_LORE, updated);
      return updated;
    });
  }, []);

  // DivinityAI handlers
  const handleSetDivinityAI = useCallback((state: Partial<DivinityAIState>) => {
    setDivinityAIState((prev) => ({ ...prev, ...state }));
  }, []);

  const handleAddDivinitySuggestion = useCallback((suggestion: LoreSuggestion) => {
    setDivinityAIState((prev) => ({
      ...prev,
      suggestions: [...prev.suggestions, suggestion],
    }));
  }, []);

  const handleUpdateDivinitySuggestion = useCallback(
    (id: string, patch: Partial<LoreSuggestion>) => {
      setDivinityAIState((prev) => ({
        ...prev,
        suggestions: prev.suggestions.map((s) =>
          s.id === id ? { ...s, ...patch } : s
        ),
      }));
    },
    []
  );

  const handleRemoveDivinitySuggestion = useCallback((id: string) => {
    setDivinityAIState((prev) => ({
      ...prev,
      suggestions: prev.suggestions.filter((s) => s.id !== id),
    }));
  }, []);

  const handleClearDivinitySuggestions = useCallback(() => {
    setDivinityAIState((prev) => ({ ...prev, suggestions: [] }));
  }, []);

  // Lore Detection handlers
  const handleSetLoreDetection = useCallback((detection: Partial<LoreDetection>) => {
    setLoreDetectionState((prev) => ({ ...prev, ...detection }));
  }, []);

  const handleClearLoreDetection = useCallback(() => {
    setLoreDetectionState(defaultLoreDetection);
  }, []);

  const value = useMemo(
    () => ({
      characters,
      selectedCharacter,
      loreEntries,
      loreBooks,
      storyNodes,
      currentView,
      galleryMedia,
      galleryItems,
      divinityAI,
      loreDetection,
      setCurrentView,
      importCharacter: handleImportCharacter,
      selectCharacter: handleSelectCharacter,
      updateCharacter: handleUpdateCharacter,
      deleteCharacter: handleDeleteCharacter,
      addImageToCharacter: handleAddImageToCharacter,
      removeImageFromCharacter: handleRemoveImageFromCharacter,
      addLoreEntry: handleAddLoreEntry,
      updateLoreEntry: handleUpdateLoreEntry,
      deleteLoreEntry: handleDeleteLoreEntry,
      addStoryNode: handleAddStoryNode,
      updateStoryNode: handleUpdateStoryNode,
      deleteStoryNode: handleDeleteStoryNode,
      setGalleryMedia,
      addGalleryItems: handleAddGalleryItems,
      clearGalleryItems: handleClearGalleryItems,
      addLoreBook: handleAddLoreBook,
      updateLoreBook: handleUpdateLoreBook,
      deleteLoreBook: handleDeleteLoreBook,
      setDivinityAI: handleSetDivinityAI,
      addDivinitySuggestion: handleAddDivinitySuggestion,
      updateDivinitySuggestion: handleUpdateDivinitySuggestion,
      removeDivinitySuggestion: handleRemoveDivinitySuggestion,
      clearDivinitySuggestions: handleClearDivinitySuggestions,
      setLoreDetection: handleSetLoreDetection,
      clearLoreDetection: handleClearLoreDetection,
    }),
    [
      characters, selectedCharacter, loreEntries, loreBooks, storyNodes,
      currentView, galleryMedia, galleryItems, divinityAI, loreDetection,
      handleImportCharacter, handleSelectCharacter, handleUpdateCharacter,
      handleDeleteCharacter,
      handleAddImageToCharacter, handleRemoveImageFromCharacter,
      handleAddLoreEntry, handleUpdateLoreEntry, handleDeleteLoreEntry,
      handleAddStoryNode, handleUpdateStoryNode, handleDeleteStoryNode,
      handleAddGalleryItems, handleClearGalleryItems,
      handleAddLoreBook, handleUpdateLoreBook, handleDeleteLoreBook,
      handleSetDivinityAI, handleAddDivinitySuggestion,
      handleUpdateDivinitySuggestion,
      handleRemoveDivinitySuggestion, handleClearDivinitySuggestions,
      handleSetLoreDetection, handleClearLoreDetection,
    ]
  );

  return <RoleplayCtx.Provider value={value}>{children}</RoleplayCtx.Provider>;
}
