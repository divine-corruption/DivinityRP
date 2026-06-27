"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Cross-device roleplay-state sync via the /api/state endpoint (Cloudflare R2).
 *
 * localStorage stays the fast local cache and offline fallback; this hook layers
 * durable, cross-device persistence on top:
 *
 *   1. On mount it PULLs the server snapshot and, if it's newer (or local is
 *      empty), hands it to `onRemoteState` so the provider can hydrate.
 *   2. Whenever any synced collection changes it debounce-PUSHes the whole
 *      snapshot to the server (last-write-wins, guarded by updatedAt).
 *
 * The hook is deliberately collection-agnostic: callers pass a `snapshot`
 * object and a setter for each piece via `onRemoteState`. Anything added to the
 * snapshot is automatically persisted ("never lose anything").
 */

export interface RoleplaySnapshot {
  characters: unknown[];
  galleryItems: unknown[];
  loreBooks: unknown[];
  loreEntries: unknown[];
  storyNodes: unknown[];
  extra?: Record<string, unknown>;
}

const DEBOUNCE_MS = 1500;
const LOCAL_UPDATED_AT_KEY = "divine_state_updated_at";

function readLocalUpdatedAt(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(LOCAL_UPDATED_AT_KEY)) || 0;
}
function writeLocalUpdatedAt(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, String(ts));
  } catch {
    /* non-critical */
  }
}

function isEmptySnapshot(s: RoleplaySnapshot): boolean {
  return (
    s.characters.length === 0 &&
    s.galleryItems.length === 0 &&
    s.loreBooks.length === 0 &&
    s.loreEntries.length === 0 &&
    s.storyNodes.length === 0
  );
}

export function useStateSync(
  snapshot: RoleplaySnapshot,
  onRemoteState: (state: RoleplaySnapshot) => void
) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const hydratedRef = useRef(false);
  const lastSerializedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRemoteRef = useRef(onRemoteState);
  onRemoteRef.current = onRemoteState;

  // ---- Pull on mount -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/api/state`, { method: "GET" });
        if (!res.ok) {
          hydratedRef.current = true;
          return;
        }
        const data = (await res.json()) as {
          state: RoleplaySnapshot | null;
          updatedAt?: number;
        };
        if (cancelled) return;

        const serverUpdatedAt = data.updatedAt ?? 0;
        const localUpdatedAt = readLocalUpdatedAt();

        // Hydrate from server when it has data AND it's newer than what we last
        // pushed from this device (or this device has nothing yet).
        if (
          data.state &&
          (serverUpdatedAt >= localUpdatedAt || isEmptySnapshot(snapshot))
        ) {
          onRemoteRef.current({
            characters: data.state.characters ?? [],
            galleryItems: data.state.galleryItems ?? [],
            loreBooks: data.state.loreBooks ?? [],
            loreEntries: data.state.loreEntries ?? [],
            storyNodes: data.state.storyNodes ?? [],
            extra: data.state.extra ?? {},
          });
          writeLocalUpdatedAt(serverUpdatedAt);
          // Avoid an immediate echo push of what we just pulled.
          lastSerializedRef.current = JSON.stringify(data.state);
        }
      } catch {
        /* offline / not configured — stay local-only */
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
    // Pull exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // ---- Debounced push on change -------------------------------------------
  const push = useCallback(
    async (payload: RoleplaySnapshot) => {
      const updatedAt = Date.now();
      try {
        const res = await fetch(`${base}/api/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: payload, updatedAt }),
        });
        if (res.status === 409) {
          // Server has newer data — pull and let it win to avoid clobbering.
          const conflict = (await res.json()) as {
            state?: RoleplaySnapshot;
            serverUpdatedAt?: number;
          };
          if (conflict.state) {
            onRemoteRef.current({
              characters: conflict.state.characters ?? [],
              galleryItems: conflict.state.galleryItems ?? [],
              loreBooks: conflict.state.loreBooks ?? [],
              loreEntries: conflict.state.loreEntries ?? [],
              storyNodes: conflict.state.storyNodes ?? [],
              extra: conflict.state.extra ?? {},
            });
            writeLocalUpdatedAt(conflict.serverUpdatedAt ?? updatedAt);
            lastSerializedRef.current = JSON.stringify(conflict.state);
          }
          return;
        }
        if (res.ok) {
          writeLocalUpdatedAt(updatedAt);
        }
      } catch {
        /* offline — localStorage already holds the data; retry on next change */
      }
    },
    [base]
  );

  useEffect(() => {
    if (!hydratedRef.current) return; // don't push before initial pull settles
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      push(snapshot);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [snapshot, push]);
}
