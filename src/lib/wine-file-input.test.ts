import { describe, expect, test } from "bun:test";
import { WineFileInput, wineFileType } from "./wine-file-input";

const path = "catalog/tech/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.pdf";
describe("Technical sheet file transport", () => {
  test("accepts a compact storage reference instead of file bytes", () => {
    expect(WineFileInput.parse({ storagePath: path, mimeType: "application/pdf" })).toEqual({ storagePath: path, mimeType: "application/pdf" });
    expect(WineFileInput.safeParse({ fileBase64: "data:application/pdf;base64,JVBERi0=", mimeType: "application/pdf" }).success).toBe(false);
  });
  test("rejects external URLs and traversal", () => {
    for (const storagePath of ["https://example.com/ficha.pdf", "catalog/tech/../private.pdf", "other/private.pdf"]) {
      expect(WineFileInput.safeParse({ storagePath, mimeType: "application/pdf" }).success).toBe(false);
    }
  });
  test("recognizes PDF and JPEG even without a browser MIME type", () => {
    expect(wineFileType({ name: "Ficha.PDF", type: "" })).toEqual({ mimeType: "application/pdf", extension: "pdf" });
    expect(wineFileType({ name: "foto.jpeg", type: "" })).toEqual({ mimeType: "image/jpeg", extension: "jpg" });
  });
});