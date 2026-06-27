import { tool } from "ai";
import { z } from "zod";

export const imagineImage = tool({
  description:
    "Generate an image using the Imagine API. Use this when the user wants to visualize a scene, character, or concept.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe(
        "Detailed description of the image to generate. Be specific about style, lighting, and composition."
      ),
    negative_prompt: z
      .string()
      .optional()
      .describe("What to avoid in the image"),
    aspect_ratio: z
      .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
      .optional()
      .default("1:1")
      .describe("Aspect ratio of the generated image"),
    style: z
      .enum(["realistic", "anime", "fantasy", "cinematic", "pixel-art"])
      .optional()
      .default("realistic")
      .describe("Art style for the image"),
  }),
  execute: async ({ prompt, negative_prompt, aspect_ratio, style }) => {
    const apiKey =
      process.env.XAI_API_KEY ||
      process.env.IMAGINE_API_KEY ||
      (typeof window !== "undefined"
        ? localStorage.getItem("imagine_api_key")
        : null);

    if (!apiKey) {
      return {
        error:
          "No image provider configured. Set XAI_API_KEY (Grok Imagine) or IMAGINE_API_KEY.",
      };
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagine`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            negative_prompt,
            aspect_ratio,
            style,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        return { error: err.error ?? "Failed to generate image" };
      }

      const data = await response.json();
      return {
        url: data.url ?? data.data?.[0]?.url,
        prompt,
        success: true,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error generating image",
      };
    }
  },
});
