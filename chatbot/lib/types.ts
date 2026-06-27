import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { imagineImage } from "./ai/tools/imagine-image";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type imagineImageTool = InferUITool<typeof imagineImage>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  imagineImage: imagineImageTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

// Roleplay Engine Types

export interface CharacterImage {
  url: string;
  caption?: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;
  avatar?: string;
  images: CharacterImage[];
  tags: string[];
  metadata: Record<string, unknown>;
  importedAt: number;
  source?: "chub" | "sillytavern" | "manual";
}

export interface LoreBook {
  id: string;
  name: string;
  description: string;
  characterId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LoreEntry {
  id: string;
  title: string;
  content: string;
  keys: string[];
  characterId?: string;
  lorebookId?: string;
  approved: boolean;
  source?: "manual" | "divinity" | "detection";
  createdAt: number;
  updatedAt: number;
}

export interface LoreSuggestion {
  id: string;
  title: string;
  content: string;
  keys: string[];
  characterId?: string;
  lorebookId?: string;
  reasoning: string;
  createdAt: number;
}

export interface DivinityAIState {
  open: boolean;
  messages: { role: "user" | "assistant"; content: string }[];
  suggestions: LoreSuggestion[];
  loading: boolean;
  selectedLorebookId: string | null;
}

export interface LoreDetection {
  active: boolean;
  suggestion: LoreSuggestion | null;
  chatId: string;
  messageId: string;
}

export interface StoryNode {
  id: string;
  characterId: string;
  title: string;
  summary: string;
  /** Scenario/opening text applied when this arc is chosen. Overrides the character scenario. */
  scenario?: string;
  /** Optional alternate opening message for this arc. */
  firstMes?: string;
  /** Optional cover art for the arc card. */
  cover?: string;
  /** Narrative tone, e.g. "Romance", "Mystery", "Dark". */
  tone?: string;
  /** Marks built-in/suggested arcs vs. user-saved checkpoints. */
  kind?: "arc" | "checkpoint";
  chatId: string;
  createdAt: number;
}

export type MediaType = "image" | "video";

export interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  caption?: string;
  /** Origin of the media so the gallery can group/filter it. */
  source: "character" | "generated" | "uploaded" | "forge";
  characterId?: string;
  createdAt: number;
}

export type SidebarView =
  | "dashboard"
  | "characters"
  | "loreuniverse"
  | "divinecorruption"
  | "settings";
