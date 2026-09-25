import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, Moon, Search, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { getGuestMenuPairings } from "@/lib/guest-access.functions";
import type { DishPairing, MenuDish } from "@/lib/menu-pairing.functions";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function findPairing(dish: MenuDish, results: DishPairing[]) {
  const name = dish.name.trim().toLocaleLowerCase("pt-BR");
  return results.find((r) => r.dish.trim().toLocaleLowerCase("pt-BR") === name) ?? null;
}

export function StaffPairings({ token }: { token: string }) {
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(0);
  const [openPick, setOpenPick] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["guest-menu-pairings", token],
    retry: false,
    refetchOnMount: "always",
    queryFn: () => getGuestMenuPairings({ data: { token, kind: "celular" } }),
  });

  const dishes = (data && data.ok ? (data.dishes as MenuDish[]) : []) ?? [];
  const results = (data && data.ok ? (data.results as DishPairing[]) : []) ?? [];
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    if (!q) return dishes;
    return dishes.filter((d) => `${d.name} ${d.description ?? ""} ${d.section ?? ""}`.toLocaleLowerCase("pt-BR").includes(q));
  }, [dishes, query]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!data || !data.ok) {
    return <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-sm text-foreground">{data?.message ?? "Link inválido."}</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold uppercase tracking-wider text-primary">Harmonizações</h1>
            <p className="truncate text-[11px] text-muted-foreground">{data.restaurantName}</p>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={toggle} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} className="h-9 w-9 shrink-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar prato"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </header>

      <main className="space-y-3 px-4 py-4">
        {!dishes.length && (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Nenhuma harmonização publicada para a equipe ainda.
          </div>
        )}
        {visible.map((dish, i) => {
          const pairing = findPairing(dish, results);
          const isOpen = open === i;
          return (
            <article key={`${dish.name}-${i}`} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{dish.name}</div>
                  {dish.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{dish.description}</div>}
                  {pairing?.gap && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-secondary px-2 py-0.5 text-[10px] uppercase text-primary">
                      <AlertTriangle className="h-3 w-3" /> Gap
                    </div>
                  )}
                </div>
                <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-primary transition ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-border p-4 pt-3">
                  {pairing?.profile && <p className="text-xs leading-relaxed text-muted-foreground">{pairing.profile}</p>}
                  {pairing?.gap && pairing.gap_note && (
                    <div className="rounded-lg border border-secondary bg-secondary/10 p-3 text-xs text-foreground/90">
                      {pairing.gap_note}
                    </div>
                  )}
                  {pairing?.picks?.length ? (
                    <ol className="space-y-3">
                      {pairing.picks.map((p, j) => (
                        <li key={`${p.wine_id}-${j}`} className="rounded-lg border border-border bg-background p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">
                                {p.wine?.internal_code && <span className="mr-1 text-muted-foreground">{p.wine.internal_code}</span>}
                                {p.wine?.name ?? "Rótulo da carta"}
                              </div>
                              <div className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                                {[p.wine?.wine_type, p.wine?.country, p.wine?.volume].filter(Boolean).join(" · ")}
                                {p.wine ? ` · ${brl(Number(p.wine.sale_price ?? 0))}` : ""}
                              </div>
                            </div>
                            <span className="shrink-0 rounded border border-primary/60 px-1.5 text-[11px] font-bold text-primary">{p.score}/10</span>
                          </div>
                          {p.reason && <p className="mt-2 text-xs leading-relaxed text-foreground/80">{p.reason}</p>}
                          {p.table_phrase && <p className="mt-2 text-sm font-medium leading-relaxed text-primary/90">“{p.table_phrase}”</p>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum rótulo da carta indicado.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
}

export default StaffPairings;