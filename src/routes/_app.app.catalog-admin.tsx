import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Database, Search, Plus, Edit, Trash2, Info, Check, X as XIcon, Clock, ShieldCheck, Ban, Sparkles, FileText, AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { MediaUploader, MediaGallery } from "@/components/MediaUploader";
import { WineAiExtractor } from "@/components/WineAiExtractor";
import { NumberInput } from "@/components/NumberInput";
import type { ExtractedWine } from "@/lib/wine-extraction.functions";

export const Route = createFileRoute("/_app/app/catalog-admin")({
  component: CatalogAdmin,
});

// Sugar residual classification (g/L) — Espumantes use the sparkling-wine scale;
// still wines fall back to the general "Seco/Meio-seco/Suave/Doce" labels.
const SPARKLING_SUGAR_TABLE: { label: string; max: number }[] = [
  { label: "Nature / Brut Nature", max: 3 },
  { label: "Extra Brut", max: 8 },
  { label: "Brut", max: 15 },
  { label: "Sec / Seco / Extra Sec", max: 20 },
  { label: "Demi-Sec / Meio-Doce", max: 60 },
  { label: "Doce / Doux / Moscatel", max: Infinity },
];
const SPARKLING_SUGAR_LABELS = SPARKLING_SUGAR_TABLE.map((t) => t.label);

export function classifySparklingSugar(g: number | null | undefined): string | null {
  if (g == null || !Number.isFinite(g)) return null;
  for (const row of SPARKLING_SUGAR_TABLE) if (g <= row.max) return row.label;
  return null;
}

// Convert any product-media reference (signed URL or path) to our same-origin proxy.
export function toProxiedFileUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return `/api/public/catalog-file?u=${encodeURIComponent(u)}`;
}

type CatalogStatus = "pending" | "approved" | "rejected";

const TYPES = ["Espumante", "Branco", "Rosé", "Tinto", "Fortificado", "Sobremesa", "Outros"];
const STYLES = [
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
const SUGAR_LEVELS = ["Seco", "Meio-seco", "Suave", "Doce"];
const INTENSITY = ["Baixo", "Médio", "Alto"];
const BODY = ["Leve", "Médio", "Encorpado"];
const VOLUMES = ["750 ml", "375 ml", "187 ml", "1500 ml", "Outro"];

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
};

type GrapeRow = { grape: string; pct: number | null; mesesBarrica: number | null };

const SOMMELIER_AXES: {
  key: keyof NonNullable<WineCatalog["sommelier_weights"]>;
  label: string;
  min: string;
  max: string;
}[] = [
  { key: "corpo", label: "Corpo / Peso", min: "Leve", max: "Encorpado" },
  { key: "acidez", label: "Acidez / Frescor", min: "Plana", max: "Vibrante" },
  { key: "taninos", label: "Taninos / Estrutura", min: "Nulo", max: "Forte" },
  { key: "docura", label: "Doçura / Residual", min: "Seco", max: "Doce" },
  { key: "estagioBarrica", label: "Estágio em Barrica", min: "Sem madeira", max: "Muito amadeirado" },
  { key: "intensidadeAromatica", label: "Intensidade Aromática", min: "Delicado", max: "Exuberante" },
];

function FieldLabel({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <span>{children}</span>
      <span title={hint} className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center text-muted-foreground/60 hover:text-primary">
        <Info className="h-3 w-3" />
      </span>
    </label>
  );
}

function CatalogAdmin() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<WineCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<CatalogStatus | "duplicates">("pending");
  const [editing, setEditing] = useState<Partial<WineCatalog> | null>(null);
  const [initialTab, setInitialTab] = useState<"geral" | "carac" | "midia">("geral");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchCatalog(); }, []);

  async function fetchCatalog() {
    setLoading(true);
    const { data } = await supabase.from("wine_catalog").select("*").order("created_at", { ascending: false });
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

  const filtered = useMemo(() => items
    .filter(i => statusTab === "duplicates" ? duplicateIds.has(i.id) : i.status === statusTab)
    .filter(i =>
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.producer ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.barcode ?? "").includes(search)
    )
    .sort((a, b) => {
      if (statusTab !== "duplicates") return 0;
      const ka = `${normKey(a.name)}|${a.vintage ?? ""}`;
      const kb = `${normKey(b.name)}|${b.vintage ?? ""}`;
      return ka.localeCompare(kb);
    }), [items, statusTab, search, duplicateIds]);

  function openEdit(item: Partial<WineCatalog>, tab: "geral" | "carac" | "midia" = "geral") {
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
      </div>

      <>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input placeholder="Buscar por nome, produtor ou código de barras..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Produtor</th>
              <th className="px-4 py-3">Safra</th>
              <th className="px-4 py-3">Tipo / Estilo</th>
              <th className="px-4 py-3">País</th>
              {statusTab === "approved" && <th className="px-4 py-3 w-32">Completude</th>}
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(item => {
              const checks = auditWine(item);
              const done = checks.filter(c => c.ok).length;
              const pct = checks.length ? Math.round((done / checks.length) * 100) : 0;
              const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
              const missing = checks.filter(c => !c.ok);
              const isExpanded = expandedId === item.id;
              const colCount = statusTab === "approved" ? 7 : 6;
              return (
              <React.Fragment key={item.id}>
              <tr className="hover:bg-accent/50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">{item.producer ?? "—"}</td>
                <td className="px-4 py-3">{item.vintage ?? "—"}</td>
                <td className="px-4 py-3"><span className="block">{item.wine_type ?? "—"}</span><span className="block text-xs text-muted-foreground">{item.style ?? ""}</span></td>
                <td className="px-4 py-3">{item.country ?? "—"}</td>
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
                      {(["geral", "carac", "midia"] as const).map(t => {
                        const inTab = missing.filter(m => m.tab === t);
                        if (inTab.length === 0) return null;
                        return (
                          <div key={t} className="rounded-md border border-[#2a2a2a] bg-[#141414] p-3">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t === "geral" ? "Geral" : t === "carac" ? "Características" : "Mídia"} ({inTab.length})
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
            {statusTab === "pending" ? "Nenhum rótulo pendente de revisão." : "Nenhum item encontrado."}
          </div>
        )}
      </div>
      </>


      {editing && (
        <EditorModal item={editing} initialTab={initialTab} onChange={setEditing} onClose={() => setEditing(null)} onSave={handleSave} />
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
  initialTab?: "geral" | "carac" | "midia";
  onChange: (i: Partial<WineCatalog>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [tab, setTab] = useState<"geral" | "carac" | "midia">(initialTab);
  const set = <K extends keyof WineCatalog>(k: K, v: WineCatalog[K]) => onChange({ ...item, [k]: v });
  const videos: Video[] = Array.isArray(item.videos) ? (item.videos as Video[]) : [];
  const suppliers: string[] = Array.isArray(item.suppliers) ? item.suppliers : [];
  const awards: string[] = Array.isArray(item.awards) ? item.awards : [];

  function setVideo(idx: number, v: Partial<Video>) {
    const next = [...videos];
    next[idx] = { ...next[idx], ...v };
    set("videos", next as any);
  }
  function addVideo() { set("videos", [...videos, { title: "", url: "" }] as any); }
  function removeVideo(i: number) { set("videos", videos.filter((_, k) => k !== i) as any); }

  function setSupplier(idx: number, v: string) {
    const next = [...suppliers]; next[idx] = v; set("suppliers", next as any);
  }
  function addSupplier() { set("suppliers", [...suppliers, ""] as any); }
  function removeSupplier(i: number) { set("suppliers", suppliers.filter((_, k) => k !== i) as any); }

  function setAward(idx: number, v: string) {
    const next = [...awards]; next[idx] = v; set("awards", next as any);
  }
  function addAward() {
    if (awards.length >= 10) return;
    set("awards", [...awards, ""] as any);
  }
  function removeAward(i: number) { set("awards", awards.filter((_, k) => k !== i) as any); }

  const grapes: GrapeRow[] = Array.isArray(item.grapes_detail) ? (item.grapes_detail as GrapeRow[]) : [];
  const grapesTotalPct = grapes.reduce((s, g) => s + (Number(g.pct) || 0), 0);
  function updateGrapes(next: GrapeRow[]) {
    set("grapes_detail", next as any);
    const summary = next.map((g) => (g.pct != null ? `${g.grape} ${g.pct}%` : g.grape)).filter(Boolean).join(", ");
    if (summary) set("grape", summary as any);
    const avg = next.reduce((s, g) => s + (Number(g.mesesBarrica) || 0) * ((Number(g.pct) || 0) / 100), 0);
    if (avg > 0) set("oak_months", Number(avg.toFixed(1)) as any);
  }
  function setGrape(i: number, patch: Partial<GrapeRow>) {
    const next = grapes.map((g, k) => (k === i ? { ...g, ...patch } : g));
    updateGrapes(next);
  }
  function addGrape() { updateGrapes([...grapes, { grape: "", pct: null, mesesBarrica: 0 }]); }
  function removeGrape(i: number) { updateGrapes(grapes.filter((_, k) => k !== i)); }

  const weights = item.sommelier_weights ?? {
    corpo: null, acidez: null, taninos: null, docura: null, estagioBarrica: null, intensidadeAromatica: null,
  };
  function setWeight(key: keyof typeof weights, v: number) {
    set("sommelier_weights", { ...weights, [key]: v } as any);
  }


  function applyExtracted(e: ExtractedWine, meta?: { sourceFileUrl?: string; mimeType?: string }) {
    const grapeSummary = e.grapes
      .map((g) => (g.pct != null ? `${g.grape} ${g.pct}%` : g.grape))
      .join(", ");
    const typeMap: Record<string, string> = {
      Tinto: "Tinto", Branco: "Branco", Espumante: "Espumante",
      Rosé: "Rosé", Rose: "Rosé", Doce: "Sobremesa", Fortificado: "Fortificado",
    };
    const avgOak = e.grapes.length
      ? e.grapes.reduce((s, g) => s + (g.mesesBarrica ?? 0) * ((g.pct ?? 0) / 100), 0)
      : null;
    const isPdf = (meta?.mimeType ?? "").includes("pdf");
    const isImage = (meta?.mimeType ?? "").startsWith("image/");
    const nextAwards = (e.premiacoes && e.premiacoes.length ? e.premiacoes.slice(0, 10) : awards);
    onChange({
      ...item,
      name: item.name || e.rotulo || "",
      producer: item.producer || e.produtor || null,
      country: item.country || e.pais || null,
      region: item.region || e.regiao || null,
      appellation: item.appellation || (e as any).denominacao || null,
      vintage: item.vintage || e.safra || null,
      wine_type: e.tipo ? (typeMap[e.tipo] ?? e.tipo) : item.wine_type ?? null,
      style: e.estilo || item.style || null,
      grape: grapeSummary || item.grape || null,
      grapes_detail: e.grapes.length ? e.grapes : item.grapes_detail ?? null,
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
      awards: nextAwards as any,
      tasting_notes: e.informacoes_tecnicas || item.tasting_notes || null,
      extraction_notes: e.informacoes_tecnicas ?? item.extraction_notes ?? null,
      source_text: e.texto_original ?? item.source_text ?? null,
      sommelier_weights: e.pesos ?? item.sommelier_weights ?? null,
      image_url: item.image_url || e.imagemUrl || (isImage ? meta?.sourceFileUrl : undefined) || null,
      tech_sheet_url: item.tech_sheet_url || (isPdf ? meta?.sourceFileUrl : undefined) || null,
      source_file_url: meta?.sourceFileUrl ?? item.source_file_url ?? null,
      suggested_retail_price: (e as any).precoVendaSugerido ?? (item as any).suggested_retail_price ?? null,
      extracted_by_ai: true,
    } as any);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">{item.id ? "Editar Rótulo" : "Novo Rótulo"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex gap-1 border-b border-border">
          {(["geral", "carac", "midia"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {t === "geral" ? "Geral" : t === "carac" ? "Características" : "Mídia"}
            </button>
          ))}
        </div>

        {tab === "geral" && (
          <div className="space-y-4">
            <WineAiExtractor onExtracted={applyExtracted} />
            {item.extracted_by_ai && (
              <div className="flex items-center gap-2 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/5 px-3 py-2 text-xs text-[#D4AF37]">
                <Sparkles className="h-3 w-3" />
                Dados preenchidos pela IA — revise antes de salvar.
                {item.source_text && (
                  <button
                    type="button"
                    onClick={() => {
                      const w = window.open("", "_blank");
                      if (w) {
                        w.document.write(`<pre style="font-family:monospace;padding:20px;white-space:pre-wrap;background:#0b0b0b;color:#eee;">${(item.source_text ?? "").replace(/</g, "&lt;")}</pre>`);
                      }
                    }}
                    className="ml-auto flex items-center gap-1 underline"
                  >
                    <FileText className="h-3 w-3" /> ver texto original
                  </button>
                )}
              </div>
            )}
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Nome*" hint="Nome do rótulo como aparece no contra-rótulo, sem produtor/safra." placeholder="Ex: Alpha Cabernet Sauvignon" value={item.name ?? ""} onChange={v => set("name", v)} />
            <Input label="Produtor" hint="Vinícola responsável pela elaboração." placeholder="Ex: Viña Montes" value={item.producer ?? ""} onChange={v => set("producer", v)} />
            <NumberInput label="Safra" hint="Ano da colheita. Vazio para NV." placeholder="Ex: 2020" value={item.vintage ?? null} onChange={v => set("vintage", v != null ? Math.trunc(v) : null)} />
            <Input label="Região" hint="Região vitivinícola ou DO." placeholder="Ex: Vale do Colchagua" value={item.region ?? ""} onChange={v => set("region", v)} />
            <Input label="País" hint="País de origem." placeholder="Ex: Chile" value={item.country ?? ""} onChange={v => set("country", v)} />
            <Input label="AOP / Denominação" hint="Somente vinhos europeus. França: AOP/AOC; Itália: DOC/DOCG; Espanha: DO/DOCa; Portugal: DOP/DOC; Alemanha: g.U./Prädikatswein." placeholder="Ex: AOC Saint-Émilion Grand Cru" value={item.appellation ?? ""} onChange={v => set("appellation", v)} />
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
                    <button onClick={() => removeGrape(i)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button onClick={addGrape} className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#D4AF37]/50 bg-[#0b0b0b] px-2 py-1.5 text-xs font-medium text-[#D4AF37] hover:bg-[#1a1a1a]">
                  <Plus className="h-3 w-3" /> Adicionar uva
                </button>
              </div>
            </div>
            <Select label="Tipo" hint="Categoria geral." value={item.wine_type ?? ""} onChange={v => set("wine_type", v)} options={TYPES} />
            <Select label="Estilo" hint="Estilo usado para harmonização." value={item.style ?? ""} onChange={v => set("style", v)} options={STYLES} />
            <Select label="Volume" hint="Capacidade da garrafa." value={item.volume ?? ""} onChange={v => set("volume", v)} options={VOLUMES} />
            <Input label="Código de barras" hint="EAN / UPC do rótulo." placeholder="7891234567890" value={item.barcode ?? ""} onChange={v => set("barcode", v)} />
            <NumberInput label="Preço sugerido de venda (R$)" hint="Preço sugerido de venda ao consumidor, quando informado pelo produtor/importador. Referência — cada restaurante pode ter o seu próprio preço." placeholder="Ex: 189,90" value={(item as any).suggested_retail_price ?? null} onChange={v => set("suggested_retail_price" as any, v as any)} />

            <div className="md:col-span-2">
              <FieldLabel hint="Fornecedores conhecidos no Brasil. Comece a digitar para buscar no catálogo. Se não existir, o nome será salvo como pendente no cadastro de fornecedores.">Fornecedores</FieldLabel>
              <div className="mt-2 space-y-2">
                {suppliers.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <SupplierAutocomplete value={s} onChange={(v) => setSupplier(i, v)} />
                    <button onClick={() => removeSupplier(i)} className="rounded p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                ))}
                <button onClick={addSupplier} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-3 w-3" /> Adicionar fornecedor</button>
              </div>
            </div>
          </div>
          </div>
        )}

        {tab === "carac" && (
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
                <NumberInput label="Teor alcoólico (%)" hint="Álcool em volume." placeholder="Ex: 13.5" value={item.alcohol_pct ?? null} onChange={v => set("alcohol_pct", v)} />
                <NumberInput label="Açúcar residual (g/L)" hint="Açúcar residual g/L." placeholder="Ex: 3.5" value={item.sugar_g_l ?? null} onChange={v => set("sugar_g_l", v)} />
                <NumberInput label="Acidez total (g/L)" hint="Acidez total g/L." placeholder="Ex: 5.8" value={item.acidity_g_l ?? null} onChange={v => set("acidity_g_l", v)} />
                <NumberInput label="pH do vinho" hint="Valor de pH." placeholder="Ex: 3.4" value={item.acidity_ph ?? null} onChange={v => set("acidity_ph", v)} />
              </div>
              {item.wine_type === "Espumante" && (
                <div className="mt-3 rounded-md border border-[#D4AF37]/30 bg-[#0b0b0b] p-2 text-xs">
                  <span className="text-muted-foreground">Classificação (espumante): </span>
                  <span className="font-bold text-[#D4AF37]">
                    {classifySparklingSugar(item.sugar_g_l ?? null) ?? "—"}
                  </span>
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
                        <span className="rounded border border-[#D4AF37]/40 bg-[#141414] px-2 py-0.5 text-xs font-bold text-[#D4AF37]">
                          {val} / 10
                        </span>
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
              <Select label="Açúcar (conceito)" hint={item.wine_type === "Espumante" ? "Classificação de dulçor para espumantes." : "Classificação por dulçor."} value={item.sugar_level ?? ""} onChange={v => set("sugar_level", v)} options={item.wine_type === "Espumante" ? SPARKLING_SUGAR_LABELS : SUGAR_LEVELS} />
              <Select label="Corpo (conceito)" hint="Peso/estrutura na boca." value={item.body ?? ""} onChange={v => set("body", v)} options={BODY} />
              <Select label="Taninos (conceito)" hint="Intensidade dos taninos." value={item.tannin ?? ""} onChange={v => set("tannin", v)} options={INTENSITY} />
              <Select label="Acidez (conceito)" hint="Percepção de frescor." value={item.acidity ?? ""} onChange={v => set("acidity", v)} options={INTENSITY} />
              <TextArea label="Elaboração" hint="Vinificação: fermentação, leveduras, tanques, etc." placeholder="Ex: Fermentação em inox a temperatura controlada..." value={item.elaboration ?? ""} onChange={v => set("elaboration", v)} className="md:col-span-2" />
              <TextArea label="Maturação" hint="Envelhecimento: barricas, tempo, guarda em garrafa." placeholder="Ex: 12 meses em carvalho francês (30% novas)." value={item.aging ?? ""} onChange={v => set("aging", v)} className="md:col-span-2" />
              <NumberInput label="Temp. mín. serviço (°C)" hint="Temperatura mínima recomendada." placeholder="Ex: 16" value={item.serving_temp_min ?? null} onChange={v => set("serving_temp_min", v)} />
              <NumberInput label="Temp. máx. serviço (°C)" hint="Temperatura máxima recomendada." placeholder="Ex: 18" value={item.serving_temp_max ?? null} onChange={v => set("serving_temp_max", v)} />
              <TextArea label="Notas de degustação" hint="Cor, aromas, paladar e final." placeholder="Ex: Rubi intenso. Aromas de frutas negras..." value={item.tasting_notes ?? ""} onChange={v => set("tasting_notes", v)} className="md:col-span-2" />
              <TextArea label="Harmonização" hint="Sugestões gastronômicas." placeholder="Ex: Carnes vermelhas grelhadas, cordeiro, queijos curados." value={item.pairing_notes ?? ""} onChange={v => set("pairing_notes", v)} className="md:col-span-2" />
              <div className="md:col-span-2">
                <FieldLabel hint="Até 10 premiações. Use um campo por prêmio.">Premiações ({awards.length}/10)</FieldLabel>
                <div className="mt-2 space-y-2">
                  {awards.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={a} onChange={e => setAward(i, e.target.value)} placeholder="Ex: 92 pts Wine Spectator 2022"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <button onClick={() => removeAward(i)} className="rounded p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </div>
                  ))}
                  {awards.length < 10 && (
                    <button onClick={addAward} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-3 w-3" /> Adicionar premiação</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {tab === "midia" && (
          <div className="space-y-5">
            <div>
              <FieldLabel hint="Foto principal do rótulo, usada como capa no catálogo.">Imagem principal</FieldLabel>
              <div className="mt-2">
                <MediaUploader label="" value={item.image_url ?? null} onChange={(v) => set("image_url", v)} folder="catalog" />
              </div>
            </div>
            <div>
              <FieldLabel hint="Imagens adicionais: contra-rótulo, garrafa, vinhedo.">Galeria de imagens</FieldLabel>
              <div className="mt-2">
                <MediaGallery label="" values={item.gallery_urls ?? []} onChange={(v) => set("gallery_urls", v)} folder="catalog" />
              </div>
            </div>
            <div>
              <FieldLabel hint="Ficha técnica oficial em PDF, fornecida pelo produtor ou importador.">Ficha técnica (PDF)</FieldLabel>
              <div className="mt-2 space-y-2">
                <MediaUploader label="" value={item.tech_sheet_url ?? null} onChange={(v) => set("tech_sheet_url", v)} accept="application/pdf" folder="catalog/tech" kind="file" />
                {item.tech_sheet_url && (
                  <a href={toProxiedFileUrl(item.tech_sheet_url) ?? "#"} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-[#D4AF37]/40 bg-[#141414] px-3 py-1.5 text-xs font-bold uppercase text-[#D4AF37] hover:bg-[#1a1a1a]">
                    <ExternalLink className="h-3 w-3" /> Abrir ficha técnica
                  </a>
                )}
              </div>
            </div>
            <div>
              <FieldLabel hint="Vídeos do YouTube, Vimeo ou outras plataformas. Renomeie o título para identificar.">Vídeos</FieldLabel>
              <div className="mt-2 space-y-2">
                {videos.map((v, i) => (
                  <div key={i} className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 md:grid-cols-[1fr_2fr_auto]">
                    <input value={v.title} onChange={e => setVideo(i, { title: e.target.value })} placeholder="Título do vídeo"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <input value={v.url} onChange={e => setVideo(i, { url: e.target.value })} placeholder="https://youtube.com/..."
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <button onClick={() => removeVideo(i)} className="rounded p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                ))}
                <button onClick={addVideo} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-3 w-3" /> Adicionar vídeo</button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button onClick={onSave} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, hint, value, onChange, placeholder }: { label: string; hint: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40" />
    </div>
  );
}

function TextArea({ label, hint, value, onChange, placeholder, className }: { label: string; hint: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40" />
    </div>
  );
}

function Select({ label, hint, value, onChange, options }: { label: string; hint: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="">Selecione...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
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

function SupplierAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

