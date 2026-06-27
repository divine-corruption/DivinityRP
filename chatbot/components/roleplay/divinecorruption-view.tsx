"use client";

import {
  Download,
  Globe,
  Loader2,
  Search,
  Upload,
  Skull,
  AlertTriangle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRoleplay } from "@/lib/roleplay-store";

interface PublicCharacter {
  id: string;
  name: string;
  description: string;
  personality?: string;
  tags?: string[];
  avatar?: string;
  publishedAt: number;
  downloads?: number;
  author?: string;
}

export function DivineCorruptionView() {
  const { characters, importCharacter, loreEntries, storyNodes } = useRoleplay();
  const [searchQuery, setSearchQuery] = useState("");
  const [publicChars, setPublicChars] = useState<PublicCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedPublic, setSelectedPublic] = useState<PublicCharacter | null>(
    null
  );
  const [publishingCharId, setPublishingCharId] = useState<string | null>(null);

  const corruptionLevel = Math.min(
    storyNodes.length + loreEntries.length,
    100
  );

  const fetchPublic = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/repository?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPublicChars(data.characters);
        setTotalCount(data.total);
      }
    } catch {
      // silently fail - repo may not be deployed
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchPublic();
  }, [fetchPublic]);

  const handlePublish = async (charId: string) => {
    setPublishingCharId(charId);
    const char = characters.find((c) => c.id === charId);
    if (!char) return;

    try {
      const res = await fetch("/api/repository", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: char.name,
          description: char.description,
          personality: char.personality,
          tags: char.tags,
          avatar: char.avatar,
          images: char.images,
          scenario: char.scenario,
          first_mes: char.firstMes,
          mes_example: char.mesExample,
          author: "local-user",
        }),
      });
      if (res.ok) {
        toast.success(`${char.name} published to repository`);
        fetchPublic();
      } else {
        toast.error("Failed to publish");
      }
    } catch {
      toast.error("Repository unavailable offline");
    } finally {
      setPublishingCharId(null);
    }
  };

  const handleImportPublic = (pub: PublicCharacter) => {
    importCharacter(pub);
    toast.success(`Imported: ${pub.name}`);
  };

  if (selectedPublic) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <button
          type="button"
          onClick={() => setSelectedPublic(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to repository
        </button>
        <div className="mb-6 flex items-start gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
            {selectedPublic.avatar ? (
              <img
                src={selectedPublic.avatar}
                alt={selectedPublic.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold">
                {selectedPublic.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{selectedPublic.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
              {selectedPublic.description}
            </p>
            {selectedPublic.tags && selectedPublic.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedPublic.tags.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => handleImportPublic(selectedPublic)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <Download className="size-4" />
              Import to Engine
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Divine Corruption</h1>
          <p className="text-sm text-muted-foreground">
            Public character repository &mdash; {totalCount} characters
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Skull className="size-5 text-purple-500" />
            <span className="text-sm font-medium">Local Corruption</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-purple-500 to-red-600 transition-all duration-700"
              style={{ width: `${corruptionLevel}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {corruptionLevel}% corrupted
          </p>
        </div>

        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Globe className="size-5 text-blue-500" />
            <span className="text-sm font-medium">Repository</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Public characters shared by the community.
            <br />
            {process.env.NODE_ENV === "production"
              ? "Accessible at repository.divine.app"
              : "Local storage mode (offline)"}
          </p>
        </div>
      </div>

      {corruptionLevel > 50 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-600 dark:text-red-400">
            Corruption is spreading. The divine balance is shifting.
          </p>
        </div>
      )}

      {/* Publish local characters section */}
      {characters.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Publish Local Characters
          </h2>
          <div className="flex flex-wrap gap-2">
            {characters.map((char) => (
              <button
                key={char.id}
                type="button"
                disabled={publishingCharId === char.id}
                onClick={() => handlePublish(char.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
              >
                {publishingCharId === char.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Upload className="size-3" />
                )}
                {char.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
        <input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search repository..."
          className="w-full rounded-lg border border-border/30 bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {/* Repository list */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : publicChars.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Globe className="mx-auto mb-3 size-10 text-muted-foreground/30" />
            <h3 className="text-sm font-medium">Repository is empty</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Publish characters to populate the repository
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {publicChars.map((pub) => (
              <div
                key={pub.id}
                className="group relative rounded-xl border border-border/30 bg-card transition-all hover:border-border/60 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setSelectedPublic(pub)}
                  className="flex w-full flex-col items-center p-3 text-center"
                >
                  <div className="mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {pub.avatar ? (
                      <img
                        src={pub.avatar}
                        alt={pub.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold">
                        {pub.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h3 className="truncate text-sm font-medium">{pub.name}</h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {pub.description}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleImportPublic(pub)}
                  className="absolute right-1.5 top-1.5 hidden rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground group-hover:block"
                >
                  <Download className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          {totalCount > 20 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border/30 px-3 py-1.5 text-xs disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">
                {page} / {Math.ceil(totalCount / 20)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(totalCount / 20)}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border/30 px-3 py-1.5 text-xs disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
