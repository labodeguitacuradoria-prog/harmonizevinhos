import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Wine, ShieldAlert, Eye, ClipboardList } from "lucide-react";
import { getGuestDashboard, getGuestStockSession, saveGuestCount } from "@/lib/guest-access.functions";

export const Route = createFileRoute("/acesso/$kind/$token")({
  head: () => ({
    meta: [
      { title: "Acesso rápido — Gestão de Vinhos" },
      { name: "description", content: "Acesso de visualização ao painel do restaurante." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Acesso rápido — Gestão de Vinhos" },
      { property: "og:description", content: "Acesso de visualização ao painel do restaurante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestAccessPage,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmt(n: number, digits = 0) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function GuestAccessPage() {
  const { kind, token } = Route.useParams();
  const isStock = kind === "contagem" || kind === "estoque";
  const deviceKind = kind === "desktop" ? "desktop" : "celular";

  if (isStock) return <GuestStock token={token} />;
  return <GuestDashboard token={token} kind={deviceKind as "celular" | "desktop"} />;
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Wine className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{title}</div>
          {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </header>
      <div className="p-4 md:p-8">{children}</div>
    </div>
  );
}

function Blocked({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-3 text-sm text-foreground">{message}</p>
        <a href="/auth" className="mt-4 inline-block text-xs text-primary underline">
          Entrar com e-mail e senha
        </a>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Carregando...
    </div>
  );
}

function GuestDashboard({ token, kind }: { token: string; kind: "celular" | "desktop" }) {
  const { data, isLoading } = useQuery({
    queryKey: ["guest-dash", token],
    retry: false,
    queryFn: () => getGuestDashboard({ data: { token, kind } }),
  });

  if (isLoading) return <Loading />;
  if (!data || !data.ok) return <Blocked message={data?.message ?? "Link inválido."} />;

  const t = data.totals;
  const kpis = [
    { label: "Faturamento (ano)", value: `R$ ${fmt(t.revenueYear)}` },
    { label: "Garrafas vendidas", value: fmt(t.bottlesYear) },
    { label: "Taças vendidas", value: fmt(t.glassesYear) },
    { label: "Estoque em adega", value: `${fmt(t.stockBottles)} gf` },
    { label: "Preço médio", value: `R$ ${fmt(t.avgPriceYear)}` },
    { label: "CMV", value: `${fmt(t.cmvYear, 1)}%` },
  ];

  return (
    <Shell title={data.restaurantName} subtitle={`${data.label} · modo visualização`}>
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-[11px] text-muted-foreground">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Modo visualização. Para acessar cadastros, pedidos e preços,{" "}
          <a href="/auth" className="text-primary underline">entre com seu e-mail</a>.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">{k.label}</span>
            <b className="mt-1 block text-base text-primary">{k.value}</b>
          </div>
        ))}
      </div>

      {t.lastCountDate && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Estoque referente à última contagem fechada em{" "}
          {new Date(t.lastCountDate + "T00:00:00").toLocaleDateString("pt-BR")}.
        </p>
      )}

      <Series title={`Faturamento — ${data.currentYear} vs ${data.previousYear}`} current={data.series.revenue.current} previous={data.series.revenue.previous} prefix="R$ " />
      <Series title="Garrafas vendidas" current={data.series.bottles.current} previous={data.series.bottles.previous} />
      <Series title="Preço médio" current={data.series.avgPrice.current} previous={data.series.avgPrice.previous} prefix="R$ " />
      <Series title="CMV (%)" current={data.series.cmv.current} previous={data.series.cmv.previous} suffix="%" digits={1} />
    </Shell>
  );
}

function Series({
  title,
  current,
  previous,
  prefix = "",
  suffix = "",
  digits = 0,
}: {
  title: string;
  current: number[];
  previous: number[];
  prefix?: string;
  suffix?: string;
  digits?: number;
}) {
  const max = Math.max(...current, ...previous, 1);
  return (
    <div className="mt-5 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 border-b border-border pb-2 text-[11px] font-bold uppercase tracking-wider text-primary">
        {title}
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 160 }}>
        {MONTHS.map((m, i) => (
          <div key={m} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex w-full items-end justify-center gap-[2px]" style={{ height: 120 }}>
              <div
                className="w-1/2 rounded-t"
                style={{
                  height: `${((previous[i] ?? 0) / max) * 100}%`,
                  background: "#444",
                }}
                title={`${prefix}${fmt(previous[i] ?? 0, digits)}${suffix}`}
              />
              <div
                className="w-1/2 rounded-t"
                style={{
                  height: `${((current[i] ?? 0) / max) * 100}%`,
                  background: "linear-gradient(to top, var(--wine), var(--gold))",
                }}
                title={`${prefix}${fmt(current[i] ?? 0, digits)}${suffix}`}
              />
            </div>
            <span className="text-[8px] text-muted-foreground">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestStock({ token }: { token: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["guest-stock", token],
    retry: false,
    queryFn: () => getGuestStockSession({ data: { token } }),
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, number | null>>({});

  if (isLoading) return <Loading />;
  if (!data || !data.ok) return <Blocked message={data?.message ?? "Link inválido."} />;

  async function save(itemId: string, qty: number | null) {
    setSaving(itemId);
    setLocal((p) => ({ ...p, [itemId]: qty }));
    await saveGuestCount({ data: { token, item_id: itemId, qty } });
    setSaving(null);
    refetch();
  }

  return (
    <Shell title={data.restaurantName} subtitle={`${data.label} · contagem de estoque`}>
      {!data.session ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <ClipboardList className="mb-2 h-5 w-5 text-primary" />
          Nenhuma contagem aberta neste momento. Peça ao gestor para abrir uma nova contagem.
        </div>
      ) : (
        <>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Contagem de {new Date(data.session.reference_date + "T00:00:00").toLocaleDateString("pt-BR")} ·{" "}
            {data.items.filter((i) => (local[i.id] ?? i.counted_qty) !== null).length}/{data.items.length} contados
          </p>
          <div className="space-y-2">
            {data.items.map((i) => {
              const qty = local[i.id] !== undefined ? local[i.id] : i.counted_qty;
              return (
                <div key={i.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {i.internal_code ? <span className="text-primary">{i.internal_code} · </span> : null}
                      {i.name}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[i.producer, i.vintage, i.volume].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={qty ?? ""}
                    disabled={saving === i.id}
                    onChange={(e) =>
                      setLocal((p) => ({ ...p, [i.id]: e.target.value === "" ? null : Number(e.target.value) }))
                    }
                    onBlur={(e) => save(i.id, e.target.value === "" ? null : Number(e.target.value))}
                    className="h-10 w-20 rounded-md border border-border bg-background px-2 text-center text-sm"
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
