import { z } from "zod";

export const WINE_FILE_MAX_BYTES = 15 * 1024 * 1024;

// Only object keys are accepted: never fetch a client-supplied URL on the server.
export const WineFileInput = z.object({
  storagePath: z.string().max(240).regex(/^catalog\/tech\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|png|jpg|webp|gif|avif)$/),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]),
});

export function wineFileType(file: { name: string; type: string }) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    webp: "image/webp", gif: "image/gif", avif: "image/avif",
  };
  const mimeType = types[extension ?? ""] ?? file.type;
  const supported = WineFileInput.shape.mimeType.safeParse(mimeType);
  if (!supported.success) throw new Error("Envie uma ficha em PDF, PNG, JPG, WebP, GIF ou AVIF.");
  return { mimeType: supported.data, extension: supported.data === "image/jpeg" ? "jpg" : supported.data.split("/")[1] };
}