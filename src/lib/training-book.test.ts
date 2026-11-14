import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { layoutBook, type BookPage, type BookWine } from "./training-book";

const w = (id: string, producer: string): BookWine => ({ id, name: id, producer } as BookWine);
const wines = [w("a1", "Alfa"), w("a2", "Alfa"), w("b1", "Beta")];

describe("layoutBook", () => {
  it("abre cada produtor com uma página própria antes dos seus rótulos", () => {
    const pages: BookPage[] = [
      { id: "i", type: "index" },
      { id: "1", type: "wine", wineId: "a1" },
      { id: "2", type: "wine", wineId: "a2" },
      { id: "3", type: "wine", wineId: "b1" },
    ];
    const { layout } = layoutBook(pages, wines);
    assert.deepEqual(layout.map((l) => l.kind), ["index", "producer", "wine", "wine", "producer", "wine"]);
  });

  it("índice aponta para a página real de cada rótulo, contando páginas inseridas", () => {
    const pages: BookPage[] = [
      { id: "c", type: "custom", path: "x", name: "capa" },
      { id: "i", type: "index" },
      { id: "3", type: "wine", wineId: "b1" },
    ];
    const { index } = layoutBook(pages, wines);
    assert.deepEqual(index, [{ producer: "Beta", page: 3, wines: [{ id: "b1", name: "b1", page: 4 }] }]);
  });
});
