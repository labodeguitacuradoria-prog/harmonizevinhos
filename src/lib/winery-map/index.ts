// Mapa minimalista da vinícola: contorno do país + ponto + linha de chamada com o nome do cadastro.
// Funções puras: o mesmo desenho alimenta a prévia, a imagem salva (SVG) e o PDF do Livro de Estudos.

export type Ring = [number, number][];
export type CountryShape = { iso2: string; name: string; pt: string | null; rings: Ring[] };
export type LabelSide = "auto" | "left" | "right";

export type MapGeom = {
  width: number;
  height: number;
  rings: Ring[];
  point: [number, number];
  line: [number, number][];
  label: { text: string; x: number; y: number; anchor: "start" | "end"; size: number };
  /** Converte um clique (coordenadas do desenho) em latitude/longitude. */
  invert: (x: number, y: number) => { lat: number; lng: number };
};

export const MAP_W = 480;
export const MAP_H = 360;
const PAD = 22;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

// Nomes em português e inglês dos países disponíveis no mapa.
const ALIASES: Record<string, string[]> = {
  BRA: ["brasil", "brazil"], ARG: ["argentina"], CHL: ["chile"], URY: ["uruguai", "uruguay"], PER: ["peru"],
  BOL: ["bolivia"], MEX: ["mexico"], USA: ["estados unidos", "eua", "usa", "united states", "estados unidos da america", "united states of america"],
  CAN: ["canada"], FRA: ["franca", "france"], ITA: ["italia", "italy"], ESP: ["espanha", "spain", "espana"], PRT: ["portugal"],
  DEU: ["alemanha", "germany", "deutschland"], AUT: ["austria"], CHE: ["suica", "switzerland"], HUN: ["hungria", "hungary"],
  GRC: ["grecia", "greece"], SVN: ["eslovenia", "slovenia"], HRV: ["croacia", "croatia"], ROU: ["romenia", "romania"],
  MDA: ["moldavia", "moldova"], BGR: ["bulgaria"], SRB: ["servia", "serbia"], GEO: ["georgia"], ARM: ["armenia"],
  TUR: ["turquia", "turkey", "turkiye"], LBN: ["libano", "lebanon"], ISR: ["israel"], CYP: ["chipre", "cyprus"],
  ZAF: ["africa do sul", "south africa"], AUS: ["australia"], NZL: ["nova zelandia", "new zealand"], CHN: ["china"],
  JPN: ["japao", "japan"], GBR: ["reino unido", "inglaterra", "united kingdom", "england", "gra bretanha", "uk"],
  MAR: ["marrocos", "morocco"], TUN: ["tunisia"], CZE: ["republica tcheca", "tchequia", "czech republic", "czechia"],
  SVK: ["eslovaquia", "slovakia"], UKR: ["ucrania", "ukraine"], LUX: ["luxemburgo", "luxembourg"], BEL: ["belgica", "belgium"],
  NLD: ["holanda", "paises baixos", "netherlands"], DNK: ["dinamarca", "denmark"], COL: ["colombia"], VEN: ["venezuela"],
  IND: ["india"], MKD: ["macedonia", "macedonia do norte", "north macedonia"], MNE: ["montenegro"], ALB: ["albania"],
  BIH: ["bosnia", "bosnia e herzegovina"], PRY: ["paraguai", "paraguay"], ECU: ["equador", "ecuador"],
};
const BY_ALIAS = new Map<string, string>();
for (const [iso, names] of Object.entries(ALIASES)) for (const n of names) BY_ALIAS.set(n, iso);

/** Código do país (ISO-3) a partir do texto do cadastro (“Brasil”, “França”, “Chile”…). */
export function resolveCountry(country: string | null | undefined): string | null {
  if (!country?.trim()) return null;
  const n = norm(country);
  if (BY_ALIAS.has(n)) return BY_ALIAS.get(n)!;
  // “Brasil - RS”, “Mendoza, Argentina”…
  for (const part of n.split(" ")) if (BY_ALIAS.has(part)) return BY_ALIAS.get(part)!;
  for (const [alias, iso] of BY_ALIAS) if (alias.length > 3 && n.includes(alias)) return iso;
  return null;
}

let cache: Promise<Record<string, CountryShape>> | null = null;
export function loadCountries() {
  cache ??= import("./countries.json").then((m) => (m.default ?? m) as unknown as Record<string, CountryShape>);
  return cache;
}

export function countryBounds(shape: CountryShape) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of shape.rings) for (const [x, y] of r) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minLng: minX, maxLng: maxX, minLat: minY, maxLat: maxY };
}

/** Ponto central do país (usado quando ainda não há localização). */
export function countryCenter(shape: CountryShape) {
  const b = countryBounds(shape);
  return { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 };
}

/** Verifica se um ponto cai dentro do retângulo do país (com folga). */
export function insideCountry(shape: CountryShape, lat: number, lng: number) {
  const b = countryBounds(shape);
  const mx = (b.maxLng - b.minLng) * 0.08 + 0.3, my = (b.maxLat - b.minLat) * 0.08 + 0.3;
  return lat >= b.minLat - my && lat <= b.maxLat + my && lng >= b.minLng - mx && lng <= b.maxLng + mx;
}

const charW = 0.5; // largura média de um caractere em Times bold, relativa ao tamanho da fonte

export function computeWineryMap(shape: CountryShape, o: { lat: number; lng: number; name: string; side?: LabelSide; width?: number; height?: number }): MapGeom {
  const W = o.width ?? MAP_W, H = o.height ?? MAP_H;
  const b = countryBounds(shape);
  const k = Math.cos((((b.minLat + b.maxLat) / 2) * Math.PI) / 180);
  const spanX = (b.maxLng - b.minLng) * k || 1, spanY = b.maxLat - b.minLat || 1;
  const s = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  const ox = (W - spanX * s) / 2, oy = (H - spanY * s) / 2;
  const proj = (lng: number, lat: number): [number, number] => [ox + (lng - b.minLng) * k * s, oy + (b.maxLat - lat) * s];
  const invert = (x: number, y: number) => ({ lat: b.maxLat - (y - oy) / s, lng: b.minLng + (x - ox) / (k * s) });
  const rings = shape.rings.map((r) => r.map(([x, y]) => proj(x, y)));
  const [px, py] = proj(o.lng, o.lat);
  const point: [number, number] = [Math.min(W - 4, Math.max(4, px)), Math.min(H - 4, Math.max(4, py))];

  const text = o.name.trim();
  const diag = 26, gap = 8, margin = 6;
  const size0 = 19;
  const need = (sz: number) => diag + gap * 2 + text.length * sz * charW;
  const room = { right: W - margin - point[0], left: point[0] - margin };
  let side: "left" | "right" = o.side === "left" || o.side === "right" ? o.side : room.right >= room.left ? "right" : "left";
  if (o.side === "auto" || !o.side) {
    const other = side === "right" ? "left" : "right";
    if (need(size0) > room[side] && need(size0) <= room[other]) side = other;
  }
  const size = Math.max(10, Math.min(size0, (room[side] - diag - gap * 2) / Math.max(1, text.length * charW)));
  const dir = side === "right" ? 1 : -1;
  const up = point[1] > 48 ? -1 : 1;
  const elbow: [number, number] = [point[0] + dir * diag, point[1] + up * diag];
  const len = text.length * size * charW + gap * 2;
  const end: [number, number] = [elbow[0] + dir * len, elbow[1]];
  return {
    width: W, height: H, rings, point,
    line: [[point[0] + dir * 5, point[1] + up * 5], elbow, end],
    label: { text, x: elbow[0] + dir * gap, y: elbow[1] - 6, anchor: side === "right" ? "start" : "end", size },
    invert,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n: number) => Math.round(n * 10) / 10;

export const MAP_COLORS = {
  land: "#f4efe2", border: "#9a8f78", line: "#555555", ink: "#232323", dot: "#800020", halo: "rgba(128,0,32,0.16)", gold: "#D4AF37",
};

/** Imagem SVG autônoma (fundo transparente) salva no cadastro da vinícola. */
export function wineryMapSvg(g: MapGeom) {
  const c = MAP_COLORS;
  const d = g.rings.map((r) => "M" + r.map(([x, y]) => `${f1(x)},${f1(y)}`).join("L") + "Z").join("");
  const pts = g.line.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ");
  const l = g.label;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${g.height}" width="${g.width}" height="${g.height}">`
    + `<path d="${d}" fill="${c.land}" stroke="${c.border}" stroke-width="1.2" stroke-linejoin="round"/>`
    + `<polyline points="${pts}" fill="none" stroke="${c.line}" stroke-width="1"/>`
    + `<circle cx="${f1(g.point[0])}" cy="${f1(g.point[1])}" r="10" fill="${c.halo}"/>`
    + `<circle cx="${f1(g.point[0])}" cy="${f1(g.point[1])}" r="5" fill="${c.dot}" stroke="#ffffff" stroke-width="1.5"/>`
    + `<text x="${f1(l.x)}" y="${f1(l.y)}" text-anchor="${l.anchor}" font-family="Times New Roman, Times, serif" font-weight="700" font-size="${f1(l.size)}" fill="${c.ink}" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${esc(l.text)}</text>`
    + `</svg>`;
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
