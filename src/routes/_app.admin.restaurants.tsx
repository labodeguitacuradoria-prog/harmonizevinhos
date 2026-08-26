import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setActiveRestaurant } from "@/lib/active-scope";
import { Building2, LogIn, Search } from "lucide-react";

export const Route = createFileRoute("/_app/admin/restaurants")({
  component: AdminRestaurants,
  head: () => ({
    meta: [
      { title: "Restaurantes cadastrados | Gestão de Vinhos" },
      {
        name: "description",
        content:
          "Painel do administrador para consultar restaurantes cadastrados e abrir cada unidade para ajustes e correções.",
      },
      { property: "og:title", content: "Restaurantes cadastrados | Gestão de Vinhos" },
      {
        property: "og:description",
        content: "Consulte e acesse os restaurantes cadastrados para corrigir dados e ajustar configurações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  name: string;
  city: string | null;
  cnpj: string | null;
  legal_name: string | null;
  group_id: string | null;
  owner_id: string;
  created_at: string;
};

function AdminRestaurants() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-restaurants"],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: rests }, { data: wines }, { data: orders }, { data: roles }] =
        await Promise.all([
          supabase
            .from("restaurants")
            .select("id, name, city, cnpj, legal_name, group_id, owner_id, created_at")
            .order("name"),
          supabase.from("wines").select("restaurant_id"),
          supabase.from("purchase_orders").select("restaurant_id"),
          supabase.from("user_roles").select("restaurant_id, user_id, role"),
        ]);

      const profileIds = Array.from(new Set((rests ?? []).map((r) => r.owner_id)));
      const { data: profiles } = profileIds.length
        ? await supabase.from("profiles").select("id, email, full_name").in("id", profileIds)
        : { data: [] as { id: string; email: string | null; full_name: string | null }[] };

      const count = (list: { restaurant_id: string | null }[] | null) => {
        const m = new Map<string, number>();
        for (const it of list ?? [])
          if (it.restaurant_id) m.set(it.restaurant_id, (m.get(it.restaurant_id) ?? 0) + 1);
        return m;
      };

      return {
        rows: (rests ?? []) as Row[],
        wineCount: count(wines as any),
        orderCount: count(orders as any),
        userCount: count(roles as any),
        owners: new Map(
          (profiles ?? []).map((p) => [p.id, p.email ?? p.full_name ?? "—"] as const),
        ),
      };
    },
  });

  const rows = useMemo(() => {
    const list = data?.rows ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((r) =>
      [r.name, r.city, r.cnpj, r.legal_name].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [data?.rows, q]);

  function openAs(id: string, to: string) {
    setActiveRestaurant(id);
    navigate({ to });
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="page-title text-xl">Restaurantes cadastrados</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Consulte os dados de cada restaurante e abra a unidade no contexto de gestão para ajustar
        problemas ou corrigir erros.
      </p>

      <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, cidade, CNPJ ou razão social"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {isLoading ? (
        <div className="mt-6 text-sm text-muted-foreground">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="mt-6 text-sm text-muted-foreground">Nenhum restaurante encontrado.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{r.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {[r.legal_name, r.cnpj, r.city].filter(Boolean).join(" · ") || "Sem dados cadastrais"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Responsável: {data?.owners.get(r.owner_id) ?? "—"}
                    {r.group_id ? " · Pertence a uma rede" : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openAs(r.id, "/app/dashboard")}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-accent"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Abrir painel
                  </button>
                  <button
                    onClick={() => openAs(r.id, "/app/wines")}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-accent"
                  >
                    Produtos
                  </button>
                  <button
                    onClick={() => openAs(r.id, "/app/orders")}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-accent"
                  >
                    Pedidos
                  </button>
                  <button
                    onClick={() => openAs(r.id, "/app/restaurant-profile")}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-accent"
                  >
                    Cadastro
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Metric label="Rótulos" value={data?.wineCount.get(r.id) ?? 0} />
                <Metric label="Pedidos" value={data?.orderCount.get(r.id) ?? 0} />
                <Metric label="Acessos" value={data?.userCount.get(r.id) ?? 0} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-2">
      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <b className="block text-sm text-primary">{value}</b>
    </div>
  );
}
