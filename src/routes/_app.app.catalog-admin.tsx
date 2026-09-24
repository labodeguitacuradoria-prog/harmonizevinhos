import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { enrichWineFromWeb } from "@/lib/wine-enrich.functions";
import { Database, Plus, Edit, Trash2, Info, Check, X as XIcon, Clock, ShieldCheck, Ban, Sparkles, FileText, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Wand2, Loader2, ImageOff, ImageIcon, GraduationCap } from "lucide-react";

import {
  WineFieldsEditor,
  WineFormTabs,
  classifySparklingSugar,
  toProxiedFileUrl,
  type WineFields,
} from "@/components/WineFieldsEditor";
import GlobalTrainingCardEditor from "@/components/training/GlobalTrainingCardEditor";
import TrainingLibraryManager from "@/components/training/TrainingLibraryManager";

export { classifySparklingSugar, toProxiedFileUrl };

export const Route = createFileRoute("/_app/app/catalog-admin")({
  component: CatalogAdmin,
});

type CatalogStatus = "pending" | "approved" | "rejected";

type Video = { title: string; url: string };

type WineCatalog = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  appellation: string | null;
  country: string | null;
  grape: string | null;
  wine_type: string | null;
  style: string | null;
  volume: string | null;
  suppliers: string[] | null;
  barcode: string | null;
  alcohol_pct: number | null;
  sugar_level: string | null;
  sugar_g_l: number | null;
  body: string | null;
  tannin: string | null;
  acidity: string | null;
  acidity_g_l: number | null;
  acidity_ph: number | null;
  elaboration: string | null;
  aging: string | null;
  serving_temp_min: number | null;
  serving_temp_max: number | null;
  tasting_notes: string | null;
  pairing_notes: string | null;
  awards: string[] | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  tech_sheet_url: string | null;
  videos: Video[] | null;
  status: CatalogStatus;
  rejection_reason: string | null;
  grapes_detail: { grape: string; pct: number | null; mesesBarrica: number | null }[] | null;
  oak_months: number | null;
  production_method: string | null;
  source_text: string | null;
  source_file_url: string | null;
  extracted_by_ai: boolean | null;
  extraction_notes: string | null;
  sommelier_weights: {
    corpo: number | null;
    acidez: number | null;
    taninos: number | null;
    docura: number | null;
    estagioBarrica: number | null;
    intensidadeAromatica: number | null;
  } | null;
  suggested_retail_price: number | null;
};

function CatalogAdmin() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<WineCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<CatalogStatus | "duplicates">("pending");
  const [editing, setEditing] = useState<Partial<WineCatalog> | null>(null);
  const [initialTab, setInitialTab] = useState<"geral" | "carac" | "midia" | "training">("geral");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cardStatus, setCardStatus] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const enrich = useServerFn(enrichWineFromWeb);


  const [filters, setFilters] = useState({
    name: "",
    producer: "",
    completeness: "",
    vintage: "",
    typeStyle: "",
  });
  const setF = (k: keyof typeof filters, v: string) => setFilters(p => ({ ...p, [k]: v }));

  useEffect(() => { fetchCatalog(); }, []);

  async function fetchCatalog() {
    setLoading(true);
    const [{ data }, { data: cards }] = await Promise.all([
      supabase.from("wine_catalog").select("*").order("created_at", { ascending: false }),
      supabase.from("global_wine_story_cards").select("catalog_id, status"),
    ]);
    const map: Record<string, string> = {};
    (cards ?? []).forEach((c: any) => { map[c.catalog_id] = c.status; });
    setCardStatus(map);
    if (data) setItems(data as any);
    setLoading(false);
  }

  async function handleSave() {
    if (!editing || !editing.name) {
      alert("Nome é obrigatório.");
      return;
    }
    // Duplicate check — same normalized name+producer+vintage should not create a second entry.
    const norm = (s: string | null | undefined) =>
      (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const nName = norm(editing.name);
    const nProd = norm(editing.producer);
    const nVint = editing.vintage ?? null;
    const dupes = items.filter((i) => {
      if (editing.id && i.id === editing.id) return false;
      if (norm(i.name) !== nName) return false;
      if (nProd && norm(i.producer) && norm(i.producer) !== nProd) return false;
      if (nVint != null && i.vintage != null && i.vintage !== nVint) return false;
      return true;
    });
    if (dupes.length > 0) {
      const list = dupes
        .slice(0, 5)
        .map((d) => `• ${d.name}${d.producer ? " — " + d.producer : ""}${d.vintage ? " (" + d.vintage + ")" : ""} [${d.status}]`)
        .join("\n");
      const ok = confirm(
        `Já existe(m) ${dupes.length} rótulo(s) similar(es) no catálogo:\n\n${list}\n\nDeseja salvar mesmo assim como um novo rótulo? Cancele para editar o existente e evitar duplicidade.`,
      );
      if (!ok) return;
    }
    const rest: any = { ...editing };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    delete rest.approved_at;
    delete rest.submitted_by;
    delete rest.source_restaurant_id;
    const payload: any = rest;
    if (editing.id) {
      const { error, data } = await supabase
        .from("wine_catalog")
        .update(payload)
        .eq("id", editing.id)
        .select();
      if (error) return alert("Erro ao salvar: " + error.message);
      if (!data || data.length === 0) {
        return alert("Nenhuma linha foi alterada. Verifique se você tem permissão de administrador.");
      }
    } else {
      if (!user?.id) return alert("Sessão inválida. Faça login novamente.");
      const { error } = await supabase
        .from("wine_catalog")
        .insert([{ ...payload, status: payload.status ?? "approved", submitted_by: user.id }]);
      if (error) return alert("Erro ao criar: " + error.message);
    }
    await ensureSuppliersInCatalog(editing.suppliers ?? [], user?.id);
    setEditing(null);
    fetchCatalog();
  }

  async function ensureSuppliersInCatalog(names: string[], uid: string | undefined) {
    if (!uid) return;
    const clean = Array.from(new Set((names || []).map((n) => (n || "").trim()).filter(Boolean)));
    if (clean.length === 0) return;
    const { data: existing } = await supabase
      .from("supplier_catalog")
      .select("name, trade_name")
      .or(clean.map((n) => `name.ilike.${n},trade_name.ilike.${n}`).join(","));
    const known = new Set(
      (existing ?? []).flatMap((r: any) => [r.name, r.trade_name].filter(Boolean).map((s: string) => s.toLowerCase()))
    );
    const missing = clean.filter((n) => !known.has(n.toLowerCase()));
    if (missing.length === 0) return;
    await supabase
      .from("supplier_catalog")
      .insert(missing.map((n) => ({ name: n, status: "pending" as const, submitted_by: uid })));
  }


  async function setStatus(id: string, status: CatalogStatus, reason?: string) {
    const patch: any = { status, rejection_reason: reason ?? null };
    if (status === "approved") {
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("wine_catalog").update(patch).eq("id", id);
    if (error) return alert(error.message);
    fetchCatalog();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir definitivamente?")) return;
    const { error } = await supabase.from("wine_catalog").delete().eq("id", id);
    if (!error) fetchCatalog();
  }

  const normKey = (s: string | null | undefined) =>
    (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  function matchText(filter: string, value: string | null | undefined): boolean {
    const s = filter.trim().toLowerCase();
    if (!s) return true;
    return (value ?? "").toLowerCase().includes(s);
  }

  function matchNum(filter: string, value: number | null | undefined): boolean {
    const s = filter.trim();
    if (!s) return true;
    if (value == null || Number.isNaN(Number(value))) return false;
    const n = Number(value);
    const range = s.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (range) return n >= Number(range[1].replace(",", ".")) && n <= Number(range[2].replace(",", "."));
    const op = s.match(/^\s*(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (op) {
      const v = Number(op[2].replace(",", "."));
      switch (op[1]) {
        case ">=": return n >= v;
        case "<=": return n <= v;
        case ">": return n > v;
        case "<": return n < v;
        case "=": return n === v;
      }
    }
    return String(n).includes(s.replace(",", "."));
  }

  const duplicateIds = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const i of items) {
      if (i.status !== "approved") continue;
      const key = `${normKey(i.name)}|${i.vintage ?? ""}`;
      if (!normKey(i.name)) continue;
      const arr = groups.get(key) ?? [];
      arr.push(i.id);
      groups.set(key, arr);
    }
    const dupIds = new Set<string>();
    for (const arr of groups.values()) if (arr.length > 1) arr.forEach(id => dupIds.add(id));
    return dupIds;
  }, [items]);

  const counts = useMemo(() => ({
    pending: items.filter(i => i.status === "pending").length,
    approved: items.filter(i => i.status === "approved").length,
    rejected: items.filter(i => i.status === "rejected").length,
    duplicates: duplicateIds.size,
  }), [items, duplicateIds]);

  const filtered = useMemo(() => {
    return items
      .filter(i => statusTab === "duplicates" ? duplicateIds.has(i.id) : i.status === statusTab)
      .filter(i => {
        if (!matchText(filters.name, i.name)) return false;
        if (!matchText(filters.producer, i.producer)) return false;
        if (!matchText(filters.typeStyle, i.wine_type) && !matchText(filters.typeStyle, i.style)) return false;
        if (!matchNum(filters.vintage, i.vintage)) return false;
        if (filters.completeness.trim()) {
          const checks = auditWine(i);
          const done = checks.filter(c => c.ok).length;
          const pct = checks.length ? Math.round((done / checks.length) * 100) : 0;
          if (!matchNum(filters.completeness, pct)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (statusTab !== "duplicates") return 0;
        const ka = `${normKey(a.name)}|${a.vintage ?? ""}`;
        const kb = `${normKey(b.name)}|${b.vintage ?? ""}`;
        return ka.localeCompare(kb);
      });
  }, [items, statusTab, filters, duplicateIds]);

  const showSelect = isAdmin;
  const allSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id));

  useEffect(() => { setSelectedIds(new Set()); }, [statusTab]);

  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map(i => i.id)));
  }

  async function bulkStatus(status: CatalogStatus) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let reason: string | undefined;
    if (status === "rejected") {
      if (!confirm(`Rejeitar ${ids.length} rótulo(s)?`)) return;
      reason = prompt("Motivo da rejeição (opcional)") ?? undefined;
    } else if (!confirm(`Aprovar ${ids.length} rótulo(s) no catálogo global?`)) return;
    setBulkBusy(true);
    const patch: any = { status, rejection_reason: reason ?? null };
    if (status === "approved") patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from("wine_catalog").update(patch).in("id", ids);
    setBulkBusy(false);
    if (error) return alert(error.message);
    setSelectedIds(new Set());
    fetchCatalog();
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Excluir definitivamente ${ids.length} rótulo(s)?`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("wine_catalog").delete().in("id", ids);
    setBulkBusy(false);
    if (error) return alert(error.message);
    setSelectedIds(new Set());
    fetchCatalog();
  }

  const ENRICH_FIELDS = [
    "producer", "region", "appellation", "country", "grape", "wine_type", "style",
    "alcohol_pct", "sugar_level", "sugar_g_l", "acidity", "acidity_g_l", "acidity_ph",
    "body", "tannin", "oak_months", "production_method", "elaboration", "aging",
    "serving_temp_min", "serving_temp_max", "tasting_notes", "pairing_notes",
    "awards", "sommelier_weights", "suggested_retail_price",
  ] as const;

  function isEmptyValue(v: unknown) {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  async function bulkEnrich() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Enriquecer ${ids.length} rótulo(s) com IA? Apenas campos vazios serão preenchidos.`)) return;
    setEnrichBusy(true);
    let ok = 0;
    let fail = 0;
    for (const [idx, id] of ids.entries()) {
      const item = items.find(i => i.id === id);
      if (!item) continue;
      setEnrichProgress({ done: idx, total: ids.length, name: item.name });
      try {
        const missingFields = ENRICH_FIELDS.filter(f => isEmptyValue((item as any)[f]));
        const res = await enrich({
          data: {
            name: item.name,
            producer: item.producer,
            vintage: item.vintage,
            country: item.country,
            region: item.region,
            wine_type: item.wine_type,
            style: item.style,
            missingFields: [...missingFields],
          },
        });
        const patch: Record<string, unknown> = {};
        for (const f of ENRICH_FIELDS) {
          const incoming = (res as any)[f];
          if (isEmptyValue((item as any)[f]) && !isEmptyValue(incoming)) patch[f] = incoming;
        }
        const note = [res.notes, res.price_rationale ? `Preço estimado: ${res.price_rationale}` : null]
          .filter(Boolean)
          .join(" | ");
        if (note) {
          patch['extraction_notes'] = [item.extraction_notes, `[IA ${new Date().toLocaleDateString("pt-BR")}] ${note}`]
            .filter(Boolean)
            .join("\n");
        }
        if (Object.keys(patch).length > 0) {
          patch['extracted_by_ai'] = true;
          const { error } = await supabase.from("wine_catalog").update(patch as any).eq("id", id);
          if (error) throw error;
        }
        ok++;
      } catch (e: any) {
        console.error("[enrich]", item.name, e);
        fail++;
      }
    }
    setEnrichProgress(null);
    setEnrichBusy(false);
    setSelectedIds(new Set());
    await fetchCatalog();
    alert(`Enriquecimento concluído: ${ok} atualizado(s)${fail ? `, ${fail} com falha` : ""}.`);
  }


  function openEdit(item: Partial<WineCatalog>, tab: "geral" | "carac" | "midia" | "training" = "geral") {
    setInitialTab(tab);
    setEditing(item);
  }


  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="page-title text-3xl font-bold tracking-tight">Catálogo Global</h1>
            <p className="text-sm text-muted-foreground">Revisão e curadoria de rótulos enviados por restaurantes.</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing({ name: "", status: "approved" })}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Novo Rótulo
          </button>
        )}
      </header>

      {isAdmin ? <TrainingLibraryManager admin /> : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-border">
        <TabButton active={statusTab === "pending"} onClick={() => setStatusTab("pending")} icon={<Clock className="h-4 w-4" />}>
          Pendentes <span className="ml-1 rounded-full bg-amber-500/20 px-2 text-xs text-amber-500">{counts.pending}</span>
        </TabButton>
        <TabButton active={statusTab === "approved"} onClick={() => setStatusTab("approved")} icon={<ShieldCheck className="h-4 w-4" />}>
          Aprovados <span className="ml-1 rounded-full bg-emerald-500/20 px-2 text-xs text-emerald-500">{counts.approved}</span>
        </TabButton>

        <TabButton active={statusTab === "rejected"} onClick={() => setStatusTab("rejected")} icon={<Ban className="h-4 w-4" />}>
          Rejeitados <span className="ml-1 rounded-full bg-rose-500/20 px-2 text-xs text-rose-500">{counts.rejected}</span>
        </TabButton>
        <TabButton active={statusTab === "duplicates"} onClick={() => setStatusTab("duplicates")} icon={<AlertTriangle className="h-4 w-4" />}>
          Duplicados <span className="ml-1 rounded-full bg-orange-500/20 px-2 text-xs text-orange-400">{counts.duplicates}</span>
        </TabButton>
      </div>

      <>

      {showSelect && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ação em lote
          </span>
          <span className="text-sm text-[#D4AF37]">
            {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={selectedIds.size === 0 || enrichBusy || bulkBusy}
              onClick={bulkEnrich}
              className="flex items-center gap-1.5 rounded-md border border-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-bold uppercase text-[#D4AF37] hover:bg-[#D4AF37]/20 disabled:opacity-40"
            >
              {enrichBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Enriquecer os dados com IA
            </button>
            {statusTab === "pending" && (
              <>
                <button
                  disabled={selectedIds.size === 0 || bulkBusy || enrichBusy}
                  onClick={() => bulkStatus("approved")}
                  className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs font-bold uppercase text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </button>
                <button
                  disabled={selectedIds.size === 0 || bulkBusy || enrichBusy}
                  onClick={() => bulkStatus("rejected")}
                  className="flex items-center gap-1.5 rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-bold uppercase text-rose-500 hover:bg-rose-500/10 disabled:opacity-40"
                >
                  <XIcon className="h-3.5 w-3.5" /> Rejeitar
                </button>
              </>
            )}
            <button
              disabled={selectedIds.size === 0 || bulkBusy || enrichBusy}
              onClick={bulkDelete}
              className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-bold uppercase text-destructive hover:bg-destructive/10 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
            {enrichProgress && (
              <span className="text-xs text-muted-foreground">
                {enrichProgress.done + 1}/{enrichProgress.total} — {enrichProgress.name}
              </span>
            )}

            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-border bg-card max-h-[calc(100vh-220px)]">

        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-xs font-semibold uppercase text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
            <tr>
              {showSelect && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    title="Selecionar todos"
                    className="h-4 w-4 accent-[#D4AF37]"
                  />
                </th>
              )}
              <th className="px-4 py-3">

                <div className="space-y-1">
                  <span>Rótulo</span>
                  <input
                    value={filters.name}
                    onChange={e => setF("name", e.target.value)}
                    placeholder="Filtrar rótulo..."
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-normal normal-case placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>
              </th>
              <th className="px-4 py-3">
                <div className="space-y-1">
                  <span>Produtor</span>
                  <input
                    value={filters.producer}
                    onChange={e => setF("producer", e.target.value)}
                    placeholder="Filtrar produtor..."
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-normal normal-case placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>
              </th>
              <th className="px-4 py-3">
                <div className="space-y-1">
                  <span>Safra</span>
                  <input
                    value={filters.vintage}
                    onChange={e => setF("vintage", e.target.value)}
                    placeholder="Ex: 2020 ou >2018"
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-normal normal-case placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>
              </th>
              <th className="px-4 py-3">
                <div className="space-y-1">
                  <span>Tipo / Estilo</span>
                  <input
                    value={filters.typeStyle}
                    onChange={e => setF("typeStyle", e.target.value)}
                    placeholder="Filtrar tipo..."
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-normal normal-case placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>
              </th>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3 whitespace-nowrap">Preço de mercado</th>
              <th className="px-4 py-3 text-center" title="Indica se o rótulo possui imagem cadastrada">Img</th>
              <th className="px-4 py-3 text-center" title="Ficha de treinamento: publicada, rascunho ou sem ficha">Ficha</th>
              {statusTab === "approved" && (
                <th className="px-4 py-3 w-40">
                  <div className="space-y-1">
                    <span>Completude</span>
                    <input
                      value={filters.completeness}
                      onChange={e => setF("completeness", e.target.value)}
                      placeholder="Ex: <80 ou 90-100"
                      className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-normal normal-case placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                </th>
              )}
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(item => {
              const cs = cardStatus[item.id];
              const checks = [...auditWine(item), { key: "training_card", label: cs === "draft" ? "Ficha de treinamento (rascunho)" : "Ficha de treinamento", tab: "training" as const, ok: cs === "published" }];
              const done = checks.filter(c => c.ok).length;
              const pct = checks.length ? Math.round((done / checks.length) * 100) : 0;
              const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
              const missing = checks.filter(c => !c.ok);
              const isExpanded = expandedId === item.id;
              const colCount = (statusTab === "approved" ? 10 : 9) + (showSelect ? 1 : 0);
              return (
              <React.Fragment key={item.id}>
              <tr className="hover:bg-accent/50">
                {showSelect && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="h-4 w-4 accent-[#D4AF37]"
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-medium">{item.name}</td>

                <td className="px-4 py-3">{item.producer ?? "—"}</td>
                <td className="px-4 py-3">{item.vintage ?? "—"}</td>
                <td className="px-4 py-3"><span className="block">{item.wine_type ?? "—"}</span><span className="block text-xs text-muted-foreground">{item.style ?? ""}</span></td>
                <td className="px-4 py-3">{item.country ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium text-[#D4AF37]">
                  {item.suggested_retail_price != null
                    ? item.suggested_retail_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.image_url ? (
                    <span title="Possui imagem cadastrada" className="inline-flex items-center justify-center text-emerald-500">
                      <ImageIcon className="h-4 w-4" />
                    </span>
                  ) : (
                    <span title="Sem imagem cadastrada" className="inline-flex items-center justify-center text-rose-500/80">
                      <ImageOff className="h-4 w-4" />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(item, "training")} title={cs === "published" ? "Ficha de treinamento publicada" : cs === "draft" ? "Ficha em rascunho" : "Sem ficha de treinamento"}
                    className={`inline-flex items-center justify-center rounded p-0.5 hover:bg-accent ${cs === "published" ? "text-emerald-500" : cs === "draft" ? "text-amber-500" : "text-rose-500/80"}`}>
                    <GraduationCap className="h-4 w-4" />
                  </button>
                </td>
                {statusTab === "approved" && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#0b0b0b] border border-[#2a2a2a]">
                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-bold text-[#D4AF37]">{pct}%</span>
                      <button
                        title={missing.length ? `${missing.length} campos faltando` : "100% completo"}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        disabled={missing.length === 0}
                        className={`rounded p-0.5 transition ${missing.length === 0 ? "text-emerald-500/60 cursor-default" : "text-[#D4AF37] hover:bg-[#1a1a1a]"}`}>
                        {missing.length === 0 ? <Check className="h-3.5 w-3.5" /> : isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    {isAdmin && item.status === "pending" && (
                      <>
                        <button title="Aprovar" onClick={() => setStatus(item.id, "approved")}
                          className="rounded p-1.5 text-emerald-500 hover:bg-emerald-500/10">
                          <Check className="h-4 w-4" />
                        </button>
                        <button title="Rejeitar" onClick={() => {
                          const r = prompt("Motivo da rejeição (opcional)") ?? undefined;
                          setStatus(item.id, "rejected", r);
                        }} className="rounded p-1.5 text-rose-500 hover:bg-rose-500/10">
                          <XIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isAdmin && item.status === "rejected" && (
                      <button title="Reverter para pendente" onClick={() => setStatus(item.id, "pending")}
                        className="rounded p-1.5 text-amber-500 hover:bg-amber-500/10">
                        <Clock className="h-4 w-4" />
                      </button>
                    )}
                    <button title="Editar rótulo" onClick={() => setEditing(item)} className="rounded p-1.5 hover:bg-accent">
                      <Edit className="h-4 w-4 text-primary" />
                    </button>
                    {isAdmin && (
                      <button title="Excluir" onClick={() => handleDelete(item.id)} className="rounded p-1.5 hover:bg-accent">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {isExpanded && missing.length > 0 && (
                <tr className="bg-[#0b0b0b]">
                  <td colSpan={colCount} className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-3">
                      {(["geral", "carac", "midia", "training"] as const).map(t => {
                        const inTab = missing.filter(m => m.tab === t);
                        if (inTab.length === 0) return null;
                        return (
                          <div key={t} className="rounded-md border border-[#2a2a2a] bg-[#141414] p-3">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t === "geral" ? "Geral" : t === "carac" ? "Características" : t === "midia" ? "Mídia" : "Treinamento"} ({inTab.length})
                              </span>
                              <button onClick={() => openEdit(item, t)}
                                className="flex items-center gap-1 rounded border border-[#D4AF37]/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#D4AF37] hover:bg-[#1a1a1a]">
                                <Edit className="h-2.5 w-2.5" /> Editar
                              </button>
                            </div>
                            <ul className="space-y-0.5">
                              {inTab.map(m => (
                                <li key={m.key} className="flex items-center gap-1.5 text-xs text-foreground/80">
                                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /> {m.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {loading && <div className="p-8 text-center">Carregando catálogo...</div>}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            {statusTab === "pending" ? "Nenhum rótulo pendente de revisão." : statusTab === "duplicates" ? "Nenhum rótulo duplicado (mesmo nome + safra) no catálogo aprovado." : "Nenhum item encontrado."}
          </div>
        )}
      </div>
      </>


      {editing && (
        <EditorModal item={editing} initialTab={initialTab} onChange={setEditing} onClose={() => { setEditing(null); fetchCatalog(); }} onSave={handleSave} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {icon}{children}
    </button>
  );
}

function EditorModal({ item, initialTab = "geral", onChange, onClose, onSave }: {
  item: Partial<WineCatalog>;
  initialTab?: "geral" | "carac" | "midia" | "training";
  onChange: (i: Partial<WineCatalog>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [tab, setTab] = useState<"geral" | "carac" | "midia" | "training">(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">{item.id ? "Editar Rótulo" : "Novo Rótulo"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
          {(["geral", "carac", "midia", "training"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {value === "geral" ? "Geral" : value === "carac" ? "Características" : value === "midia" ? "Mídia" : "Ficha de Treinamento"}
            </button>
          ))}
        </div>

        {tab === "training" ? (
          <GlobalTrainingCardEditor wine={{ ...(item as WineFields), id: item.id, name: item.name ?? "Rótulo sem nome" }} />
        ) : (
          <WineFieldsEditor
            tab={tab}
            item={item as WineFields}
            onChange={(next) => onChange(next as Partial<WineCatalog>)}
            mediaFolder="catalog"
            showSlideshow
          />
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button onClick={onSave} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Salvar</button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// Completeness panel — highlights labels missing key information
// ============================================================

type FieldCheck = { key: string; label: string; tab: "geral" | "carac" | "midia"; ok: boolean };

const EUROPEAN_COUNTRIES = ["frança","franca","france","itália","italia","italy","espanha","spain","españa","portugal","alemanha","germany","deutschland","áustria","austria","grécia","grecia","greece","hungria","hungary","suíça","suica","switzerland","romênia","romenia","romania","bulgária","bulgaria","croácia","croacia","croatia","eslovênia","eslovenia","slovenia","reino unido","uk","inglaterra","england","luxemburgo","luxembourg","holanda","netherlands","bélgica","belgica","belgium","república tcheca","chéquia","czechia","eslováquia","slovakia","moldávia","moldova","geórgia","georgia"];
function isEuropeanCountry(c: string | null | undefined): boolean {
  if (!c) return false;
  const l = c.toLowerCase();
  return EUROPEAN_COUNTRIES.some(e => l.includes(e));
}

function auditWine(w: WineCatalog): FieldCheck[] {
  const grapes = Array.isArray(w.grapes_detail) ? w.grapes_detail : [];
  const isEspumante = w.wine_type === "Espumante";
  return [
    { key: "producer", label: "Produtor", tab: "geral", ok: !!w.producer },
    { key: "vintage", label: "Safra", tab: "geral", ok: !!w.vintage },
    { key: "country", label: "País", tab: "geral", ok: !!w.country },
    { key: "region", label: "Região", tab: "geral", ok: !!w.region },
    { key: "appellation", label: "AOP / Denominação (Europa)", tab: "geral", ok: !!w.appellation || !isEuropeanCountry(w.country) },
    { key: "wine_type", label: "Tipo", tab: "geral", ok: !!w.wine_type },
    { key: "style", label: "Estilo", tab: "geral", ok: !!w.style },
    { key: "grapes_detail", label: "Blend de uvas", tab: "geral", ok: grapes.length > 0 },
    { key: "alcohol_pct", label: "Álcool (%)", tab: "carac", ok: w.alcohol_pct != null },
    { key: "sugar_g_l", label: "Açúcar residual (g/L)", tab: "carac", ok: w.sugar_g_l != null },
    { key: "acidity_g_l", label: "Acidez total (g/L)", tab: "carac", ok: w.acidity_g_l != null },
    { key: "acidity_ph", label: "pH", tab: "carac", ok: w.acidity_ph != null },
    { key: "sugar_level", label: "Açúcar (conceito)", tab: "carac", ok: !!w.sugar_level },
    { key: "body", label: "Corpo (conceito)", tab: "carac", ok: !!w.body },
    { key: "tannin", label: "Taninos (conceito)", tab: "carac", ok: !!w.tannin },
    { key: "acidity", label: "Acidez (conceito)", tab: "carac", ok: !!w.acidity },
    { key: "sommelier_weights", label: "Pesos sommelier", tab: "carac", ok: !!w.sommelier_weights && Object.values(w.sommelier_weights).some(v => v != null) },
    { key: "serving_temp_min", label: "Temp. serviço mín.", tab: "carac", ok: w.serving_temp_min != null },
    { key: "serving_temp_max", label: "Temp. serviço máx.", tab: "carac", ok: w.serving_temp_max != null },
    { key: "elaboration", label: "Elaboração", tab: "carac", ok: !!w.elaboration },
    { key: "aging", label: "Maturação", tab: "carac", ok: !!w.aging },
    { key: "tasting_notes", label: "Notas de degustação", tab: "carac", ok: !!w.tasting_notes },
    { key: "pairing_notes", label: "Harmonização", tab: "carac", ok: !!w.pairing_notes },
    { key: "awards", label: "Premiações", tab: "carac", ok: Array.isArray(w.awards) && w.awards.length > 0 },
    ...(isEspumante ? [{ key: "production_method", label: "Método (espumante)", tab: "carac" as const, ok: !!w.production_method }] : []),
    { key: "image_url", label: "Imagem principal", tab: "midia", ok: !!w.image_url },
    { key: "tech_sheet_url", label: "Ficha técnica (PDF)", tab: "midia", ok: !!w.tech_sheet_url },
  ];
}
