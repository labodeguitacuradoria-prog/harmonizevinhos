import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export type LinkScope = "dashboard" | "stock_count" | "training";
export type DeviceKind = "mobile" | "desktop";

export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function secret() {
  const s = process.env["ACCESS_LINK_SECRET"];
  if (!s) throw new Error("ACCESS_LINK_SECRET não configurado.");
  return s;
}

export function newDeviceId() {
  return randomBytes(24).toString("base64url");
}

export function hashDeviceId(deviceId: string) {
  return createHmac("sha256", secret()).update(`device:${deviceId}`).digest("hex");
}

export function signDeviceId(deviceId: string) {
  const sig = createHmac("sha256", secret()).update(deviceId).digest("base64url");
  return `${deviceId}.${sig}`;
}

export function verifyDeviceCookie(value: string | undefined | null): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const deviceId = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = createHmac("sha256", secret()).update(deviceId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return deviceId;
}

export function cookieNameFor(linkId: string) {
  return `hz_al_${linkId.replace(/-/g, "")}`;
}

const MOBILE_RE = /android|iphone|ipod|ipad|iemobile|opera mini|blackberry|windows phone|mobile/i;

export function detectDeviceKind(userAgent: string | null | undefined): DeviceKind {
  return MOBILE_RE.test(userAgent ?? "") ? "mobile" : "desktop";
}

export class AccessLinkError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
