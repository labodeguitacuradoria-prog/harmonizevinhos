import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MENU_PALETTES, contrastRatio, readableColors } from "./menu-appearance";

describe("printed menu contrast", () => {
  it("keeps forest-green text and headings readable at a minimum 4.5:1", () => {
    const p = MENU_PALETTES.find((p) => p.key === "forest");
    assert.ok(p);
    assert.equal(p.bgColor, "#163024");
    assert.ok(contrastRatio(p.bgColor, p.textColor) >= 4.5);
    assert.ok(contrastRatio(p.bgColor, p.accentColor) >= 4.5);
  });
  it("keeps light-blue text and headings readable at a minimum 4.5:1", () => {
    const p = MENU_PALETTES.find((p) => p.key === "blue");
    assert.ok(p);
    assert.equal(p.bgColor, "#dbeaf5");
    assert.ok(contrastRatio(p.bgColor, p.textColor) >= 4.5);
    assert.ok(contrastRatio(p.bgColor, p.accentColor) >= 4.5);
  });
  it("corrects unreadable text and accents for custom backgrounds", () => {
    for (const bg of ["#141414", "#ffffff", "#777777", "#800020"]) {
      const p = readableColors(bg, bg, bg);
      assert.notEqual(p.textColor, bg);
      assert.ok(contrastRatio(bg, p.textColor) >= 4.5);
      assert.ok(contrastRatio(bg, p.accentColor) >= 4.5);
    }
  });
});