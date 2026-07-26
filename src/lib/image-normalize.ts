// Normalizes a product image (bottle) onto a white background,
// automatically cropping the subject and scaling it so it occupies
// ~2/3 of the canvas. Output: PNG Blob at a fixed size.
//
// Heuristic background removal: pixels similar to the dominant
// corner colors are treated as background and turned pure white.
// Then the bounding box of non-background pixels is used to
// crop/scale the subject.

export const NORMALIZED_WIDTH = 800;
export const NORMALIZED_HEIGHT = 1000;
export const SUBJECT_FILL = 2 / 3;

async function loadFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

async function loadFromUrl(url: string): Promise<HTMLImageElement> {
  // Try direct fetch first (respects CORS). Fallback: server proxy.
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    try {
      return await loadImage(obj);
    } finally {
      setTimeout(() => URL.revokeObjectURL(obj), 5000);
    }
  } catch {
    const proxied = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxied);
    if (!res.ok) throw new Error("Falha ao baixar imagem da URL informada.");
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    try {
      return await loadImage(obj);
    } finally {
      setTimeout(() => URL.revokeObjectURL(obj), 5000);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = src;
  });
}

type RGB = { r: number; g: number; b: number };

function sampleCorners(data: Uint8ClampedArray, w: number, h: number): RGB {
  const pts: [number, number][] = [];
  const pad = 3;
  const size = 8;
  for (const [cx, cy] of [
    [pad, pad],
    [w - pad - size, pad],
    [pad, h - pad - size],
    [w - pad - size, h - pad - size],
  ] as [number, number][]) {
    for (let y = cy; y < cy + size; y++) {
      for (let x = cx; x < cx + size; x++) {
        pts.push([x, y]);
      }
    }
  }
  let r = 0, g = 0, b = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  const n = pts.length;
  return { r: r / n, g: g / n, b: b / n };
}

function isBackground(r: number, g: number, b: number, ref: RGB, tol: number): boolean {
  // Near ref color OR near-white.
  const dr = r - ref.r, dg = g - ref.g, db = b - ref.b;
  const distRef = Math.sqrt(dr * dr + dg * dg + db * db);
  const distWhite = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
  return distRef < tol || distWhite < 28;
}

export async function normalizeProductImage(source: File | string): Promise<Blob> {
  const img = typeof source === "string" ? await loadFromUrl(source) : await loadFromFile(source);

  // Draw into a working canvas at source size (cap for perf).
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * scale));
  const sh = Math.max(1, Math.round(img.naturalHeight * scale));
  const work = document.createElement("canvas");
  work.width = sw;
  work.height = sh;
  const wctx = work.getContext("2d", { willReadFrequently: true })!;
  wctx.drawImage(img, 0, 0, sw, sh);

  let imgData: ImageData;
  try {
    imgData = wctx.getImageData(0, 0, sw, sh);
  } catch {
    // Tainted canvas — fall back to fitting original without bg cleanup.
    return await composeOnWhite(img, null);
  }

  const { data } = imgData;
  const ref = sampleCorners(data, sw, sh);
  const tol = 38; // color distance tolerance

  // Whiten background & compute bounding box.
  let minX = sw, minY = sh, maxX = -1, maxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (isBackground(r, g, b, ref, tol)) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
      } else {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  wctx.putImageData(imgData, 0, 0);

  if (maxX < 0 || maxY < 0) {
    // Nothing detected — fit whole image
    return composeOnWhite(work, null);
  }

  // Add a small margin around detected subject
  const margin = Math.round(Math.min(sw, sh) * 0.02);
  const bx = Math.max(0, minX - margin);
  const by = Math.max(0, minY - margin);
  const bw = Math.min(sw - bx, maxX - minX + 1 + margin * 2);
  const bh = Math.min(sh - by, maxY - minY + 1 + margin * 2);

  return composeOnWhite(work, { x: bx, y: by, w: bw, h: bh });
}

async function composeOnWhite(
  src: CanvasImageSource,
  crop: { x: number; y: number; w: number; h: number } | null,
): Promise<Blob> {
  const out = document.createElement("canvas");
  out.width = NORMALIZED_WIDTH;
  out.height = NORMALIZED_HEIGHT;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingQuality = "high";

  let srcW: number, srcH: number, sx: number, sy: number;
  if (crop) {
    sx = crop.x; sy = crop.y; srcW = crop.w; srcH = crop.h;
  } else {
    sx = 0; sy = 0;
    srcW = (src as HTMLCanvasElement).width || (src as HTMLImageElement).naturalWidth;
    srcH = (src as HTMLCanvasElement).height || (src as HTMLImageElement).naturalHeight;
  }

  // Fit subject so its LARGER dimension = 2/3 of canvas (bottle occupies ~2/3).
  const target = Math.min(NORMALIZED_WIDTH, NORMALIZED_HEIGHT) * SUBJECT_FILL;
  const targetLong = Math.max(NORMALIZED_WIDTH, NORMALIZED_HEIGHT) * SUBJECT_FILL;
  const srcLong = Math.max(srcW, srcH);
  const srcShort = Math.min(srcW, srcH);
  // Scale by the long side to the long target, but ensure short side doesn't exceed 'target'.
  let s = targetLong / srcLong;
  if (srcShort * s > target) s = target / srcShort;
  const dw = srcW * s;
  const dh = srcH * s;
  const dx = (NORMALIZED_WIDTH - dw) / 2;
  const dy = (NORMALIZED_HEIGHT - dh) / 2;

  ctx.drawImage(src, sx, sy, srcW, srcH, dx, dy, dw, dh);

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem."))),
      "image/png",
      0.92,
    );
  });
}
