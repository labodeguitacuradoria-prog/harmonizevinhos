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
      doc.setTextColor(...GOLD);
      doc.textWithLink("‹ Voltar ao índice", W / 2, H - 9, { align: "center", pageNumber: firstIndexPage });
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
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.line(W / 2 - 20, 95, W / 2 + 20, 95);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("PRODUTOR", W / 2, 88, { align: "center", charSpace: 1.5 });
      doc.setFont("times", "bold");
      doc.setFontSize(30);
      doc.setTextColor(...INK);
      const title = doc.splitTextToSize(l.producer, W - 2 * M) as string[];
      doc.text(title, W / 2, 112, { align: "center" });
      let y = 112 + title.length * 11 + 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(`${wines.length} ${wines.length === 1 ? "rótulo" : "rótulos"} neste livro`, W / 2, y, { align: "center" });
      y += 12;
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

    // Página do rótulo
    const w = l.wine;
    const color = TYPE_COLOR[w.wine_type ?? ""] ?? GOLD;
    doc.setFillColor(...color);
    doc.rect(0, 0, W, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(typeLabel(w.wine_type).toUpperCase(), M, 7.8, { charSpace: 1.2 });
    const num = index.flatMap((e) => e.wines).findIndex((x) => x.id === w.id) + 1;
    doc.text(`Nº ${String(num).padStart(3, "0")}`, W - M, 7.8, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text(producerOf(w).toUpperCase(), W / 2, 26, { align: "center", charSpace: 1.2 });
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...INK);
    const nameLines = doc.splitTextToSize(wineTitle(w), W - 2 * M) as string[];
    doc.text(nameLines, W / 2, 36, { align: "center" });
    let top = 36 + nameLines.length * 8 + 2;
    const origin = [w.region, w.country].filter(Boolean).join(" · ");
    if (origin) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text(origin, W / 2, top, { align: "center" });
      top += 4;
    }
    top += 6;

    // Foto da garrafa
    const boxW = 60;
    const boxH = 100;
    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(M, top, boxW, boxH, 2, 2, "S");
    const img = w.image_url ? await toDataUrl(w.image_url) : null;
    if (img) {
      const s = Math.min((boxW - 6) / img.w, (boxH - 6) / img.h);
      doc.addImage(img.data, "JPEG", M + (boxW - img.w * s) / 2, top + (boxH - img.h * s) / 2, img.w * s, img.h * s);
    } else {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Sem foto", M + boxW / 2, top + boxH / 2, { align: "center" });
    }

    // Ficha técnica
    const x = M + boxW + 8;
    let y = top + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text("FICHA TÉCNICA", x, y, { charSpace: 1 });
    y += 6;
    for (const [k, v] of techRows(w)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(k, x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...INK);
      const vl = doc.splitTextToSize(v, W - M - x - 30) as string[];
      doc.text(vl, x + 30, y);
      y += Math.max(1, vl.length) * 4.4 + 2;
      if (y > top + boxH) break;
    }

    // Blocos de texto
    y = Math.max(top + boxH, y) + 8;
    const block = (label: string, text: string | null) => {
      if (!text?.trim() || y > H - 40) return;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...GOLD);
      doc.text(label.toUpperCase(), M, y, { charSpace: 1 });
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      const lines = (doc.splitTextToSize(text.trim(), W - 2 * M) as string[]).slice(0, Math.floor((H - 40 - y) / 4.6));
      doc.text(lines, M, y);
      y += lines.length * 4.6 + 6;
    };
    block("Na taça e na boca", w.tasting_notes);
    block("Como é feito", w.elaboration);
    block("Combina com", w.pairing_notes);

    // Espaço para anotações
    if (y < H - 36) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...GOLD);
      doc.text("MINHAS ANOTAÇÕES", M, y, { charSpace: 1 });
      y += 8;
      doc.setDrawColor(225, 225, 225);
      while (y < H - 20) {
        doc.line(M, y, W - M, y);
        y += 8;
      }
    }
    footer(n, true);
  }
  opts.onProgress?.(layout.length, layout.length);
  return { blob: doc.output("blob"), index, pageCount: layout.length };
}
