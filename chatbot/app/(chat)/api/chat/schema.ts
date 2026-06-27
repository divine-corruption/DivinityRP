import { z } from "zod";

// Roleplay turns are long-form prose. The previous 2000-char cap rejected
// ordinary RP messages with a 400, which then cascaded into a 500 when the
// client later tried to edit/regenerate a turn that was never saved. Allow a
// generous ceiling that still guards against abuse.
const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(50000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const userMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.record(z.unknown())),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
  customPrompt: z.string().max(8000).optional(),
  characterData: z.string().max(100000).optional(),
  loreData: z.string().max(100000).optional(),
  memoryData: z.string().max(20000).optional(),
  globalSystemPrompt: z.string().max(8000).optional(),
  arcData: z.string().max(20000).optional(),
  regenInstruction: z.string().max(4000).optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
