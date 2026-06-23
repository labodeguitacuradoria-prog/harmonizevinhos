import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Minus, Check, ScanLine, Image as ImageIcon, X, ClipboardList } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const Route = createFileRoute("/_app/app/stock-counts")({
  component: StockCountPage,
});

type Session = {
  id: string;
  restaurant_id: string;
  reference_date: string;
  status: "draft" | "closed";
  started_at: string;
  closed_at: string | null;
};

type SessionItem = {
  id: string;
  wine_id: string;
  previous_qty: number;
  counted_qty: number | null;
  wine: {
    id: string;
    name: string;
    producer: string | null;
    vintage: number | null;
    wine_type: string | null;
    volume: string | null;
    image_url: string | null;
    barcode: string | null;
  };
};

const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto", white: "Branco", rose: "Rosé",
  sparkling: "Espumante", dessert: "Sobremesa", fortified: "Fortificado",
};

const TYPE_FILTERS: { key: string; label: string; match: (t: string | null) => boolean }[] = [
  { key: "all", label: "Todos", match: () => true },
  { key: "pending", label: "Pendentes", match: () => true }, // handled separately
  { key: "Tinto", label: "Tintos", match: (t) => normalizeType(t) === "Tinto" },
  { key: "Branco", label: "Brancos", match: (t) => normalizeType(t) === "Branco" },
  { key: "Rosé", label: "Rosés", match: (t) => normalizeType(t) === "Rosé" },
  { key: "Espumante", label: "Espumantes", match: (t) => normalizeType(t) === "Espumante" },
  { key: "Sobremesa", label: "Sobremesa", match: (t) => normalizeType(t) === "Sobremesa" },
  { key: "Fortificado", label: "Fortificados", match: (t) => normalizeType(t) === "Fortificado" },
];

function normalizeType(t: string | null): string | null {
  if (!t) return null;
  return LEGACY_TYPE_MAP[t] ?? t;
}

function StockCountPage() {
  const { restaurantId, user } = useAuth();
  const qc = useQueryClient();

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ["stock-count-session", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_count_sessions")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .eq("status", "draft")
        .maybeSingle();
      if (error) throw error;
      return data as Session | null;
    },
  });

  async function startSession() {
    if (!restaurantId || !user) return;
    // Snapshot current stock from inventory_movements
    const [{ data: wines }, { data: movs }] = await Promise.all([
      supabase.from("wines").select("id").eq("restaurant_id", restaurantId),
      supabase
        .from("inventory_movements")
        .select("wine_id, movement_type, quantity")
        .eq("restaurant_id", restaurantId),
    ]);
    if (!wines || wines.length === 0) {
      toast.error("Cadastre pelo menos um rótulo antes de iniciar uma contagem.");
      return;
    }
    const stock: Record<string, number> = {};
    for (const m of movs ?? []) {
      const sign = m.movement_type === "sale" ? -1 : 1;
      stock[m.wine_id] = (stock[m.wine_id] ?? 0) + sign * m.quantity;
    }
    const { data: newSession, error } = await supabase
      .from("stock_count_sessions")
      .insert({
        restaurant_id: restaurantId,
        started_by: user.id,
      })
      .select()
      .single();
    if (error || !newSession) {
      toast.error(error?.message ?? "Erro ao iniciar contagem");
      return;
    }
    const items = wines.map((w) => ({
      session_id: newSession.id,
      wine_id: w.id,
      previous_qty: stock[w.id] ?? 0,
    }));
    const { error: errItems } = await supabase.from("stock_count_items").insert(items);
    if (errItems) {
      toast.error(errItems.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["stock-count-session", restaurantId] });
    toast.success("Contagem iniciada");
  }

  if (loadingSession) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!session) {
    return (
      <div className="p-6 md:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Contagem de Estoque</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inicie uma nova contagem. O sistema usa a data de hoje como referência.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma contagem em andamento.</p>
          <button
            onClick={startSession}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Iniciar contagem
          </button>
        </div>
      </div>
    );
  }

  return <CountSessionView session={session} />;
}

function CountSessionView({ session }: { session: Session }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [flashItemId, setFlashItemId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock-count-items", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_count_items")
        .select(
          "id, wine_id, previous_qty, counted_qty, wine:wines(id,name,producer,vintage,wine_type,volume,image_url,barcode)",
        )
        .eq("session_id", session.id);
      if (error) throw error;
      const rows = (data ?? []) as unknown as SessionItem[];
      return rows.sort((a, b) => a.wine.name.localeCompare(b.wine.name));
    },
  });

  const counted = items.filter((i) => i.counted_qty !== null).length;
  const total = items.length;
  const allDone = total > 0 && counted === total;

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "pending") return items.filter((i) => i.counted_qty === null);
    const f = TYPE_FILTERS.find((x) => x.key === filter);
    return items.filter((i) => f?.match(i.wine.wine_type) ?? true);
  }, [items, filter]);

  async function setQty(item: SessionItem, qty: number) {
    if (qty < 0) qty = 0;
    // optimistic
    qc.setQueryData<SessionItem[]>(["stock-count-items", session.id], (prev) =>
      (prev ?? []).map((i) =>
        i.id === item.id ? { ...i, counted_qty: qty } : i,
      ),
    );
    setFlashItemId(item.id);
    setTimeout(() => setFlashItemId((curr) => (curr === item.id ? null : curr)), 600);
    const { error } = await supabase
      .from("stock_count_items")
      .update({
        counted_qty: qty,
        counted_at: new Date().toISOString(),
        counted_by: user?.id ?? null,
      })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["stock-count-items", session.id] });
    }
  }

  function jumpToWine(wineId: string) {
    const el = cardRefs.current[wineId];
    if (!el) {
      toast.error("Código não cadastrado neste restaurante");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => inputRefs.current[wineId]?.focus(), 350);
    setFlashItemId(items.find((i) => i.wine_id === wineId)?.id ?? null);
    setTimeout(() => setFlashItemId(null), 1200);
  }

  function handleBarcode(code: string) {
    setScannerOpen(false);
    const trimmed = code.trim();
    const match = items.find((i) => i.wine.barcode === trimmed);
    if (!match) {
      toast.error(`Código ${trimmed} não cadastrado`);
      return;
    }
    if (filter !== "all" && filter !== "pending") setFilter("all");
    jumpToWine(match.wine_id);
  }

  async function closeSession() {
    if (!allDone) {
      setFilter("pending");
      toast.error(`${total - counted} rótulo(s) ainda sem contagem.`);
      return;
    }
    if (!confirm("Encerrar a contagem? As diferenças serão registradas como ajuste de estoque.")) return;
    setClosing(true);
    // Build adjustments
    const adjustments = items
      .map((i) => {
        const diff = (i.counted_qty ?? 0) - i.previous_qty;
        return diff !== 0
          ? {
              wine_id: i.wine_id,
              restaurant_id: session.restaurant_id,
              movement_type: "adjustment" as const,
              quantity: diff,
              notes: `Ajuste por contagem (${session.reference_date})`,
              created_by: user?.id ?? null,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (adjustments.length > 0) {
      const { error } = await supabase.from("inventory_movements").insert(adjustments);
      if (error) {
        toast.error(error.message);
        setClosing(false);
        return;
      }
    }
    const { error: errClose } = await supabase
      .from("stock_count_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: user?.id ?? null,
      })
      .eq("id", session.id);
    setClosing(false);
    if (errClose) return toast.error(errClose.message);
    toast.success("Contagem encerrada");
    qc.invalidateQueries({ queryKey: ["stock-count-session"] });
    qc.invalidateQueries({ queryKey: ["stock-map"] });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Contagem de Estoque</h1>
            <p className="text-xs text-muted-foreground">
              Referência: {new Date(session.reference_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <ScanLine className="h-4 w-4" /> Escanear
          </button>
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-3 pb-24 md:p-6">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando rótulos...</p>}
        {!isLoading && visibleItems.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum rótulo neste filtro.
          </p>
        )}
        {!isLoading && visibleItems.length > 0 && (
          <GroupedList
            items={visibleItems}
            grouped={filter === "all"}
            renderRow={(item) => {
              const done = item.counted_qty !== null;
              const flashing = flashItemId === item.id;
              return (
                <div
                  key={item.id}
                  ref={(el) => { cardRefs.current[item.wine_id] = el; }}
                  className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-all ${
                    done
                      ? "border-primary/60 bg-primary/[0.03]"
                      : "border-border"
                  } ${flashing ? "ring-2 ring-primary" : ""}`}
                >
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {done && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <span className="truncate text-sm font-medium leading-tight">
                        {item.wine.name}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {[
                        item.wine.volume,
                        item.wine.producer,
                        item.wine.vintage,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>

                  {/* Image icon (optional) */}
                  {item.wine.image_url && (
                    <button
                      type="button"
                      onClick={() => setZoomImg(item.wine.image_url!)}
                      className="shrink-0 rounded p-1 text-primary hover:bg-accent hover:text-foreground"
                      title="Ver rótulo"
                      aria-label="Ver rótulo"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  )}

                  {/* Discrete controls */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(item, Math.max(0, (item.counted_qty ?? 0) - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      ref={(el) => { inputRefs.current[item.wine_id] = el; }}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="—"
                      value={item.counted_qty ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          qc.setQueryData<SessionItem[]>(
                            ["stock-count-items", session.id],
                            (prev) =>
                              (prev ?? []).map((i) =>
                                i.id === item.id ? { ...i, counted_qty: null } : i,
                              ),
                          );
                          return;
                        }
                        const n = Math.max(0, parseInt(v, 10) || 0);
                        setQty(item, n);
                      }}
                      className="h-7 w-12 rounded border border-input bg-background text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(item, item.counted_qty === null ? 0 : item.counted_qty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold">{counted}</span>
            <span className="text-muted-foreground"> de {total} contados</span>
          </div>
          <button
            onClick={closeSession}
            disabled={closing}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              allDone
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            } disabled:opacity-50`}
          >
            {closing ? "Encerrando..." : "Encerrar contagem"}
          </button>
        </div>
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleBarcode}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {zoomImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomImg(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-md p-2 text-white hover:bg-white/10"
            onClick={() => setZoomImg(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img src={zoomImg} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

const TYPE_ORDER = ["Espumante", "Branco", "Rosé", "Tinto", "Sobremesa", "Fortificado"];

function GroupedList({
  items,
  grouped,
  renderRow,
}: {
  items: SessionItem[];
  grouped: boolean;
  renderRow: (item: SessionItem) => React.ReactNode;
}) {
  if (!grouped) {
    return <div className="space-y-1.5">{items.map(renderRow)}</div>;
  }
  const groups: Record<string, SessionItem[]> = {};
  for (const it of items) {
    const t = normalizeType(it.wine.wine_type) ?? "Outros";
    (groups[t] ??= []).push(it);
  }
  const keys = Object.keys(groups).sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a);
    const bi = TYPE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return (
    <div className="space-y-4">
      {keys.map((k) => (
        <section key={k}>
          <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {k} <span className="text-muted-foreground/60">({groups[k].length})</span>
          </h2>
          <div className="space-y-1.5">{groups[k].map(renderRow)}</div>
        </section>
      ))}
    </div>
  );
}
