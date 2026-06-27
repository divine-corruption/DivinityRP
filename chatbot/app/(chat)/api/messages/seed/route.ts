import { auth } from "@/app/(auth)/auth";
import {
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";

/**
 * Seed a conversation thread with its opening assistant message and persist it
 * server-side so the history loads on resume.
 *
 * This is what makes "begin a new story arc" behave like creating a new
 * conversation: the arc thread gets a real DB-backed chat row and its opening
 * line is stored, instead of being a transient in-memory message that vanished
 * on reload.
 *
 * Idempotent: if the chat already has messages we do nothing, so re-opening an
 * arc never duplicates the opener.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    chatId?: string;
    title?: string;
    message?: { id?: string; text?: string };
    visibility?: "private" | "public";
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const chatId = body.chatId;
  const text = body.message?.text?.trim();
  if (!chatId) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  // Ensure the chat row exists (and belongs to this user).
  const existing = await getChatById({ id: chatId });
  if (existing) {
    if (existing.userId !== session.user.id) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    await saveChat({
      id: chatId,
      userId: session.user.id,
      title: body.title?.slice(0, 120) || "New roleplay",
      visibility: body.visibility ?? "private",
    });
  }

  // Only seed the opening message if the thread is empty.
  if (text) {
    const current = await getMessagesByChatId({ id: chatId });
    if (current.length === 0) {
      await saveMessages({
        messages: [
          {
            id: body.message?.id ?? crypto.randomUUID(),
            chatId,
            role: "assistant",
            parts: [{ type: "text", text }],
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }
  }

  return Response.json({ ok: true, chatId });
}
