import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Database, Search, Plus, Edit, Trash2, Info, Check, X as XIcon, Clock, ShieldCheck, Ban, Sparkles, FileText } from "lucide-react";
import { MediaUploader, MediaGallery } from "@/components/MediaUploader";
import { WineAiExtractor } from "@/components/WineAiExtractor";
import type { ExtractedWine } from "@/lib/wine-extraction.functions";

export const Route = createFileRoute("/_app/app/catalog-admin")({
  component: CatalogAdmin,
});

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
  const [statusTab, setStatusTab] = useState<CatalogStatus>("pending");
  const [editing, setEditing] = useState<Partial<WineCatalog> | null>(null);

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
    setEditing(null);
    fetchCatalog();
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

  const counts = useMemo(() => ({
    pending: items.filter(i => i.status === "pending").length,
    approved: items.filter(i => i.status === "approved").length,
    rejected: items.filter(i => i.status === "rejected").length,
  }), [items]);

  const filtered = useMemo(() => items
    .filter(i => i.status === statusTab)
    .filter(i =>
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.producer ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.barcode ?? "").includes(search)
    ), [items, statusTab, search]);

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
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-accent/50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">{item.producer ?? "—"}</td>
                <td className="px-4 py-3">{item.vintage ?? "—"}</td>
                <td className="px-4 py-3"><span className="block">{item.wine_type ?? "—"}</span><span className="block text-xs text-muted-foreground">{item.style ?? ""}</span></td>
                <td className="px-4 py-3">{item.country ?? "—"}</td>
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
                    <button onClick={() => setEditing(item)} className="rounded p-1.5 hover:bg-accent">
                      <Edit className="h-4 w-4 text-primary" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(item.id)} className="rounded p-1.5 hover:bg-accent">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-8 text-center">Carregando catálogo...</div>}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            {statusTab === "pending" ? "Nenhum rótulo pendente de revisão." : "Nenhum item encontrado."}
          </div>
        )}
      </div>

      {editing && (
        <EditorModal item={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={handleSave} />
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

function EditorModal({ item, onChange, onClose, onSave }: {
  item: Partial<WineCatalog>;
  onChange: (i: Partial<WineCatalog>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [tab, setTab] = useState<"geral" | "carac" | "midia">("geral");
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


  function applyExtracted(e: ExtractedWine) {
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
    onChange({
      ...item,
      name: item.name || e.rotulo || "",
      producer: item.producer || e.produtor || null,
      country: item.country || e.pais || null,
      region: item.region || e.regiao || null,
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
      tasting_notes: e.informacoes_tecnicas || item.tasting_notes || null,
      extraction_notes: e.informacoes_tecnicas ?? item.extraction_notes ?? null,
      source_text: e.texto_original ?? item.source_text ?? null,
      sommelier_weights: e.pesos ?? item.sommelier_weights ?? null,
      extracted_by_ai: true,
    });
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
            <Input label="Safra" hint="Ano da colheita. Vazio para NV." placeholder="Ex: 2020" value={item.vintage ? String(item.vintage) : ""} onChange={v => set("vintage", v ? Number(v) : null)} />
            <Input label="Região" hint="Região vitivinícola ou DO." placeholder="Ex: Vale do Colchagua" value={item.region ?? ""} onChange={v => set("region", v)} />
            <Input label="País" hint="País de origem." placeholder="Ex: Chile" value={item.country ?? ""} onChange={v => set("country", v)} />
            <Input label="Uvas" hint="Castas e % quando houver corte." placeholder="Ex: Cabernet Sauvignon 85%, Merlot 15%" value={item.grape ?? ""} onChange={v => set("grape", v)} />
            <Select label="Tipo" hint="Categoria geral." value={item.wine_type ?? ""} onChange={v => set("wine_type", v)} options={TYPES} />
            <Select label="Estilo" hint="Estilo usado para harmonização." value={item.style ?? ""} onChange={v => set("style", v)} options={STYLES} />
            <Select label="Volume" hint="Capacidade da garrafa." value={item.volume ?? ""} onChange={v => set("volume", v)} options={VOLUMES} />
            <Input label="Código de barras" hint="EAN / UPC do rótulo." placeholder="7891234567890" value={item.barcode ?? ""} onChange={v => set("barcode", v)} />
            <div className="md:col-span-2">
              <FieldLabel hint="Fornecedores conhecidos no Brasil. Pode incluir mais de um.">Fornecedores</FieldLabel>
              <div className="mt-2 space-y-2">
                {suppliers.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={s} onChange={e => setSupplier(i, e.target.value)} placeholder="Ex: Mistral, World Wine..."
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Teor alcoólico (%)" hint="Porcentagem de álcool em volume." placeholder="Ex: 13.5" value={item.alcohol_pct != null ? String(item.alcohol_pct) : ""} onChange={v => set("alcohol_pct", v ? Number(v) : null)} />
            <div />
            <Select label="Açúcar (conceito)" hint="Classificação por dulçor." value={item.sugar_level ?? ""} onChange={v => set("sugar_level", v)} options={SUGAR_LEVELS} />
            <Input label="Açúcar (g/L)" hint="Açúcar residual em gramas por litro." placeholder="Ex: 3.5" value={item.sugar_g_l != null ? String(item.sugar_g_l) : ""} onChange={v => set("sugar_g_l", v ? Number(v) : null)} />
            <Select label="Corpo" hint="Peso/estrutura do vinho na boca." value={item.body ?? ""} onChange={v => set("body", v)} options={BODY} />
            <Select label="Taninos" hint="Intensidade dos taninos." value={item.tannin ?? ""} onChange={v => set("tannin", v)} options={INTENSITY} />
            <Select label="Acidez (conceito)" hint="Percepção de frescor." value={item.acidity ?? ""} onChange={v => set("acidity", v)} options={INTENSITY} />
            <Input label="Acidez (g/L)" hint="Acidez total em gramas por litro." placeholder="Ex: 5.8" value={item.acidity_g_l != null ? String(item.acidity_g_l) : ""} onChange={v => set("acidity_g_l", v ? Number(v) : null)} />
            <Input label="Acidez (pH)" hint="Valor de pH do vinho." placeholder="Ex: 3.4" value={item.acidity_ph != null ? String(item.acidity_ph) : ""} onChange={v => set("acidity_ph", v ? Number(v) : null)} />
            <div />
            <TextArea label="Elaboração" hint="Vinificação: tipo de fermentação, leveduras, tanques, etc." placeholder="Ex: Fermentação em tanques de inox a temperatura controlada..." value={item.elaboration ?? ""} onChange={v => set("elaboration", v)} className="md:col-span-2" />
            <TextArea label="Maturação" hint="Envelhecimento: barricas, tempo, guarda em garrafa." placeholder="Ex: 12 meses em barrica de carvalho francês (30% novas)." value={item.aging ?? ""} onChange={v => set("aging", v)} className="md:col-span-2" />
            <Input label="Temp. mín. serviço (°C)" hint="Temperatura mínima recomendada." placeholder="Ex: 16" value={item.serving_temp_min != null ? String(item.serving_temp_min) : ""} onChange={v => set("serving_temp_min", v ? Number(v) : null)} />
            <Input label="Temp. máx. serviço (°C)" hint="Temperatura máxima recomendada." placeholder="Ex: 18" value={item.serving_temp_max != null ? String(item.serving_temp_max) : ""} onChange={v => set("serving_temp_max", v ? Number(v) : null)} />
            <TextArea label="Notas de degustação" hint="Cor, aromas, paladar e final." placeholder="Ex: Rubi intenso. Aromas de frutas negras, especiarias..." value={item.tasting_notes ?? ""} onChange={v => set("tasting_notes", v)} className="md:col-span-2" />
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
        )}

        {tab === "midia" && (
          <div className="space-y-5">
            <div>
              <FieldLabel hint="Foto principal do rótulo, usada como capa no catálogo.">Imagem principal</FieldLabel>
              <div className="mt-2 space-y-2">
                <MediaUploader label="" value={item.image_url ?? null} onChange={(v) => set("image_url", v)} folder="catalog" />
                <input
                  type="url"
                  placeholder="ou cole aqui a URL de uma imagem (https://...)"
                  defaultValue=""
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) { set("image_url", v); e.target.value = ""; }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground/50"
                />
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
              <div className="mt-2">
                <MediaUploader label="" value={item.tech_sheet_url ?? null} onChange={(v) => set("tech_sheet_url", v)} accept="application/pdf" folder="catalog/tech" kind="file" />
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
