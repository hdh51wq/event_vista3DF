import type { CloudinaryFolder } from "@/lib/cloudinary";

export async function uploadImage(
  input: string | File,
  folder: CloudinaryFolder,
  token: string
): Promise<string> {
  if (typeof input === "string") {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64: input, folder }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url as string;
  }

  const formData = new FormData();
  formData.append("file", input);
  formData.append("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}
