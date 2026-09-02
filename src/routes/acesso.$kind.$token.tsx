import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Wine, ShieldAlert, Eye, ClipboardList, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { getGuestDashboardData, getGuestStockSession, saveGuestCount } from "@/lib/guest-access.functions";
import { DashboardPage } from "@/routes/_app.app.dashboard";

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

function GuestAccessPage() {
  const { kind, token } = Route.useParams();
  const isStock = kind === "contagem" || kind === "estoque";
  const deviceKind = kind === "desktop" ? "desktop" : "celular";

  if (isStock) return <GuestStock token={token} />;
  return <GuestDashboard token={token} kind={deviceKind as "celular" | "desktop"} />;
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Wine className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{title}</div>
          {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-primary"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
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
  const { theme, toggle } = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ["guest-dash-data", token],
    retry: false,
    queryFn: () => getGuestDashboardData({ data: { token, kind } }),
  });

  if (isLoading) return <Loading />;
  if (!data || !data.ok) return <Blocked message={data?.message ?? "Link inválido."} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-end gap-2 border-b border-border bg-card px-3 py-2">
        <div className="min-w-0 flex-1" />
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-primary"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
      <DashboardPage
        guest={{
          restaurantName: data.restaurantName,
          wines: data.wines as never,
          movements: data.movements as never,
          corkage: data.corkage,
          stock: data.stock,
          targets: data.targets,
        }}
      />
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
