import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import User from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";
import { deleteFromCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: furnitureItemId } = await params;
    if (!furnitureItemId) {
      return NextResponse.json({ error: "Furniture id is required" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const furnitureItem = (user.customFurniture || []).find(
      (item: { id?: string; _id?: unknown; views?: Record<string, string | undefined> }) =>
        item.id === furnitureItemId || String(item._id) === furnitureItemId
    );
    if (!furnitureItem) {
      return NextResponse.json({ error: "Furniture item not found" }, { status: 404 });
    }

    const viewKeys = ["front", "back", "left", "right"] as const;
    for (const key of viewKeys) {
      const url = furnitureItem.views?.[key];
      if (url && url.includes("cloudinary.com")) {
        try {
          await deleteFromCloudinary(url);
        } catch {
          /* continue even if cloud delete fails */
        }
      }
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { customFurniture: { id: furnitureItem.id } },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
