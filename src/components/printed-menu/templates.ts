export type TemplateKey = "classic" | "twocol" | "minimal" | "casual";

export type TemplateDef = {
  key: TemplateKey;
  label: string;
  desc: string;
  columns: 1 | 2;
  // classes aplicadas dentro da folha (sempre preto sobre branco)
  page: string;
  headerTitle: string;
  headerSubtitle: string;
  sectionTitle: string;
  itemName: string;
  itemMeta: string;
  itemPrice: string;
  dotted: boolean;
  rule: string;
};

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  classic: {
    key: "classic",
    label: "Clássico",
    desc: "Serifado, seções em caixa alta, preço com pontilhado.",
    columns: 1,
    page: "font-serif text-[11pt] leading-relaxed",
    headerTitle: "text-center text-[22pt] uppercase tracking-[0.18em]",
    headerSubtitle: "text-center text-[9pt] uppercase tracking-[0.3em] mt-2",
    sectionTitle: "text-[12pt] uppercase tracking-[0.2em] font-semibold",
    itemName: "text-[11pt] font-semibold",
    itemMeta: "text-[9pt] italic",
    itemPrice: "text-[11pt] font-semibold tabular-nums",
    dotted: true,
    rule: "border-b border-black/60",
  },
  twocol: {
    key: "twocol",
    label: "Duas colunas",
    desc: "Compacto, ideal para cartas longas.",
    columns: 2,
    page: "font-serif text-[9.5pt] leading-snug",
    headerTitle: "text-center text-[18pt] uppercase tracking-[0.14em]",
    headerSubtitle: "text-center text-[8pt] uppercase tracking-[0.26em] mt-1.5",
    sectionTitle: "text-[10pt] uppercase tracking-[0.16em] font-semibold",
    itemName: "text-[9.5pt] font-semibold",
    itemMeta: "text-[8pt]",
    itemPrice: "text-[9.5pt] font-semibold tabular-nums",
    dotted: false,
    rule: "border-b border-black/40",
  },
  minimal: {
    key: "minimal",
    label: "Minimalista",
    desc: "Sem molduras, muito espaço em branco, tipografia leve.",
    columns: 1,
    page: "font-sans text-[10.5pt] leading-loose",
    headerTitle: "text-[20pt] font-light uppercase tracking-[0.24em]",
    headerSubtitle: "text-[8.5pt] uppercase tracking-[0.28em] mt-2 text-black/60",
    sectionTitle: "text-[9pt] uppercase tracking-[0.28em] font-medium text-black/60",
    itemName: "text-[10.5pt] font-medium",
    itemMeta: "text-[8.5pt] text-black/60",
    itemPrice: "text-[10.5pt] tabular-nums",
    dotted: false,
    rule: "",
  },
  casual: {
    key: "casual",
    label: "Casual / Moderno",
    desc: "Tipografia moderna, leve e descontraída, ideal para bistrôs.",
    columns: 1,
    page: "font-sans text-[11pt] leading-relaxed",
    headerTitle: "text-[24pt] font-semibold lowercase tracking-[0.04em]",
    headerSubtitle: "text-[10pt] font-medium tracking-wide mt-2 text-black/70",
    sectionTitle: "text-[11pt] font-bold tracking-wide text-black/80",
    itemName: "text-[11pt] font-semibold",
    itemMeta: "text-[9.5pt] text-black/70",
    itemPrice: "text-[11pt] font-semibold tabular-nums",
    dotted: false,
    rule: "",
  },
};

export const TEMPLATE_LIST = [TEMPLATES.classic, TEMPLATES.twocol, TEMPLATES.minimal, TEMPLATES.casual];

/* ===== Tamanhos de papel ===== */
export type PaperKey = "a4" | "a5" | "letter" | "dl";

export type PaperDef = {
  key: PaperKey;
  code: string;
  dims: string;
  widthMm: number;
  heightMm: number;
  /** margem interna da folha */
  padMm: number;
  cssSize: string;
};

export const PAPERS: Record<PaperKey, PaperDef> = {
  a4: { key: "a4", code: "A4", dims: "21,0 × 29,7 cm", widthMm: 210, heightMm: 297, padMm: 14, cssSize: "210mm 297mm" },
  a5: { key: "a5", code: "A5", dims: "14,8 × 21,0 cm", widthMm: 148, heightMm: 210, padMm: 10, cssSize: "148mm 210mm" },
  letter: {
    key: "letter",
    code: "Carta / Letter",
    dims: "21,6 × 27,9 cm",
    widthMm: 216,
    heightMm: 279,
    padMm: 14,
    cssSize: "216mm 279mm",
  },
  dl: {
    key: "dl",
    code: "DL / Slim",
    dims: "9,9 × 21,0 cm",
    widthMm: 99,
    heightMm: 210,
    padMm: 8,
    cssSize: "99mm 210mm",
  },
};

export const PAPER_LIST = [PAPERS.a4, PAPERS.a5, PAPERS.letter, PAPERS.dl];

export const paperOf = (k: string | null | undefined): PaperDef => PAPERS[(k as PaperKey) ?? "a4"] ?? PAPERS.a4;

/** Papel com dimensões definidas pelo usuário (em mm). */
export function customPaper(widthMm: number, heightMm: number, padMm = 12): PaperDef {
  const w = Math.min(Math.max(Number(widthMm) || 210, 60), 420);
  const h = Math.min(Math.max(Number(heightMm) || 297, 80), 594);
  const pad = Math.min(Math.max(Number(padMm) || 0, 0), 40);
  return {
    key: "a4",
    code: "Personalizado",
    dims: `${w.toString().replace(".", ",")} × ${h.toString().replace(".", ",")} mm`,
    widthMm: w,
    heightMm: h,
    padMm: pad,
    cssSize: `${w}mm ${h}mm`,
  };
}

/** Espaçamento das linhas de informação abaixo do nome do rótulo (em pt). */
export type MenuSpacing = {
  /** distância entre o nome do rótulo e a primeira linha de informação */
  nameGap: number;
  /** distância entre as linhas de informação */
  lineGap: number;
  /** distância entre um rótulo e o próximo */
  itemGap: number;
};

export const DEFAULT_SPACING: MenuSpacing = { nameGap: 1, lineGap: 1, itemGap: 8 };

export type MenuLayout = {
  sectionAlign: "left" | "center" | "right";
  itemAlign: "left" | "center" | "right";
  pricePosition: "near" | "far";
  headerAlign: "left" | "center" | "right";
};

export const DEFAULT_LAYOUT: MenuLayout = {
  sectionAlign: "left",
  itemAlign: "left",
  pricePosition: "far",
  headerAlign: "center",
};

export type PageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const DEFAULT_PAGE_MARGINS: PageMargins = { top: 14, right: 14, bottom: 14, left: 14 };

/* ===== Tipografia ajustável ===== */
export type FontKey = "serif" | "sans" | "slab" | "mono" | "script";

export const FONT_LIST: { key: FontKey; label: string; css: string }[] = [
  { key: "serif", label: "Serifada", css: 'Georgia, "Times New Roman", serif' },
  { key: "sans", label: "Sem serifa", css: '"Segoe UI", Helvetica, Arial, sans-serif' },
  { key: "slab", label: "Slab / Display", css: '"Rockwell", "Courier New", Georgia, serif' },
  { key: "mono", label: "Monoespaçada", css: '"Courier New", monospace' },
  { key: "script", label: "Cursiva / Script", css: '"Segoe Script", "Brush Script MT", cursive' },
];

export const fontCss = (k: FontKey | undefined): string | undefined =>
  k ? FONT_LIST.find((f) => f.key === k)?.css : undefined;

export type MenuTypography = {
  nameFont?: FontKey;
  nameSize?: number;
  sectionFont?: FontKey;
  sectionSize?: number;
  metaFont?: FontKey;
  metaSize?: number;
  priceFont?: FontKey;
  priceSize?: number;
};

export const DEFAULT_TYPOGRAPHY: MenuTypography = {};

export type VisibleFields = {
  code: boolean;
  producer: boolean;
  vintage: boolean;
  /** compatibilidade: região + país juntos */
  origin: boolean;
  country: boolean;
  region: boolean;
  grape: boolean;
  volume: boolean;
  price: boolean;
};

export const DEFAULT_VISIBLE_FIELDS: VisibleFields = {
  code: false,
  producer: true,
  vintage: true,
  origin: true,
  country: true,
  region: true,
  grape: false,
  volume: true,
  price: true,
};

/** Normaliza cartas antigas que só tinham o campo "origin". */
export function normalizeFields(raw: Partial<VisibleFields> | null | undefined): VisibleFields {
  const f = { ...DEFAULT_VISIBLE_FIELDS, ...(raw ?? {}) };
  if (raw && raw.country === undefined && raw.region === undefined) {
    f.country = !!raw.origin;
    f.region = !!raw.origin;
  }
  return f;
}

export type MenuSection = { id: string; title: string; wineIds: string[] };

export type MenuWine = {
  id: string;
  name: string;
  internal_code?: string | null;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  appellation: string | null;
  country: string | null;
  grape: string | null;
  wine_type: string | null;
  style?: string | null;
  volume: string | null;
  sale_price: number | null;
  active_on_menu: boolean | null;
};

const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto",
  white: "Branco",
  rose: "Rosé",
  sparkling: "Espumante",
  dessert: "Fortificado",
  fortified: "Fortificado",
};

export function typeLabel(t: string | null): string {
  if (!t) return "Outros";
  return LEGACY_TYPE_MAP[t] ?? t;
}

export const isGlassVol = (v: string | null | undefined) => !!v && /taça|taca|glass/i.test(v);

const SECTION_ORDER = ["Espumante", "Branco", "Rosé", "Tinto", "Fortificado", "Outros", "Vinhos em taça"];

// Agrupamento automático por tipo, com "Vinhos em taça" separado.
export type GroupMode = "type" | "style";

export function sectionKey(w: MenuWine, mode: GroupMode = "type"): string {
  if (isGlassVol(w.volume)) return "Vinhos em taça";
  if (mode === "style" && w.style && w.style.trim()) return w.style.trim();
  return typeLabel(w.wine_type);
}

export function autoSections(wines: MenuWine[], mode: GroupMode = "type"): MenuSection[] {
  const buckets = new Map<string, string[]>();
  const typeOf = new Map<string, string>();
  for (const w of wines) {
    const key = sectionKey(w, mode);
    if (!typeOf.has(key)) typeOf.set(key, isGlassVol(w.volume) ? "Vinhos em taça" : typeLabel(w.wine_type));
    const arr = buckets.get(key) ?? [];
    arr.push(w.id);
    buckets.set(key, arr);
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(typeOf.get(a) ?? a);
    const ib = SECTION_ORDER.indexOf(typeOf.get(b) ?? b);
    return (ia === -1 ? 50 : ia) - (ib === -1 ? 50 : ib) || a.localeCompare(b);
  });
  return keys.map((k) => ({ id: `sec-${k}`, title: k, wineIds: buckets.get(k)! }));
}

export function formatPrice(v: number | null | undefined, decimals = true, currency = false): string {
  if (v == null) return "";
  const d = decimals ? 2 : 0;
  const value = Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return currency ? `R$ ${value}` : value;
}

export function wineMetaFirstLine(w: MenuWine, f: VisibleFields): string {
  const parts: string[] = [];
  if (f.producer && w.producer) parts.push(w.producer);
  if (f.vintage && w.vintage) parts.push(String(w.vintage));
  const originBits: string[] = [];
  if (f.region && (w.appellation || w.region)) originBits.push((w.appellation || w.region)!);
  if (f.country && w.country) originBits.push(w.country);
  if (originBits.length) parts.push(originBits.join(", "));
  if (f.volume && w.volume) parts.push(w.volume);
  return parts.join(" · ");
}

export function wineMetaGrapeLine(w: MenuWine, f: VisibleFields): string | null {
  return f.grape && w.grape ? w.grape : null;
}
