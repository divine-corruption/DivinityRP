import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

const STORE = new Map<string, Record<string, unknown>>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const char = STORE.get(id);
    if (!char) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(char);
  }

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const search = searchParams.get("search")?.toLowerCase();

  let entries: Array<Record<string, unknown>> = Array.from(STORE.entries()).map(([k, v]) => ({ id: k, ...v }));

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
    const entry = {
      ...body,
      id,
      publishedAt: Date.now(),
    };
    STORE.set(id, entry);
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
  STORE.delete(id);
  return NextResponse.json({ success: true });
}
