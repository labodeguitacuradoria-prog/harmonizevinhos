/**
 * Regras compartilhadas para manter todas as fotos de vinhos dentro do
 * armazenamento do próprio aplicativo (sem links de sites externos).
 * Módulo puro: pode ser usado no navegador e no servidor.
 */

export const MEDIA_BUCKET = "product-media";
/** Validade dos links assinados das fotos (10 anos). */
export const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 10;
/** Links assinados com menos que isso de validade são renovados. */
export const RENEW_BELOW_SECONDS = 60 * 60 * 24 * 365 * 5;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type ImageUrlKind = "empty" | "internal" | "data" | "external" | "invalid";

/** Caminho do arquivo dentro do bucket quando a URL é do nosso armazenamento. */
export function internalStoragePath(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/);
    if (!m || m[1] !== MEDIA_BUCKET) return null;
    return decodeURIComponent(m[2]);
  } catch {
    return null;
  }
}

export function classifyImageUrl(value: string | null | undefined): ImageUrlKind {
  const v = (value ?? "").trim();
  if (!v) return "empty";
  if (/^data:image\//i.test(v)) return "data";
  if (!/^https?:\/\//i.test(v)) return "invalid";
  if (internalStoragePath(v)) return "internal";
  try {
    new URL(v);
    return "external";
  } catch {
    return "invalid";
  }
}

/** Segundos de validade restantes de um link assinado (null = não assinado / desconhecido). */
export function signedUrlSecondsLeft(url: string, nowMs = Date.now()): number | null {
  try {
    const token = new URL(url).searchParams.get("token");
    if (!token) return null;
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(atob(b64));
    if (typeof payload.exp !== "number") return null;
    return payload.exp - Math.floor(nowMs / 1000);
  } catch {
    return null;
  }
}

/** True quando a URL precisa de alguma ação (trazer para o sistema ou renovar o link). */
export function imageNeedsWork(url: string | null | undefined, nowMs = Date.now()): "import" | "renew" | null {
  const kind = classifyImageUrl(url);
  if (kind === "external" || kind === "data") return "import";
  if (kind === "internal") {
    const left = signedUrlSecondsLeft(url!, nowMs);
    if (left !== null && left < RENEW_BELOW_SECONDS) return "renew";
  }
  return null;
}

/** Bloqueia endereços internos/privados para impedir uso indevido do download. */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "metadata.google.internal" || h === "0.0.0.0") return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (h.includes(":")) return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h === "::";
  return false;
}

/** Identifica o formato real da imagem pelos primeiros bytes. */
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: "image/gif", ext: "gif" };
  const ascii = (s: number, e: number) => String.fromCharCode(...b.slice(s, e));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(4, 8) === "ftyp" && /^(avif|avis)$/.test(ascii(8, 12))) return { mime: "image/avif", ext: "avif" };
  return null;
}

export function decodeDataUrl(url: string): Uint8Array | null {
  const m = url.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function readLimited(res: Response): Promise<Uint8Array | null> {
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf.byteLength > MAX_IMAGE_BYTES ? null : buf;
}

export type FetchedImage = { bytes: Uint8Array; mime: string; ext: string };

/**
 * Baixa uma imagem externa (ou decodifica data URL). Tenta o site direto e,
 * se ele bloquear, um proxy público de imagens.
 */
export async function fetchImage(url: string): Promise<{ ok: true; image: FetchedImage } | { ok: false; error: string }> {
  const kind = classifyImageUrl(url);
  if (kind === "data") {
    const bytes = decodeDataUrl(url);
    const t = bytes ? sniffImage(bytes) : null;
    if (!bytes || !t) return { ok: false, error: "Imagem colada em formato inválido." };
    if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "Imagem maior que 15 MB." };
    return { ok: true, image: { bytes, ...t } };
  }
  if (kind !== "external") return { ok: false, error: "Endereço de imagem inválido." };
  const u = new URL(url);
  if (isBlockedHost(u.hostname)) return { ok: false, error: "Endereço não permitido." };

  const attempts = [
    () => fetch(url, { headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: `${u.origin}/` }, redirect: "follow" }),
    () => fetch(`https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=png`, { headers: { "User-Agent": UA } }),
  ];
  let lastError = "O site não liberou a imagem.";
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (!res.ok) {
        lastError = res.status === 404 ? "A imagem não existe mais neste endereço." : `O site recusou o download (erro ${res.status}).`;
        continue;
      }
      const bytes = await readLimited(res);
      if (!bytes) {
        lastError = "Imagem maior que 15 MB.";
        continue;
      }
      const t = sniffImage(bytes);
      if (!t) {
        lastError = "O endereço não aponta para uma foto (JPG, PNG ou WEBP).";
        continue;
      }
      return { ok: true, image: { bytes, ...t } };
    } catch {
      lastError = "Não foi possível acessar o site da imagem.";
    }
  }
  return { ok: false, error: lastError };
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
