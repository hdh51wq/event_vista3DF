import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  CLOUDINARY_FOLDERS,
  type CloudinaryFolder,
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
  uploadToCloudinary,
} from "@/lib/cloudinary";

export const runtime = "nodejs";

function isValidFolder(folder: string): folder is CloudinaryFolder {
  return (CLOUDINARY_FOLDERS as readonly string[]).includes(folder);
}

export async function POST(req: NextRequest) {
  console.log("=== UPLOAD API CALLED ===");
  console.log("ENV CHECK:", {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY ? "SET ✅" : "MISSING ❌",
    apiSecret: process.env.CLOUDINARY_API_SECRET ? "SET ✅" : "MISSING ❌",
  });

  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Cloudinary is not configured on the server" },
        { status: 503 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const folder = String(formData.get("folder") || "");

      if (!file || file.size === 0) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      if (!isValidFolder(folder)) {
        return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
      }

      console.log("Attempting upload to folder:", folder);
      console.log("File size:", file.size);

      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadBufferToCloudinary(
        buffer,
        folder,
        file.type || "application/octet-stream"
      );
      console.log("Upload success:", url);
      return NextResponse.json({ url });
    }

    const body = await req.json();
    const { base64, folder } = body as { base64?: string; folder?: string };

    if (!base64 || typeof base64 !== "string") {
      return NextResponse.json({ error: "base64 is required" }, { status: 400 });
    }
    if (!folder || !isValidFolder(folder)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }

    console.log("Attempting upload to folder:", folder);
    console.log("Base64 length:", base64?.length);

    const url = await uploadToCloudinary(base64, folder);
    console.log("Upload success:", url);
    return NextResponse.json({ url });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log("Upload FAILED:", err?.message, error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
