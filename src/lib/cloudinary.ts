import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const CLOUDINARY_FOLDERS = [
  "branded",
  "venues",
  "custom-scenes",
  "furniture",
] as const;

export type CloudinaryFolder = (typeof CLOUDINARY_FOLDERS)[number];

export function isDataUrl(value: string | undefined | null): boolean {
  return typeof value === "string" && value.startsWith("data:");
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export async function uploadToCloudinary(
  base64: string,
  folder: CloudinaryFolder
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured");
  }

  const result = await cloudinary.uploader.upload(base64, {
    folder: `eventvista/${folder}`,
    resource_type: "image",
    format: "webp",
    quality: "auto:good",
  });
  return result.secure_url;
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: CloudinaryFolder,
  mimeType: string
): Promise<string> {
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;
  return uploadToCloudinary(dataUri, folder);
}

export async function ensureCloudinaryUrl(
  value: string | undefined,
  folder: CloudinaryFolder
): Promise<string | undefined> {
  if (!value) return value;
  if (!isDataUrl(value)) return value;
  return uploadToCloudinary(value, folder);
}

export async function migrateFurnitureViews(
  views: Record<string, string | undefined>
): Promise<Record<string, string | undefined>> {
  const keys = ["front", "back", "left", "right"] as const;
  const migrated: Record<string, string | undefined> = { ...views };
  for (const key of keys) {
    const src = views[key];
    if (src && isDataUrl(src)) {
      migrated[key] = await uploadToCloudinary(src, "furniture");
    }
  }
  return migrated;
}

export async function migrateCustomScenes<
  T extends { src: string; name: string; width?: number; height?: number },
>(scenes: T[]): Promise<T[]> {
  return Promise.all(
    scenes.map(async (scene) => ({
      ...scene,
      src: (await ensureCloudinaryUrl(scene.src, "custom-scenes")) ?? scene.src,
    }))
  );
}

export async function migratePlacedItemsData(
  data: Record<string, Array<{ brandedSrc?: string } & Record<string, unknown>>>
): Promise<Record<string, Array<{ brandedSrc?: string } & Record<string, unknown>>>> {
  const migrated: typeof data = {};
  for (const [sceneKey, items] of Object.entries(data)) {
    migrated[sceneKey] = await Promise.all(
      items.map(async (item) => {
        if (item.brandedSrc && isDataUrl(item.brandedSrc)) {
          return {
            ...item,
            brandedSrc: await uploadToCloudinary(item.brandedSrc, "branded"),
          };
        }
        return item;
      })
    );
  }
  return migrated;
}

export async function deleteFromCloudinary(url: string) {
  const uploadMarker = "/upload/";
  const idx = url.indexOf(uploadMarker);
  if (idx < 0) return;

  let publicId = url.slice(idx + uploadMarker.length);
  publicId = publicId.replace(/^v\d+\//, "");
  publicId = publicId.replace(/\.[^/.]+$/, "");

  await cloudinary.uploader.destroy(publicId);
}
