import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyImageUrl, imageNeedsWork, isBlockedHost, internalStoragePath, sniffImage, RENEW_BELOW_SECONDS } from "./image-storage";

const BASE = "https://abc.supabase.co/storage/v1/object/sign/product-media/wines/x/1.png";
const tokenWithExp = (exp: number) => {
  const p = btoa(JSON.stringify({ exp })).replace(/=+$/, "");
  return `${BASE}?token=h.${p}.s`;
};

describe("fotos sempre no sistema", () => {
  it("link de site externo precisa ser trazido para o sistema", () => {
    assert.equal(classifyImageUrl("https://www.almaunica.com.br/garrafa.png"), "external");
    assert.equal(imageNeedsWork("https://www.almaunica.com.br/garrafa.png"), "import");
  });
  it("imagem colada (data URL) também é trazida", () => {
    assert.equal(imageNeedsWork("data:image/png;base64,AAAA"), "import");
  });
  it("foto já no armazenamento com link longo não precisa de nada", () => {
    const now = Date.now();
    const url = tokenWithExp(Math.floor(now / 1000) + RENEW_BELOW_SECONDS + 1000);
    assert.equal(internalStoragePath(url), "wines/x/1.png");
    assert.equal(imageNeedsWork(url, now), null);
  });
  it("foto no armazenamento com link perto de vencer é renovada", () => {
    const now = Date.now();
    assert.equal(imageNeedsWork(tokenWithExp(Math.floor(now / 1000) + 3600 * 24 * 300), now), "renew");
  });
  it("bloqueia endereços internos", () => {
    assert.equal(isBlockedHost("localhost"), true);
    assert.equal(isBlockedHost("192.168.0.10"), true);
    assert.equal(isBlockedHost("169.254.169.254"), true);
    assert.equal(isBlockedHost("cdn.dooca.store"), false);
  });
  it("reconhece o formato real da foto pelos bytes", () => {
    assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext, "jpg");
    assert.equal(sniffImage(new TextEncoder().encode("<html><body>nao</body>")), null);
  });
});
