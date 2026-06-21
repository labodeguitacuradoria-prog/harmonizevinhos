import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wine, Package, DollarSign, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/app/")({
  component: RestaurantDashboard,
});

function RestaurantDashboard() {
  const { role, restaurantId, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role === "supplier") navigate({ to: "/supplier" });
    if (role === "admin") navigate({ to: "/admin" });
  }, [role, loading, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["restaurant-stats", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const [winesRes, invRes] = await Promise.all([
        supabase.from("wines").select("id, cost_price, sale_price").eq("restaurant_id", restaurantId!),
        supabase
          .from("inventory_movements")
          .select("movement_type, quantity, unit_price, occurred_at")
          .eq("restaurant_id", restaurantId!),
      ]);
      const wines = winesRes.data ?? [];
      const movs = invRes.data ?? [];
      const stock = movs.reduce((acc, m) => {
        if (m.movement_type === "entry") return acc + m.quantity;
        if (m.movement_type === "sale") return acc - m.quantity;
        return acc + m.quantity;
      }, 0);
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const salesMonth = movs
        .filter((m) => m.movement_type === "sale" && new Date(m.occurred_at) >= startMonth)
        .reduce((s, m) => s + m.quantity * Number(m.unit_price ?? 0), 0);
      const bottlesSoldMonth = movs
        .filter((m) => m.movement_type === "sale" && new Date(m.occurred_at) >= startMonth)
        .reduce((s, m) => s + m.quantity, 0);
      return {
        totalLabels: wines.length,
        stock,
        salesMonth,
        bottlesSoldMonth,
      };
    },
  });

  if (role !== "restaurant" && !loading) return null;

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Painel do restaurante</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Visão geral da sua adega e vendas do mês.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Wine className="h-5 w-5" />}
          label="Rótulos cadastrados"
          value={stats?.totalLabels ?? 0}
        />
        <Stat
          icon={<Package className="h-5 w-5" />}
          label="Garrafas em estoque"
          value={stats?.stock ?? 0}
        />
        <Stat
          icon={<TrendingUp className="h-5 w-5" />}
          label="Garrafas vendidas no mês"
          value={stats?.bottlesSoldMonth ?? 0}
        />
        <Stat
          icon={<DollarSign className="h-5 w-5" />}
          label="Receita do mês"
          value={`R$ ${(stats?.salesMonth ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Primeiros passos</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. Cadastre seus rótulos em <strong>Vinhos</strong>.</li>
          <li>2. Registre entradas e vendas em cada vinho.</li>
          <li>3. Em <strong>Compartilhamento</strong> autorize fornecedores específicos a ver dados dos rótulos deles.</li>
        </ol>
      </div>
    </div>
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
