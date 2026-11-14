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

const TYPE_LABEL: Record<string, string> = {
  red: "Tinto",
  white: "Branco",
  rose: "Rosé",
  sparkling: "Espumante",
  dessert: "Sobremesa",
  fortified: "Fortificado",
};
export const TYPE_COLOR: Record<string, [number, number, number]> = {
  red: [128, 0, 32],
  white: [212, 175, 55],
  rose: [214, 110, 130],
  sparkling: [150, 150, 150],
  dessert: [170, 110, 40],
  fortified: [74, 4, 4],
};

export function typeLabel(t: string | null) {
  return (t && TYPE_LABEL[t]) || t || "Vinho";
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
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${opts.title} · ${opts.restaurantName}`, M, H - 9);
    doc.text(String(n), W - M, H - 9, { align: "right" });
    if (withBack && firstIndexPage > 0) {
      const cx = W / 2, cy = H - 10.2;
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.35);
      doc.lines([[2.6, -2.4], [2.6, 2.4]], cx - 2.6, cy, [1, 1], "S");
      doc.rect(cx - 1.8, cy, 3.6, 2.6, "S");
      doc.link(cx - 4, cy - 3.5, 8, 7, { pageNumber: firstIndexPage });
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
        const url = await opts.resolveCustomUrl(photo);
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
    const color = TYPE_COLOR[w.wine_type ?? ""] ?? GOLD;
    const SOFT: [number, number, number] = [color[0] + (255 - color[0]) * 0.88, color[1] + (255 - color[1]) * 0.88, color[2] + (255 - color[2]) * 0.88].map(Math.round) as [number, number, number];
    const DARK: [number, number, number] = [38, 52, 44];
    doc.setFillColor(...color);
    doc.rect(0, 0, W, 13, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(card.header, M, 8.4, { charSpace: 1.2 });
    const num = index.flatMap((e) => e.wines).findIndex((x) => x.id === w.id) + 1;
    const badge = `Nº ${String(num).padStart(3, "0")}`;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(W - M - 20, 3.5, 20, 6.5, 3.2, 3.2, "F");
    doc.setTextColor(...color);
    doc.text(badge, W - M - 10, 8.1, { align: "center" });

    const top = 22;
    const boxW = 66, boxH = 98;
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
      doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text("Sem foto", M + boxW / 2, top + boxH / 2, { align: "center" });
    }

    const x = M + boxW + 9, cw = W - M - x;
    let y = top + 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...GOLD);
    doc.text(producerOf(w).toUpperCase(), x, y, { charSpace: 1 });
    y += 8;
    doc.setFont("times", "bold"); doc.setFontSize(21); doc.setTextColor(...DARK);
    const nl = (doc.splitTextToSize(wineTitle(w), cw) as string[]).slice(0, 3);
    doc.text(nl, x, y); y += nl.length * 7.6;
    const origin = [w.country, [w.region].filter(Boolean).join("")].filter(Boolean).join(" • ");
    if (origin) { doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(doc.splitTextToSize(origin, cw)[0] as string, x, y); y += 5; }
    if (w.appellation) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(doc.splitTextToSize(clean(w.appellation), cw)[0] as string, x, y); y += 5; }
    if (card.price) { y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...color); doc.text(card.price, x, y); y += 7; }
    // pílulas de uvas
    let px = x;
    doc.setFontSize(8.5);
    for (const g of card.grapes.slice(0, 6)) {
      const tw = doc.getTextWidth(g) + 6;
      if (px + tw > W - M) { px = x; y += 7.5; }
      doc.setFillColor(...DARK); doc.roundedRect(px, y - 4.3, tw, 6, 3, 3, "F");
      doc.setTextColor(255, 255, 255); doc.text(g, px + 3, y);
      px += tw + 2;
    }
    if (card.grapes.length) y += 9;
    // tabela rápida
    const row = (k: string, draw: (vx: number) => void) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(k, x, y);
      draw(x + 22);
      doc.setDrawColor(210, 210, 210); doc.setLineDashPattern([0.4, 1], 0); doc.line(x, y + 2.4, W - M, y + 2.4); doc.setLineDashPattern([], 0);
      y += 7.5;
    };
    const txt = (t: string) => (vx: number) => { doc.setFont("helvetica", "normal"); doc.setTextColor(...INK); doc.text(doc.splitTextToSize(t, W - M - vx)[0] as string, vx, y); };
    if (w.body) row("Corpo", (vx) => {
      const d = bodyDots(w.body);
      for (let k = 0; k < 5; k++) { doc.setDrawColor(...color); doc.setFillColor(...color); doc.circle(vx + 1.6 + k * 4.4, y - 1.2, 1.5, k < d ? "FD" : "S"); }
      txt(clean(w.body).toLowerCase())(vx + 24);
    });
    if (w.sugar_level) row("Açúcar", txt(clean(w.sugar_level).toLowerCase()));
    if (card.wood) row("Madeira", txt(card.wood));

    y = Math.max(top + boxH, y) + 9;
    const label = (t: string, lx = M) => { doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text(t, lx, y, { charSpace: 1 }); };
    const pills = (items: string[], lx: number, maxX: number, fill: boolean) => {
      let qx = lx; doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      for (const it of items) {
        const tw = doc.getTextWidth(it) + 7;
        if (qx + tw > maxX) { qx = lx; y += 8; }
        if (fill) { doc.setFillColor(...SOFT); doc.roundedRect(qx, y - 4.6, tw, 6.4, 3.2, 3.2, "F"); }
        else { doc.setDrawColor(...color); doc.roundedRect(qx, y - 4.6, tw, 6.4, 3.2, 3.2, "S"); }
        doc.setTextColor(...INK); doc.text(it, qx + 3.5, y); qx += tw + 2.5;
      }
    };
    if (card.aromas.length) { label("CHEIRO DE..."); y += 7; pills(card.aromas.map((a) => a.label), M, W - M, false); y += 10; }
    if (card.mouth) {
      label("NA BOCA"); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...INK);
      const ml = (doc.splitTextToSize(card.mouth, W - 2 * M) as string[]).slice(0, 2); doc.text(ml, M, y); y += ml.length * 5 + 6;
    }
    if (card.temp || card.dishes.length) {
      const y0 = y; const half = M + (W - 2 * M) * 0.32;
      if (card.temp) { label("SERVIR A"); y += 7; doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(card.temp, M, y); }
      const yT = y; y = y0;
      if (card.dishes.length) { label("COMBINA COM", half); y += 7; pills(card.dishes, half, W - M, true); }
      y = Math.max(yT, y) + 10;
    }
    if (y < H - 50) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(10.5);
      const sl = (doc.splitTextToSize(`“${card.say}”`, W - 2 * M - 10) as string[]).slice(0, 3);
      const bh = 10 + sl.length * 5;
      doc.setFillColor(252, 252, 250); doc.setDrawColor(...DARK); doc.setLineWidth(0.3);
      doc.roundedRect(M, y - 4, W - 2 * M, bh, 2.5, 2.5, "FD");
      label("FALE ASSIM NA MESA", M + 5); y += 6;
      doc.setFont("helvetica", "italic"); doc.setTextColor(...INK); doc.text(sl, M + 5, y);
      y += sl.length * 5 + 8;
    }
    if (y < H - 30) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      const rl = (doc.splitTextToSize(`Para decorar: ${card.remember}`, W - 2 * M - 10) as string[]).slice(0, 2);
      doc.setFillColor(...SOFT); doc.roundedRect(M, y - 4.5, W - 2 * M, 5 + rl.length * 4.8, 2.5, 2.5, "F");
      doc.setTextColor(...INK); doc.text(rl, M + 5, y);
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
  [/nozes|am[eê]ndoa|avel[aã]/i, "frutas secas", "🌰"],
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
  dishes: string[]; grapes: string[]; say: string; remember: string; price: string; wood: string;
};

export function studyCard(w: BookWine): StudyCard {
  const all = `${w.tasting_notes ?? ""} ${w.elaboration ?? ""}`;
  const aromas: { label: string; icon: string }[] = [];
  for (const [rx, label, icon] of AROMAS) if (rx.test(all) && !aromas.some((a) => a.label === label)) aromas.push({ label, icon });
  const wineSent = sentences(w.tasting_notes).filter((s) => !isWinerySentence(s, w.producer));
  const mouth = (wineSent.find((s) => /boca|paladar|final|taninos?|acidez|textura/i.test(s)) ?? wineSent[0] ?? "").slice(0, 170);
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
  const remember = [w.name, [styleWord || type.toLowerCase(), where, a3[0]].filter(Boolean).join(" + ")].join(" = ");
  const wood = w.oak_months ? `${String(w.oak_months).replace(".", ",")} meses em carvalho` : clean(w.aging) || (gd.length && gd.every((g) => !g.mesesBarrica) ? "sem madeira" : "");
  const price = w.sale_price ? `R$ ${Number(w.sale_price).toFixed(0)}` : "";
  return { header, aromas: aromas.slice(0, 6), mouth, temp, dishes, grapes, say, remember, price, wood };
}
