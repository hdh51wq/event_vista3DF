import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import User from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import crypto from "crypto";

export const runtime = "nodejs";

function serialize3DItems(
  items: Array<{
    id?: string;
    label?: string;
    price?: number;
    glbPath?: string;
    createdAt?: Date;
  }> = []
) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    price: item.price ?? 0,
    glbPath: item.glbPath,
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      items: serialize3DItems(user.custom3DFurniture),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { label, price, glbPath } = body as {
      label?: string;
      price?: number;
      glbPath?: string;
    };

    if (!label?.trim()) {
      return NextResponse.json({ error: "Item label is required" }, { status: 400 });
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
    }
    if (!glbPath?.trim()) {
      return NextResponse.json({ error: "GLB path is required" }, { status: 400 });
    }

    const newItem = {
      id: `custom-3d-${crypto.randomUUID()}`,
      label: label.trim(),
      price,
      glbPath: glbPath.trim(),
      createdAt: new Date(),
    };

    user.custom3DFurniture = user.custom3DFurniture || [];
    user.custom3DFurniture.push(newItem);
    await user.save();

    const serialized = {
      ...newItem,
      createdAt: newItem.createdAt.toISOString(),
    };

    return NextResponse.json({
      message: "3D furniture saved successfully",
      item: serialized,
      items: serialize3DItems(user.custom3DFurniture),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        agencyName: user.agencyName,
        phone: user.phone,
        address: user.address,
        customFurniture: user.customFurniture,
        custom3DFurniture: serialize3DItems(user.custom3DFurniture),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const itemId =
      req.nextUrl.searchParams.get("id") ||
      ((await req.json().catch(() => ({}))) as { id?: string }).id;

    if (!itemId) {
      return NextResponse.json({ error: "Furniture id is required" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const furnitureItem = (user.custom3DFurniture || []).find(
      (item: { id?: string }) => item.id === itemId
    );
    if (!furnitureItem) {
      return NextResponse.json({ error: "3D furniture item not found" }, { status: 404 });
    }

    if (furnitureItem.glbPath?.includes("cloudinary.com")) {
      try {
        await deleteFromCloudinary(furnitureItem.glbPath, "raw");
      } catch {
        /* continue even if cloud delete fails */
      }
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { custom3DFurniture: { id: furnitureItem.id } },
    });

    const updatedUser = await User.findById(userId);

    return NextResponse.json({
      success: true,
      items: serialize3DItems(updatedUser?.custom3DFurniture),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
