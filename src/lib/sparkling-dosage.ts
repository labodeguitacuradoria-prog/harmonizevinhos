/**
 * Dosagem de açúcar dos espumantes (Nature, Extra Brut, Brut, Sec, Demi-Sec, Doce/Moscatel).
 * Espumantes não usam a escala dos vinhos tranquilos (Seco, Meio-seco, Suave, Doce):
 * um Brut com 10 g/L não é "Seco". Ordem de confiança: nome do rótulo > estilo > g/L > valor salvo.
 */
export const SPARKLING_SUGAR_TABLE: { label: string; short: string; max: number }[] = [
  { label: "Nature / Brut Nature", short: "Nature", max: 3 },
  { label: "Extra Brut", short: "Extra Brut", max: 8 },
  { label: "Brut", short: "Brut", max: 15 },
  { label: "Sec / Seco / Extra Sec", short: "Sec", max: 20 },
  { label: "Demi-Sec / Meio-Doce", short: "Demi-Sec", max: 60 },
  { label: "Doce / Doux / Moscatel", short: "Doce", max: Infinity },
];
export const SPARKLING_SUGAR_LABELS = SPARKLING_SUGAR_TABLE.map((t) => t.label);
const [NATURE, EXTRA_BRUT, BRUT, SEC, DEMI_SEC, DOCE] = SPARKLING_SUGAR_LABELS;

/** Classificação pelo açúcar residual (g/L). */
export function classifySparklingSugar(g: number | null | undefined): string | null {
  if (g == null || !Number.isFinite(g) || g < 0) return null;
  for (const row of SPARKLING_SUGAR_TABLE) if (g <= row.max) return row.label;
  return null;
}

const fold = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const MOSCATEL_RX = /\b(moscatel|moscato|muscat|asti)\b/;

/** Dosagem escrita no texto (nome do rótulo, estilo), ou null quando não há menção. */
export function dosageFromText(text: string | null | undefined): string | null {
  const t = fold(text);
  if (!t) return null;
  if (/\b(brut\s+nature|nature|pet[\s-]?nat|pas\s+dose|dosage\s+zero|zero\s+dosage|non\s+dosato|sem\s+dosagem|nao\s+dosado)\b/.test(t)) return NATURE;
  if (/\bextra[\s-]?brut\b/.test(t)) return EXTRA_BRUT;
  if (/\bbrut\b/.test(t)) return BRUT;
  if (/\b(demi[\s-]?sec|meio[\s-]?doce|meio[\s-]?seco|semi[\s-]?seco|semi[\s-]?secco|amabile|demi[\s-]?doux)\b/.test(t)) return DEMI_SEC;
  if (/\b(doce|doux|dolce|dulce|suave)\b/.test(t) || MOSCATEL_RX.test(t)) return DOCE;
  if (/\b(extra[\s-]?(sec|seco|secco|dry)|sec|secco|dry)\b/.test(t)) return SEC;
  return null;
}

/** Converte um valor salvo (inclusive a escala antiga dos vinhos tranquilos) para a dosagem do espumante. */
function fromSavedValue(v: string | null | undefined): string | null {
  const t = fold(v).trim();
  if (!t) return null;
  const exact = SPARKLING_SUGAR_TABLE.find((r) => fold(r.label) === t || fold(r.short) === t);
  if (exact) return exact.label;
  if (t === "seco") return null; // "Seco" vem da escala de vinhos tranquilos: não serve como dosagem.
  if (t === "meio-seco" || t === "meio seco") return DEMI_SEC;
  if (t === "suave" || t === "doce") return DOCE;
  return dosageFromText(t);
}

export type DosageInput = {
  name?: string | null;
  style?: string | null;
  sugar_level?: string | null;
  sugar_g_l?: number | null;
};

/**
 * Dosagem correta de um espumante, no formato das opções do cadastro.
 * Retorna null quando nada no cadastro permite afirmar a dosagem.
 */
export function sparklingDosage(w: DosageInput): string | null {
  return (
    dosageFromText(w.name) ??
    dosageFromText(w.style) ??
    classifySparklingSugar(w.sugar_g_l) ??
    fromSavedValue(w.sugar_level)
  );
}

/** Texto curto para fichas e guias: "Nature", "Brut", "Demi-Sec", "Moscatel"... */
export function dosageShortLabel(label: string | null | undefined, name?: string | null): string {
  if (!label) return "";
  const row = SPARKLING_SUGAR_TABLE.find((r) => r.label === label);
  if (!row) return label;
  if (row.label === DOCE && MOSCATEL_RX.test(fold(name))) return "Moscatel";
  return row.short;
}

export function isSparkling(type: string | null | undefined) {
  return /espumante|sparkling|champagne|cava|prosecco/.test(fold(type));
}
