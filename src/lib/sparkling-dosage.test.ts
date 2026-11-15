import { test } from "node:test";
import assert from "node:assert/strict";
import { sparklingDosage, dosageShortLabel, classifySparklingSugar } from "./sparkling-dosage";

test("nome do rótulo define a dosagem, mesmo com 'Seco' salvo", () => {
  assert.equal(sparklingDosage({ name: "Doracy Nature Método Clássico", sugar_level: "Seco" }), "Nature / Brut Nature");
  assert.equal(sparklingDosage({ name: "Cave Geisse BRUT ROSÉ", sugar_level: "Seco", sugar_g_l: 2 }), "Brut");
  assert.equal(sparklingDosage({ name: "Casa Valduga Extra Brut", sugar_level: "Seco" }), "Extra Brut");
  assert.equal(sparklingDosage({ name: "Salton Demi-Sec", sugar_level: "Seco" }), "Demi-Sec / Meio-Doce");
  assert.equal(sparklingDosage({ name: "Garibaldi Moscatel", sugar_level: "Seco" }), "Doce / Doux / Moscatel");
});

test("sem menção no nome, usa o açúcar residual em g/L", () => {
  assert.equal(classifySparklingSugar(3), "Nature / Brut Nature");
  assert.equal(classifySparklingSugar(8), "Extra Brut");
  assert.equal(classifySparklingSugar(12), "Brut");
  assert.equal(classifySparklingSugar(18), "Sec / Seco / Extra Sec");
  assert.equal(classifySparklingSugar(45), "Demi-Sec / Meio-Doce");
  assert.equal(classifySparklingSugar(80), "Doce / Doux / Moscatel");
  assert.equal(sparklingDosage({ name: "Espumante Rosé", sugar_level: "Seco", sugar_g_l: 10 }), "Brut");
});

test("'Seco' sozinho não vira dosagem de espumante", () => {
  assert.equal(sparklingDosage({ name: "Espumante da Casa", sugar_level: "Seco" }), null);
  assert.equal(sparklingDosage({ name: "Espumante da Casa", sugar_level: "Brut" }), "Brut");
  assert.equal(sparklingDosage({ name: "Espumante da Casa", sugar_level: "Meio-seco" }), "Demi-Sec / Meio-Doce");
});

test("rótulo curto na ficha", () => {
  assert.equal(dosageShortLabel("Nature / Brut Nature"), "Nature");
  assert.equal(dosageShortLabel("Doce / Doux / Moscatel", "Moscatel Espumante"), "Moscatel");
  assert.equal(dosageShortLabel("Doce / Doux / Moscatel", "Espumante Doce"), "Doce");
});
