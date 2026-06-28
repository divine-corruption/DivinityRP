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
 *   3. On `beforeunload` and on `visibilitychange` (tab hidden) it does a
 *      synchronous best-effort flush so closing the tab never loses a pending
 *      debounced push.
 *   4. A 5-minute heartbeat re-pushes whenever a previous push was skipped
 *      (e.g. offline at write time, tab in background, debounce not yet fired).
 *   5. The `extra` bucket captures every additional localStorage key the app
 *      cares about (settings, threads, arcs, active-character, custom prompt,
 *      etc.) so they survive a browser-clear just like the main collections do.
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
/** Re-push every 5 minutes to recover from any missed/failed push. */
const HEARTBEAT_MS = 5 * 60 * 1000;
const LOCAL_UPDATED_AT_KEY = "divine_state_updated_at";

/**
 * All extra localStorage keys we want to capture in the `extra` bucket.
 * Adding a key here is sufficient to make it durable — no other change needed.
 */
const EXTRA_LOCALSTORAGE_KEYS = [
  // Settings panel
  "divine_custom_prompt",
  "divine_rp_settings",
  // Thread registry + active pointers
  "divine_conversation_threads",
  "divine_active_thread",
  "divine_active_character",
  // Per-chat arc selections (captured as a single JSON map, see buildExtra)
  "__divine_arcs__",
  // Imagine API key
  "imagine_api_key",
] as const;

/** Prefix used for per-chat arc keys (divine_chat_arc:<chatId>). */
const ARC_PREFIX = "divine_chat_arc:";
/** Prefix used for last-thread pointers (divine_last_thread:<characterId>). */
const LAST_THREAD_PREFIX = "divine_last_thread:";

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

/**
 * Build the `extra` map from localStorage, capturing all per-chat arc keys and
 * per-character last-thread pointers in addition to the static list above.
 */
function buildExtra(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const extra: Record<string, unknown> = {};

  // Static keys
  for (const key of EXTRA_LOCALSTORAGE_KEYS) {
    if (key === "__divine_arcs__") continue; // handled dynamically below
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        extra[key] = JSON.parse(raw);
      } catch {
        extra[key] = raw;
      }
    }
  }

  // Dynamic: collect all divine_chat_arc:<id> keys into one map
  const arcs: Record<string, unknown> = {};
  const lastThreads: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(ARC_PREFIX)) {
      const raw = localStorage.getItem(k);
      if (raw !== null) {
        try {
          arcs[k.slice(ARC_PREFIX.length)] = JSON.parse(raw);
        } catch {
          arcs[k.slice(ARC_PREFIX.length)] = raw;
        }
      }
    } else if (k.startsWith(LAST_THREAD_PREFIX)) {
      const raw = localStorage.getItem(k);
      if (raw !== null) lastThreads[k.slice(LAST_THREAD_PREFIX.length)] = raw;
    }
  }
  if (Object.keys(arcs).length > 0) extra.__divine_arcs__ = arcs;
  if (Object.keys(lastThreads).length > 0)
    extra.__divine_last_threads__ = lastThreads;

  return extra;
}

/**
 * Restore extra keys back into localStorage after a remote pull.
 * Skips keys that are already set locally so we never overwrite a newer local
 * value with a stale remote one.
 */
export function restoreExtra(
  extra: Record<string, unknown> | undefined,
  force = false
): void {
  if (!extra || typeof window === "undefined") return;

  for (const key of EXTRA_LOCALSTORAGE_KEYS) {
    if (key === "__divine_arcs__") continue;
    if (!force && localStorage.getItem(key) !== null) continue;
    const val = extra[key];
    if (val !== undefined) {
      try {
        localStorage.setItem(
          key,
          typeof val === "string" ? val : JSON.stringify(val)
        );
      } catch {
        /* storage full */
      }
    }
  }

  // Restore per-chat arcs
  const arcs = extra.__divine_arcs__ as Record<string, unknown> | undefined;
  if (arcs) {
    for (const [chatId, arc] of Object.entries(arcs)) {
      const lsKey = `${ARC_PREFIX}${chatId}`;
      if (!force && localStorage.getItem(lsKey) !== null) continue;
      try {
        localStorage.setItem(
          lsKey,
          typeof arc === "string" ? arc : JSON.stringify(arc)
        );
      } catch {
        /* storage full */
      }
    }
  }

  // Restore per-character last-thread pointers
  const lastThreads = extra.__divine_last_threads__ as
    | Record<string, unknown>
    | undefined;
  if (lastThreads) {
    for (const [charId, threadId] of Object.entries(lastThreads)) {
      const lsKey = `${LAST_THREAD_PREFIX}${charId}`;
      if (!force && localStorage.getItem(lsKey) !== null) continue;
      try {
        localStorage.setItem(lsKey, String(threadId));
      } catch {
        /* storage full */
      }
    }
  }
}

export function useStateSync(
  snapshot: RoleplaySnapshot,
  onRemoteState: (state: RoleplaySnapshot) => void
) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const hydratedRef = useRef(false);
  const lastSerializedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPushRef = useRef(false);
  const onRemoteRef = useRef(onRemoteState);
  onRemoteRef.current = onRemoteState;
  // Keep a live ref to the latest snapshot so beforeunload can read it
  // without stale-closure issues.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // ---- Push helper -----------------------------------------------------------
  const push = useCallback(
    async (payload: RoleplaySnapshot, isSync = false): Promise<boolean> => {
      const updatedAt = Date.now();
      const extra = buildExtra();
      const fullPayload: RoleplaySnapshot = { ...payload, extra };
      try {
        const res = await fetch(`${base}/api/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: fullPayload, updatedAt }),
          // keepalive lets the browser complete the request even after the page
          // starts unloading (critical for the beforeunload flush).
          keepalive: isSync,
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
            restoreExtra(conflict.state.extra, false);
            writeLocalUpdatedAt(conflict.serverUpdatedAt ?? updatedAt);
            lastSerializedRef.current = JSON.stringify(conflict.state);
          }
          return true;
        }
        if (res.ok) {
          writeLocalUpdatedAt(updatedAt);
          pendingPushRef.current = false;
          return true;
        }
        pendingPushRef.current = true;
        return false;
      } catch {
        /* offline — localStorage already holds the data; retry via heartbeat */
        pendingPushRef.current = true;
        return false;
      }
    },
    [base]
  );

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
          // Restore extra localStorage keys from the server snapshot, but only
          // for keys not already set locally (local is newer for this device).
          restoreExtra(data.state.extra, false);
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

  // ---- Heartbeat: re-push every 5 min to recover missed/failed pushes -----
  useEffect(() => {
    heartbeatRef.current = setInterval(() => {
      if (!hydratedRef.current) return;
      // Push if there's a known pending push OR simply as a safety net.
      // Compare current snapshot to last confirmed push.
      const serialized = JSON.stringify(snapshotRef.current);
      if (
        pendingPushRef.current ||
        serialized !== lastSerializedRef.current
      ) {
        push(snapshotRef.current);
      }
    }, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [push]);

  // ---- Flush on tab-hide (visibilitychange) & page-close (beforeunload) ---
  useEffect(() => {
    const flush = () => {
      if (!hydratedRef.current) return;
      const serialized = JSON.stringify(snapshotRef.current);
      if (serialized === lastSerializedRef.current) return;
      // Cancel the pending debounce — we're flushing right now.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Use keepalive so the browser can complete this request post-unload.
      push(snapshotRef.current, true);
      lastSerializedRef.current = serialized;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [push]);
}
