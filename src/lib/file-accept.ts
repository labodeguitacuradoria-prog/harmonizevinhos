// Windows' native "Abrir" dialog can hang on cloud-synced folders (OneDrive/Drive)
// when the browser passes MIME filters such as "application/pdf" or "image/*".
// File pickers must always receive literal extensions.

const MIME_TO_EXT: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/*": [".png", ".jpg", ".jpeg", ".webp"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/avif": [".avif"],
  "image/svg+xml": [".svg"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "video/*": [".mp4", ".webm", ".mov"],
  "video/mp4": [".mp4"],
  "audio/*": [".mp3", ".wav", ".m4a"],
};

/** Converts any accept string into extension-only tokens (deduplicated). */
export function extensionAccept(accept: string): string {
  const out: string[] = [];
  for (const raw of accept.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    const mapped = token.startsWith(".") ? [token] : MIME_TO_EXT[token] ?? [];
    for (const ext of mapped) if (!out.includes(ext)) out.push(ext);
  }
  return out.join(",");
}

export const ACCEPT = {
  pdf: ".pdf",
  images: ".png,.jpg,.jpeg,.webp",
  pdfOrImage: ".pdf,.png,.jpg,.jpeg,.webp",
  techSheet: ".pdf,.png,.jpg,.jpeg,.webp,.gif,.avif",
  sales: ".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt",
  stock: ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.ods",
  menuBrief: ".pdf,.png,.jpg,.jpeg,.webp,.svg,.doc,.docx,.ai,.zip",
} as const;
