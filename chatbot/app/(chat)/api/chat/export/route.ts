import { auth } from "@/app/(auth)/auth";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { isR2Configured, uploadToR2 } from "@/lib/storage/r2";
import { convertToUIMessages } from "@/lib/utils";

/**
 * Export a conversation (chat metadata + messages) as a JSON snapshot to
 * Cloudflare R2 and return the servable URL. History itself stays in Postgres;
 * this just produces a durable, shareable archive of a single conversation.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await request.json().catch(() => ({ chatId: null }));
  if (!chatId) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }
  if (chat.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isR2Configured()) {
    return Response.json(
      { error: "R2 storage is not configured" },
      { status: 500 }
    );
  }

  const messages = await getMessagesByChatId({ id: chatId });

  const snapshot = {
    exportedAt: new Date().toISOString(),
    chat: {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      visibility: chat.visibility,
    },
    messages: convertToUIMessages(messages),
  };

  const key = `exports/${session.user.id}/${chatId}-${Date.now()}.json`;
  const body = Buffer.from(JSON.stringify(snapshot, null, 2), "utf-8");

  try {
    const { url } = await uploadToR2(key, body, "application/json");
    return Response.json({ url, key });
  } catch (error) {
    console.error("Chat export error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export chat",
      },
      { status: 500 }
    );
  }
}
