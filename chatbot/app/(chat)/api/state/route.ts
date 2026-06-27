import { auth } from "@/app/(auth)/auth";
import { getJsonFromR2, isR2Configured, putJsonToR2 } from "@/lib/storage/r2";

/**
 * Per-user roleplay state sync — cross-device persistence via Cloudflare R2.
 *
 * The DIVINE roleplay layer (characters, gallery, lore books/entries, story
 * nodes) historically lived only in each browser's localStorage, so nothing
 * synced across devices and clearing a browser lost everything. This endpoint
 * stores the whole roleplay state as a single JSON document in R2, keyed by the
 * authenticated user, so it follows the user everywhere and is never lost.
 *
 *   GET  /api/state            -> { state, updatedAt } | { state: null }
 *   POST /api/state  { state, updatedAt }  -> { ok, updatedAt }
 *
 * Concurrency: last-write-wins guarded by `updatedAt`. A POST whose client
 * `updatedAt` is OLDER than what's already stored is rejected (409) so a stale
 * tab can't clobber newer data; the client then re-pulls and merges.
 */

export interface SyncedState {
  characters?: unknown[];
  galleryItems?: unknown[];
  loreBooks?: unknown[];
  loreEntries?: unknown[];
  storyNodes?: unknown[];
  // Free-form bucket for anything else the client wants to persist so we
  // "never lose anything" without needing a schema change per field.
  extra?: Record<string, unknown>;
}

interface StoredDoc {
  state: SyncedState;
  updatedAt: number;
}

function keyForUser(userId: string): string {
  return `state/users/${userId}/roleplay.json`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    // No durable store configured — tell the client to stay local-only.
    return Response.json({ state: null, updatedAt: 0, durable: false });
  }

  try {
    const doc = await getJsonFromR2<StoredDoc>(keyForUser(session.user.id));
    if (!doc) {
      return Response.json({ state: null, updatedAt: 0, durable: true });
    }
    return Response.json({
      state: doc.state,
      updatedAt: doc.updatedAt ?? 0,
      durable: true,
    });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "failed to load state",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return Response.json({ error: "storage not configured" }, { status: 503 });
  }

  let body: { state?: SyncedState; updatedAt?: number; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.state || typeof body.state !== "object") {
    return Response.json({ error: "state required" }, { status: 400 });
  }

  const key = keyForUser(session.user.id);
  const incomingUpdatedAt = Number(body.updatedAt) || Date.now();

  try {
    // Stale-write guard: don't let an older snapshot overwrite a newer one.
    if (!body.force) {
      const existing = await getJsonFromR2<StoredDoc>(key);
      if (existing && (existing.updatedAt ?? 0) > incomingUpdatedAt) {
        return Response.json(
          {
            error: "stale",
            serverUpdatedAt: existing.updatedAt,
            state: existing.state,
          },
          { status: 409 }
        );
      }
    }

    const doc: StoredDoc = {
      state: body.state,
      updatedAt: incomingUpdatedAt,
    };
    await putJsonToR2(key, doc);
    return Response.json({ ok: true, updatedAt: incomingUpdatedAt });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "failed to save state",
      },
      { status: 500 }
    );
  }
}
