import { describe, expect, it } from "vitest";
import { ACCEPT, extensionAccept } from "./file-accept";

describe("file picker accept filters", () => {
  it("converts MIME filters to literal extensions", () => {
    expect(extensionAccept("application/pdf,image/*")).toBe(".pdf,.png,.jpg,.jpeg,.webp");
  });

  it("keeps extensions and drops unknown MIME types", () => {
    expect(extensionAccept(".PDF, foo/bar, .docx")).toBe(".pdf,.docx");
  });

  it("never exposes MIME types in shared presets", () => {
    for (const value of Object.values(ACCEPT)) expect(value).not.toMatch(/\//);
  });
});
