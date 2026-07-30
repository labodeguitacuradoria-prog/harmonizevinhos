import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Database, Search, Plus, Edit, Trash2, Info, Check, X as XIcon, Clock, ShieldCheck, Ban, Sparkles, FileText, AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import {
  WineFieldsEditor,
  WineFormTabs,
  classifySparklingSugar,
  toProxiedFileUrl,
  type WineFields,
} from "@/components/WineFieldsEditor";

export { classifySparklingSugar, toProxiedFileUrl };

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
        <TabButton active={statusTab === "duplicates"} onClick={() => setStatusTab("duplicates")} icon={<AlertTriangle className="h-4 w-4" />}>
          Duplicados <span className="ml-1 rounded-full bg-orange-500/20 px-2 text-xs text-orange-400">{counts.duplicates}</span>
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
            {statusTab === "pending" ? "Nenhum rótulo pendente de revisão." : statusTab === "duplicates" ? "Nenhum rótulo duplicado (mesmo nome + safra) no catálogo aprovado." : "Nenhum item encontrado."}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">{item.id ? "Editar Rótulo" : "Novo Rótulo"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="h-5 w-5" /></button>
        </div>

        <WineFormTabs tab={tab} onChange={setTab} />

        <WineFieldsEditor
          tab={tab}
          item={item as WineFields}
          onChange={(next) => onChange(next as Partial<WineCatalog>)}
          mediaFolder="catalog"
        />

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
