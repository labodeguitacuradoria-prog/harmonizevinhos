import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Wine as WineIcon, GlassWater, ScanLine } from "lucide-react";
import { MediaUploader, MediaGallery } from "@/components/MediaUploader";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const Route = createFileRoute("/_app/app/wines")({
  component: ProductsPage,
});

type Wine = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  country: string | null;
  wine_type: string | null;
  grape: string | null;
  volume: string | null;
  cost_price: number;
  sale_price: number;
  supplier_id: string | null;
  internal_code: string | null;
  alcohol_pct: number | null;
  sugar_level: string | null;
  body: string | null;
  tannin: string | null;
  acidity: string | null;
  aging: string | null;
  serving_temp_min: number | null;
  serving_temp_max: number | null;
  pairing_notes: string | null;
  tasting_notes: string | null;
  awards: string[] | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  tech_sheet_url: string | null;
  video_url: string | null;
  barcode: string | null;
};

type Glass = {
  id: string;
  name: string;
  brand: string | null;
  capacity_ml: number | null;
  wine_type_recommended: string | null;
  material: string | null;
  cost_price: number;
  stock_quantity: number;
  image_url: string | null;
  notes: string | null;
};

const DEFAULT_TYPES = ["Tinto", "Branco", "Rosé", "Espumante", "Sobremesa", "Fortificado"];
const DEFAULT_VOLUMES = ["750 ml", "375 ml", "187 ml", "Taça"];
const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto", white: "Branco", rose: "Rosé",
  sparkling: "Espumante", dessert: "Sobremesa", fortified: "Fortificado",
};
const SUGAR_LEVELS = ["Seco", "Meio-seco", "Suave", "Doce"];
const INTENSITY = ["Baixo", "Médio", "Alto"];
const BODY = ["Leve", "Médio", "Encorpado"];
const GLASS_WINE_TYPES = ["Universal", "Tinto", "Branco", "Espumante", "Sobremesa", "Outro"];
const GLASS_MATERIALS = ["Cristal", "Vidro", "Outro"];

function ProductsPage() {
  const [category, setCategory] = useState<"wine" | "glass">("wine");

  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastro de Produtos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie o catálogo do seu restaurante por categoria.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        <CategoryTab active={category === "wine"} onClick={() => setCategory("wine")} icon={<WineIcon className="h-4 w-4" />}>
          Vinhos
        </CategoryTab>
        <CategoryTab active={category === "glass"} onClick={() => setCategory("glass")} icon={<GlassWater className="h-4 w-4" />}>
          Taças
        </CategoryTab>
        <span className="ml-2 self-center text-xs text-muted-foreground">
          Decanters · Saca-rolhas · Cartas · Acessórios — em breve
        </span>
      </div>

      <div className="mt-6">
        {category === "wine" ? <WinesSection /> : <GlassesSection />}
      </div>
    </div>
  );
}

function CategoryTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ===== WINES =====

function WinesSection() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editWine, setEditWine] = useState<Wine | null>(null);

  const { data: wines = [], isLoading } = useQuery({
    queryKey: ["wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("name");
      if (error) throw error;
      return data as Wine[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: stockMap = {} } = useQuery({
    queryKey: ["stock-map", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id, movement_type, quantity")
        .eq("restaurant_id", restaurantId!);
      const map: Record<string, number> = {};
      for (const m of data ?? []) {
        const sign = m.movement_type === "sale" ? -1 : 1;
        map[m.wine_id] = (map[m.wine_id] ?? 0) + sign * m.quantity;
      }
      return map;
    },
  });

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Novo vinho
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Safra</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Custo</th>
              <th className="px-4 py-3">Venda</th>
              <th className="px-4 py-3">Markup</th>
              <th className="px-4 py-3">Estoque</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && wines.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                Nenhum vinho cadastrado ainda.
              </td></tr>
            )}
            {wines.map((w) => {
              const markup = w.cost_price > 0 ? ((Number(w.sale_price) / Number(w.cost_price) - 1) * 100).toFixed(0) : "-";
              return (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setEditWine(w)} className="flex items-center gap-2 text-left hover:text-primary">
                      {w.image_url && <img src={w.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                      <div>
                        <div className="font-medium underline-offset-2 hover:underline">{w.name}</div>
                        <div className="text-xs text-muted-foreground">{w.producer ?? ""}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">{w.vintage ?? "-"}</td>
                  <td className="px-4 py-3">{wineTypeLabel(w.wine_type)}</td>
                  <td className="px-4 py-3">{w.volume ?? "-"}</td>
                  <td className="px-4 py-3">R$ {Number(w.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-3">R$ {Number(w.sale_price).toFixed(2)}</td>
                  <td className="px-4 py-3">{markup}{markup !== "-" && "%"}</td>
                  <td className="px-4 py-3">{stockMap[w.id] ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {(showForm || editWine) && (
        <WineForm
          wine={editWine}
          suppliers={suppliers}
          restaurantId={restaurantId!}
          onClose={() => { setShowForm(false); setEditWine(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["wines"] });
            setShowForm(false);
            setEditWine(null);
          }}
        />
      )}
    </div>
  );
}

function wineTypeLabel(t: string | null) {
  if (!t) return "-";
  return LEGACY_TYPE_MAP[t] ?? t;
}

function WineForm({
  wine,
  suppliers,
  restaurantId,
  onClose,
  onSaved,
}: {
  wine?: Wine | null;
  suppliers: { id: string; name: string }[];
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!wine;
  const initialType = wine?.wine_type ? (LEGACY_TYPE_MAP[wine.wine_type] ?? wine.wine_type) : "Tinto";
  const typeInList = DEFAULT_TYPES.includes(initialType);
  const initialVolume = wine?.volume ?? "750 ml";
  const volumeInList = DEFAULT_VOLUMES.includes(initialVolume);

  const [tab, setTab] = useState<"geral" | "carac" | "midia">("geral");

  const [f, setF] = useState({
    name: wine?.name ?? "",
    producer: wine?.producer ?? "",
    vintage: wine?.vintage ? String(wine.vintage) : "",
    region: wine?.region ?? "",
    country: wine?.country ?? "",
    grape: wine?.grape ?? "",
    wine_type: typeInList ? initialType : "__custom",
    wine_type_custom: typeInList ? "" : initialType,
    volume: volumeInList ? initialVolume : "__custom",
    volume_custom: volumeInList ? "" : initialVolume,
    cost_price: wine ? String(wine.cost_price) : "",
    sale_price: wine ? String(wine.sale_price) : "",
    supplier_id: wine?.supplier_id ?? "",
    internal_code: wine?.internal_code ?? "",
    alcohol_pct: wine?.alcohol_pct != null ? String(wine.alcohol_pct) : "",
    sugar_level: wine?.sugar_level ?? "",
    body: wine?.body ?? "",
    tannin: wine?.tannin ?? "",
    acidity: wine?.acidity ?? "",
    aging: wine?.aging ?? "",
    serving_temp_min: wine?.serving_temp_min != null ? String(wine.serving_temp_min) : "",
    serving_temp_max: wine?.serving_temp_max != null ? String(wine.serving_temp_max) : "",
    pairing_notes: wine?.pairing_notes ?? "",
    tasting_notes: wine?.tasting_notes ?? "",
    awards: (wine?.awards ?? []).join(", "),
  });
  const [image, setImage] = useState<string | null>(wine?.image_url ?? null);
  const [gallery, setGallery] = useState<string[]>(wine?.gallery_urls ?? []);
  const [techSheet, setTechSheet] = useState<string | null>(wine?.tech_sheet_url ?? null);
  const [videoUrl, setVideoUrl] = useState<string>(wine?.video_url ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const wineType = f.wine_type === "__custom" ? f.wine_type_custom.trim() : f.wine_type;
    const volume = f.volume === "__custom" ? f.volume_custom.trim() : f.volume;
    const payload = {
      restaurant_id: restaurantId,
      name: f.name,
      producer: f.producer || null,
      vintage: f.vintage ? Number(f.vintage) : null,
      region: f.region || null,
      country: f.country || null,
      grape: f.grape || null,
      wine_type: wineType || null,
      volume: volume || null,
      cost_price: Number(f.cost_price) || 0,
      sale_price: Number(f.sale_price) || 0,
      supplier_id: f.supplier_id || null,
      internal_code: f.internal_code.trim() || null,
      alcohol_pct: f.alcohol_pct ? Number(f.alcohol_pct) : null,
      sugar_level: f.sugar_level || null,
      body: f.body || null,
      tannin: f.tannin || null,
      acidity: f.acidity || null,
      aging: f.aging || null,
      serving_temp_min: f.serving_temp_min ? Number(f.serving_temp_min) : null,
      serving_temp_max: f.serving_temp_max ? Number(f.serving_temp_max) : null,
      pairing_notes: f.pairing_notes || null,
      tasting_notes: f.tasting_notes || null,
      awards: f.awards ? f.awards.split(",").map((s) => s.trim()).filter(Boolean) : null,
      image_url: image,
      gallery_urls: gallery.length ? gallery : null,
      tech_sheet_url: techSheet,
      video_url: videoUrl.trim() || null,
    };
    const { error } = isEdit
      ? await supabase.from("wines").update(payload).eq("id", wine!.id)
      : await supabase.from("wines").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Vinho atualizado" : "Vinho cadastrado");
    onSaved();
  }

  async function remove() {
    if (!wine) return;
    if (!confirm(`Excluir "${wine.name}"? Movimentos passados serão removidos.`)) return;
    setDeleting(true);
    const { error } = await supabase.from("wines").delete().eq("id", wine.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Vinho excluído");
    onSaved();
  }

  return (
    <Modal title={isEdit ? `Editar — ${wine!.name}` : "Novo vinho"} onClose={onClose}>
      {isEdit && (
        <p className="mb-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Alterar Preço de Custo ou Preço de Venda afeta apenas vendas e entradas <strong>futuras</strong>. O histórico de faturamento e os indicadores dos dashboards continuam usando os preços registrados em cada movimento.
        </p>
      )}

      <div className="mb-4 flex gap-1 border-b border-border">
        <FormTab active={tab === "geral"} onClick={() => setTab("geral")}>Geral</FormTab>
        <FormTab active={tab === "carac"} onClick={() => setTab("carac")}>Características</FormTab>
        <FormTab active={tab === "midia"} onClick={() => setTab("midia")}>Mídia</FormTab>
      </div>

      <form onSubmit={save} className="space-y-4">
        {tab === "geral" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome*" required value={f.name} onChange={(v) => setF({ ...f, name: v })} />
            <Field label="Código no restaurante" value={f.internal_code} onChange={(v) => setF({ ...f, internal_code: v })} />
            <Field label="Produtor" value={f.producer} onChange={(v) => setF({ ...f, producer: v })} />
            <Field label="Safra" value={f.vintage} onChange={(v) => setF({ ...f, vintage: v })} />
            <Field label="Região" value={f.region} onChange={(v) => setF({ ...f, region: v })} />
            <Field label="País" value={f.country} onChange={(v) => setF({ ...f, country: v })} />
            <Field label="Uvas" value={f.grape} onChange={(v) => setF({ ...f, grape: v })} />
            <SelectWithCustom
              label="Tipo"
              value={f.wine_type}
              custom={f.wine_type_custom}
              options={DEFAULT_TYPES}
              onChange={(v, c) => setF({ ...f, wine_type: v, wine_type_custom: c })}
            />
            <SelectWithCustom
              label="Volume"
              value={f.volume}
              custom={f.volume_custom}
              options={DEFAULT_VOLUMES}
              onChange={(v, c) => setF({ ...f, volume: v, volume_custom: c })}
            />
            <Field label="Preço de Custo (R$)" type="number" value={f.cost_price} onChange={(v) => setF({ ...f, cost_price: v })} />
            <Field label="Preço de Venda (R$)" type="number" value={f.sale_price} onChange={(v) => setF({ ...f, sale_price: v })} />
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Fornecedor</span>
              <select
                value={f.supplier_id}
                onChange={(e) => setF({ ...f, supplier_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem fornecedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {tab === "carac" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Teor alcoólico (%)" type="number" value={f.alcohol_pct} onChange={(v) => setF({ ...f, alcohol_pct: v })} />
            <SelectField label="Açúcar" value={f.sugar_level} options={SUGAR_LEVELS} onChange={(v) => setF({ ...f, sugar_level: v })} />
            <SelectField label="Corpo" value={f.body} options={BODY} onChange={(v) => setF({ ...f, body: v })} />
            <SelectField label="Taninos" value={f.tannin} options={INTENSITY} onChange={(v) => setF({ ...f, tannin: v })} />
            <SelectField label="Acidez" value={f.acidity} options={INTENSITY} onChange={(v) => setF({ ...f, acidity: v })} />
            <Field label="Envelhecimento" value={f.aging} onChange={(v) => setF({ ...f, aging: v })} />
            <Field label="Temp. mín. serviço (°C)" type="number" value={f.serving_temp_min} onChange={(v) => setF({ ...f, serving_temp_min: v })} />
            <Field label="Temp. máx. serviço (°C)" type="number" value={f.serving_temp_max} onChange={(v) => setF({ ...f, serving_temp_max: v })} />
            <TextArea label="Notas de degustação" value={f.tasting_notes} onChange={(v) => setF({ ...f, tasting_notes: v })} className="sm:col-span-2" />
            <TextArea label="Harmonização" value={f.pairing_notes} onChange={(v) => setF({ ...f, pairing_notes: v })} className="sm:col-span-2" />
            <Field label="Premiações (separadas por vírgula)" value={f.awards} onChange={(v) => setF({ ...f, awards: v })} />
          </div>
        )}

        {tab === "midia" && (
          <div className="space-y-4">
            <MediaUploader label="Imagem principal do rótulo" value={image} onChange={setImage} folder="wines" />
            <MediaGallery label="Galeria de imagens" values={gallery} onChange={setGallery} folder="wines" />
            <MediaUploader
              label="Ficha técnica (PDF)"
              value={techSheet}
              onChange={setTechSheet}
              accept="application/pdf"
              folder="wines/tech"
              kind="file"
            />
            <Field label="Link de vídeo (YouTube, Vimeo...)" value={videoUrl} onChange={setVideoUrl} />
          </div>
        )}

        <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {isEdit && (
            <button type="button" onClick={remove} disabled={deleting} className="mr-auto rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50">
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? "Salvando..." : isEdit ? "Atualizar" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===== GLASSES =====


function GlassesSection() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editGlass, setEditGlass] = useState<Glass | null>(null);

  const { data: glasses = [], isLoading } = useQuery({
    queryKey: ["glasses", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("glasses")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("name");
      if (error) throw error;
      return data as Glass[];
    },
  });

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nova taça
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Taça</th>
              <th className="px-4 py-3">Marca</th>
              <th className="px-4 py-3">Capacidade</th>
              <th className="px-4 py-3">Indicada para</th>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3">Custo</th>
              <th className="px-4 py-3">Estoque</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && glasses.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                Nenhuma taça cadastrada ainda.
              </td></tr>
            )}
            {glasses.map((g) => (
              <tr key={g.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setEditGlass(g)} className="flex items-center gap-2 text-left hover:text-primary">
                    {g.image_url && <img src={g.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                    <span className="font-medium underline-offset-2 hover:underline">{g.name}</span>
                  </button>
                </td>
                <td className="px-4 py-3">{g.brand ?? "-"}</td>
                <td className="px-4 py-3">{g.capacity_ml ? `${g.capacity_ml} ml` : "-"}</td>
                <td className="px-4 py-3">{g.wine_type_recommended ?? "-"}</td>
                <td className="px-4 py-3">{g.material ?? "-"}</td>
                <td className="px-4 py-3">R$ {Number(g.cost_price).toFixed(2)}</td>
                <td className="px-4 py-3">{g.stock_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showForm || editGlass) && (
        <GlassForm
          glass={editGlass}
          restaurantId={restaurantId!}
          onClose={() => { setShowForm(false); setEditGlass(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["glasses"] });
            setShowForm(false);
            setEditGlass(null);
          }}
        />
      )}
    </div>
  );
}

function GlassForm({
  glass,
  restaurantId,
  onClose,
  onSaved,
}: {
  glass?: Glass | null;
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!glass;
  const [f, setF] = useState({
    name: glass?.name ?? "",
    brand: glass?.brand ?? "",
    capacity_ml: glass?.capacity_ml != null ? String(glass.capacity_ml) : "",
    wine_type_recommended: glass?.wine_type_recommended ?? "",
    material: glass?.material ?? "",
    cost_price: glass ? String(glass.cost_price) : "",
    stock_quantity: glass ? String(glass.stock_quantity) : "0",
    notes: glass?.notes ?? "",
  });
  const [image, setImage] = useState<string | null>(glass?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: f.name,
      brand: f.brand || null,
      capacity_ml: f.capacity_ml ? Number(f.capacity_ml) : null,
      wine_type_recommended: f.wine_type_recommended || null,
      material: f.material || null,
      cost_price: Number(f.cost_price) || 0,
      stock_quantity: Number(f.stock_quantity) || 0,
      notes: f.notes || null,
      image_url: image,
    };
    const { error } = isEdit
      ? await supabase.from("glasses").update(payload).eq("id", glass!.id)
      : await supabase.from("glasses").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Taça atualizada" : "Taça cadastrada");
    onSaved();
  }

  async function remove() {
    if (!glass) return;
    if (!confirm(`Excluir "${glass.name}"?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("glasses").delete().eq("id", glass.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Taça excluída");
    onSaved();
  }

  return (
    <Modal title={isEdit ? `Editar — ${glass!.name}` : "Nova taça"} onClose={onClose}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome*" required value={f.name} onChange={(v) => setF({ ...f, name: v })} />
        <Field label="Marca" value={f.brand} onChange={(v) => setF({ ...f, brand: v })} />
        <Field label="Capacidade (ml)" type="number" value={f.capacity_ml} onChange={(v) => setF({ ...f, capacity_ml: v })} />
        <SelectField label="Indicada para" value={f.wine_type_recommended} options={GLASS_WINE_TYPES} onChange={(v) => setF({ ...f, wine_type_recommended: v })} />
        <SelectField label="Material" value={f.material} options={GLASS_MATERIALS} onChange={(v) => setF({ ...f, material: v })} />
        <Field label="Preço de custo (R$)" type="number" value={f.cost_price} onChange={(v) => setF({ ...f, cost_price: v })} />
        <Field label="Estoque atual" type="number" value={f.stock_quantity} onChange={(v) => setF({ ...f, stock_quantity: v })} />
        <TextArea label="Observações" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <MediaUploader label="Imagem da taça" value={image} onChange={setImage} folder="glasses" />
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-2 sm:col-span-2">
          {isEdit && (
            <button type="button" onClick={remove} disabled={deleting} className="mr-auto rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50">
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? "Salvando..." : isEdit ? "Atualizar" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===== shared UI =====

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col rounded-lg border border-border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-6">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label, type = "text", value, onChange, required,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        step="0.01"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function SelectWithCustom({
  label, value, custom, options, onChange,
}: {
  label: string; value: string; custom: string; options: string[]; onChange: (v: string, c: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value, custom)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">Outro (personalizado)…</option>
      </select>
      {value === "__custom" && (
        <input
          autoFocus
          placeholder="Digite o valor"
          value={custom}
          onChange={(e) => onChange(value, e.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      )}
    </label>
  );
}

function FormTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
