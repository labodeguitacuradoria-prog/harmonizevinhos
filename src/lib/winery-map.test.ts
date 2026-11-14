import { describe, it } from "node:test";
import assert from "node:assert/strict";
import shapes from "./winery-map/countries.json";
import { computeWineryMap, insideCountry, resolveCountry, wineryMapSvg, type CountryShape } from "./winery-map";

const S = shapes as unknown as Record<string, CountryShape>;

describe("mapa da vinícola", () => {
  it("reconhece o país escrito como no cadastro", () => {
    assert.equal(resolveCountry("França"), "FRA");
    assert.equal(resolveCountry("Brasil"), "BRA");
    assert.equal(resolveCountry("África do Sul"), "ZAF");
    assert.equal(resolveCountry("Mendoza, Argentina"), "ARG");
    assert.equal(resolveCountry("Estados Unidos"), "USA");
    assert.equal(resolveCountry("Atlântida"), null);
  });

  it("escreve o nome exatamente como está no cadastro da vinícola", () => {
    const g = computeWineryMap(S.BRA, { lat: -29.17, lng: -51.52, name: "Casa Valduga" });
    assert.equal(g.label.text, "Casa Valduga");
    assert.ok(wineryMapSvg(g).includes(">Casa Valduga</text>"));
  });

  it("o ponto clicado no mapa volta para a mesma latitude/longitude", () => {
    const g = computeWineryMap(S.CHL, { lat: -34.6, lng: -71.2, name: "Viña Montes" });
    const back = g.invert(g.point[0], g.point[1]);
    assert.ok(Math.abs(back.lat - (-34.6)) < 1e-4);
    assert.ok(Math.abs(back.lng - (-71.2)) < 1e-4);
  });

  it("o nome e a linha ficam dentro da imagem", () => {
    for (const [iso, lat, lng] of [["BRA", -29.17, -51.52], ["FRA", 44.84, -0.58], ["ITA", 43.47, 11.25], ["ARG", -33.0, -68.8]] as const) {
      const g = computeWineryMap(S[iso], { lat, lng, name: "Bodega Catena Zapata" });
      for (const [x] of g.line) { assert.ok(x >= 0 && x <= g.width); }
    }
  });

  it("respeita o lado escolhido para o nome", () => {
    assert.equal(computeWineryMap(S.ITA, { lat: 43.47, lng: 11.25, name: "Antinori", side: "left" }).label.anchor, "end");
    assert.equal(computeWineryMap(S.ITA, { lat: 43.47, lng: 11.25, name: "Antinori", side: "right" }).label.anchor, "start");
  });

  it("detecta ponto fora do país", () => {
    assert.equal(insideCountry(S.BRA, -29.17, -51.52), true);
    assert.equal(insideCountry(S.BRA, 44.84, -0.58), false);
  });

  it("protege caracteres especiais do nome na imagem salva", () => {
    assert.ok(wineryMapSvg(computeWineryMap(S.PRT, { lat: 41.1, lng: -7.8, name: "Quinta <A> & B" })).includes("Quinta &lt;A&gt; &amp; B"));
  });
});
