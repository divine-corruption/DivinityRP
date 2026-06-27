import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const ext = file.name.split(".").pop() ?? "png";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = join(process.cwd(), "public", "uploads", filename);

    await writeFile(filepath, Buffer.from(bytes));

    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    const host = request.headers.get("host") ?? "localhost:3000";
    const url = `${protocol}://${host}/uploads/${filename}`;

    return NextResponse.json({ url, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
