import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { ACCEPT, extensionAccept } from "./file-accept";

describe("file picker accept filters", () => {
  test("converts MIME filters to literal extensions", () => {
    assert.equal(extensionAccept("application/pdf,image/*"), ".pdf,.png,.jpg,.jpeg,.webp");
  });

  test("keeps extensions and drops unknown MIME types", () => {
    assert.equal(extensionAccept(".PDF, foo/bar, .docx"), ".pdf,.docx");
  });

  test("never exposes MIME types in shared presets", () => {
    for (const value of Object.values(ACCEPT)) assert.doesNotMatch(value, /\//);
  });
});
