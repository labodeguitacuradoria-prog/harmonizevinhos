/** Preenche a ficha de treinamento a partir dos dados já cadastrados no rótulo (sem IA). */
type W = Record<string, any>;

const clean = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const firstSentence = (s: string, max = 220) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const dot = cut.lastIndexOf(".");
  return (dot > 60 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, "") + "…");
};

function grapesLine(w: W) {
  const det = Array.isArray(w.grapes_detail) ? w.grapes_detail : [];
  const parts = det
    .map((g: any) => {
      const name = clean(g?.name ?? g?.grape ?? g?.variety);
      const pct = g?.pct ?? g?.percent ?? g?.percentage;
      return name ? (pct != null && pct !== "" ? `${name} ${pct}%` : name) : "";
    })
    .filter(Boolean);
  return parts.length ? parts.join(", ") : clean(w.grape);
}

function makingLine(w: W) {
  const isSparkling = /espumante|sparkling/i.test(`${w.wine_type ?? ""} ${w.style ?? ""}`);
  if (isSparkling && clean(w.production_method)) return `Método ${clean(w.production_method)}.`;
  const oak = w.oak_months != null && Number(w.oak_months) > 0 ? `${w.oak_months} meses em madeira` : "";
  const aging = clean(w.aging);
  if (aging || oak) return [aging, oak && !aging.includes(String(w.oak_months)) ? oak : ""].filter(Boolean).join(" · ");
  if (clean(w.elaboration)) return firstSentence(clean(w.elaboration), 300);
  return "";
}

function mouthfeel(w: W) {
  const parts = [clean(w.body) && `corpo ${clean(w.body).toLowerCase()}`, clean(w.sugar_level).toLowerCase()].filter(Boolean);
  return parts.length ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) : "";
}

function pairings(w: W) {
  return clean(w.pairing_notes)
    .split(/[,;\n•]|\.\s/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 2 && s.length <= 120)
    .slice(0, 5);
}

export function prefillTrainingFromWine(w: W) {
  const origin = [clean(w.producer), [clean(w.region), clean(w.appellation), clean(w.country)].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" — ");
  const style = clean(w.style) || clean(w.wine_type);
  const grapes = grapesLine(w);
  const tasting = clean(w.tasting_notes);
  const summaryParts = [
    `${w.name ?? "Este vinho"}${clean(w.producer) ? `, da ${clean(w.producer)}` : ""}${style ? `, é um ${style.toLowerCase()}` : ""}${grapes ? ` feito com ${grapes}` : ""}.`,
    tasting ? firstSentence(tasting, 260) : "",
  ].filter(Boolean);
  const pitch = style
    ? `Se o senhor gosta de um ${style.toLowerCase()}, este ${w.name} é uma ótima escolha${clean(w.region) ? ` direto de ${clean(w.region)}` : ""}.`
    : "";
  return {
    compact_summary: summaryParts.join(" ").slice(0, 900),
    grapes_line: grapes.slice(0, 400),
    making_line: makingLine(w).slice(0, 600),
    origin_story: origin.slice(0, 2000),
    name_meaning: "",
    mouthfeel: mouthfeel(w).slice(0, 400),
    pairings: pairings(w),
    sales_pitch: pitch.slice(0, 600),
    fun_fact: Array.isArray(w.awards) && w.awards.length ? `Premiado: ${w.awards.slice(0, 3).join("; ")}`.slice(0, 800) : "",
    do_not_confuse: "",
  };
}
