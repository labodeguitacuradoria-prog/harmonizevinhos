export type TemplateKey = "classic" | "twocol" | "minimal";

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
};

export const TEMPLATE_LIST = [TEMPLATES.classic, TEMPLATES.twocol, TEMPLATES.minimal];

export type VisibleFields = {
  producer: boolean;
  vintage: boolean;
  origin: boolean;
  grape: boolean;
  volume: boolean;
  price: boolean;
};

export const DEFAULT_VISIBLE_FIELDS: VisibleFields = {
  producer: true,
  vintage: true,
  origin: true,
  grape: false,
  volume: true,
  price: true,
};

export type MenuSection = { id: string; title: string; wineIds: string[] };

export type MenuWine = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  appellation: string | null;
  country: string | null;
  grape: string | null;
  wine_type: string | null;
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
export function autoSections(wines: MenuWine[]): MenuSection[] {
  const buckets = new Map<string, string[]>();
  for (const w of wines) {
    const key = isGlassVol(w.volume) ? "Vinhos em taça" : typeLabel(w.wine_type);
    const arr = buckets.get(key) ?? [];
    arr.push(w.id);
    buckets.set(key, arr);
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? 50 : ia) - (ib === -1 ? 50 : ib) || a.localeCompare(b);
  });
  return keys.map((k) => ({ id: `sec-${k}`, title: k, wineIds: buckets.get(k)! }));
}

export function formatPrice(v: number | null | undefined): string {
  if (v == null) return "";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function wineMeta(w: MenuWine, f: VisibleFields): string {
  const parts: string[] = [];
  if (f.producer && w.producer) parts.push(w.producer);
  if (f.vintage && w.vintage) parts.push(String(w.vintage));
  if (f.grape && w.grape) parts.push(w.grape);
  if (f.origin) {
    const origin = [w.appellation || w.region, w.country].filter(Boolean).join(", ");
    if (origin) parts.push(origin);
  }
  if (f.volume && w.volume) parts.push(w.volume);
  return parts.join(" · ");
}
