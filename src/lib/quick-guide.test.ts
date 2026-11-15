import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildQuickCards, houseDishesByWine, palateWords, quickCard, visualWords } from "./quick-guide";
import type { BookWine } from "./training-book";

const NOTES =
  "Texto da vinícola. **ANÁLISE VISUAL** Apresenta coloração amarelo palha com reflexos dourados, límpido e brilhante. " +
  "**ANÁLISE OLFATIVA** Notas de abacaxi, pêssego e baunilha. " +
  "**ANÁLISE GUSTATIVA** Seco, cremoso, com acidez equilibrada e final longo.";

const wine = (p: Partial<BookWine>): BookWine =>
  ({ id: "w", name: "Doracy Chardonnay 2023", producer: "Lidio Carraro", wine_type: "Branco", tasting_notes: NOTES, ...p }) as BookWine;

describe("Guia Rápido de Salão", () => {
  it("visual vira palavras-chave da análise visual", () => {
    assert.deepEqual(visualWords(NOTES), ["amarelo palha", "reflexos dourados", "límpido", "brilhante"]);
  });

  it("paladar vira palavras-chave da análise gustativa, sem o título", () => {
    assert.deepEqual(palateWords(NOTES), ["seco", "cremoso", "acidez equilibrada", "final longo"]);
  });

  it("olfato usa só os aromas da análise olfativa", () => {
    assert.deepEqual(quickCard(wine({})).nose, ["abacaxi", "pêssego", "baunilha"]);
  });

  it("dosagem de açúcar aparece só para espumante", () => {
    assert.equal(quickCard(wine({ wine_type: "Espumante", sugar_level: "Brut" })).dosage, "Brut");
    assert.equal(quickCard(wine({ wine_type: "Branco", sugar_level: "Seco" })).dosage, "");
  });

  it("Fale assim à mesa usa a frase escrita no cadastro", () => {
    const c = quickCard(wine({ table_pitch: "Branco cremoso, ótimo com peixes." }));
    assert.equal(c.pitch, "Branco cremoso, ótimo com peixes.");
    assert.equal(c.pitchAuto, false);
    assert.equal(quickCard(wine({ table_pitch: null })).pitchAuto, true);
  });

  it("maturação mostra o texto completo do cadastro", () => {
    const long = "Estágio de 12 meses em barricas de carvalho francês de primeiro e segundo uso, seguido de 6 meses de repouso em garrafa antes de chegar ao mercado, preservando o frescor.";
    assert.equal(quickCard(wine({ aging: long })).maturation, long);
  });

  it("nome sai sem a safra", () => {
    assert.equal(quickCard(wine({})).name, "Doracy Chardonnay");
  });

  it("combina com: pratos da casa têm prioridade sobre a harmonização do cadastro", () => {
    const house = houseDishesByWine([
      { results: [{ dish: "Risoto de camarão", picks: [{ wine_id: "w", score: 9 }] }, { dish: "Salmão grelhado", picks: [{ wine_id: "w", score: 7 }] }] },
    ]);
    const c = quickCard(wine({ pairing_notes: "Peixes, aves" }), house.get("w"));
    assert.deepEqual(c.dishes, ["Risoto de camarão", "Salmão grelhado"]);
    assert.equal(quickCard(wine({ pairing_notes: "Peixes, aves" })).dishes.join("|"), "Peixes|Aves");
  });

  it("ordem de serviço: espumantes, brancos, rosés, tintos; por código dentro do tipo", () => {
    const cards = buildQuickCards([
      wine({ id: "t", wine_type: "Tinto", internal_code: "5" }),
      wine({ id: "b2", wine_type: "Branco", internal_code: "12" }),
      wine({ id: "e", wine_type: "Espumante", internal_code: "40" }),
      wine({ id: "b1", wine_type: "Branco", internal_code: "3" }),
      wine({ id: "r", wine_type: "Rosé", internal_code: "1" }),
    ]);
    assert.deepEqual(cards.map((c) => c.id), ["e", "b1", "b2", "r", "t"]);
  });
});
