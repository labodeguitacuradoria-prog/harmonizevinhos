import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Wine, Package, TrendingUp, Store } from "lucide-react";
import { MaterialsManager } from "@/routes/_app.app.suppliers";

export const Route = createFileRoute("/_app/supplier/")({
  component: SupplierPortal,
});

function SupplierPortal() {
  const { role, supplierId, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== "supplier") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["supplier-data", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data: wines } = await supabase
        .from("wines")
        .select("id, name, vintage, sale_price, cost_price, restaurant_id, restaurants(name, city)")
        .eq("supplier_id", supplierId!);
      const wineIds = (wines ?? []).map((w) => w.id);
      const { data: movs } = wineIds.length
        ? await supabase
            .from("inventory_movements")
            .select("wine_id, movement_type, quantity, unit_price, occurred_at, restaurant_id")
            .in("wine_id", wineIds)
        : { data: [] };
      const { data: materials } = await supabase
        .from("supplier_materials")
        .select("*")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false });
      const { data: orders } = await supabase
        .from("purchase_orders")
        .select("id, restaurant_id, created_at, status, expected_date, restaurants(name)")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false });
      const orderIds = (orders ?? []).map((o) => o.id);
      const { data: orderItems } = orderIds.length
        ? await supabase
            .from("purchase_order_items")
            .select("id, order_id, wine_id, qty_bottles, qty_received, status")
            .in("order_id", orderIds)
        : { data: [] };
      return {
        wines: wines ?? [],
        movs: movs ?? [],
        materials: materials ?? [],
        orders: orders ?? [],
        orderItems: orderItems ?? [],
      };
    },
  });

  if (loading || isLoading) return <div className="p-10 text-muted-foreground">Carregando...</div>;

  const wines = data?.wines ?? [];
  const movs = data?.movs ?? [];

  const restaurantIds = Array.from(new Set(wines.map((w) => w.restaurant_id)));
  const stockByWine: Record<string, number> = {};
  for (const m of movs) {
    const sign = m.movement_type === "sale" ? -1 : 1;
    stockByWine[m.wine_id] = (stockByWine[m.wine_id] ?? 0) + sign * m.quantity;
  }
  const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const bottlesSoldMonth = movs
    .filter((m) => m.movement_type === "sale" && new Date(m.occurred_at) >= startMonth)
    .reduce((s, m) => s + m.quantity, 0);
  const totalStock = Object.values(stockByWine).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Portal do fornecedor</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Visão dos seus rótulos nos restaurantes que autorizaram compartilhamento.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Store className="h-5 w-5" />} label="Restaurantes ativos" value={restaurantIds.length} />
        <Stat icon={<Wine className="h-5 w-5" />} label="Rótulos visíveis" value={wines.length} />
        <Stat icon={<Package className="h-5 w-5" />} label="Garrafas em estoque" value={totalStock} />
        <Stat icon={<TrendingUp className="h-5 w-5" />} label="Vendidas no mês" value={bottlesSoldMonth} />
      </div>

      {wines.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Ainda não há restaurantes compartilhando dados dos seus rótulos.
        </div>
      )}

      {wines.length > 0 && (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Estoque por restaurante</h2>
            <Table headers={["Restaurante", "Rótulo", "Safra", "Em estoque", "Preço de venda", "Markup"]}>
              {wines.map((w) => {
                const r = w.restaurants as { name?: string; city?: string } | null;
                const markup = w.cost_price > 0 ? `${((Number(w.sale_price) / Number(w.cost_price) - 1) * 100).toFixed(0)}%` : "-";
                return (
                  <tr key={w.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r?.name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{r?.city ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">{w.name}</td>
                    <td className="px-4 py-3">{w.vintage ?? "-"}</td>
                    <td className="px-4 py-3">{stockByWine[w.id] ?? 0}</td>
                    <td className="px-4 py-3">R$ {Number(w.sale_price).toFixed(2)}</td>
                    <td className="px-4 py-3">{markup}</td>
                  </tr>
                );
              })}
            </Table>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Últimas vendas</h2>
            <Table headers={["Data", "Restaurante", "Rótulo", "Qtd", "Preço unit."]}>
              {movs
                .filter((m) => m.movement_type === "sale")
                .sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at))
                .slice(0, 50)
                .map((m, i) => {
                  const w = wines.find((x) => x.id === m.wine_id);
                  const r = w?.restaurants as { name?: string } | null;
                  return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{new Date(m.occurred_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">{r?.name ?? "-"}</td>
                      <td className="px-4 py-3">{w?.name ?? "-"}</td>
                      <td className="px-4 py-3">{m.quantity}</td>
                      <td className="px-4 py-3">R$ {Number(m.unit_price ?? 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
            </Table>
          </section>
        </div>
      )}

      <SupplierOrders
        orders={(data?.orders ?? []) as SupplierOrder[]}
        items={(data?.orderItems ?? []) as SupplierOrderItem[]}
        wines={wines.map((w) => ({ id: w.id, name: w.name }))}
      />


      {supplierId && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Meus materiais</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Publique listas de preços, apresentações e fichas técnicas. Os restaurantes cadastrados
            terão acesso ao seu conteúdo.
          </p>
          <MaterialsManager
            supplierId={supplierId}
            materials={(data?.materials ?? []) as Parameters<typeof MaterialsManager>[0]["materials"]}
            onChange={() => refetch()}
            canEdit
          />
        </section>
      )}
    </div>
  );
}

type SupplierOrder = {
  id: string;
  restaurant_id: string;
  created_at: string;
  status: string;
  expected_date: string | null;
  restaurants: { name?: string } | null;
};

type SupplierOrderItem = {
  id: string;
  order_id: string;
  wine_id: string;
  qty_bottles: number;
  qty_received: number;
  status: string;
};

const ITEM_STATUS: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

function SupplierOrders({
  orders,
  items,
  wines,
}: {
  orders: SupplierOrder[];
  items: SupplierOrderItem[];
  wines: { id: string; name: string }[];
}) {
  const [fRest, setFRest] = useState("");
  const [fWine, setFWine] = useState("");
  const [fStatus, setFStatus] = useState("");

  const orderById: Record<string, SupplierOrder> = {};
  orders.forEach((o) => (orderById[o.id] = o));
  const wineName: Record<string, string> = {};
  wines.forEach((w) => (wineName[w.id] = w.name));

  const rows = items
    .map((it) => ({ it, o: orderById[it.order_id] }))
    .filter((r) => r.o)
    .filter((r) => (fRest ? r.o!.restaurant_id === fRest : true))
    .filter((r) => (fWine ? (wineName[r.it.wine_id] ?? "").toLowerCase().includes(fWine.toLowerCase()) : true))
    .filter((r) => (fStatus ? r.it.status === fStatus : true))
    .sort((a, b) => (a.o!.created_at < b.o!.created_at ? 1 : -1));

  const restaurants = Array.from(
    new Map(orders.map((o) => [o.restaurant_id, o.restaurants?.name ?? "Restaurante"])).entries(),
  );

  const sel = "rounded border border-border bg-background px-2 py-1 text-xs";

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">Pedidos recebidos</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Pedidos feitos pelos restaurantes para os seus rótulos.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={fRest} onChange={(e) => setFRest(e.target.value)} className={sel}>
          <option value="">Todos os restaurantes</option>
          {restaurants.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <input
          value={fWine}
          onChange={(e) => setFWine(e.target.value)}
          placeholder="Filtrar rótulo"
          className={sel}
        />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel}>
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="partial">Parcial</option>
          <option value="received">Recebido</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>
      <Table headers={["Data", "Restaurante", "Rótulo", "Solicitado", "Recebido", "Status"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">
              Nenhum pedido registrado até o momento.
            </td>
          </tr>
        )}
        {rows.map(({ it, o }) => (
          <tr key={it.id} className="border-b border-border last:border-0">
            <td className="px-4 py-3">{new Date(o!.created_at).toLocaleDateString("pt-BR")}</td>
            <td className="px-4 py-3">{o!.restaurants?.name ?? "-"}</td>
            <td className="px-4 py-3">{wineName[it.wine_id] ?? "Rótulo"}</td>
            <td className="px-4 py-3">{it.qty_bottles}</td>
            <td className="px-4 py-3">{it.qty_received}</td>
            <td className="px-4 py-3">{ITEM_STATUS[it.status] ?? it.status}</td>
          </tr>
        ))}
      </Table>
    </section>
  );
}


function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
