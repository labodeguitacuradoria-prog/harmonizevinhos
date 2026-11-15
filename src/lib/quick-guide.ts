// Guia Rápido de Salão: ficha curta por rótulo para o celular do garçom (palavras-chave, sem parágrafos).
// Os mesmos cartões alimentam a versão na tela e o PDF offline com links.
import { bodyDots, clean, studyCard, tastingSection, typeBand, typeKey, typeLabel, wineName, type BookWine } from "@/lib/training-book";

type RGB = [number, number, number];

export type QuickCard = {
  id: string;
  type: string;
  group: string;
  header: string;
  band: { bg: RGB; fg: RGB };
  code: string;
  producer: string;
  name: string;
  country: string;
  region: string;
  price: string;
  grapes: string;
  body: string;
  bodyDots: number;
  /** Apenas espumantes: Nature, Brut, Demi-sec… */
  dosage: string;
  maturation: string;
  visual: string[];
  nose: string[];
  palate: string[];
  dishes: string[];
  /** true quando os pratos vêm da harmonização do cardápio do restaurante. */
  houseDishes: boolean;
  pitch: string;
  /** true quando o cadastro ainda não tem a frase "Fale assim à mesa" e usamos uma automática. */
  pitchAuto: boolean;
  temp: string;
  hasPhoto: boolean;
};

const TYPE_ORDER = ["sparkling", "white", "rose", "orange", "red", "dessert", "fortified", ""];
const GROUP_LABEL: Record<string, string> = {
  sparkling: "Espumantes", white: "Brancos", rose: "Rosés", orange: "Laranjas", red: "Tintos",
  dessert: "Sobremesa", fortified: "Fortificados", "": "Outros",
};

const VISUAL: [RegExp, string][] = [
  [/amarelo[ -]palha/i, "amarelo palha"], [/amarelo[ -]dourado|dourado intenso/i, "amarelo dourado"],
  [/amarelo[ -]esverdeado/i, "amarelo esverdeado"], [/amarelo[ -]lim[aã]o/i, "amarelo limão"],
  [/reflexos? (?:\w+ )?dourad/i, "reflexos dourados"], [/reflexos? (?:\w+ )?(?:esverdead|verde)/i, "reflexos esverdeados"],
  [/[aâ]mbar|ambarad/i, "âmbar"], [/\bouro\b|dourada?\b/i, "dourado"],
  [/rubi/i, "rubi"], [/granada/i, "granada"], [/viol[aá]ce|violeta/i, "reflexos violáceos"], [/p[uú]rpura/i, "púrpura"],
  [/atijolad|tijolo/i, "atijolado"], [/vermelho[ -]cereja|cor de cereja/i, "vermelho cereja"],
  [/salm[aã]o/i, "rosa salmão"], [/casca de cebola/i, "casca de cebola"], [/rosa[ -]p[aá]lido|rosado p[aá]lido/i, "rosa pálido"],
  [/rosad[oa]|\brosa\b/i, "rosado"],
  [/l[ií]mpid|limpidez/i, "límpido"], [/brilh/i, "brilhante"], [/cristalin/i, "cristalino"],
  [/(?:cor|colora[cç][aã]o|tonalidade)[^.]{0,40}(?:intens|profund)/i, "cor intensa"],
  [/perlage[^.]{0,20}fin|borbulhas? finas?|bolhas? finas?/i, "perlage fino"],
  [/perlage[^.]{0,40}persistent|borbulhas?[^.]{0,30}persistent/i, "perlage persistente"],
  [/l[aá]grimas/i, "lágrimas"],
];

const PALATE: [RegExp, string | ((m: RegExpExecArray) => string)][] = [
  [/\bsec[oa]\b/i, "seco"], [/\bdoce\b|ado[cç]icad/i, "doce"],
  [/acidez (alta|vibrante|viva|equilibrada|refrescante|marcante|m[eé]dia|elevada|crocante|suculenta|delicada|presente|baixa)/i, (m) => `acidez ${m[1].toLowerCase()}`],
  [/taninos? (macios?|sedosos?|firmes?|finos?|aveludados?|maduros?|presentes?|m[eé]dios?|redondos?|elegantes?|integrados?|suaves?|polidos?|marcantes?|delicados?)/i, (m) => `taninos ${m[1].toLowerCase().replace(/([^s])$/, "$1s")}`],
  [/fresc(?:o|a|or)\b/i, "fresco"], [/cremos|cremosidade/i, "cremoso"], [/untuos/i, "untuoso"], [/sedos/i, "sedoso"],
  [/aveludad/i, "aveludado"], [/mineral/i, "mineral"], [/salin/i, "salino"], [/frutad|fruta (?:madura|fresca|suculenta)/i, "frutado"],
  [/equilibr/i, "equilibrado"], [/elegan/i, "elegante"], [/encorpad|corpo (?:robusto|cheio|pleno)/i, "encorpado"],
  [/\bleve\b|corpo leve/i, "leve"], [/\bmaci[oa]\b|maciez/i, "macio"], [/redond/i, "redondo"], [/complex/i, "complexo"],
  [/suculent/i, "suculento"], [/amanteigad|manteiga/i, "amanteigado"], [/tostad/i, "tostado"],
  [/final (longo|persistente|m[eé]dio|curto|prolongado|agrad[aá]vel|marcante|elegante|fresco)/i, (m) => `final ${m[1].toLowerCase()}`],
  [/persist[eê]n/i, "persistente"],
];

function pick(text: string, rules: [RegExp, string | ((m: RegExpExecArray) => string)][], max: number) {
  // Regras mais específicas vêm antes; um trecho já usado (ex.: "acidez equilibrada") não gera outra pílula ("equilibrado").
  const found: { label: string; at: number; end: number }[] = [];
  for (const [rx, out] of rules) {
    const m = rx.exec(text);
    if (!m) continue;
    const label = typeof out === "string" ? out : out(m);
    const at = m.index, end = m.index + m[0].length;
    if (found.some((f) => f.label === label || (at < f.end && end > f.at))) continue;
    found.push({ label, at, end });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.label).slice(0, max);
}

/** Palavras da cor/aspecto, tiradas da análise visual (ou do texto todo, se não houver seção). */
export function visualWords(notes: string | null | undefined) {
  const out = pick(tastingSection(notes, "visual") || clean(notes), VISUAL, 5);
  // "rosado" genérico some quando já há um tom rosa específico.
  return out.some((x) => /salm|cebola|p[aá]lido/.test(x)) ? out.filter((x) => x !== "rosado") : out;
}

/** Sensações de boca, tiradas da análise gustativa. */
export function palateWords(notes: string | null | undefined) {
  const text = tastingSection(notes, "gustativa");
  const out = pick(text, PALATE, 6);
  return out.some((x) => x.startsWith("final ")) ? out.filter((x) => x !== "persistente") : out;
}

const money = (v: number | null | undefined) =>
  v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";

/** Pratos do cardápio da casa indicados para cada vinho na Harmonização do cardápio. */
export function houseDishesByWine(guides: { results: unknown }[]) {
  const map = new Map<string, { dish: string; score: number }[]>();
  for (const g of guides)
    for (const r of Array.isArray(g.results) ? (g.results as { dish?: string; picks?: { wine_id?: string; score?: number }[] }[]) : []) {
      const dish = clean(r?.dish);
      if (!dish) continue;
      for (const p of r.picks ?? []) {
        if (!p?.wine_id) continue;
        const list = map.get(p.wine_id) ?? [];
        if (!list.some((x) => x.dish.toLowerCase() === dish.toLowerCase())) list.push({ dish, score: Number(p.score) || 0 });
        map.set(p.wine_id, list);
      }
    }
  const out = new Map<string, string[]>();
  for (const [id, list] of map) out.set(id, list.sort((a, b) => b.score - a.score).slice(0, 4).map((x) => x.dish));
  return out;
}

export function quickCard(w: BookWine, houseDishes?: string[]): QuickCard {
  const s = studyCard(w);
  const k = typeKey(w.wine_type);
  const band = typeBand(w.wine_type);
  const own = clean(w.table_pitch).replace(/^["“]|["”]$/g, "");
  const nose = s.aromas.map((a) => a.label).slice(0, 6);
  return {
    id: w.id,
    type: k,
    group: GROUP_LABEL[k] ?? GROUP_LABEL[""],
    header: s.header || typeLabel(w.wine_type).toUpperCase(),
    band: { bg: band.bg, fg: band.fg },
    code: s.code,
    producer: clean(w.winery_name) || clean(w.producer),
    name: wineName(w),
    country: clean(w.country),
    region: [w.region, w.appellation].map(clean).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · "),
    price: money(w.sale_price),
    grapes: s.grapes.join(" · "),
    body: clean(w.body),
    bodyDots: bodyDots(w.body),
    dosage: k === "sparkling" ? clean(w.sugar_level) : "",
    maturation: clean(w.aging) || (w.oak_months ? `${String(w.oak_months).replace(".", ",")} meses em carvalho` : ""),
    visual: visualWords(w.tasting_notes),
    nose,
    palate: palateWords(w.tasting_notes),
    dishes: houseDishes?.length ? houseDishes : s.dishes.slice(0, 4),
    houseDishes: !!houseDishes?.length,
    pitch: own || s.say,
    pitchAuto: !own,
    temp: s.temp,
    hasPhoto: !!w.image_url,
  };
}

const codeNum = (c: string) => (/^\d+$/.test(c) ? Number(c) : Number.POSITIVE_INFINITY);

/** Cartões em ordem de serviço: espumantes, brancos, rosés, tintos… e por código dentro de cada tipo. */
export function buildQuickCards(wines: BookWine[], house: Map<string, string[]> = new Map()) {
  const rank = (t: string) => { const i = TYPE_ORDER.indexOf(t); return i < 0 ? TYPE_ORDER.length : i; };
  return wines
    .map((w) => quickCard(w, house.get(w.id)))
    .sort((a, b) => rank(a.type) - rank(b.type) || codeNum(a.code) - codeNum(b.code) || a.code.localeCompare(b.code) || a.name.localeCompare(b.name, "pt-BR"));
}

export function groupCards(cards: QuickCard[]) {
  const groups: { label: string; type: string; cards: QuickCard[] }[] = [];
  for (const c of cards) {
    const g = groups[groups.length - 1];
    if (g && g.type === c.type) g.cards.push(c);
    else groups.push({ label: c.group, type: c.type, cards: [c] });
  }
  return groups;
}

// ---------------- PDF para celular (offline, com links) ----------------
type Img = { data: string; w: number; h: number };
export const QUICK_PDF_W = 100;
const MIN_H = 178;
const M = 6;
const INK: RGB = [25, 25, 25];
const MUTED: RGB = [110, 110, 110];
const LINE: RGB = [205, 205, 205];
const pt = (size: number, f = 1.3) => size * 0.3528 * f;

/** Gera o PDF do guia (índice clicável + uma ficha por rótulo). Executar apenas no navegador. */
export async function buildQuickGuidePdf(opts: { title: string; restaurantName: string; cards: QuickCard[]; photos: Map<string, Img | null> }) {
  const { jsPDF } = await import("jspdf");
  const W = QUICK_PDF_W;
  const doc = new jsPDF({ unit: "mm", format: [W, MIN_H] });
  const groups = groupCards(opts.cards);

  // Índice: linhas de 9 mm, quebra em páginas da mesma altura.
  type Row = { kind: "title" } | { kind: "group"; g: (typeof groups)[number] } | { kind: "wine"; c: QuickCard };
  const rows: Row[] = [{ kind: "title" }];
  for (const g of groups) { rows.push({ kind: "group", g }); for (const c of g.cards) rows.push({ kind: "wine", c }); }
  const rowH = (r: Row) => (r.kind === "title" ? 26 : r.kind === "group" ? 11 : 9.5);
  const indexPages: Row[][] = [[]];
  let used = 8;
  for (const r of rows) {
    if (used + rowH(r) > MIN_H - 8) { indexPages.push([]); used = 8; }
    indexPages[indexPages.length - 1].push(r);
    used += rowH(r);
  }
  const firstCardPage = indexPages.length + 1;
  const cardPage = new Map(opts.cards.map((c, i) => [c.id, firstCardPage + i]));
  const groupIndexPage = new Map<string, number>();
  indexPages.forEach((p, i) => p.forEach((r) => { if (r.kind === "group" && !groupIndexPage.has(r.g.type)) groupIndexPage.set(r.g.type, i + 1); }));

  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
  const codeW = Math.max(10, ...opts.cards.map((c) => doc.getTextWidth(c.code || "—"))) + 3.5;
  indexPages.forEach((page, i) => {
    if (i > 0) doc.addPage([W, MIN_H], "portrait");
    let y = 8;
    for (const r of page) {
      if (r.kind === "title") {
        doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...INK);
        doc.text(doc.splitTextToSize(opts.title, W - 2 * M)[0] as string, M, y + 6);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
        doc.text(doc.splitTextToSize(opts.restaurantName, W - 2 * M)[0] as string, M, y + 12);
        doc.text("Toque no vinho para abrir a ficha.", M, y + 17.5);
        doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.line(M, y + 21.5, W - M, y + 21.5);
      } else if (r.kind === "group") {
        const c0 = r.g.cards[0];
        doc.setFillColor(...c0.band.bg); doc.roundedRect(M, y + 3.2, 3.4, 3.4, 0.8, 0.8, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK);
        doc.text(r.g.label.toUpperCase(), M + 5.5, y + 6.2, { charSpace: 0.6 });
      } else {
        const c = r.c;
        const page = cardPage.get(c.id)!;
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...INK);
        doc.text(c.code || "—", M, y + 6);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
        const pw = c.price ? doc.getTextWidth(c.price) + 3 : 0;
        doc.setFontSize(10.5);
        const name = doc.splitTextToSize(c.name, W - 2 * M - codeW - pw)[0] as string;
        doc.text(name, M + codeW, y + 6);
        if (c.price) { doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.text(c.price, W - M, y + 6, { align: "right" }); }
        doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y + 9, W - M, y + 9);
        doc.link(M, y, W - 2 * M, 9.5, { pageNumber: page });
      }
      y += rowH(r);
    }
  });

  for (const c of opts.cards) {
    const img = opts.photos.get(c.id) ?? null;
    const h = Math.max(MIN_H, drawCard(doc, c, img, false, groupIndexPage.get(c.type) ?? 1));
    doc.addPage([W, h], "portrait");
    drawCard(doc, c, img, true, groupIndexPage.get(c.type) ?? 1);
  }
  return doc.output("blob");
}

/** Desenha (ou só mede, com draw=false) a ficha e devolve a altura usada em mm. */
function drawCard(doc: InstanceType<typeof import("jspdf").jsPDF>, c: QuickCard, img: Img | null, draw: boolean, indexPage: number) {
  const W = QUICK_PDF_W;
  const D = draw ? doc : null;
  const font = (style: "normal" | "bold" | "italic", size: number, color: RGB = INK) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); };
  const wrap = (t: string, width: number) => doc.splitTextToSize(t, width) as string[];

  // Faixa do tipo + código
  D?.setFillColor(...c.band.bg); D?.rect(0, 0, W, 12, "F");
  let pillW = 0;
  if (c.code) {
    font("bold", 10.5);
    const t = `Nº ${c.code}`;
    pillW = Math.max(17, doc.getTextWidth(t) + 7);
    D?.setFillColor(255, 255, 255); D?.roundedRect(W - M - pillW, 2.6, pillW, 6.8, 3.4, 3.4, "F");
    D?.setTextColor(...(c.type === "sparkling" ? c.band.fg : c.band.bg)); D?.text(t, W - M - pillW / 2, 7.4, { align: "center" });
  }
  // Texto da faixa: reduz a fonte até caber ao lado do código (o espaçamento entre letras conta na largura).
  const room = W - 2 * M - (pillW ? pillW + 3 : 0);
  let hs = 10, cs = 0.5;
  const hw = () => { font("bold", hs, c.band.fg); return doc.getTextWidth(c.header) + cs * c.header.length; };
  while (hw() > room && hs > 7) { hs -= 0.5; cs = Math.max(0.15, cs - 0.07); }
  let head = c.header;
  while (head.length > 3 && doc.getTextWidth(head) + cs * head.length > room) head = `${head.slice(0, -2).trimEnd()}…`;
  D?.text(head, M, 7.6, { charSpace: cs });
  // Voltar ao índice
  font("bold", 8.5, MUTED);
  D?.text("‹  ÍNDICE", M, 18);
  D?.link(M - 2, 13, 26, 7, { pageNumber: indexPage });

  // Garrafa + identificação
  const top = 22, bw = 30, bh = 60;
  if (img) {
    const sc = Math.min((bw - 2) / img.w, (bh - 2) / img.h);
    D?.addImage(img.data, "JPEG", M + (bw - img.w * sc) / 2, top + (bh - img.h * sc) / 2, img.w * sc, img.h * sc);
  } else {
    D?.setDrawColor(...LINE); D?.setLineWidth(0.3); D?.roundedRect(M, top, bw, bh, 2, 2, "S");
    font("normal", 8, MUTED); D?.text("sem foto", M + bw / 2, top + bh / 2, { align: "center" });
  }
  const x = M + bw + 5, cw = W - M - x;
  let y = top + 4;
  if (c.producer) { font("bold", 8.5, MUTED); const l = wrap(c.producer.toUpperCase(), cw).slice(0, 2); D?.text(l, x, y, { charSpace: 0.3 }); y += l.length * pt(8.5) + 1.8; }
  font("bold", 15); const nl = wrap(c.name, cw).slice(0, 4); y += pt(15, 0.75); D?.text(nl, x, y, { lineHeightFactor: 1.12 }); y += (nl.length - 1) * pt(15, 1.12) + 6.5;
  if (c.country) { font("bold", 10.5); D?.text(wrap(c.country, cw)[0], x, y); y += 5.2; }
  if (c.region) { font("normal", 10.5, MUTED); const l = wrap(c.region, cw).slice(0, 2); D?.text(l, x, y); y += l.length * pt(10.5) + 1.2; }
  if (c.price) { y += 3; font("bold", 15); D?.text(c.price, x, y); y += 6; }
  y = Math.max(top + bh, y) + 7;

  const sep = () => { D?.setDrawColor(...LINE); D?.setLineWidth(0.2); D?.line(M, y, W - M, y); };
  const KW = 26;
  // Linhas curtas (rótulo à esquerda, valor à direita)
  const row = (k: string, v: string, extra?: (vx: number, vy: number) => number, kw = KW) => {
    font("bold", 8.5, MUTED); D?.text(k.toUpperCase(), M, y + 0.2, { charSpace: 0.4 });
    let vx = M + Math.max(kw, doc.getTextWidth(k.toUpperCase()) + 0.4 * k.length + 4);
    if (extra) vx = extra(vx, y);
    font("normal", 11);
    const l = v ? wrap(v, W - M - vx) : [""];
    D?.text(l, vx, y + 0.4, { lineHeightFactor: 1.3 });
    y += (l.length - 1) * pt(11) + 3.4; sep(); y += 5.6;
  };
  if (c.grapes) row("Uvas", c.grapes);
  if (c.body) row("Corpo", c.body.toLowerCase(), (vx, vy) => {
    for (let k = 0; k < 5; k++) {
      D?.setDrawColor(...INK); D?.setFillColor(...INK); D?.setLineWidth(0.3);
      D?.circle(vx + 1.5 + k * 4.2, vy - 1.2, 1.45, k < c.bodyDots ? "FD" : "S");
    }
    return vx + 24;
  });
  if (c.dosage) row("Dosagem de açúcar", c.dosage);

  const label = (t: string) => { font("bold", 8.5, MUTED); D?.text(t.toUpperCase(), M, y, { charSpace: 0.4 }); y += 5.4; };
  if (c.maturation) {
    label("Maturação");
    font("normal", 11); const l = wrap(c.maturation, W - 2 * M); D?.text(l, M, y, { lineHeightFactor: 1.32 });
    y += (l.length - 1) * pt(11, 1.32) + 4; sep(); y += 5.6;
  }
  const pills = (items: string[]) => {
    font("normal", 10.5);
    let px = M;
    for (const it of items) {
      const tw = Math.min(W - 2 * M, doc.getTextWidth(it) + 6.5);
      if (px + tw > W - M) { px = M; y += 8; }
      D?.setDrawColor(150, 150, 150); D?.setLineWidth(0.3); D?.roundedRect(px, y - 4.6, tw, 6.6, 3.3, 3.3, "S");
      D?.text(it, px + 3.25, y);
      px += tw + 2;
    }
    y += 5.2; sep(); y += 5.6;
  };
  if (c.visual.length) { label("Visual"); y += 0.8; pills(c.visual); }
  if (c.nose.length) { label("Olfato"); y += 0.8; pills(c.nose); }
  if (c.palate.length) { label("Paladar"); y += 0.8; pills(c.palate); }
  if (c.dishes.length) {
    label("Combina com");
    font("normal", 11);
    for (const d of c.dishes) {
      const l = wrap(d, W - 2 * M - 5);
      D?.text("•", M + 0.5, y); D?.text(l, M + 5, y, { lineHeightFactor: 1.3 });
      y += l.length * pt(11) + 1.2;
    }
    y += 2.6; sep(); y += 5.6;
  }
  if (c.pitch) {
    font("italic", 11.5); const l = wrap(`“${c.pitch}”`, W - 2 * M - 8);
    const bh2 = 10 + l.length * pt(11.5, 1.32);
    D?.setDrawColor(...INK); D?.setLineWidth(0.4); D?.roundedRect(M, y - 4, W - 2 * M, bh2, 2.5, 2.5, "S");
    font("bold", 8.5, MUTED); D?.text("FALE ASSIM À MESA", M + 4, y + 1.6, { charSpace: 0.4 });
    font("italic", 11.5); D?.text(l, M + 4, y + 7.6, { lineHeightFactor: 1.32 });
    y += bh2 + 4;
  }
  if (c.temp) {
    font("bold", 8.5, MUTED); D?.text("TEMPERATURA DE SERVIÇO", M, y + 1, { charSpace: 0.4 });
    font("bold", 12); D?.text(c.temp, W - M, y + 1.2, { align: "right" });
    y += 5;
  }
  return y + 8;
}
