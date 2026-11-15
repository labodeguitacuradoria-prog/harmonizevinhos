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

it("história da vinícola vai para a página do produtor, não para a ficha do rótulo", async () => {
  const { studyCard, producerAbout } = await import("./training-book");
  const w = { id: "x", name: "V", producer: "Casa Y", tasting_notes: "Produzido pela vinícola Casa Y desde 1989. Na boca é fresco.", wine_type: "white" } as never;
  assert.equal(studyCard(w).mouth, "Na boca é fresco.");
  assert.equal(producerAbout([w]), "Produzido pela vinícola Casa Y desde 1989.");
});

describe("ficha do rótulo", async () => {
  const { studyCard, typeBand, wineName } = await import("./training-book");
  const notes = `Texto inicial.\n\n**ANÁLISE VISUAL**\nAmarelo palha.\n\n**ANÁLISE OLFATIVA**\nNotas de baunilha, mel e coco, com abacaxi.\n\n**ANÁLISE GUSTATIVA (PALADAR)**\nNo paladar é untuoso e fresco.`;
  const base = { id: "x", name: "Doracy Chardonnay 2023", vintage: 2022, producer: "P", tasting_notes: notes, wine_type: "Branco" } as never as BookWine;

  it("faixa muda de cor conforme o tipo (branco, espumante, rosé, tinto)", () => {
    const bg = (t: string) => typeBand(t).bg.join(",");
    assert.equal(bg("Branco"), "160,125,30");
    assert.equal(bg("Espumante"), "236,214,120");
    assert.equal(bg("Rosé"), "222,72,138");
    assert.equal(bg("Tinto"), "176,22,40");
  });
  it("pílula da faixa mostra o código do vinho e some sem código", () => {
    assert.equal(studyCard({ ...base, internal_code: "042" }).code, "042");
    assert.equal(studyCard({ ...base, internal_code: null }).code, "");
  });
  it("maturação vem do campo Maturação do cadastro", () => {
    assert.equal(studyCard({ ...base, aging: "12 meses em carvalho francês", oak_months: 6 }).maturation, "12 meses em carvalho francês");
  });
  it("aromas saem só da análise olfativa", () => {
    assert.deepEqual(studyCard(base).aromas.map((a) => a.label), ["baunilha", "mel", "coco", "abacaxi"]);
  });
  it("paladar traz a análise gustativa sem o título", () => {
    assert.equal(studyCard(base).mouth, "No paladar é untuoso e fresco.");
  });
  it("título sem safra", () => {
    assert.equal(wineName(base), "Doracy Chardonnay");
  });
});

describe("faixa de espumantes e rosés", async () => {
  const { studyCard } = await import("./training-book");
  const mk = (o: Partial<BookWine>) => ({ id: "s", name: "S", producer: "P", tasting_notes: "", ...o } as BookWine);

  it("espumante mostra o método do cadastro, nunca o corpo", () => {
    assert.equal(studyCard(mk({ wine_type: "Espumante", style: "Espumante Leve", body: "Médio", production_method: "Tradicional" })).header, "ESPUMANTE • MÉTODO TRADICIONAL");
    assert.equal(studyCard(mk({ wine_type: "Espumante", production_method: "Charmat" })).header, "ESPUMANTE • MÉTODO CHARMAT");
    assert.equal(studyCard(mk({ wine_type: "Espumante", production_method: "Asti" })).header, "ESPUMANTE • MÉTODO ASTI");
    assert.equal(studyCard(mk({ wine_type: "Espumante", production_method: "Outro: Sur Lie" })).header, "ESPUMANTE • MÉTODO SUR LIE");
  });
  it("espumante sem método cadastrado usa o método citado na ficha, ou só ESPUMANTE", () => {
    assert.equal(studyCard(mk({ wine_type: "Espumante", elaboration: "Elaborado pelo método Charmat." })).header, "ESPUMANTE • MÉTODO CHARMAT");
    assert.equal(studyCard(mk({ wine_type: "Espumante", body: "Médio", region: "Asti" })).header, "ESPUMANTE");
  });
  it("rosé mostra só ROSÉ, sem leve ou médio", () => {
    const c = studyCard(mk({ wine_type: "Rosé", style: "Rosé Leve", body: "Médio", region: "Provence" }));
    assert.equal(c.header, "ROSÉ");
    assert.equal(c.say, "É um rosé de Provence.");
  });
  it("tinto e branco mantêm o estilo do cadastro", () => {
    assert.equal(studyCard(mk({ wine_type: "Tinto", style: "Tinto Encorpado" })).header, "TINTO • ENCORPADO");
  });
});

it("Livro de Estudos: parágrafos com negrito, dosagem só em espumante, pratos da casa e prêmios", async () => {
  const { studyCard, highlightSegments } = await import("./training-book");
  const segs = highlightSegments("Notas de abacaxi e baunilha.", [/abacaxi/i, /baunilha/i]);
  assert.deepEqual(segs.filter((s) => s.b).map((s) => s.t), ["abacaxi", "baunilha"]);
  const base = { id: "1", name: "X", producer: "P", vintage: null, volume: null, wine_type: "Espumante", style: null, country: null, region: null, appellation: null, grape: null, alcohol_pct: null, body: null, sugar_level: "Nature", oak_months: null, aging: null, serving_temp_min: null, serving_temp_max: null, tasting_notes: null, pairing_notes: "Peixe", elaboration: null, sale_price: null, image_url: null, internal_code: null };
  assert.equal(studyCard(base).dosage, "Nature");
  assert.equal(studyCard({ ...base, wine_type: "Tinto" }).dosage, "");
  assert.deepEqual(studyCard({ ...base, house_dishes: ["Risoto de camarão"] }).dishes, ["Risoto de camarão"]);
  assert.deepEqual(studyCard({ ...base, awards: ["92 pts Descorchados"] }).awards, ["92 pts Descorchados"]);
});
