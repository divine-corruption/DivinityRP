import { customProvider } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";
import { xaiChat } from "../xai";

const XAI_API_KEY = process.env.XAI_API_KEY ?? "";

const xaiProvider = createOpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: XAI_API_KEY,
  name: "xai",
});

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

function extractModelId(modelId: string): string {
  const parts = modelId.split("/");
  return parts[parts.length - 1];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asAny(x: any): any {
  return x;
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }
  return asAny(xaiProvider.chat(extractModelId(modelId)));
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return asAny(xaiProvider.chat(extractModelId(titleModel.id)));
}

export { xaiChat };
