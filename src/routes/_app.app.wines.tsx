import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Wine as WineIcon, GlassWater, ScanLine, Info, AlertTriangle, Check as CheckIcon, Pencil } from "lucide-react";
import { MediaUploader, MediaGallery } from "@/components/MediaUploader";
import { BarcodeScanner } from "@/components/BarcodeScanner";

function isGlassVol(v: string | null | undefined) {
  if (!v) return false;
  const s = v.toLowerCase();
  return s.includes("taça") || s.includes("taca");
}

function WineStatusBadge({ wine }: { wine: { active_on_menu: boolean; count_in_stock: boolean } }) {
  if (wine.active_on_menu) return null;
  const archived = !wine.count_in_stock;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        archived
          ? "bg-muted text-muted-foreground"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      }`}
    >
      {archived ? "Arquivado" : "Fora da carta"}
    </span>
  );
}


function ReorderAlertCell({
  wine,
  stock,
  avg4m,
  compact,
}: {
  wine: Wine;
  stock: number | null;
  avg4m: number;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const suggested = Math.max(1, Math.ceil(avg4m));
  const min = wine.min_stock_override != null ? Math.max(0, Math.round(Number(wine.min_stock_override))) : suggested;
  const [value, setValue] = useState<string>(wine.min_stock_override != null ? String(wine.min_stock_override) : "");
  const [saving, setSaving] = useState(false);

  const hasStock = stock != null;
  const needsReorder = hasStock && stock <= min;

  async function save(next: number | null) {
    setSaving(true);
    const { error } = await supabase.from("wines").update({ min_stock_override: next }).eq("id", wine.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Estoque mínimo atualizado");
    qc.invalidateQueries({ queryKey: ["wines"] });
    setEditing(false);
  }

  const badge = needsReorder ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-500">
      <AlertTriangle className="h-3 w-3" /> Comprar
    </span>
  ) : hasStock ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
      <CheckIcon className="h-3 w-3" /> Ok
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Sem contagem
    </span>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {badge}
        <span className="text-[9px] text-muted-foreground">mín {min}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {badge}
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
          title="Ajustar estoque mínimo"
        >
          mín {min} <Pencil className="h-2.5 w-2.5" />
        </button>
      </div>
      {editing && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-border bg-popover p-3 text-xs shadow-lg">
          <div className="mb-2 text-muted-foreground">
            Sugestão do sistema: <span className="font-semibold text-foreground">{suggested}</span> un.
            <div className="text-[10px] text-muted-foreground/80">(média dos últimos 4 meses, arredondada)</div>
          </div>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estoque mínimo manual</span>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Padrão: ${suggested}`}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => { setValue(""); save(null); }}
              className="rounded-md border border-input px-2 py-1 text-[11px] hover:bg-accent"
              title="Voltar a usar a sugestão automática"
            >
              Usar automático
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(value === "" ? null : Number(value))}
              className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


type CatalogPick = {
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  country: string | null;
  grape: string | null;
  wine_type: string | null;
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
  barcode: string | null;
  image_url: string | null;
};

function CatalogSearch({ onPick }: { onPick: (c: CatalogPick) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(CatalogPick & { id: string })[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("wine_catalog")
        .select("id,name,producer,vintage,region,appellation,country,grape,wine_type,alcohol_pct,sugar_level,body,tannin,acidity,aging,serving_temp_min,serving_temp_max,pairing_notes,tasting_notes,barcode,image_url")
        .eq("status", "approved")
        .or(`name.ilike.%${q}%,producer.ilike.%${q}%,barcode.eq.${q}`)
        .limit(8);
      setResults((data as any) ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="relative rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
        <Info className="h-3 w-3" /> Buscar no Catálogo Global (preenche os campos vazios automaticamente)
      </div>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Digite nome, produtor ou código de barras..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {open && (q.trim().length >= 2) && (
        <div className="absolute left-3 right-3 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {loading && <div className="p-3 text-xs text-muted-foreground">Buscando...</div>}
          {!loading && results.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhum rótulo encontrado.</div>}
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => { onPick(r); setOpen(false); setQ(""); }}
              className="block w-full border-b border-border px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <div className="font-medium">{r.name} {r.vintage ? <span className="text-muted-foreground">— {r.vintage}</span> : null}</div>
              <div className="text-xs text-muted-foreground">{[r.producer, r.region, r.country].filter(Boolean).join(" • ")}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/app/wines")({
  component: ProductsPage,
});

type Video = { title: string; url: string };

type Wine = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  appellation: string | null;
  country: string | null;
  wine_type: string | null;
  style: string | null;
  grape: string | null;
  volume: string | null;
  cost_price: number;
  sale_price: number;
  supplier_id: string | null;
  suppliers: string[] | null;
  internal_code: string | null;
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
  pairing_notes: string | null;
  tasting_notes: string | null;
  awards: string[] | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  tech_sheet_url: string | null;
  video_url: string | null;
  videos: Video[] | null;
  barcode: string | null;
  active_on_menu: boolean;
  count_in_stock: boolean;
  min_stock_override: number | null;
};

function computeMinStock(w: Pick<Wine, "min_stock_override">, avg4m: number): number {
  if (w.min_stock_override != null) return Math.max(0, Math.round(Number(w.min_stock_override)));
  // suggested = média mensal últimos 4 meses (arredondada para cima)
  return Math.max(1, Math.ceil(avg4m));
}

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

const DEFAULT_TYPES = ["Tinto", "Branco", "Rosé", "Espumante", "Fortificado"];
const DEFAULT_VOLUMES = ["750 ml", "375 ml", "187 ml", "Taça"];
const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto", white: "Branco", rose: "Rosé",
  sparkling: "Espumante", dessert: "Fortificado", fortified: "Fortificado",
};
const SUGAR_LEVELS = ["Seco", "Meio-seco", "Suave", "Doce"];
const INTENSITY = ["Baixo", "Médio", "Alto"];
const BODY = ["Leve", "Médio", "Encorpado"];
const STYLES = [
  "ESPUMANTE", "BRANCO LEVE", "BRANCO AROMÁTICO", "BRANCO ENCORPADO", "ROSÉ",
  "TINTO LEVE", "TINTO MÉDIO", "TINTO ENCORPADO", "FORTIFICADO",
];
const GLASS_WINE_TYPES = ["Universal", "Tinto", "Branco", "Espumante", "Fortificado", "Outro"];
const GLASS_MATERIALS = ["Cristal", "Vidro", "Outro"];

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

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


function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-input bg-background px-1.5 py-1 text-[11px] placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
    />
  );
}

type ColFilters = {

  internal_code: string;
  name: string;
  vintage: string;
  wine_type: string;
  volume: string;
  cost_price: string;
  sale_price: string;
  markup: string;
  stock: string;
  monthly: string;
  alert: "" | "comprar" | "ok" | "sem";
};
const EMPTY_FILTERS: ColFilters = {
  internal_code: "", name: "", vintage: "", wine_type: "", volume: "",
  cost_price: "", sale_price: "", markup: "", stock: "", monthly: "", alert: "",
};

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
function matchText(filter: string, value: string | null | undefined): boolean {
  const s = filter.trim().toLowerCase();
  if (!s) return true;
  return (value ?? "").toLowerCase().includes(s);
}

function WinesSection() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editWine, setEditWine] = useState<Wine | null>(null);
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const setF = (k: keyof ColFilters, v: string) => setFilters((p) => ({ ...p, [k]: v as never }));
  const hasAnyFilter = Object.values(filters).some((v) => v !== "");


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
    queryKey: ["last-stock-count-map", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      // Find latest closed session per restaurant, then read its item counts.
      const { data: sessions } = await supabase
        .from("stock_count_sessions")
        .select("id, reference_date")
        .eq("restaurant_id", restaurantId!)
        .eq("status", "closed")
        .order("reference_date", { ascending: false })
        .limit(1);
      const session = sessions?.[0];
      const map: Record<string, { qty: number; date: string | null }> = {};
      if (!session) return map;
      const { data: items } = await supabase
        .from("stock_count_items")
        .select("wine_id, counted_qty")
        .eq("session_id", session.id);
      for (const it of items ?? []) {
        map[it.wine_id] = { qty: it.counted_qty ?? 0, date: session.reference_date };
      }
      return map;
    },
  });

  const { data: monthlySalesMap = {} } = useQuery({
    queryKey: ["monthly-sales-avg-12m", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id, quantity, occurred_at")
        .eq("restaurant_id", restaurantId!)
        .eq("movement_type", "sale")
        .gte("occurred_at", start);
      const byWine: Record<string, Record<string, number>> = {};
      for (const m of data ?? []) {
        const d = new Date(m.occurred_at as string);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!byWine[m.wine_id]) byWine[m.wine_id] = {};
        byWine[m.wine_id][key] = (byWine[m.wine_id][key] ?? 0) + m.quantity;
      }
      const map: Record<string, number> = {};
      for (const wineId of Object.keys(byWine)) {
        const months = Object.values(byWine[wineId]);
        const total = months.reduce((a, b) => a + b, 0);
        map[wineId] = months.length ? Math.round(total / months.length) : 0;
      }
      return map;
    },
  });

  // Média das vendas dos últimos 4 meses (soma / 4) — usada para sugerir o estoque mínimo.
  const { data: avg4mMap = {} } = useQuery({
    queryKey: ["monthly-sales-avg-4m", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id, quantity, occurred_at")
        .eq("restaurant_id", restaurantId!)
        .eq("movement_type", "sale")
        .gte("occurred_at", start);
      const totals: Record<string, number> = {};
      for (const m of data ?? []) {
        totals[m.wine_id] = (totals[m.wine_id] ?? 0) + m.quantity;
      }
      const map: Record<string, number> = {};
      for (const wineId of Object.keys(totals)) map[wineId] = totals[wineId] / 4;
      return map;
    },
  });


  const filteredWines = wines
    .filter((w) => (onlyActive ? w.active_on_menu : true))
    .filter((w) => {
      const markup = Number(w.cost_price) > 0 ? (Number(w.sale_price) / Number(w.cost_price) - 1) * 100 : null;
      const stock = isGlassVol(w.volume) ? null : (stockMap[w.id]?.qty ?? null);
      const monthly = isGlassVol(w.volume) ? null : (monthlySalesMap[w.id] ?? 0);
      const min = computeMinStock(w, avg4mMap[w.id] ?? 0);
      let alertStatus: "comprar" | "ok" | "sem" = "sem";
      if (!isGlassVol(w.volume)) {
        if (stock == null) alertStatus = "sem";
        else if (stock <= min) alertStatus = "comprar";
        else alertStatus = "ok";
      }
      return (
        matchText(filters.internal_code, w.internal_code) &&
        (matchText(filters.name, w.name) || matchText(filters.name, w.producer)) &&
        matchText(filters.vintage, w.vintage != null ? String(w.vintage) : "") &&
        (filters.wine_type === "" || filters.wine_type === wineTypeLabel(w.wine_type)) &&
        (filters.volume === "" || filters.volume === (w.volume ?? "")) &&
        matchNum(filters.cost_price, Number(w.cost_price)) &&
        matchNum(filters.sale_price, Number(w.sale_price)) &&
        matchNum(filters.markup, markup) &&
        matchNum(filters.stock, stock) &&
        matchNum(filters.monthly, monthly) &&
        (filters.alert === "" || filters.alert === alertStatus)
      );
    });

  const typeOptions = Array.from(new Set(wines.map((w) => wineTypeLabel(w.wine_type)).filter((v) => v && v !== "-"))).sort();
  const volumeOptions = Array.from(new Set(wines.map((w) => w.volume ?? "").filter(Boolean))).sort();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Apenas ativos na carta
          </label>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Novo vinho
        </button>
      </div>


      {/* Mobile: card list */}
      <div className="mt-4 space-y-2 sm:hidden">
        {isLoading && (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        )}
        {!isLoading && filteredWines.length === 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {hasAnyFilter || onlyActive ? "Nenhum vinho encontrado com esses filtros." : "Nenhum vinho cadastrado ainda."}

          </div>
        )}
        {filteredWines.map((w) => {
          const markup = w.cost_price > 0 ? ((Number(w.sale_price) / Number(w.cost_price) - 1) * 100).toFixed(0) : "-";
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setEditWine(w)}
              className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{w.name}</span>
                    {!w.active_on_menu && <WineStatusBadge wine={w} />}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {[w.internal_code, w.producer, w.vintage].filter(Boolean).join(" · ") || "-"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{wineTypeLabel(w.wine_type)}</span>
                    {w.volume && <span>{w.volume}</span>}
                    <span>R$ {Number(w.sale_price).toFixed(2)}</span>
                    {markup !== "-" && <span>mk {markup}%</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estoque</div>
                  <div className="text-base font-semibold leading-none">
                    {isGlassVol(w.volume) ? "—" : (stockMap[w.id]?.qty ?? "—")}
                  </div>
                  {!isGlassVol(w.volume) && stockMap[w.id]?.date && (
                    <div className="text-[9px] text-muted-foreground/80">{fmtDate(stockMap[w.id].date)}</div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Mês: <span className="font-medium text-foreground">{isGlassVol(w.volume) ? "—" : (monthlySalesMap[w.id] ?? 0)}</span>
                  </div>
                  {!isGlassVol(w.volume) && (
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <ReorderAlertCell wine={w} stock={stockMap[w.id]?.qty ?? null} avg4m={avg4mMap[w.id] ?? 0} compact />
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="no-scrollbar mt-4 hidden overflow-auto rounded-lg border border-border bg-card max-h-[calc(100vh-220px)] sm:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Safra</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Custo</th>
              <th className="px-4 py-3">Venda</th>
              <th className="px-4 py-3">Markup</th>
              <th className="px-4 py-3">
                <div>Estoque</div>
                <div className="text-[9px] font-normal normal-case text-muted-foreground/70">última contagem</div>
              </th>
              <th className="px-4 py-3">Venda mensal</th>
              <th className="px-4 py-3">Alerta de compra</th>
            </tr>
            <tr className="border-t border-border/60 bg-card/80 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-normal">
              <th><FilterInput value={filters.internal_code} onChange={(v) => setF("internal_code", v)} placeholder="filtrar" /></th>
              <th><FilterInput value={filters.name} onChange={(v) => setF("name", v)} placeholder="rótulo/produtor" /></th>
              <th><FilterInput value={filters.vintage} onChange={(v) => setF("vintage", v)} placeholder="ex. 2020" /></th>
              <th>
                <select
                  value={filters.wine_type}
                  onChange={(e) => setF("wine_type", e.target.value)}
                  className="w-full rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                >
                  <option value="">Todos</option>
                  {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </th>
              <th>
                <select
                  value={filters.volume}
                  onChange={(e) => setF("volume", e.target.value)}
                  className="w-full rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                >
                  <option value="">Todos</option>
                  {volumeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </th>
              <th><FilterInput value={filters.cost_price} onChange={(v) => setF("cost_price", v)} placeholder=">50 ou 10-30" /></th>
              <th><FilterInput value={filters.sale_price} onChange={(v) => setF("sale_price", v)} placeholder=">100" /></th>
              <th><FilterInput value={filters.markup} onChange={(v) => setF("markup", v)} placeholder=">150" /></th>
              <th><FilterInput value={filters.stock} onChange={(v) => setF("stock", v)} placeholder="<5" /></th>
              <th><FilterInput value={filters.monthly} onChange={(v) => setF("monthly", v)} placeholder=">0" /></th>
              <th>
                <select
                  value={filters.alert}
                  onChange={(e) => setF("alert", e.target.value)}
                  className="w-full rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                >
                  <option value="">Todos</option>
                  <option value="comprar">Comprar</option>
                  <option value="ok">Ok</option>
                  <option value="sem">Sem contagem</option>
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && filteredWines.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                {hasAnyFilter || onlyActive ? "Nenhum vinho encontrado com esses filtros." : "Nenhum vinho cadastrado ainda."}
              </td></tr>
            )}

            {filteredWines.map((w) => {
              const markup = w.cost_price > 0 ? ((Number(w.sale_price) / Number(w.cost_price) - 1) * 100).toFixed(0) : "-";
              return (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.internal_code ?? "-"}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setEditWine(w)} className="text-left hover:text-primary">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium underline-offset-2 hover:underline">{w.name}</span>
                        {!w.active_on_menu && <WineStatusBadge wine={w} />}
                      </div>
                      <div className="text-xs text-muted-foreground">{w.producer ?? ""}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3">{w.vintage ?? "-"}</td>
                  <td className="px-4 py-3">{wineTypeLabel(w.wine_type)}</td>
                  <td className="px-4 py-3">{w.volume ?? "-"}</td>
                  <td className="px-4 py-3">R$ {Number(w.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-3">R$ {Number(w.sale_price).toFixed(2)}</td>
                  <td className="px-4 py-3">{markup}{markup !== "-" && "%"}</td>
                  <td className="px-4 py-3">
                    {isGlassVol(w.volume) ? (
                      "—"
                    ) : stockMap[w.id] ? (
                      <>
                        <div className="font-medium leading-none">{stockMap[w.id].qty}</div>
                        {stockMap[w.id].date && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground/80">{fmtDate(stockMap[w.id].date)}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{isGlassVol(w.volume) ? "—" : (monthlySalesMap[w.id] ?? 0)}</td>
                  <td className="px-4 py-3">
                    {isGlassVol(w.volume) ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ReorderAlertCell wine={w} stock={stockMap[w.id]?.qty ?? null} avg4m={avg4mMap[w.id] ?? 0} />
                    )}
                  </td>
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

  const initialStyle = wine?.style ?? "";
  const styleInList = STYLES.includes(initialStyle);

  const [f, setF] = useState({
    name: wine?.name ?? "",
    producer: wine?.producer ?? "",
    vintage: wine?.vintage ? String(wine.vintage) : "",
    region: wine?.region ?? "",
    appellation: wine?.appellation ?? "",
    country: wine?.country ?? "",
    grape: wine?.grape ?? "",
    wine_type: typeInList ? initialType : "__custom",
    wine_type_custom: typeInList ? "" : initialType,
    style: styleInList ? initialStyle : (initialStyle ? "__custom" : ""),
    style_custom: styleInList ? "" : initialStyle,
    volume: volumeInList ? initialVolume : "__custom",
    volume_custom: volumeInList ? "" : initialVolume,
    cost_price: wine ? String(wine.cost_price) : "",
    sale_price: wine ? String(wine.sale_price) : "",
    supplier_id: wine?.supplier_id ?? "",
    internal_code: wine?.internal_code ?? "",
    alcohol_pct: wine?.alcohol_pct != null ? String(wine.alcohol_pct) : "",
    sugar_level: wine?.sugar_level ?? "",
    sugar_g_l: wine?.sugar_g_l != null ? String(wine.sugar_g_l) : "",
    body: wine?.body ?? "",
    tannin: wine?.tannin ?? "",
    acidity: wine?.acidity ?? "",
    acidity_g_l: wine?.acidity_g_l != null ? String(wine.acidity_g_l) : "",
    acidity_ph: wine?.acidity_ph != null ? String(wine.acidity_ph) : "",
    elaboration: wine?.elaboration ?? "",
    aging: wine?.aging ?? "",
    serving_temp_min: wine?.serving_temp_min != null ? String(wine.serving_temp_min) : "",
    serving_temp_max: wine?.serving_temp_max != null ? String(wine.serving_temp_max) : "",
    pairing_notes: wine?.pairing_notes ?? "",
    tasting_notes: wine?.tasting_notes ?? "",
    barcode: wine?.barcode ?? "",
    active_on_menu: wine?.active_on_menu ?? true,
    count_in_stock: wine?.count_in_stock ?? true,
  });
  const [suppliersList, setSuppliersList] = useState<string[]>(wine?.suppliers ?? []);
  const [awardsList, setAwardsList] = useState<string[]>(wine?.awards ?? []);
  const [videosList, setVideosList] = useState<Video[]>(
    Array.isArray(wine?.videos) ? (wine!.videos as Video[]) : (wine?.video_url ? [{ title: "Vídeo", url: wine.video_url }] : [])
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [image, setImage] = useState<string | null>(wine?.image_url ?? null);
  const [gallery, setGallery] = useState<string[]>(wine?.gallery_urls ?? []);
  const [techSheet, setTechSheet] = useState<string | null>(wine?.tech_sheet_url ?? null);
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
      appellation: f.appellation || null,
      country: f.country || null,
      grape: f.grape || null,
      wine_type: wineType || null,
      style: (f.style === "__custom" ? f.style_custom.trim() : f.style) || null,
      volume: volume || null,
      cost_price: Number(f.cost_price) || 0,
      sale_price: Number(f.sale_price) || 0,
      supplier_id: f.supplier_id || null,
      suppliers: suppliersList.length ? suppliersList : null,
      internal_code: f.internal_code.trim() || null,
      alcohol_pct: f.alcohol_pct ? Number(f.alcohol_pct) : null,
      sugar_level: f.sugar_level || null,
      sugar_g_l: f.sugar_g_l ? Number(f.sugar_g_l) : null,
      body: f.body || null,
      tannin: f.tannin || null,
      acidity: f.acidity || null,
      acidity_g_l: f.acidity_g_l ? Number(f.acidity_g_l) : null,
      acidity_ph: f.acidity_ph ? Number(f.acidity_ph) : null,
      elaboration: f.elaboration || null,
      aging: f.aging || null,
      serving_temp_min: f.serving_temp_min ? Number(f.serving_temp_min) : null,
      serving_temp_max: f.serving_temp_max ? Number(f.serving_temp_max) : null,
      pairing_notes: f.pairing_notes || null,
      tasting_notes: f.tasting_notes || null,
      awards: awardsList.length ? awardsList : null,
      image_url: image,
      gallery_urls: gallery.length ? gallery : null,
      tech_sheet_url: techSheet,
      video_url: videosList[0]?.url ?? null,
      videos: videosList.length ? videosList : null,
      barcode: f.barcode.trim() || null,
      active_on_menu: f.active_on_menu,
      count_in_stock: f.count_in_stock,
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
            <div className="sm:col-span-2">
              <CatalogSearch
                onPick={(c) => {
                  setF((prev) => ({
                    ...prev,
                    name: prev.name || c.name || "",
                    producer: prev.producer || c.producer || "",
                    vintage: prev.vintage || (c.vintage ? String(c.vintage) : ""),
                    region: prev.region || c.region || "",
                    appellation: prev.appellation || (c as any).appellation || "",
                    country: prev.country || c.country || "",
                    grape: prev.grape || c.grape || "",
                    wine_type: prev.wine_type === "Tinto" && c.wine_type
                      ? (DEFAULT_TYPES.includes(c.wine_type) ? c.wine_type : "__custom")
                      : prev.wine_type,
                    wine_type_custom: !DEFAULT_TYPES.includes(c.wine_type ?? "") ? (c.wine_type ?? "") : prev.wine_type_custom,
                    alcohol_pct: prev.alcohol_pct || (c.alcohol_pct != null ? String(c.alcohol_pct) : ""),
                    sugar_level: prev.sugar_level || c.sugar_level || "",
                    body: prev.body || c.body || "",
                    tannin: prev.tannin || c.tannin || "",
                    acidity: prev.acidity || c.acidity || "",
                    aging: prev.aging || c.aging || "",
                    serving_temp_min: prev.serving_temp_min || (c.serving_temp_min != null ? String(c.serving_temp_min) : ""),
                    serving_temp_max: prev.serving_temp_max || (c.serving_temp_max != null ? String(c.serving_temp_max) : ""),
                    pairing_notes: prev.pairing_notes || c.pairing_notes || "",
                    tasting_notes: prev.tasting_notes || c.tasting_notes || "",
                    barcode: prev.barcode || c.barcode || "",
                  }));
                  if (!image && c.image_url) setImage(c.image_url);
                }}
              />
            </div>
            <Field label="Nome*" required value={f.name} onChange={(v) => setF({ ...f, name: v })} hint="Nome do rótulo como aparece no contra-rótulo, sem incluir produtor ou safra." placeholder="Ex: Alpha Cabernet Sauvignon" />
            <Field label="Código no restaurante" value={f.internal_code} onChange={(v) => setF({ ...f, internal_code: v })} hint="Código interno usado pelo restaurante para identificar o rótulo (PDV, carta, planilha)." placeholder="Ex: V-014" />
            <Field label="Produtor" value={f.producer} onChange={(v) => setF({ ...f, producer: v })} hint="Vinícola ou produtor responsável pela elaboração do vinho." placeholder="Ex: Viña Montes" />
            <Field label="Safra" value={f.vintage} onChange={(v) => setF({ ...f, vintage: v })} hint="Ano da colheita das uvas. Deixe em branco para vinhos sem safra (NV)." placeholder="Ex: 2020" />
            <Field label="Região" value={f.region} onChange={(v) => setF({ ...f, region: v })} hint="Região vitivinícola, denominação ou apelação de origem." placeholder="Ex: Vale do Colchagua" />
            <Field label="País" value={f.country} onChange={(v) => setF({ ...f, country: v })} hint="País de origem do vinho, por extenso e em português." placeholder="Ex: Chile" />
            <Field label="AOP / Denominação" value={f.appellation} onChange={(v) => setF({ ...f, appellation: v })} hint="Somente vinhos europeus. Denominação de Origem Protegida — França: AOP/AOC; Itália: DOC/DOCG; Espanha: DO/DOCa; Portugal: DOP/DOC; Alemanha: g.U./Prädikatswein." placeholder="Ex: AOC Saint-Émilion Grand Cru" />
            <Field label="Uvas" value={f.grape} onChange={(v) => setF({ ...f, grape: v })} hint="Castas/uvas e seus percentuais quando houver corte. Separe por vírgula." placeholder="Ex: Cabernet Sauvignon 85%, Merlot 15%" />
            <SelectWithCustom
              label="Tipo"
              hint="Categoria geral do vinho. Use 'Outro' apenas quando nenhuma das opções padrão se aplicar."
              value={f.wine_type}
              custom={f.wine_type_custom}
              options={DEFAULT_TYPES}
              onChange={(v, c) => setF({ ...f, wine_type: v, wine_type_custom: c })}
            />
            <SelectWithCustom
              label="Volume"
              hint="Capacidade da garrafa ou medida da dose (Taça). Use 'Outro' para volumes não listados."
              value={f.volume}
              custom={f.volume_custom}
              options={DEFAULT_VOLUMES}
              onChange={(v, c) => setF({ ...f, volume: v, volume_custom: c })}
            />
            <Field label="Preço de Custo (R$)" type="number" value={f.cost_price} onChange={(v) => setF({ ...f, cost_price: v })} hint="Valor pago ao fornecedor por unidade (garrafa/dose). Usado para cálculo de margem." placeholder="Ex: 85.00" />
            <Field label="Preço de Venda (R$)" type="number" value={f.sale_price} onChange={(v) => setF({ ...f, sale_price: v })} hint="Preço cobrado do cliente final, conforme a carta do restaurante." placeholder="Ex: 220.00" />
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
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Código de barras</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={f.barcode}
                  onChange={(e) => setF({ ...f, barcode: e.target.value })}
                  placeholder="EAN / UPC"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setScanOpen(true)}
                  className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                >
                  <ScanLine className="h-4 w-4" /> Escanear
                </button>
              </div>
            </label>
            <div className="sm:col-span-2 mt-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.active_on_menu}
                    onChange={(e) => setF({ ...f, active_on_menu: e.target.checked })}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium">Ativo na carta</span>
                    <span className="block text-xs text-muted-foreground">Aparece como rótulo disponível para venda.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.count_in_stock}
                    onChange={(e) => setF({ ...f, count_in_stock: e.target.checked })}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium">Contar no estoque</span>
                    <span className="block text-xs text-muted-foreground">Entra na lista da contagem do staff.</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
        {scanOpen && (
          <BarcodeScanner
            onDetected={(code) => { setF((prev) => ({ ...prev, barcode: code.trim() })); setScanOpen(false); }}
            onClose={() => setScanOpen(false)}
          />
        )}

        {tab === "carac" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectWithCustom
              label="Estilo"
              hint="Estilo/subcategoria do vinho (ex.: Encorpado e complexo, Fresco e frutado)."
              value={f.style}
              custom={f.style_custom}
              options={STYLES}
              onChange={(v, c) => setF({ ...f, style: v, style_custom: c })}
            />
            <Field label="Teor alcoólico (%)" type="number" value={f.alcohol_pct} onChange={(v) => setF({ ...f, alcohol_pct: v })} hint="Porcentagem de álcool em volume, conforme rótulo." placeholder="Ex: 13.5" />
            <SelectField label="Açúcar" value={f.sugar_level} options={SUGAR_LEVELS} onChange={(v) => setF({ ...f, sugar_level: v })} hint="Nível de açúcar residual (seco, meio-seco, demi-sec, doce...)." />
            <Field label="Açúcar residual (g/L)" type="number" value={f.sugar_g_l} onChange={(v) => setF({ ...f, sugar_g_l: v })} hint="Concentração de açúcar residual em gramas por litro." placeholder="Ex: 4.5" />
            <SelectField label="Corpo" value={f.body} options={BODY} onChange={(v) => setF({ ...f, body: v })} hint="Sensação de peso/estrutura do vinho na boca." />
            <SelectField label="Taninos" value={f.tannin} options={INTENSITY} onChange={(v) => setF({ ...f, tannin: v })} hint="Intensidade dos taninos (adstringência). Mais relevante em tintos." />
            <SelectField label="Acidez" value={f.acidity} options={INTENSITY} onChange={(v) => setF({ ...f, acidity: v })} hint="Percepção de acidez/frescor no paladar." />
            <Field label="Acidez total (g/L)" type="number" value={f.acidity_g_l} onChange={(v) => setF({ ...f, acidity_g_l: v })} hint="Acidez total em gramas de ácido tartárico por litro." placeholder="Ex: 5.8" />
            <Field label="pH" type="number" value={f.acidity_ph} onChange={(v) => setF({ ...f, acidity_ph: v })} hint="Valor de pH do vinho." placeholder="Ex: 3.5" />
            <Field label="Elaboração" value={f.elaboration} onChange={(v) => setF({ ...f, elaboration: v })} hint="Método de vinificação: fermentação, maceração, tanques, etc." placeholder="Ex: Fermentação em inox, maceração 20 dias" className="sm:col-span-2" />
            <Field label="Maturação" value={f.aging} onChange={(v) => setF({ ...f, aging: v })} hint="Envelhecimento: barricas, tempo em garrafa, etc." placeholder="Ex: 12 meses em barrica de carvalho francês (30% novas)" className="sm:col-span-2" />
            <Field label="Temp. mín. serviço (°C)" type="number" value={f.serving_temp_min} onChange={(v) => setF({ ...f, serving_temp_min: v })} hint="Temperatura mínima recomendada para servir." placeholder="Ex: 16" />
            <Field label="Temp. máx. serviço (°C)" type="number" value={f.serving_temp_max} onChange={(v) => setF({ ...f, serving_temp_max: v })} hint="Temperatura máxima recomendada para servir." placeholder="Ex: 18" />
            <TextArea label="Notas de degustação" value={f.tasting_notes} onChange={(v) => setF({ ...f, tasting_notes: v })} className="sm:col-span-2" hint="Descrição sensorial: cor, aromas, sabor, corpo, taninos e final de boca." placeholder="Ex: Rubi intenso. Aromas de frutas negras maduras, especiarias e notas de baunilha. Taninos firmes, corpo médio e final persistente." />
            <TextArea label="Harmonização" value={f.pairing_notes} onChange={(v) => setF({ ...f, pairing_notes: v })} className="sm:col-span-2" hint="Sugestões gastronômicas: pratos, proteínas, queijos e temperos que combinam." placeholder="Ex: Carnes vermelhas grelhadas, cordeiro e queijos curados." />
            <div className="sm:col-span-2">
              <StringListEditor
                label="Premiações"
                hint="Lista de prêmios e pontuações relevantes."
                placeholder="Ex: 92 pts Wine Spectator"
                values={awardsList}
                onChange={setAwardsList}
              />
            </div>
            <div className="sm:col-span-2">
              <StringListEditor
                label="Fornecedores"
                hint="Um ou mais fornecedores deste rótulo para o restaurante."
                placeholder="Ex: Mistral"
                values={suppliersList}
                onChange={setSuppliersList}
              />
            </div>
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
            <VideoListEditor values={videosList} onChange={setVideosList} />
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

      {/* Mobile: card list */}
      <div className="mt-4 space-y-2 sm:hidden">
        {isLoading && (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        )}
        {!isLoading && glasses.length === 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma taça cadastrada ainda.
          </div>
        )}
        {glasses.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setEditGlass(g)}
            className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left active:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{g.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {[g.brand, g.capacity_ml ? `${g.capacity_ml} ml` : null, g.material].filter(Boolean).join(" · ") || "-"}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {g.wine_type_recommended ?? "Universal"} · R$ {Number(g.cost_price).toFixed(2)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estoque</div>
                <div className="text-base font-semibold leading-none">{g.stock_quantity}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="no-scrollbar mt-4 hidden overflow-auto rounded-lg border border-border bg-card max-h-[calc(100vh-220px)] sm:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
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

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span>{children}</span>
      {hint && (
        <span
          title={hint}
          aria-label={hint}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full text-muted-foreground/60 hover:text-primary"
        >
          <Info className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}

function Field({
  label, type = "text", value, onChange, required, hint, placeholder, className = "",
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string; placeholder?: string; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type={type}
        step="0.01"
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function StringListEditor({ label, hint, placeholder, values, onChange }: { label: string; hint?: string; placeholder?: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="mt-1 flex gap-2">
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } }
          }}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } }}
          className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
        >Adicionar</button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
              {v}
              <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoListEditor({ values, onChange }: { values: Video[]; onChange: (v: Video[]) => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div>
      <FieldLabel hint="Adicione um ou mais vídeos (YouTube, Vimeo, etc.) com título opcional.">Vídeos</FieldLabel>
      <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex: Apresentação)"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40" />
        <button type="button" onClick={() => { if (url.trim()) { onChange([...values, { title: title.trim() || "Vídeo", url: url.trim() }]); setTitle(""); setUrl(""); } }}
          className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">Adicionar</button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {values.map((v, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{v.title}</div>
                <a href={v.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary hover:underline">{v.url}</a>
              </div>
              <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextArea({ label, value, onChange, className = "", hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; className?: string; hint?: string; placeholder?: string }) {
  return (
    <label className={`block ${className}`}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange, hint }: { label: string; value: string; options: string[]; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
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
  label, value, custom, options, onChange, hint,
}: {
  label: string; value: string; custom: string; options: string[]; onChange: (v: string, c: string) => void; hint?: string;
}) {
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
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
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
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
