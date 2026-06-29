import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { getJsonFromR2, isR2Configured, putJsonToR2 } from "@/lib/storage/r2";

/**
 * Character repository ("published" community characters).
 *
 * Previously this used an in-memory `Map`, which silently lost every published
 * character on each serverless cold start and never shared data across
 * instances. It now persists to Cloudflare R2 as a single index document, so
 * published characters survive restarts and are visible across all instances.
 *
 * Storage layout:
 *   repository/index.json  ->  { characters: RepoCharacter[] }
 *
 * When R2 is not configured we fall back to a per-instance in-memory map AND
 * warn, so local dev still works but operators know it isn't durable.
 */

interface RepoCharacter extends Record<string, unknown> {
  id: string;
  name?: string;
  tags?: string[];
  publishedAt: number;
}

const INDEX_KEY = "repository/index.json";

// Per-instance fallback only used when R2 is unconfigured (non-durable).
const MEMORY_FALLBACK = new Map<string, RepoCharacter>();
let warnedNoR2 = false;

function warnOnce() {
  if (!warnedNoR2 && process.env.NODE_ENV !== "test") {
    warnedNoR2 = true;
    console.warn(
      "[DivinityRP] /api/repository: R2 not configured — published characters are stored in-memory only and will NOT survive a restart or sync across instances. Set R2_* env vars (or MEDIA/STATE workers) for durable persistence."
    );
  }
}

async function loadAll(): Promise<RepoCharacter[]> {
  if (isR2Configured()) {
    const doc = await getJsonFromR2<{ characters: RepoCharacter[] }>(INDEX_KEY);
    return doc?.characters ?? [];
  }
  warnOnce();
  return Array.from(MEMORY_FALLBACK.values());
}

async function saveAll(characters: RepoCharacter[]): Promise<void> {
  if (isR2Configured()) {
    await putJsonToR2(INDEX_KEY, { characters });
    return;
  }
  warnOnce();
  MEMORY_FALLBACK.clear();
  for (const c of characters) MEMORY_FALLBACK.set(c.id, c);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const all = await loadAll();

  if (id) {
    const char = all.find((c) => c.id === id);
    if (!char) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json(char);
  }

  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const search = searchParams.get("search")?.toLowerCase();

  let entries = all;
  if (search) {
    entries = entries.filter((e) => {
      const name = e.name as string | undefined;
      const tags = e.tags as string[] | undefined;
      return (
        name?.toLowerCase().includes(search) ||
        tags?.some((t) => t.toLowerCase().includes(search))
      );
    });
  }

  // Newest first.
  entries = [...entries].sort((a, b) => b.publishedAt - a.publishedAt);

  const total = entries.length;
  const paginated = entries.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    characters: paginated,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = nanoid(12);
    const entry: RepoCharacter = {
      ...body,
      id,
      publishedAt: Date.now(),
    };
    const all = await loadAll();
    all.push(entry);
    await saveAll(all);
    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to publish character" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const all = await loadAll();
  const next = all.filter((c) => c.id !== id);
  await saveAll(next);
  return NextResponse.json({ success: true });
}
