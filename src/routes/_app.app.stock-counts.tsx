import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  Check,
  ScanLine,
  Image as ImageIcon,
  X,
  ClipboardList,
  Flag,
  AlertTriangle,
} from "lucide-react";
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
  flag: string | null;
  flag_note: string | null;
  wine: {
    id: string;
    name: string;
    producer: string | null;
    vintage: number | null;
    wine_type: string | null;
    volume: string | null;
    image_url: string | null;
    barcode: string | null;
    internal_code: string | null;
  };
};

type HistoryRow = {
  session_id: string;
  reference_date: string;
  wine_id: string;
  counted_qty: number | null;
};

const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto",
  white: "Branco",
  rose: "Rosé",
  sparkling: "Espumante",
  dessert: "Fortificado",
  fortified: "Fortificado",
};

const CANONICAL_TYPES = ["Espumante", "Branco", "Rosé", "Tinto", "Fortificado"];

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "Espumante", label: "Espumantes" },
  { key: "Branco", label: "Brancos" },
  { key: "Rosé", label: "Rosés" },
  { key: "Tinto", label: "Tintos" },
  { key: "Fortificado", label: "Fortificados" },
  { key: "others", label: "Outros" },
];

function normalizeType(t: string | null): string | null {
  if (!t) return null;
  return LEGACY_TYPE_MAP[t] ?? t;
}

function isGlassVolume(v: string | null | undefined) {
  if (!v) return false;
  const s = v.toLowerCase();
  return s.includes("taça") || s.includes("taca");
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
    const { data: wines } = await supabase
        .from("wines")
        .select("id, volume, count_in_stock")
        .eq("restaurant_id", restaurantId);
        
    const { data: lastStock } = await supabase.rpc('get_last_closed_stock', { p_restaurant_id: restaurantId });
    
    const countable = (wines ?? []).filter(
      (w) => !isGlassVolume(w.volume) && w.count_in_stock !== false,
    );
    if (countable.length === 0) {
      toast.error(
        "Nenhum rótulo de garrafa cadastrado. Itens vendidos em taça não entram na contagem.",
      );
      return;
    }
    const stock: Record<string, number> = {};
    (lastStock || []).forEach((row: any) => {
      stock[row.wine_id] = row.last_qty;
    });

    const { data: newSession, error } = await supabase
      .from("stock_count_sessions")
      .insert({ restaurant_id: restaurantId, started_by: user.id })
      .select()
      .single();
    if (error || !newSession) {
      toast.error(error?.message ?? "Erro ao iniciar contagem");
      return;
    }
    const items = countable.map((w) => ({
      session_id: newSession.id,
      wine_id: w.id,
      previous_qty: stock[w.id] ?? 0,
    }));
    const { error: errItems } = await supabase
      .from("stock_count_items")
      .insert(items);
    if (errItems) {
      toast.error(errItems.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["stock-count-session", restaurantId] });
    toast.success("Contagem iniciada");
  }

  if (loadingSession) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 md:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Contagem de Estoque
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inicie uma nova contagem. O sistema usa a data de hoje como
          referência. Itens vendidos em taça não são contados.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma contagem em andamento.
          </p>
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
  const { user, restaurantId } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [flagFor, setFlagFor] = useState<SessionItem | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [flashItemId, setFlashItemId] = useState<string | null>(null);
  // Items "tocados" no filtro pendentes que devem permanecer visíveis
  const [stickyPending, setStickyPending] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock-count-items", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_count_items")
        .select(
          "id, wine_id, previous_qty, counted_qty, flag, flag_note, wine:wines(id,name,producer,vintage,wine_type,volume,image_url,barcode,internal_code)",
        )
        .eq("session_id", session.id);
      if (error) throw error;
      const rows = (data ?? []) as unknown as SessionItem[];
      return rows.sort((a, b) => {
        const ca = a.wine.internal_code ?? "";
        const cb = b.wine.internal_code ?? "";
        if (ca && cb && ca !== cb) return ca.localeCompare(cb);
        return a.wine.name.localeCompare(b.wine.name);
      });
    },
  });

  // Últimas 8 contagens fechadas para comparação visual
  const { data: history = [] } = useQuery({
    queryKey: ["stock-count-history", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from("stock_count_sessions")
        .select("id, reference_date")
        .eq("restaurant_id", restaurantId!)
        .eq("status", "closed")
        .order("reference_date", { ascending: false })
        .limit(8);
      if (error) throw error;
      const ids = (sessions ?? []).map((s) => s.id);
      if (ids.length === 0) return [] as { id: string; reference_date: string; rows: HistoryRow[] }[];
      const { data: rows, error: err2 } = await supabase
        .from("stock_count_items")
        .select("session_id, wine_id, counted_qty")
        .in("session_id", ids);
      if (err2) throw err2;
      return (sessions ?? []).map((s) => ({
        id: s.id,
        reference_date: s.reference_date,
        rows: ((rows ?? []) as HistoryRow[]).filter(
          (r) => r.session_id === s.id,
        ),
      }));
    },
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["stock-count-issues", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_count_issues")
        .select("id, description, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const counted = items.filter(
    (i) => i.counted_qty !== null || i.flag != null,
  ).length;
  const total = items.length;
  const allDone = total > 0 && counted === total;

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "pending") {
      return items.filter(
        (i) =>
          (i.counted_qty === null && i.flag == null) ||
          stickyPending.has(i.id),
      );
    }
    if (filter === "others") {
      return items.filter((i) => {
        const t = normalizeType(i.wine.wine_type);
        return !t || !CANONICAL_TYPES.includes(t);
      });
    }
    return items.filter((i) => normalizeType(i.wine.wine_type) === filter);
  }, [items, filter, stickyPending]);

  function markTouched(id: string) {
    if (filter === "pending") {
      setStickyPending((prev) => {
        if (prev.has(id)) return prev;
        const n = new Set(prev);
        n.add(id);
        return n;
      });
    }
  }

  async function setQty(item: SessionItem, qty: number) {
    if (qty < 0) qty = 0;
    markTouched(item.id);
    qc.setQueryData<SessionItem[]>(["stock-count-items", session.id], (prev) =>
      (prev ?? []).map((i) =>
        i.id === item.id ? { ...i, counted_qty: qty } : i,
      ),
    );
    setFlashItemId(item.id);
    setTimeout(
      () => setFlashItemId((curr) => (curr === item.id ? null : curr)),
      600,
    );
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

  async function saveFlag(
    item: SessionItem,
    flag: string | null,
    note: string,
  ) {
    markTouched(item.id);
    qc.setQueryData<SessionItem[]>(["stock-count-items", session.id], (prev) =>
      (prev ?? []).map((i) =>
        i.id === item.id ? { ...i, flag, flag_note: note || null } : i,
      ),
    );
    const { error } = await supabase
      .from("stock_count_items")
      .update({ flag, flag_note: note || null })
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
    const unresolved = items.filter(
      (i) => i.counted_qty === null && i.flag == null,
    );
    if (unresolved.length > 0) {
      setFilter("pending");
      toast.error(`${unresolved.length} rótulo(s) ainda sem contagem.`);
      return;
    }
    if (
      !confirm(
        "Encerrar a contagem? As diferenças serão registradas como ajuste de estoque.",
      )
    )
      return;
    setClosing(true);
    const adjustments = items
      .map((i) => {
        // não gera ajuste para itens marcados como problemáticos
        if (i.flag === "duplicate" || i.flag === "should_not_count") return null;
        if (i.counted_qty === null) return null;
        const diff = i.counted_qty - i.previous_qty;
        return diff !== 0
          ? {
              wine_id: i.wine_id,
              restaurant_id: session.restaurant_id,
              movement_type: "adjustment" as const,
              quantity: diff,
              notes: `Ajuste por contagem (${session.reference_date})`,
              created_by: user?.id ?? null,
              source_session_id: session.id,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (adjustments.length > 0) {
      const { error } = await supabase
        .from("inventory_movements")
        .insert(adjustments);
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
    qc.invalidateQueries({ queryKey: ["dash-stock"] });
  }

  // mapa wine_id -> [qty por sessão histórica]
  const historyByWine = useMemo(() => {
    const m: Record<string, Record<string, number | null>> = {};
    for (const s of history) {
      for (const r of s.rows) {
        (m[r.wine_id] ??= {})[s.id] = r.counted_qty;
      }
    }
    return m;
  }, [history]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Contagem de Estoque
            </h1>
            <p className="text-xs text-muted-foreground">
              Referência:{" "}
              {new Date(
                session.reference_date + "T00:00:00",
              ).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIssueOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Reportar
              problema
            </button>
            <button
              onClick={() => setScannerOpen(true)}
              className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <ScanLine className="h-4 w-4" /> Escanear
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                if (f.key !== "pending") setStickyPending(new Set());
                setFilter(f.key);
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setIssueOpen(true)}
            className="md:hidden ml-auto flex items-center gap-1 rounded-full border border-amber-500/40 px-2.5 py-1 text-[11px] font-medium text-amber-500"
          >
            <AlertTriangle className="h-3 w-3" /> Reportar
          </button>
        </div>
      </div>

      {/* History header (desktop only) */}
      {history.length > 0 && (
        <div className="hidden md:flex shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-6 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex-1">Rótulo</span>
          <span className="flex gap-1">
            {history.map((s) => (
              <span
                key={s.id}
                className="w-10 text-center"
                title={new Date(
                  s.reference_date + "T00:00:00",
                ).toLocaleDateString("pt-BR")}
              >
                {new Date(s.reference_date + "T00:00:00").toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "2-digit" },
                )}
              </span>
            ))}
            <span className="w-[126px] text-center">Contagem</span>
          </span>
        </div>
      )}

      {/* List - scrolls independently */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-3 md:p-6">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Carregando rótulos...</p>
        )}
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
              const flagged = item.flag != null;
              const flashing = flashItemId === item.id;
              const histRow = historyByWine[item.wine_id] ?? {};
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    cardRefs.current[item.wine_id] = el;
                  }}
                  className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-all ${
                    flagged
                      ? "border-amber-500/60 bg-amber-500/[0.04]"
                      : done
                        ? "border-primary/60 bg-primary/[0.03]"
                        : "border-border"
                  } ${flashing ? "ring-2 ring-primary" : ""}`}
                >
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {flagged ? (
                        <Flag className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      ) : done ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : null}
                      {item.wine.internal_code && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                          {item.wine.internal_code}
                        </span>
                      )}
                      <span className="truncate text-sm font-medium leading-tight">
                        {item.wine.name}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {[item.wine.volume, item.wine.producer, item.wine.vintage]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                      {flagged && item.flag_note && (
                        <span className="ml-2 text-amber-500">
                          ⚑ {item.flag_note}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* History columns (desktop only) */}
                  {history.length > 0 && (
                    <div className="hidden md:flex shrink-0 gap-1">
                      {history.map((s) => {
                        const q = histRow[s.id];
                        return (
                          <span
                            key={s.id}
                            className="w-10 text-center text-[11px] tabular-nums text-muted-foreground"
                          >
                            {q ?? "—"}
                          </span>
                        );
                      })}
                    </div>
                  )}

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

                  {/* Flag button */}
                  <button
                    type="button"
                    onClick={() => setFlagFor(item)}
                    className={`shrink-0 rounded p-1 hover:bg-accent ${
                      flagged
                        ? "text-amber-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Sinalizar problema"
                    aria-label="Sinalizar problema"
                  >
                    <Flag className="h-4 w-4" />
                  </button>

                  {/* Discrete controls */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setQty(item, Math.max(0, (item.counted_qty ?? 0) - 1))
                      }
                      className="flex h-7 w-7 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      ref={(el) => {
                        inputRefs.current[item.wine_id] = el;
                      }}
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
                                i.id === item.id
                                  ? { ...i, counted_qty: null }
                                  : i,
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
                      onClick={() =>
                        setQty(
                          item,
                          item.counted_qty === null
                            ? 0
                            : item.counted_qty + 1,
                        )
                      }
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

      {/* Footer - sticky inside the column, not fixed */}
      <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold">{counted}</span>
            <span className="text-muted-foreground"> de {total} resolvidos</span>
            {issues.length > 0 && (
              <span className="ml-3 text-xs text-amber-500">
                ⚑ {issues.length} problema(s) reportado(s)
              </span>
            )}
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

      {flagFor && (
        <FlagDialog
          item={flagFor}
          onClose={() => setFlagFor(null)}
          onSave={async (flag, note) => {
            await saveFlag(flagFor, flag, note);
            setFlagFor(null);
          }}
        />
      )}

      {issueOpen && (
        <IssueDialog
          sessionId={session.id}
          userId={user?.id ?? null}
          onClose={() => setIssueOpen(false)}
          onSaved={() =>
            qc.invalidateQueries({
              queryKey: ["stock-count-issues", session.id],
            })
          }
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
          <img
            src={zoomImg}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

const TYPE_ORDER = ["Espumante", "Branco", "Rosé", "Tinto", "Fortificado"];

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
    const key = TYPE_ORDER.includes(t) ? t : "Outros";
    (groups[key] ??= []).push(it);
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
            {k}{" "}
            <span className="text-muted-foreground/60">
              ({groups[k].length})
            </span>
          </h2>
          <div className="space-y-1.5">{groups[k].map(renderRow)}</div>
        </section>
      ))}
    </div>
  );
}

const FLAG_OPTIONS: { key: string; label: string }[] = [
  { key: "not_registered", label: "Rótulo não cadastrado" },
  { key: "duplicate", label: "Cadastro duplicado" },
  { key: "should_not_count", label: "Não deveria ser contado" },
  { key: "other", label: "Outro problema" },
];

function FlagDialog({
  item,
  onClose,
  onSave,
}: {
  item: SessionItem;
  onClose: () => void;
  onSave: (flag: string | null, note: string) => Promise<void> | void;
}) {
  const [flag, setFlag] = useState<string | null>(item.flag);
  const [note, setNote] = useState<string>(item.flag_note ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Sinalizar problema</h3>
            <p className="text-xs text-muted-foreground">{item.wine.name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {FLAG_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                flag === opt.key
                  ? "border-primary bg-primary/[0.05]"
                  : "border-input"
              }`}
            >
              <input
                type="radio"
                name="flag"
                checked={flag === opt.key}
                onChange={() => setFlag(opt.key)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação (opcional)"
          rows={3}
          className="mt-3 w-full rounded-md border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={saving || item.flag == null}
            onClick={async () => {
              setSaving(true);
              await onSave(null, "");
              setSaving(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Remover sinalização
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!flag || saving}
              onClick={async () => {
                setSaving(true);
                await onSave(flag, note);
                setSaving(false);
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueDialog({
  sessionId,
  userId,
  onClose,
  onSaved,
}: {
  sessionId: string;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Reportar problema geral</h3>
            <p className="text-xs text-muted-foreground">
              Descreva o que encontrou (rótulo sem cadastro, cadastro duplicado,
              etc.). A contagem segue normalmente.
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Ex: Encontrei garrafa do rótulo Pizzato Reserva 2019 sem cadastro."
          className="w-full rounded-md border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!text.trim() || saving}
            onClick={async () => {
              setSaving(true);
              const { error } = await supabase
                .from("stock_count_issues")
                .insert({
                  session_id: sessionId,
                  description: text.trim(),
                  created_by: userId,
                });
              setSaving(false);
              if (error) return toast.error(error.message);
              toast.success("Problema reportado");
              onSaved();
              onClose();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Reportar
          </button>
        </div>
      </div>
    </div>
  );
}
