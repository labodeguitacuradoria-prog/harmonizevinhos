import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Package, Minus } from "lucide-react";

export const Route = createFileRoute("/_app/app/wines")({
  component: WinesPage,
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
};

const DEFAULT_TYPES = ["Tinto", "Branco", "Rosé", "Espumante", "Sobremesa", "Fortificado"];
const DEFAULT_VOLUMES = ["750 ml", "375 ml", "187 ml", "Taça"];
const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto", white: "Branco", rose: "Rosé",
  sparkling: "Espumante", dessert: "Sobremesa", fortified: "Fortificado",
};

function WinesPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editWine, setEditWine] = useState<Wine | null>(null);
  const [moveWine, setMoveWine] = useState<Wine | null>(null);

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
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vinhos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo, preços e estoque da sua adega.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Novo vinho
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
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
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && wines.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                Nenhum vinho cadastrado ainda.
              </td></tr>
            )}
            {wines.map((w) => {
              const markup = w.cost_price > 0 ? ((Number(w.sale_price) / Number(w.cost_price) - 1) * 100).toFixed(0) : "-";
              return (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditWine(w)}
                      className="text-left hover:text-primary"
                    >
                      <div className="font-medium underline-offset-2 hover:underline">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.producer ?? ""}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3">{w.vintage ?? "-"}</td>
                  <td className="px-4 py-3">{wineTypeLabel(w.wine_type)}</td>
                  <td className="px-4 py-3">{w.volume ?? "-"}</td>
                  <td className="px-4 py-3">R$ {Number(w.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-3">R$ {Number(w.sale_price).toFixed(2)}</td>
                  <td className="px-4 py-3">{markup}{markup !== "-" && "%"}</td>
                  <td className="px-4 py-3">{stockMap[w.id] ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setMoveWine(w)}
                      className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent"
                    >
                      Movimento
                    </button>
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
      {moveWine && (
        <MovementForm
          wine={moveWine}
          restaurantId={restaurantId!}
          onClose={() => setMoveWine(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["stock-map"] });
            qc.invalidateQueries({ queryKey: ["restaurant-stats"] });
            setMoveWine(null);
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
  suppliers,
  restaurantId,
  onClose,
  onSaved,
}: {
  suppliers: { id: string; name: string }[];
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: "",
    producer: "",
    vintage: "",
    region: "",
    country: "",
    grape: "",
    wine_type: "Tinto",
    wine_type_custom: "",
    volume: "750 ml",
    volume_custom: "",
    cost_price: "",
    sale_price: "",
    supplier_id: "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const wineType = f.wine_type === "__custom" ? f.wine_type_custom.trim() : f.wine_type;
    const volume = f.volume === "__custom" ? f.volume_custom.trim() : f.volume;
    const { error } = await supabase.from("wines").insert({
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
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Vinho cadastrado");
    onSaved();
  }

  return (
    <Modal title="Novo vinho" onClose={onClose}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome*" required value={f.name} onChange={(v) => setF({ ...f, name: v })} />
        <Field label="Produtor" value={f.producer} onChange={(v) => setF({ ...f, producer: v })} />
        <Field label="Safra" type="number" value={f.vintage} onChange={(v) => setF({ ...f, vintage: v })} />
        <Field label="Região" value={f.region} onChange={(v) => setF({ ...f, region: v })} />
        <Field label="País" value={f.country} onChange={(v) => setF({ ...f, country: v })} />
        <Field label="Uvas" value={f.grape} onChange={(v) => setF({ ...f, grape: v })} />
        <label className="block">
          <span className="text-sm font-medium">Tipo</span>
          <select
            value={f.wine_type}
            onChange={(e) => setF({ ...f, wine_type: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DEFAULT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="__custom">Outro (personalizado)…</option>
          </select>
          {f.wine_type === "__custom" && (
            <input
              autoFocus
              placeholder="Digite o tipo"
              value={f.wine_type_custom}
              onChange={(e) => setF({ ...f, wine_type_custom: e.target.value })}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </label>
        <label className="block">
          <span className="text-sm font-medium">Volume</span>
          <select
            value={f.volume}
            onChange={(e) => setF({ ...f, volume: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DEFAULT_VOLUMES.map((v) => <option key={v} value={v}>{v}</option>)}
            <option value="__custom">Outro (personalizado)…</option>
          </select>
          {f.volume === "__custom" && (
            <input
              autoFocus
              placeholder="Ex.: 1 L, 500 ml"
              value={f.volume_custom}
              onChange={(e) => setF({ ...f, volume_custom: e.target.value })}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </label>
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
        <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MovementForm({
  wine,
  restaurantId,
  onClose,
  onSaved,
}: {
  wine: Wine;
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"entry" | "sale">("entry");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const unit = price ? Number(price) : type === "sale" ? Number(wine.sale_price) : Number(wine.cost_price);
    const { error } = await supabase.from("inventory_movements").insert({
      wine_id: wine.id,
      restaurant_id: restaurantId,
      movement_type: type,
      quantity: Number(qty),
      unit_price: unit,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Movimento registrado");
    onSaved();
  }

  return (
    <Modal title={wine.name} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setType("entry")} className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${type === "entry" ? "border-primary bg-primary/10" : "border-input"}`}>
            <Package className="h-4 w-4" /> Entrada
          </button>
          <button type="button" onClick={() => setType("sale")} className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${type === "sale" ? "border-primary bg-primary/10" : "border-input"}`}>
            <Minus className="h-4 w-4" /> Venda
          </button>
        </div>
        <Field label="Quantidade" type="number" value={qty} onChange={setQty} required />
        <Field
          label={`Preço unitário (R$) — padrão R$ ${Number(type === "sale" ? wine.sale_price : wine.cost_price).toFixed(2)}`}
          type="number"
          value={price}
          onChange={setPrice}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
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
