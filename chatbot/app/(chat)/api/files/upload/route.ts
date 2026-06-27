import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { isR2Configured, uploadToR2 } from "@/lib/storage/r2";

// Allowed upload types: still covers chat image attachments (JPEG/PNG) and now
// extends to the wider set the media Gallery accepts (more image formats +
// video). Videos are larger, so the cap is raised accordingly.
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB to accommodate short video clips

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_BYTES, {
      message: "File size should be less than 50MB",
    })
    .refine((file) => ALLOWED_TYPES.includes(file.type), {
      message: "File type should be an image (JPEG/PNG/WebP/GIF) or video (MP4/WebM/OGG/MOV)",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();
    const contentType = (file as File).type || undefined;

    try {
      // Preferred: Cloudflare R2.
      if (isR2Configured()) {
        const key = `chat/${randomUUID()}-${safeName}`;
        const { url } = await uploadToR2(key, fileBuffer, contentType);
        return NextResponse.json({
          url,
          pathname: key,
          contentType: contentType ?? "application/octet-stream",
        });
      }

      // Fallback: Vercel Blob.
      const data = await put(`${safeName}`, fileBuffer, {
        access: "public",
      });

      return NextResponse.json(data);
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
