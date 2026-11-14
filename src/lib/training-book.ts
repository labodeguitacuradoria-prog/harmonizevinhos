// Livro de Estudos (A4) montado apenas com os dados já cadastrados nos rótulos.
export type BookPage =
  | { id: string; type: "wine"; wineId: string }
  | { id: string; type: "custom"; path: string; name: string }
  | { id: string; type: "index" };

export type BookWine = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  volume: string | null;
  wine_type: string | null;
  style: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  grape: string | null;
  alcohol_pct: number | null;
  body: string | null;
  sugar_level: string | null;
  oak_months: number | null;
  aging: string | null;
  serving_temp_min: number | null;
  serving_temp_max: number | null;
  tasting_notes: string | null;
  pairing_notes: string | null;
  elaboration: string | null;
  sale_price: number | null;
  image_url: string | null;
  internal_code: string | null;
  winery_about?: string | null;
  winery_photo?: string | null;
  grapes_detail?: { grape: string; pct?: number; mesesBarrica?: number }[] | null;
};

export type BookIndexEntry = { producer: string; page: number; wines: { id: string; name: string; page: number }[] };

export const NO_PRODUCER = "Outros produtores";

export function producerOf(w: Pick<BookWine, "producer">) {
  return w.producer?.trim() || NO_PRODUCER;
}

/** Ordem inicial: índice + rótulos agrupados por produtor, em ordem alfabética. */
export function defaultPages(wines: BookWine[], makeId: () => string): BookPage[] {
  const sorted = [...wines].sort(
    (a, b) => producerOf(a).localeCompare(producerOf(b), "pt-BR") || a.name.localeCompare(b.name, "pt-BR"),
  );
  return [{ id: makeId(), type: "index" }, ...sorted.map((w) => ({ id: makeId(), type: "wine" as const, wineId: w.id }))];
}

export const INDEX_LINES_PER_PAGE = 42;

export type Layout =
  | { kind: "custom"; page: Extract<BookPage, { type: "custom" }> }
  | { kind: "index"; part: number }
  | { kind: "producer"; producer: string; wineIds: string[] }
  | { kind: "wine"; wine: BookWine };

/** Expande a lista editável nas páginas reais do PDF (com aberturas de produtor e índice). */
export function layoutBook(pages: BookPage[], wines: BookWine[]) {
  const byId = new Map(wines.map((w) => [w.id, w]));
  const valid = pages.filter((p) => p.type !== "wine" || byId.has(p.wineId));
  // Grupos consecutivos por produtor.
  const runs: { producer: string; wineIds: string[] }[] = [];
  let last: string | null = null;
  for (const p of valid) {
    if (p.type !== "wine") {
      last = null;
      continue;
    }
    const prod = producerOf(byId.get(p.wineId)!);
    if (prod !== last) runs.push({ producer: prod, wineIds: [] });
    runs[runs.length - 1].wineIds.push(p.wineId);
    last = prod;
  }
  const indexLines = runs.reduce((n, r) => n + 2 + r.wineIds.length, 0);
  const indexPages = Math.max(1, Math.ceil(indexLines / INDEX_LINES_PER_PAGE));

  const out: Layout[] = [];
  let runIdx = 0;
  last = null;
  for (const p of valid) {
    if (p.type === "custom") {
      out.push({ kind: "custom", page: p });
      last = null;
    } else if (p.type === "index") {
      for (let i = 0; i < indexPages; i++) out.push({ kind: "index", part: i });
      last = null;
    } else {
      const w = byId.get(p.wineId)!;
      const prod = producerOf(w);
      if (prod !== last) {
        out.push({ kind: "producer", producer: prod, wineIds: runs[runIdx].wineIds });
        runIdx++;
      }
      out.push({ kind: "wine", wine: w });
      last = prod;
    }
  }
  const index: BookIndexEntry[] = [];
  out.forEach((l, i) => {
    if (l.kind === "producer") index.push({ producer: l.producer, page: i + 1, wines: [] });
    if (l.kind === "wine") index[index.length - 1]?.wines.push({ id: l.wine.id, name: wineTitle(l.wine), page: i + 1 });
  });
  return { layout: out, index };
}

export function wineTitle(w: Pick<BookWine, "name" | "vintage">) {
  return w.vintage && !w.name.includes(String(w.vintage)) ? `${w.name} ${w.vintage}` : w.name;
}

/** Nome do vinho sem a safra (remove anos como 2022 que vieram junto do nome). */
export function wineName(w: Pick<BookWine, "name">) {
  return w.name.replace(/\s*\b(19|20)\d{2}\b/g, "").replace(/\s{2,}/g, " ").trim() || w.name;
}

const TYPE_LABEL: Record<string, string> = {
  red: "Tinto",
  white: "Branco",
  rose: "Rosé",
  sparkling: "Espumante",
  dessert: "Sobremesa",
  fortified: "Fortificado",
  orange: "Laranja",
};
const norm = (t: string | null | undefined) =>
  (t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const TYPE_KEY: Record<string, string> = {
  tinto: "red", red: "red", branco: "white", white: "white", rose: "rose", rosado: "rose",
  espumante: "sparkling", sparkling: "sparkling", champagne: "sparkling", sobremesa: "dessert", dessert: "dessert",
  fortificado: "fortified", fortified: "fortified", laranja: "orange", orange: "orange",
};
/** Normaliza o tipo do cadastro (em português ou inglês) para uma chave única. */
export function typeKey(t: string | null | undefined) {
  return TYPE_KEY[norm(t)] ?? "";
}

type RGB = [number, number, number];
/** Cores da faixa superior da ficha: fundo, texto da faixa e cor de destaque na página. */
export const TYPE_BAND: Record<string, { bg: RGB; fg: RGB; accent: RGB }> = {
  white: { bg: [160, 125, 30], fg: [255, 255, 255], accent: [160, 125, 30] }, // amarelo palha
  sparkling: { bg: [236, 214, 120], fg: [80, 62, 10], accent: [176, 145, 40] }, // amarelo claro
  rose: { bg: [222, 72, 138], fg: [255, 255, 255], accent: [222, 72, 138] }, // pink
  red: { bg: [176, 22, 40], fg: [255, 255, 255], accent: [176, 22, 40] }, // vermelho
  dessert: { bg: [176, 112, 36], fg: [255, 255, 255], accent: [176, 112, 36] },
  fortified: { bg: [92, 14, 22], fg: [255, 255, 255], accent: [92, 14, 22] },
  orange: { bg: [210, 118, 40], fg: [255, 255, 255], accent: [210, 118, 40] },
};
const DEFAULT_BAND = { bg: [160, 125, 30] as RGB, fg: [255, 255, 255] as RGB, accent: [160, 125, 30] as RGB };
export function typeBand(t: string | null | undefined) {
  return TYPE_BAND[typeKey(t)] ?? DEFAULT_BAND;
}

export function typeLabel(t: string | null) {
  return TYPE_LABEL[typeKey(t)] || t || "Vinho";
}

export function techRows(w: BookWine): [string, string][] {
  const temp =
    w.serving_temp_min || w.serving_temp_max
      ? `${w.serving_temp_min ?? w.serving_temp_max}${w.serving_temp_max && w.serving_temp_min !== w.serving_temp_max ? ` a ${w.serving_temp_max}` : ""} °C`
      : "";
  const rows: [string, string][] = [
    ["Tipo", [typeLabel(w.wine_type), w.style].filter(Boolean).join(" · ")],
    ["País", w.country ?? ""],
    ["Região", [w.region, w.appellation].filter(Boolean).join(" · ")],
    ["Uvas", w.grape ?? ""],
    ["Safra", w.vintage ? String(w.vintage) : ""],
    ["Volume", w.volume ?? ""],
    ["Teor alcoólico", w.alcohol_pct ? `${String(w.alcohol_pct).replace(".", ",")}%` : ""],
    ["Corpo", w.body ?? ""],
    ["Açúcar", w.sugar_level ?? ""],
    ["Madeira", w.oak_months ? `${String(w.oak_months).replace(".", ",")} meses` : w.aging ?? ""],
    ["Servir a", temp],
    ["Preço na carta", w.sale_price ? `R$ ${Number(w.sale_price).toFixed(2).replace(".", ",")}` : ""],
  ];
  return rows.filter(([, v]) => v);
}

async function toDataUrl(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.88), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

/** Gera o PDF A4 com índice clicável. Executar apenas no navegador. */
export async function buildBookPdf(opts: {
  title: string;
  restaurantName: string;
  pages: BookPage[];
  wines: BookWine[];
  resolveCustomUrl: (path: string) => Promise<string | null>;
  onProgress?: (done: number, total: number) => void;
}) {
  const { jsPDF } = await import("jspdf");
  const { layout, index } = layoutBook(opts.pages, opts.wines);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 18;
  const GOLD: [number, number, number] = [160, 125, 30];
  const INK: [number, number, number] = [35, 35, 35];
  const MUTED: [number, number, number] = [120, 120, 120];
  const firstIndexPage = layout.findIndex((l) => l.kind === "index") + 1;

  const footer = (n: number, withBack: boolean) => {
    doc.setDrawColor(220, 220, 220);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(`${opts.title} · ${opts.restaurantName}`, W / 2 - M - 12)[0] as string, M, H - 8.6);
    doc.setFont("helvetica", "bold");
    doc.text(String(n), W / 2, H - 8.6, { align: "center" });
    if (withBack && firstIndexPage > 0) {
      const cx = W - M - 3.4, cy = H - 9.8;
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.45);
      doc.lines([[3.4, -3.1], [3.4, 3.1]], cx - 3.4, cy, [1, 1], "S");
      doc.rect(cx - 2.3, cy, 4.6, 3.3, "S");
      doc.link(cx - 6, cy - 5, 12, 10, { pageNumber: firstIndexPage });
    }
  };

  for (let i = 0; i < layout.length; i++) {
    opts.onProgress?.(i, layout.length);
    if (i > 0) doc.addPage();
    const n = i + 1;
    const l = layout[i];

    if (l.kind === "custom") {
      const url = await opts.resolveCustomUrl(l.page.path);
      const img = url ? await toDataUrl(url) : null;
      if (img) {
        const s = Math.min(W / img.w, H / img.h);
        const w = img.w * s;
        const h = img.h * s;
        doc.addImage(img.data, "JPEG", (W - w) / 2, (H - h) / 2, w, h);
      }
      continue;
    }

    if (l.kind === "index") {
      doc.setFont("times", "bold");
      doc.setFontSize(24);
      doc.setTextColor(...INK);
      doc.text(l.part === 0 ? "Índice dos rótulos" : "Índice (continuação)", W / 2, 32, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      if (l.part === 0) doc.text("Toque no nome do vinho para ir direto à página.", W / 2, 40, { align: "center" });
      // linhas desta parte
      const lines: { t: "p" | "w"; text: string; page: number }[] = [];
      for (const e of index) {
        lines.push({ t: "p", text: e.producer, page: e.page });
        for (const w of e.wines) lines.push({ t: "w", text: w.name, page: w.page });
        lines.push({ t: "w", text: "", page: 0 });
      }
      const slice = lines.slice(l.part * INDEX_LINES_PER_PAGE, (l.part + 1) * INDEX_LINES_PER_PAGE);
      let y = 52;
      for (const ln of slice) {
        if (ln.text) {
          if (ln.t === "p") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(...GOLD);
            doc.textWithLink(ln.text.toUpperCase(), M, y, { pageNumber: ln.page });
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...INK);
            const t = doc.splitTextToSize(ln.text, W - 2 * M - 30)[0] as string;
            doc.textWithLink(t, M + 5, y, { pageNumber: ln.page });
            const tw = doc.getTextWidth(t);
            doc.setDrawColor(200, 200, 200);
            doc.setLineDashPattern([0.4, 1], 0);
            doc.line(M + 7 + tw, y - 0.6, W - M - 10, y - 0.6);
            doc.setLineDashPattern([], 0);
            doc.text(String(ln.page), W - M, y, { align: "right" });
            doc.link(M, y - 4, W - 2 * M, 5.5, { pageNumber: ln.page });
          }
        }
        y += 5.4;
      }
      footer(n, false);
      continue;
    }

    if (l.kind === "producer") {
      const wines = l.wineIds.map((id) => opts.wines.find((w) => w.id === id)!).filter(Boolean);
      const photo = wines.find((w) => w.winery_photo)?.winery_photo;
      if (photo) {
        const url = /^https?:\/\//.test(photo) ? photo : await opts.resolveCustomUrl(photo);
        const img = url ? await toDataUrl(url) : null;
        if (img) {
          const sc = Math.min(120 / img.w, 34 / img.h);
          doc.addImage(img.data, "JPEG", (W - img.w * sc) / 2, 10, img.w * sc, img.h * sc);
        }
      }
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.line(W / 2 - 20, 55, W / 2 + 20, 55);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("PRODUTOR", W / 2, 48, { align: "center", charSpace: 1.5 });
      doc.setFont("times", "bold");
      doc.setFontSize(30);
      doc.setTextColor(...INK);
      const title = doc.splitTextToSize(l.producer, W - 2 * M) as string[];
      doc.text(title, W / 2, 72, { align: "center" });
      let y = 72 + title.length * 11 + 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(`${wines.length} ${wines.length === 1 ? "rótulo" : "rótulos"} neste livro`, W / 2, y, { align: "center" });
      y += 12;
      const about = producerAbout(wines);
      if (about) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...GOLD);
        doc.text("SOBRE A VINÍCOLA", W / 2, y, { align: "center", charSpace: 1.2 });
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        const al = (doc.splitTextToSize(about, W - 2 * M - 20) as string[]).slice(0, 14);
        doc.text(al, W / 2, y, { align: "center", lineHeightFactor: 1.45 });
        y += al.length * 5.1 + 10;
      }
      doc.setFontSize(12);
      for (const w of wines) {
        const page = index.flatMap((e) => e.wines).find((x) => x.id === w.id)?.page ?? n;
        doc.setTextColor(...INK);
        doc.textWithLink(wineTitle(w), W / 2, y, { align: "center", pageNumber: page });
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(`${typeLabel(w.wine_type)} · página ${page}`, W / 2, y + 4.5, { align: "center" });
        doc.setFontSize(12);
        y += 12;
        if (y > H - 30) break;
      }
      footer(n, true);
      continue;
    }

    // Página do rótulo — ficha de estudo
    const w = l.wine;
    const card = studyCard(w);
    const band = typeBand(w.wine_type);
    const color = band.accent;
    const SOFT: [number, number, number] = [color[0] + (255 - color[0]) * 0.86, color[1] + (255 - color[1]) * 0.86, color[2] + (255 - color[2]) * 0.86].map(Math.round) as [number, number, number];
    const DARK: [number, number, number] = [38, 52, 44];
    const LH = (pt: number, f = 1.35) => pt * 0.3528 * f;
    const BOTTOM = H - 18;
    doc.setFillColor(...band.bg);
    doc.rect(0, 0, W, 15, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...band.fg);
    doc.text(card.header, M, 9.6, { charSpace: 1.2 });
    if (card.code) {
      const badge = `Nº ${card.code}`;
      doc.setFontSize(11);
      const bw = Math.max(20, doc.getTextWidth(badge) + 9);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(W - M - bw, 3.7, bw, 7.6, 3.8, 3.8, "F");
      doc.setTextColor(...(typeKey(w.wine_type) === "sparkling" ? band.fg : band.bg));
      doc.text(badge, W - M - bw / 2, 9.1, { align: "center" });
    }

    const top = 23;
    const boxW = 64, boxH = 96;
    doc.setFillColor(238, 238, 238);
    doc.roundedRect(M + 1, top + 1.2, boxW, boxH, 3, 3, "F");
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(228, 228, 228);
    doc.roundedRect(M, top, boxW, boxH, 3, 3, "FD");
    const img = w.image_url ? await toDataUrl(w.image_url) : null;
    if (img) {
      const sc = Math.min((boxW - 8) / img.w, (boxH - 8) / img.h);
      doc.addImage(img.data, "JPEG", M + (boxW - img.w * sc) / 2, top + (boxH - img.h * sc) / 2, img.w * sc, img.h * sc);
    } else {
      doc.setFontSize(10); doc.setTextColor(...MUTED);
      doc.text("Sem foto", M + boxW / 2, top + boxH / 2, { align: "center" });
    }

    const x = M + boxW + 8, cw = W - M - x;
    let y = top + 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...GOLD);
    doc.text(doc.splitTextToSize(producerOf(w).toUpperCase(), cw)[0] as string, x, y, { charSpace: 1 });
    y += 9.5;
    doc.setFont("times", "bold"); doc.setFontSize(25); doc.setTextColor(...DARK);
    const nl = (doc.splitTextToSize(wineName(w), cw) as string[]).slice(0, 3);
    doc.text(nl, x, y, { lineHeightFactor: 1.1 }); y += nl.length * LH(25, 1.1) + 1.5;
    const origin = [w.country, w.region].filter(Boolean).join(" • ");
    if (origin) { doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...INK); doc.text(doc.splitTextToSize(origin, cw)[0] as string, x, y); y += 6; }
    if (w.appellation) { doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED); doc.text(doc.splitTextToSize(clean(w.appellation), cw)[0] as string, x, y); y += 6; }
    if (card.price) { y += 2.5; doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...color); doc.text(card.price, x, y); y += 8.5; }
    // pílulas de uvas
    let px = x;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
    for (const g of card.grapes.slice(0, 6)) {
      const tw = doc.getTextWidth(g) + 7;
      if (px + tw > W - M) { px = x; y += 8.6; }
      doc.setFillColor(...DARK); doc.roundedRect(px, y - 5, tw, 7, 3.5, 3.5, "F");
      doc.setTextColor(255, 255, 255); doc.text(g, px + 3.5, y);
      px += tw + 2;
    }
    if (card.grapes.length) y += 10;
    // tabela rápida
    const KW = 27;
    const row = (k: string, draw: (vx: number) => number) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...MUTED); doc.text(k, x, y);
      const lines = draw(x + KW);
      const yl = y + (lines - 1) * LH(11) + 2.8;
      doc.setDrawColor(210, 210, 210); doc.setLineDashPattern([0.4, 1], 0); doc.line(x, yl, W - M, yl); doc.setLineDashPattern([], 0);
      y = yl + 6;
    };
    const txt = (t: string, max = 1) => (vx: number) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...INK);
      const tl = (doc.splitTextToSize(t, W - M - vx) as string[]).slice(0, max);
      doc.text(tl, vx, y, { lineHeightFactor: 1.35 });
      return tl.length;
    };
    if (w.body) row("Corpo", (vx) => {
      const d = bodyDots(w.body);
      for (let k = 0; k < 5; k++) { doc.setDrawColor(...color); doc.setFillColor(...color); doc.circle(vx + 1.9 + k * 5, y - 1.4, 1.8, k < d ? "FD" : "S"); }
      return txt(clean(w.body).toLowerCase())(vx + 27);
    });
    if (w.sugar_level) row("Açúcar", txt(clean(w.sugar_level).toLowerCase()));
    if (card.maturation) row("Maturação", txt(card.maturation, 3));

    y = Math.max(top + boxH, y) + 11;
    const label = (t: string, lx = M) => { doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(...GOLD); doc.text(t, lx, y, { charSpace: 1 }); };
    const pills = (items: string[], lx: number, maxX: number, fill: boolean) => {
      let qx = lx; doc.setFont("helvetica", "normal"); doc.setFontSize(11.5);
      for (const it of items) {
        const tw = doc.getTextWidth(it) + 8;
        if (qx + tw > maxX) { qx = lx; y += 9.4; }
        if (fill) { doc.setFillColor(...SOFT); doc.roundedRect(qx, y - 5.4, tw, 7.6, 3.8, 3.8, "F"); }
        else { doc.setDrawColor(...color); doc.setLineWidth(0.35); doc.roundedRect(qx, y - 5.4, tw, 7.6, 3.8, 3.8, "S"); }
        doc.setTextColor(...INK); doc.text(it, qx + 4, y); qx += tw + 2.5;
      }
    };
    if (card.aromas.length) { label("AROMAS"); y += 9; pills(card.aromas.map((a) => a.label), M, W - M, false); y += 12; }
    if (card.mouth) {
      label("PALADAR"); y += 7.5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(12.5); doc.setTextColor(...INK);
      const ml = (doc.splitTextToSize(card.mouth, W - 2 * M) as string[]).slice(0, 6);
      doc.text(ml, M, y, { lineHeightFactor: 1.35 }); y += ml.length * LH(12.5) + 7;
    }
    if ((card.temp || card.dishes.length) && y < BOTTOM - 20) {
      const y0 = y; const half = M + (W - 2 * M) * 0.3;
      if (card.temp) { label("SERVIR A"); y += 9; doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...INK); doc.text(card.temp, M, y); }
      const yT = y; y = y0;
      if (card.dishes.length) { label("COMBINA COM", half); y += 9; pills(card.dishes, half, W - M, true); }
      y = Math.max(yT, y) + 15;
    }
    doc.setFont("helvetica", "italic"); doc.setFontSize(12.5);
    const sl = (doc.splitTextToSize(`“${card.say}”`, W - 2 * M - 10) as string[]).slice(0, 3);
    const bh = 14 + sl.length * LH(12.5);
    if (y + bh < BOTTOM) {
      doc.setFillColor(252, 252, 250); doc.setDrawColor(...DARK); doc.setLineWidth(0.3);
      doc.roundedRect(M, y - 7.5, W - 2 * M, bh + 1.5, 2.5, 2.5, "FD");
      label("FALE ASSIM À MESA", M + 5); y += 7.5;
      doc.setFont("helvetica", "italic"); doc.setFontSize(12.5); doc.setTextColor(...INK); doc.text(sl, M + 5, y, { lineHeightFactor: 1.35 });
      y += sl.length * LH(12.5) + 12;
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(11.5);
    const rl = (doc.splitTextToSize(`Para decorar: ${card.remember}`, W - 2 * M - 10) as string[]).slice(0, 2);
    if (y + rl.length * LH(11.5) + 2 < BOTTOM) {
      doc.setFillColor(...SOFT); doc.roundedRect(M, y - 6.4, W - 2 * M, 9 + (rl.length - 1) * LH(11.5), 2.5, 2.5, "F");
      doc.setTextColor(...INK); doc.text(rl, M + 5, y, { lineHeightFactor: 1.35 });
    }
    footer(n, true);
  }
  opts.onProgress?.(layout.length, layout.length);
  return { blob: doc.output("blob"), index, pageCount: layout.length };
}

// ---------- Ficha de estudo (flashcard) — derivada só do cadastro, sem IA ----------
export const clean = (s: string | null | undefined) =>
  (s ?? "").replace(/\*\*|__|`|^#+\s*/gm, "").replace(/\s+/g, " ").trim();

const sentences = (s: string | null | undefined) =>
  clean(s).split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú“"])/).map((x) => x.trim()).filter(Boolean);

const WINERY_RX = /\b(vin[ií]cola|winery|bodega|cantina|ch[aâ]teau|domaine|fam[ií]lia|fundad[ao]|desde \d{4}|produzid[ao] pel[ao]|propriedade|gera[cç][aã]o|hist[oó]ria|enólog[ao]|fazenda)\b/i;

export function isWinerySentence(s: string, producer?: string | null) {
  return WINERY_RX.test(s) || (!!producer && producer.length > 3 && s.toLowerCase().includes(producer.toLowerCase()));
}

/** Texto sobre a vinícola, juntando (sem repetir) as frases institucionais de todos os rótulos do produtor. */
export function producerAbout(wines: BookWine[]) {
  const official = wines.find((w) => w.winery_about?.trim())?.winery_about;
  if (official) return clean(official);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of wines)
    for (const s of sentences(w.tasting_notes).concat(sentences(w.elaboration)))
      if (isWinerySentence(s, w.producer) && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase());
        out.push(s);
      }
  return out.slice(0, 6).join(" ");
}

const AROMAS: [RegExp, string, string][] = [
  [/lim[aã]o|lima\b/i, "limão", "🍋"], [/maracuj/i, "maracujá", "🥭"], [/abacaxi/i, "abacaxi", "🍍"],
  [/c[ií]tric/i, "cítricos", "🍊"], [/p[eê]ssego/i, "pêssego", "🍑"], [/damasco/i, "damasco", "🍑"],
  [/\bpera/i, "pera", "🍐"], [/ma[cç][aã]/i, "maçã", "🍏"], [/tropica/i, "frutas tropicais", "🥭"],
  [/morango/i, "morango", "🍓"], [/cereja/i, "cereja", "🍒"], [/framboesa/i, "framboesa", "🍓"],
  [/amora|mirtilo|cassis/i, "frutas negras", "🫐"], [/ameixa/i, "ameixa", "🫐"],
  [/frutas? vermelh/i, "frutas vermelhas", "🍓"], [/frutas? negr|frutas? pret/i, "frutas negras", "🫐"],
  [/flor|floral|violeta|rosa\b/i, "flores", "🌸"], [/mel\b/i, "mel", "🍯"], [/baunilha/i, "baunilha", "🍦"],
  [/tostad|brioche|p[aã]o/i, "tostado / pão", "🍞"], [/especiari|pimenta|cravo|canela/i, "especiarias", "🌶️"],
  [/chocolate|cacau/i, "chocolate", "🍫"], [/caf[eé]\b/i, "café", "☕"], [/carvalho|madeira|defumad/i, "madeira", "🪵"],
  [/ervas|herb|menta|eucalipto/i, "ervas", "🌿"], [/mineral/i, "mineral", "🪨"], [/couro|tabaco/i, "tabaco / couro", "🍂"],
  [/nozes|am[eê]ndoa|avel[aã]|frut[ao]s? sec[ao]s/i, "frutas secas", "🌰"], [/\bcoco\b/i, "coco", "🥥"], [/\bfigo/i, "figo", "🍇"],
  [/frutas? brancas?/i, "frutas brancas", "🍐"], [/frutas? em calda|compota/i, "frutas em calda", "🍯"],
  [/manteiga|amanteigad/i, "manteiga", "🧈"], [/caramelo|toffee/i, "caramelo", "🍮"], [/alca[cç]uz/i, "alcaçuz", "🌿"],
  [/terros|cogumelo|sous-bois/i, "terroso", "🍄"], [/levedura|autólise|autolise/i, "leveduras", "🍞"],
];

export function bodyDots(body: string | null) {
  const b = (body ?? "").toLowerCase();
  if (!b) return 0;
  if (/muito encorp|intens/.test(b)) return 5;
  if (/encorp|alto/.test(b)) return 4;
  if (/m[eé]di/.test(b)) return 3;
  if (/leve|baixo/.test(b)) return 2;
  return 3;
}

export type StudyCard = {
  header: string; aromas: { label: string; icon: string }[]; mouth: string; temp: string;
  dishes: string[]; grapes: string[]; say: string; remember: string; price: string; maturation: string; code: string;
};

const ANALYSIS_HEAD = /(?:\*\*|#+[ \t]*)?[ \t]*AN[ÁA]LISE[ \t]+(VISUAL|OLFATIVA|GUSTATIVA)(?:[ \t]*\([^)\n]{0,30}\))?[ \t]*(?:\*\*)?[ \t]*[:\-–]?\s*/gi;

/** Texto de uma seção das notas de degustação (sem o título "ANÁLISE ..."). */
export function tastingSection(notes: string | null | undefined, kind: "visual" | "olfativa" | "gustativa") {
  const s = notes ?? "";
  const heads = [...s.matchAll(ANALYSIS_HEAD)];
  const i = heads.findIndex((h) => norm(h[1]) === kind);
  if (i < 0) return "";
  const from = heads[i].index! + heads[i][0].length;
  const rest = s.slice(from, heads[i + 1]?.index ?? s.length);
  const stop = rest.search(/\*\*[^*\n]{3,60}\*\*|\n[ \t]*#+[ \t]|\n[ \t]*(CONCLUS|HARMONIZA|SERVI[CÇ]O)/i);
  return clean(stop > 0 ? rest.slice(0, stop) : rest);
}

function clip(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dot = cut.lastIndexOf(". ");
  return dot > max * 0.5 ? cut.slice(0, dot + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function studyCard(w: BookWine): StudyCard {
  const nose = tastingSection(w.tasting_notes, "olfativa");
  const src = nose || `${w.tasting_notes ?? ""} ${w.elaboration ?? ""}`;
  const found: { label: string; icon: string; at: number }[] = [];
  for (const [rx, label, icon] of AROMAS) {
    const m = rx.exec(src);
    if (m && !found.some((a) => a.label === label)) found.push({ label, icon, at: m.index });
  }
  const aromas = found.sort((a, b) => a.at - b.at).map(({ label, icon }) => ({ label, icon }));
  const palate = tastingSection(w.tasting_notes, "gustativa");
  const wineSent = sentences(w.tasting_notes).filter((s) => !isWinerySentence(s, w.producer) && !/^AN[ÁA]LISE\b/i.test(s));
  const mouth = palate
    ? clip(palate, 480)
    : clip(wineSent.find((s) => /boca|paladar|final|taninos?|acidez|textura/i.test(s)) ?? wineSent[0] ?? "", 240);
  const temp = w.serving_temp_min || w.serving_temp_max
    ? `${w.serving_temp_min ?? w.serving_temp_max}${w.serving_temp_max && w.serving_temp_min !== w.serving_temp_max ? ` a ${w.serving_temp_max}` : ""} °C` : "";
  const dishes = clean(w.pairing_notes).replace(/\.$/, "").split(/,|;| e (?=[a-zà-ú])/i).map((s) => s.trim()).filter((s) => s && s.length < 40).slice(0, 5)
    .map((s) => s[0].toUpperCase() + s.slice(1));
  const gd = Array.isArray(w.grapes_detail) ? w.grapes_detail : [];
  const grapes = gd.length
    ? gd.map((g) => `${g.grape}${g.pct && gd.length > 1 ? ` ${g.pct}%` : ""}`)
    : clean(w.grape).split(/,|\//).map((s) => s.trim()).filter(Boolean);
  const type = typeLabel(w.wine_type);
  const styleWord = clean(w.style).toLowerCase().replace(type.toLowerCase(), "").trim() || clean(w.body).toLowerCase();
  const header = [type, styleWord].filter(Boolean).join(" • ").toUpperCase();
  const where = w.region || w.country || "";
  const a3 = aromas.slice(0, 3).map((a) => a.label);
  const say = `É um ${type.toLowerCase()}${styleWord ? ` ${styleWord}` : ""}${where ? ` de ${where}` : ""}${grapes.length ? `, feito com ${grapes.map((g) => g.replace(/ \d+%$/, "")).slice(0, 2).join(" e ")}` : ""}${a3.length ? `. Lembra ${a3.join(", ")}` : ""}.`;
  const remember = [wineName(w), [styleWord || type.toLowerCase(), where, a3[0]].filter(Boolean).join(" + ")].join(" = ");
  const maturation = clip(clean(w.aging), 150) || (w.oak_months ? `${String(w.oak_months).replace(".", ",")} meses em carvalho` : "");
  const price = w.sale_price ? `R$ ${Number(w.sale_price).toFixed(0)}` : "";
  const code = clean(w.internal_code);
  return { header, aromas: aromas.slice(0, 8), mouth, temp, dishes, grapes, say, remember, price, maturation, code };
}
