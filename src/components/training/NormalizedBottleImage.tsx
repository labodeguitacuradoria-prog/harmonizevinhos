import { useEffect, useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

const SAMPLE_SIZE = 420;
const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1800;
const normalizedCache = new Map<string, string>();
const normalizationJobs = new Map<string, Promise<string>>();

function analyzeEdge(data: Uint8ClampedArray, width: number, height: number) {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  let transparent = 0;
  let sampled = 0;
  const add = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    sampled += 1;
    if (data[index + 3] < 24) {
      transparent += 1;
      return;
    }
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const key = `${Math.round(r / 24)},${Math.round(g / 24)},${Math.round(b / 24)}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  };

  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
  for (let x = 0; x < width; x += step) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    add(0, y);
    add(width - 1, y);
  }

  if (transparent > sampled * 0.55) return { transparent: true as const };
  const winner = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!winner) return { transparent: true as const };
  return {
    transparent: false as const,
    r: winner.r / winner.count,
    g: winner.g / winner.count,
    b: winner.b / winner.count,
  };
}

function normalizeImage(image: HTMLImageElement) {
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height).data;
  const edge = analyzeEdge(pixels, width, height);

  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  let foregroundPixels = 0;
  const colorTolerance = 42 * 42;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];
      if (alpha < 24) continue;
      if (!edge.transparent) {
        const dr = pixels[index] - edge.r;
        const dg = pixels[index + 1] - edge.g;
        const db = pixels[index + 2] - edge.b;
        if (dr * dr + dg * dg + db * db <= colorTolerance) continue;
      }
      foregroundPixels += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top || foregroundPixels < width * height * 0.002) return null;

  const contentWidth = right - left + 1;
  const contentHeight = bottom - top + 1;
  const marginX = Math.max(1, Math.round(contentWidth * 0.025));
  const marginY = Math.max(1, Math.round(contentHeight * 0.012));
  const sx = Math.max(0, left - marginX);
  const sy = Math.max(0, top - marginY);
  const sw = Math.min(width - sx, contentWidth + marginX * 2);
  const sh = Math.min(height - sy, contentHeight + marginY * 2);

  const output = document.createElement("canvas");
  output.width = OUTPUT_WIDTH;
  output.height = OUTPUT_HEIGHT;
  const outputContext = output.getContext("2d");
  if (!outputContext) return null;

  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const fitScale = Math.min((OUTPUT_WIDTH * 0.96) / sw, (OUTPUT_HEIGHT * 0.985) / sh);
  const drawWidth = sw * fitScale;
  const drawHeight = sh * fitScale;
  outputContext.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    (OUTPUT_WIDTH - drawWidth) / 2,
    (OUTPUT_HEIGHT - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return output.toDataURL("image/png");
}

function loadNormalizedImage(src: string): Promise<string> {
  const cached = normalizedCache.get(src);
  if (cached) return Promise.resolve(cached);
  const running = normalizationJobs.get(src);
  if (running) return running;

  const job = new Promise<string>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        resolve(normalizeImage(image) ?? src);
      } catch {
        resolve(src);
      }
    };
    image.onerror = () => resolve(src);
    image.src = src;
  }).then((result) => {
    normalizedCache.set(src, result);
    normalizationJobs.delete(src);
    return result;
  });

  normalizationJobs.set(src, job);
  return job;
}

export function preloadNormalizedImages(sources: Array<string | null | undefined>) {
  return Promise.all(sources.filter((source): source is string => Boolean(source)).map(loadNormalizedImage));
}

export default function NormalizedBottleImage({ src, alt, className }: Props) {
  const [displaySrc, setDisplaySrc] = useState(() => normalizedCache.get(src) ?? null);

  useEffect(() => {
    let active = true;
    setDisplaySrc(normalizedCache.get(src) ?? null);
    void loadNormalizedImage(src).then((normalized) => {
      if (active) setDisplaySrc(normalized);
    });
    return () => {
      active = false;
    };
  }, [src]);

  if (!displaySrc) {
    return <div className={`${className ?? ""} animate-pulse bg-training-line/30`} aria-label={`Preparando imagem de ${alt}`} />;
  }

  return <img src={displaySrc} alt={alt} className={className} />;
}