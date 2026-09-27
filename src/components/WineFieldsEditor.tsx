import React, { useEffect, useState } from "react";
import { Trash2, Plus, Sparkles, FileText, ExternalLink, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MediaUploader, MediaGallery } from "@/components/MediaUploader";
import SlideshowCreator from "@/components/SlideshowCreator";
import { WineAiExtractor } from "@/components/WineAiExtractor";
import { NumberInput } from "@/components/NumberInput";
import type { ExtractedWine } from "@/lib/wine-extraction.functions";

// ============================================================
// Ficha cadastral compartilhada (Catálogo Global + Restaurante)
// ============================================================

export type Video = { title: string; url: string };
export type GrapeRow = { grape: string; pct: number | null; mesesBarrica: number | null };
export type SommelierWeights = {
  corpo: number | null;
  acidez: number | null;
  taninos: number | null;
  docura: number | null;
  estagioBarrica: number | null;
  intensidadeAromatica: number | null;
};

export type WineFields = {
  name?: string | null;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  appellation?: string | null;
  country?: string | null;
  grape?: string | null;
  wine_type?: string | null;
  style?: string | null;
  volume?: string | null;
  suppliers?: string[] | null;
  barcode?: string | null;
  alcohol_pct?: number | null;
  sugar_level?: string | null;
  sugar_g_l?: number | null;
  body?: string | null;
  tannin?: string | null;
  acidity?: string | null;
  acidity_g_l?: number | null;
  acidity_ph?: number | null;
  elaboration?: string | null;
  aging?: string | null;
  serving_temp_min?: number | null;
  serving_temp_max?: number | null;
  tasting_notes?: string | null;
  pairing_notes?: string | null;
  awards?: string[] | null;
  image_url?: string | null;
  gallery_urls?: string[] | null;
  tech_sheet_url?: string | null;
  videos?: Video[] | null;
  grapes_detail?: GrapeRow[] | null;
  oak_months?: number | null;
  production_method?: string | null;
  source_text?: string | null;
  source_file_url?: string | null;
  extracted_by_ai?: boolean | null;
  extraction_notes?: string | null;
  sommelier_weights?: SommelierWeights | null;
  suggested_retail_price?: number | null;
  [key: string]: unknown;
};

export const TYPES = ["Espumante", "Branco", "Rosé", "Tinto", "Fortificado", "Sobremesa", "Outros"];
export const STYLES = [
  "ESPUMANTE",
  "BRANCO LEVE",
  "BRANCO AROMÁTICO",
  "BRANCO ENCORPADO",
  "ROSÉ",
  "TINTO LEVE",
  "TINTO MÉDIO",
  "TINTO ENCORPADO",
  "FORTIFICADO",
];
export const SUGAR_LEVELS = ["Seco", "Meio-seco", "Suave", "Doce"];
export const INTENSITY = ["Baixo", "Médio", "Alto"];
export const BODY = ["Leve", "Médio", "Encorpado"];
export const VOLUMES = ["750 ml", "375 ml", "187 ml", "1500 ml", "Taça", "Outro"];

const SPARKLING_SUGAR_TABLE: { label: string; max: number }[] = [
  { label: "Nature / Brut Nature", max: 3 },
  { label: "Extra Brut", max: 8 },
  { label: "Brut", max: 15 },
  { label: "Sec / Seco / Extra Sec", max: 20 },
  { label: "Demi-Sec / Meio-Doce", max: 60 },
  { label: "Doce / Doux / Moscatel", max: Infinity },
];
export const SPARKLING_SUGAR_LABELS = SPARKLING_SUGAR_TABLE.map((t) => t.label);

export function classifySparklingSugar(g: number | null | undefined): string | null {
  if (g == null || !Number.isFinite(g)) return null;
  for (const row of SPARKLING_SUGAR_TABLE) if (g <= row.max) return row.label;
  return null;
}

export function toProxiedFileUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return `/api/public/catalog-file?u=${encodeURIComponent(u)}`;
}

export const SOMMELIER_AXES: { key: keyof SommelierWeights; label: string; min: string; max: string }[] = [
  { key: "corpo", label: "Corpo / Peso", min: "Leve", max: "Encorpado" },
  { key: "acidez", label: "Acidez / Frescor", min: "Plana", max: "Vibrante" },
  { key: "taninos", label: "Taninos / Estrutura", min: "Nulo", max: "Forte" },
  { key: "docura", label: "Doçura / Residual", min: "Seco", max: "Doce" },
  { key: "estagioBarrica", label: "Estágio em Barrica", min: "Sem madeira", max: "Muito amadeirado" },
  { key: "intensidadeAromatica", label: "Intensidade Aromática", min: "Delicado", max: "Exuberante" },
];

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <span>{children}</span>
      <span title={hint} className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center text-muted-foreground/60 hover:text-primary">
        <Info className="h-3 w-3" />
      </span>
    </label>
  );
}

export function Input({ label, hint, value, onChange, placeholder, className }: { label: string; hint: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40" />
    </div>
  );
}

export function TextArea({ label, hint, value, onChange, placeholder, className }: { label: string; hint: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40" />
    </div>
  );
}

export function Select({ label, hint, value, onChange, options, className }: { label: string; hint: string; value: string; onChange: (v: string) => void; options: string[]; className?: string }) {
  const [customMode, setCustomMode] = useState(false);
  const normalized = value.trim();
  const custom = customMode || (normalized !== "" && !options.includes(normalized));
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select value={custom ? "__custom" : normalized} onChange={(e) => {
        if (e.target.value === "__custom") { setCustomMode(true); return; }
        setCustomMode(false);
        onChange(e.target.value);
      }}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="">Selecione...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">Outro (digitar)</option>
      </select>
      {custom && (
        <input value={value} onChange={(e) => onChange(e.target.value.replace(/^\s+/, ""))} placeholder="Digite o valor (pode ter mais de uma palavra)"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
      )}
    </div>
  );
}

export function SupplierAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; trade_name: string | null; status: string }[]>([]);
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("supplier_catalog")
        .select("id, name, trade_name, status")
        .or(`name.ilike.%${q}%,trade_name.ilike.%${q}%`)
        .eq("status", "approved")
        .limit(8);
      if (!cancelled) setResults(data ?? []);
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);
  return (
    <div className="relative flex-1">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Ex: Mistral, World Wine..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(r.trade_name || r.name); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span>{r.trade_name || r.name}</span>
              {r.trade_name && r.name !== r.trade_name && <span className="text-xs text-muted-foreground">{r.name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Aplica o resultado da extração por IA em cima do item atual.
export function applyExtractedToWine(item: WineFields, e: ExtractedWine, meta?: { sourceFileUrl?: string; mimeType?: string }): WineFields {
  const awards: string[] = Array.isArray(item.awards) ? item.awards : [];
  const grapeSummary = e.grapes.map((g) => (g.pct != null ? `${g.grape} ${g.pct}%` : g.grape)).join(", ");
  const typeMap: Record<string, string> = {
    Tinto: "Tinto", Branco: "Branco", Espumante: "Espumante",
    Rosé: "Rosé", Rose: "Rosé", Doce: "Sobremesa", Fortificado: "Fortificado",
  };
  const avgOak = e.grapes.length
    ? e.grapes.reduce((s, g) => s + (g.mesesBarrica ?? 0) * ((g.pct ?? 0) / 100), 0)
    : null;
  const isPdf = (meta?.mimeType ?? "").includes("pdf");
  const isImage = (meta?.mimeType ?? "").startsWith("image/");
  const nextAwards = e.premiacoes && e.premiacoes.length ? e.premiacoes.slice(0, 10) : awards;
  return {
    ...item,
    name: item.name || e.rotulo || "",
    producer: item.producer || e.produtor || null,
    country: item.country || e.pais || null,
    region: item.region || e.regiao || null,
    appellation: item.appellation || e.denominacao || null,
    vintage: item.vintage || e.safra || null,
    wine_type: e.tipo ? (typeMap[e.tipo] ?? e.tipo) : item.wine_type ?? null,
    style: e.estilo || item.style || null,
    grape: grapeSummary || item.grape || null,
    grapes_detail: e.grapes.length ? (e.grapes as GrapeRow[]) : item.grapes_detail ?? null,
    oak_months: e.mesesBarrica ?? (avgOak && avgOak > 0 ? Number(avgOak.toFixed(1)) : item.oak_months ?? null),
    production_method: e.metodoProducao || item.production_method || null,
    alcohol_pct: e.alcool ?? item.alcohol_pct ?? null,
    sugar_g_l: e.acucar ?? item.sugar_g_l ?? null,
    acidity_g_l: e.acidezVal ?? item.acidity_g_l ?? null,
    acidity_ph: e.ph ?? item.acidity_ph ?? null,
    sugar_level: e.nivelAcucar || item.sugar_level || null,
    body: e.conceitoCorpo || item.body || null,
    tannin: e.conceitoTaninos || item.tannin || null,
    acidity: e.conceitoAcidez || item.acidity || null,
    elaboration: e.elaboracao || item.elaboration || null,
    aging: e.maturacao || item.aging || null,
    serving_temp_min: e.tempServicoMin ?? item.serving_temp_min ?? null,
    serving_temp_max: e.tempServicoMax ?? item.serving_temp_max ?? null,
    pairing_notes: e.harmonizacao || item.pairing_notes || null,
    awards: nextAwards,
    tasting_notes: e.informacoes_tecnicas || item.tasting_notes || null,
    extraction_notes: e.informacoes_tecnicas ?? item.extraction_notes ?? null,
    source_text: e.texto_original ?? item.source_text ?? null,
    sommelier_weights: e.pesos ?? item.sommelier_weights ?? null,
    image_url: item.image_url || e.imagemUrl || (isImage ? meta?.sourceFileUrl : undefined) || null,
    tech_sheet_url: item.tech_sheet_url || (isPdf ? meta?.sourceFileUrl : undefined) || null,
    source_file_url: meta?.sourceFileUrl ?? item.source_file_url ?? null,
    suggested_retail_price: e.precoVendaSugerido ?? item.suggested_retail_price ?? null,
    extracted_by_ai: true,
  };
}

export function WineFieldsEditor({
  tab,
  item,
  onChange,
  mediaFolder = "catalog",
  showExtractor = true,
  showSuggestedPrice = true,
  showSlideshow = false,
  generalTop,
  generalExtras,
  generalPricing,
}: {
  tab: "geral" | "carac" | "midia";
  item: WineFields;
  onChange: (next: WineFields) => void;
  mediaFolder?: string;
  showExtractor?: boolean;
  /** Preço sugerido ao consumidor é exclusivo do catálogo global. */
  showSuggestedPrice?: boolean;
  /** Criação de vídeo com a galeria: exclusiva do cadastro global. */
  showSlideshow?: boolean;
  /** Bloco acima da grade (ex: busca no catálogo global). */
  generalTop?: React.ReactNode;
  /** Campos exclusivos do restaurante (código interno, status...). */
  generalExtras?: React.ReactNode;
  /** Campos de preço exclusivos do restaurante (custo/venda). */
  generalPricing?: React.ReactNode;
}) {
  const set = <K extends keyof WineFields>(k: K, v: WineFields[K]) => onChange({ ...item, [k]: v });
  const videos: Video[] = Array.isArray(item.videos) ? item.videos : [];
  const suppliers: string[] = Array.isArray(item.suppliers) ? item.suppliers : [];
  const awards: string[] = Array.isArray(item.awards) ? item.awards : [];

  function setVideo(idx: number, v: Partial<Video>) {
    const next = [...videos];
    next[idx] = { ...next[idx], ...v };
    set("videos", next);
  }
  function addVideo() { set("videos", [...videos, { title: "", url: "" }]); }
  function removeVideo(i: number) { set("videos", videos.filter((_, k) => k !== i)); }

  function setSupplier(idx: number, v: string) {
    const next = [...suppliers]; next[idx] = v; set("suppliers", next);
  }
  function addSupplier() { set("suppliers", [...suppliers, ""]); }
  function removeSupplier(i: number) { set("suppliers", suppliers.filter((_, k) => k !== i)); }

  function setAward(idx: number, v: string) {
    const next = [...awards]; next[idx] = v; set("awards", next);
  }
  function addAward() { if (awards.length < 10) set("awards", [...awards, ""]); }
  function removeAward(i: number) { set("awards", awards.filter((_, k) => k !== i)); }

  const grapes: GrapeRow[] = Array.isArray(item.grapes_detail) ? item.grapes_detail : [];
  const grapesTotalPct = grapes.reduce((s, g) => s + (Number(g.pct) || 0), 0);
  function updateGrapes(next: GrapeRow[]) {
    const summary = next.map((g) => (g.pct != null ? `${g.grape} ${g.pct}%` : g.grape)).filter(Boolean).join(", ");
    const avg = next.reduce((s, g) => s + (Number(g.mesesBarrica) || 0) * ((Number(g.pct) || 0) / 100), 0);
    onChange({
      ...item,
      grapes_detail: next,
      ...(summary ? { grape: summary } : {}),
      ...(avg > 0 ? { oak_months: Number(avg.toFixed(1)) } : {}),
    });
  }
  function setGrape(i: number, patch: Partial<GrapeRow>) {
    updateGrapes(grapes.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  }
  function addGrape() { updateGrapes([...grapes, { grape: "", pct: null, mesesBarrica: 0 }]); }
  function removeGrape(i: number) { updateGrapes(grapes.filter((_, k) => k !== i)); }

  const weights: SommelierWeights = item.sommelier_weights ?? {
    corpo: null, acidez: null, taninos: null, docura: null, estagioBarrica: null, intensidadeAromatica: null,
  };
  function setWeight(key: keyof SommelierWeights, v: number) {
    set("sommelier_weights", { ...weights, [key]: v });
  }

  if (tab === "geral") {
    return (
      <div className="space-y-4">
        {showExtractor && <WineAiExtractor onExtracted={(e, meta) => onChange(applyExtractedToWine(item, e, meta))} />}
        {generalTop}
        {item.extracted_by_ai && (
          <div className="flex items-center gap-2 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/5 px-3 py-2 text-xs text-[#D4AF37]">
            <Sparkles className="h-3 w-3" />
            Dados preenchidos pela IA — revise antes de salvar.
            {item.source_text && (
              <button
                type="button"
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (w) w.document.write(`<pre style="font-family:monospace;padding:20px;white-space:pre-wrap;background:#0b0b0b;color:#eee;">${(item.source_text ?? "").replace(/</g, "&lt;")}</pre>`);
                }}
                className="ml-auto flex items-center gap-1 underline"
              >
                <FileText className="h-3 w-3" /> ver texto original
              </button>
            )}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Nome*" hint="Nome do rótulo como aparece no contra-rótulo, sem produtor/safra." placeholder="Ex: Alpha Cabernet Sauvignon" value={item.name ?? ""} onChange={(v) => set("name", v)} />
          <Input label="Produtor" hint="Vinícola responsável pela elaboração." placeholder="Ex: Viña Montes" value={item.producer ?? ""} onChange={(v) => set("producer", v)} />
          <NumberInput label="Safra" hint="Ano da colheita. Vazio para NV." placeholder="Ex: 2020" value={item.vintage ?? null} onChange={(v) => set("vintage", v != null ? Math.trunc(v) : null)} />
          <Input label="Região" hint="Região vitivinícola ou DO." placeholder="Ex: Vale do Colchagua" value={item.region ?? ""} onChange={(v) => set("region", v)} />
          <Input label="País" hint="País de origem." placeholder="Ex: Chile" value={item.country ?? ""} onChange={(v) => set("country", v)} />
          <Input label="AOP / Denominação" hint="Somente vinhos europeus. França: AOP/AOC; Itália: DOC/DOCG; Espanha: DO/DOCa; Portugal: DOP/DOC; Alemanha: g.U./Prädikatswein." placeholder="Ex: AOC Saint-Émilion Grand Cru" value={item.appellation ?? ""} onChange={(v) => set("appellation", v)} />
          <div className="rounded-lg border border-[#D4AF37]/40 bg-[#141414] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Blend de Uvas</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${grapesTotalPct === 100 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"}`}>
                {grapesTotalPct}%
              </span>
            </div>
            <div className="space-y-1.5">
              {grapes.map((g, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={g.grape} onChange={(e) => setGrape(i, { grape: e.target.value })} placeholder="Nome da uva"
                    className="flex-1 rounded border border-[#2a2a2a] bg-[#0b0b0b] px-2 py-1.5 text-xs text-white" />
                  <input type="number" min={0} max={100} value={g.pct ?? ""} onChange={(e) => setGrape(i, { pct: e.target.value ? Number(e.target.value) : null })}
                    placeholder="%"
                    className="w-14 rounded border border-[#2a2a2a] bg-[#0b0b0b] px-2 py-1.5 text-center text-xs text-[#D4AF37]" />
                  <button type="button" onClick={() => removeGrape(i)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={addGrape} className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#D4AF37]/50 bg-[#0b0b0b] px-2 py-1.5 text-xs font-medium text-[#D4AF37] hover:bg-[#1a1a1a]">
                <Plus className="h-3 w-3" /> Adicionar uva
              </button>
            </div>
          </div>
          <Select label="Tipo" hint="Categoria geral." value={item.wine_type ?? ""} onChange={(v) => set("wine_type", v)} options={TYPES} />
          <Select label="Estilo" hint="Estilo usado para harmonização." value={item.style ?? ""} onChange={(v) => set("style", v)} options={STYLES} />
          <Select label="Volume" hint="Capacidade da garrafa ou dose (Taça)." value={item.volume ?? ""} onChange={(v) => set("volume", v)} options={VOLUMES} />
          <Input label="Código de barras" hint="EAN / UPC do rótulo." placeholder="7891234567890" value={item.barcode ?? ""} onChange={(v) => set("barcode", v)} />
          {showSuggestedPrice && (
            <NumberInput label="Preço sugerido de venda (R$)" hint="Preço sugerido de venda ao consumidor, quando informado pelo produtor/importador." placeholder="Ex: 189,90" value={item.suggested_retail_price ?? null} onChange={(v) => set("suggested_retail_price", v)} />
          )}
          {generalPricing}

          <div className="md:col-span-2">
            <FieldLabel hint="Fornecedores conhecidos no Brasil. Comece a digitar para buscar no catálogo. Se não existir, o nome será salvo como pendente no cadastro de fornecedores.">Fornecedores</FieldLabel>
            <div className="mt-2 space-y-2">
              {suppliers.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <SupplierAutocomplete value={s} onChange={(v) => setSupplier(i, v)} />
                  <button type="button" onClick={() => removeSupplier(i)} className="rounded p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div>
              ))}
              <button type="button" onClick={addSupplier} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-3 w-3" /> Adicionar fornecedor</button>
            </div>
          </div>
          {generalExtras}
        </div>
      </div>
    );
  }

  if (tab === "carac") {
    return (
      <div className="space-y-5">
        {(item.wine_type === "Espumante" || item.production_method) && (
          <div className="rounded-lg border border-[#D4AF37]/40 bg-[#141414] p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Método de Elaboração (Espumante)</div>
            <div className="flex flex-wrap gap-2">
              {["Tradicional", "Charmat", "Asti", "Outro"].map((m) => {
                const active = (item.production_method ?? "").startsWith(m);
                return (
                  <button key={m} type="button" onClick={() => set("production_method", m)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-bold uppercase transition ${active ? "border-[#D4AF37] bg-[#1a1a1a] text-[#D4AF37]" : "border-[#2a2a2a] text-[#888] hover:text-[#D4AF37]"}`}>
                    {m}
                  </button>
                );
              })}
            </div>
            {(item.production_method ?? "").startsWith("Outro") && (
              <input
                value={item.production_method?.replace(/^Outro:?\s*/, "") ?? ""}
                onChange={(e) => set("production_method", `Outro: ${e.target.value}`)}
                placeholder="Descreva o método"
                className="mt-2 w-full rounded border border-[#2a2a2a] bg-[#0b0b0b] px-2 py-1.5 text-xs text-white"
              />
            )}
          </div>
        )}

        {/* Laudo Químico */}
        <div className="rounded-lg border border-[#D4AF37]/40 bg-[#141414] p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">● Laudo Químico &amp; Analítico (Laboratório)</div>
          <p className="mb-3 text-xs text-muted-foreground">Valores analíticos reais do laudo químico do produtor. Atuam como direcionadores objetivos do painel.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <NumberInput label="Teor alcoólico (%)" hint="Álcool em volume." placeholder="Ex: 13.5" value={item.alcohol_pct ?? null} onChange={(v) => set("alcohol_pct", v)} />
            <NumberInput label="Açúcar residual (g/L)" hint="Açúcar residual g/L." placeholder="Ex: 3.5" value={item.sugar_g_l ?? null} onChange={(v) => set("sugar_g_l", v)} />
            <NumberInput label="Acidez total (g/L)" hint="Acidez total g/L." placeholder="Ex: 5.8" value={item.acidity_g_l ?? null} onChange={(v) => set("acidity_g_l", v)} />
            <NumberInput label="pH do vinho" hint="Valor de pH." placeholder="Ex: 3.4" value={item.acidity_ph ?? null} onChange={(v) => set("acidity_ph", v)} />
          </div>
          {item.wine_type === "Espumante" && (
            <div className="mt-3 rounded-md border border-[#D4AF37]/30 bg-[#0b0b0b] p-2 text-xs">
              <span className="text-muted-foreground">Classificação (espumante): </span>
              <span className="font-bold text-[#D4AF37]">{classifySparklingSugar(item.sugar_g_l ?? null) ?? "—"}</span>
            </div>
          )}
        </div>

        {/* Passagem por Barrica */}
        <div className="rounded-lg border border-[#D4AF37]/40 bg-[#141414] p-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Passagem por Barrica</div>
          <div className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">Estratificação por Casta (Uva)</div>
          {grapes.length === 0 && <p className="text-xs text-muted-foreground">Adicione uvas no bloco de Blend acima.</p>}
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {grapes.map((g, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#0b0b0b] p-3">
                <div>
                  <div className="text-sm font-bold text-white">{g.grape || "—"}</div>
                  <div className="text-xs text-muted-foreground">{g.pct ?? 0}% do Blend</div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} step="0.5" value={g.mesesBarrica ?? 0}
                    onChange={(e) => setGrape(i, { mesesBarrica: e.target.value ? Number(e.target.value) : 0 })}
                    className="w-20 rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2 text-center text-sm text-white" />
                  <span className="text-xs text-muted-foreground">meses</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#2a2a2a] pt-3">
            <span className="text-xs text-muted-foreground">Tempo Geral (Média Ponderada):</span>
            <span className="rounded-md border border-[#D4AF37]/40 bg-[#0b0b0b] px-3 py-1 text-sm font-bold text-[#D4AF37]">
              {(item.oak_months ?? 0).toFixed(1)} meses
            </span>
          </div>
        </div>

        {/* Pesos & Intensidades Sommelier */}
        <div className="rounded-lg border border-[#D4AF37]/40 bg-[#141414] p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Pesos &amp; Intensidades Sommelier (Escala 1 a 10)</div>
          <div className="grid gap-3 md:grid-cols-2">
            {SOMMELIER_AXES.map((axis) => {
              const val = weights[axis.key] ?? 0;
              return (
                <div key={axis.key} className="rounded-md border border-[#2a2a2a] bg-[#0b0b0b] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{axis.label}</span>
                    <span className="rounded border border-[#D4AF37]/40 bg-[#141414] px-2 py-0.5 text-xs font-bold text-[#D4AF37]">{val} / 10</span>
                  </div>
                  <input type="range" min={1} max={10} step={1} value={val || 1}
                    onChange={(e) => setWeight(axis.key, Number(e.target.value))}
                    className="w-full accent-[#D4AF37]" />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{axis.min}</span><span>{axis.max}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Açúcar (conceito)" hint={item.wine_type === "Espumante" ? "Classificação de dulçor para espumantes." : "Classificação por dulçor."} value={item.sugar_level ?? ""} onChange={(v) => set("sugar_level", v)} options={item.wine_type === "Espumante" ? SPARKLING_SUGAR_LABELS : SUGAR_LEVELS} />
          <Select label="Corpo (conceito)" hint="Peso/estrutura na boca." value={item.body ?? ""} onChange={(v) => set("body", v)} options={BODY} />
          <Select label="Taninos (conceito)" hint="Intensidade dos taninos." value={item.tannin ?? ""} onChange={(v) => set("tannin", v)} options={INTENSITY} />
          <Select label="Acidez (conceito)" hint="Percepção de frescor." value={item.acidity ?? ""} onChange={(v) => set("acidity", v)} options={INTENSITY} />
          <TextArea label="Elaboração" hint="Vinificação: fermentação, leveduras, tanques, etc." placeholder="Ex: Fermentação em inox a temperatura controlada..." value={item.elaboration ?? ""} onChange={(v) => set("elaboration", v)} className="md:col-span-2" />
          <TextArea label="Maturação" hint="Envelhecimento: barricas, tempo, guarda em garrafa." placeholder="Ex: 12 meses em carvalho francês (30% novas)." value={item.aging ?? ""} onChange={(v) => set("aging", v)} className="md:col-span-2" />
          <NumberInput label="Temp. mín. serviço (°C)" hint="Temperatura mínima recomendada." placeholder="Ex: 16" value={item.serving_temp_min ?? null} onChange={(v) => set("serving_temp_min", v)} />
          <NumberInput label="Temp. máx. serviço (°C)" hint="Temperatura máxima recomendada." placeholder="Ex: 18" value={item.serving_temp_max ?? null} onChange={(v) => set("serving_temp_max", v)} />
          <TextArea label="Notas de degustação" hint="Cor, aromas, paladar e final." placeholder="Ex: Rubi intenso. Aromas de frutas negras..." value={item.tasting_notes ?? ""} onChange={(v) => set("tasting_notes", v)} className="md:col-span-2" />
          <TextArea label="Harmonização" hint="Sugestões gastronômicas." placeholder="Ex: Carnes vermelhas grelhadas, cordeiro, queijos curados." value={item.pairing_notes ?? ""} onChange={(v) => set("pairing_notes", v)} className="md:col-span-2" />
          <div className="md:col-span-2">
            <FieldLabel hint="Até 10 premiações. Use um campo por prêmio.">Premiações ({awards.length}/10)</FieldLabel>
            <div className="mt-2 space-y-2">
              {awards.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input value={a} onChange={(e) => setAward(i, e.target.value)} placeholder="Ex: 92 pts Wine Spectator 2022"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  <button type="button" onClick={() => removeAward(i)} className="rounded p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div>
              ))}
              {awards.length < 10 && (
                <button type="button" onClick={addAward} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-3 w-3" /> Adicionar premiação</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel hint="Foto principal do rótulo, usada como capa no catálogo.">Imagem principal</FieldLabel>
        <div className="mt-2">
          <MediaUploader label="" value={item.image_url ?? null} onChange={(v) => set("image_url", v)} folder={mediaFolder} />
        </div>
      </div>
      <div>
        <FieldLabel hint="Imagens adicionais: contra-rótulo, garrafa, vinhedo.">Galeria de imagens</FieldLabel>
        <div className="mt-2">
          <MediaGallery label="" values={item.gallery_urls ?? []} onChange={(v) => set("gallery_urls", v)} folder={mediaFolder} />
        </div>
      </div>
      <div>
        <FieldLabel hint="Ficha técnica oficial em PDF, fornecida pelo produtor ou importador.">Ficha técnica (PDF)</FieldLabel>
        <div className="mt-2 space-y-2">
          <MediaUploader label="" value={item.tech_sheet_url ?? null} onChange={(v) => set("tech_sheet_url", v)} accept="application/pdf" folder={`${mediaFolder}/tech`} kind="file" />
          {item.tech_sheet_url && (
            <a href={toProxiedFileUrl(item.tech_sheet_url) ?? "#"} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-[#D4AF37]/40 bg-[#141414] px-3 py-1.5 text-xs font-bold uppercase text-[#D4AF37] hover:bg-[#1a1a1a]">
              <ExternalLink className="h-3 w-3" /> Abrir ficha técnica
            </a>
          )}
        </div>
      </div>
      <div>
        <FieldLabel hint="Vídeos por link (YouTube, Vimeo) ou arquivo enviado do seu computador.">Vídeos</FieldLabel>
        <div className="mt-2 space-y-2">
          {showSlideshow && (
            <SlideshowCreator
              mainImage={item.image_url ?? null}
              gallery={item.gallery_urls ?? []}
              wineName={item.name ?? null}
              folder={`${mediaFolder}/videos`}
              onCreated={(v) => set("videos", [...videos, v])}
            />
          )}
          {videos.map((v, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                <input value={v.title} onChange={(e) => setVideo(i, { title: e.target.value })} placeholder="Título do vídeo"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input value={v.url} onChange={(e) => setVideo(i, { url: e.target.value })} placeholder="https://youtube.com/..."
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <button type="button" onClick={() => removeVideo(i)} className="rounded p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
              <MediaUploader
                label="Ou envie o arquivo do vídeo"
                value={/\.(mp4|webm|mov|m4v)(\?|$)/i.test(v.url ?? "") ? v.url : null}
                onChange={(url) => setVideo(i, { url: url ?? "" })}
                accept="video/*"
                kind="file"
                folder={`${mediaFolder}/videos`}
              />
            </div>
          ))}
          <button type="button" onClick={addVideo} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-3 w-3" /> Adicionar vídeo</button>
        </div>
      </div>
    </div>
  );
}

export function WineFormTabs({ tab, onChange }: { tab: "geral" | "carac" | "midia"; onChange: (t: "geral" | "carac" | "midia") => void }) {
  return (
    <div className="mb-4 flex gap-1 border-b border-border">
      {(["geral", "carac", "midia"] as const).map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          {t === "geral" ? "Geral" : t === "carac" ? "Características" : "Mídia"}
        </button>
      ))}
    </div>
  );
}
