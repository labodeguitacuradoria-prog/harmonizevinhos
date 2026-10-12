import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  Lock,
  Flag,
  AlertTriangle,
  Check,
  X,
  PlusCircle,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/_app/app/stock-counts-admin")({
  component: StockCountAdminPage,
});

type SessionRow = {
  id: string;
  restaurant_id: string;
  reference_date: string;
  status: "draft" | "closed";
  started_at: string;
  closed_at: string | null;
  started_by: string | null;
  closed_by: string | null;
};

type ItemRow = {
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
    volume: string | null;
    wine_type: string | null;
    internal_code: string | null;
  };
};

type IssueRow = {
  id: string;
  description: string;
  created_at: string;
  resolved_at: string | null;
};

function fmtDate(d: string) {
  return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
}

function isGlassVolume(v: string | null | undefined) {
  if (!v) return false;
  const s = v.toLowerCase();
  return s.includes("taça") || s.includes("taca");
}

/** Adiciona à sessão os rótulos cadastrados depois do início da contagem. */
async function syncMissingWines(session: SessionRow): Promise<number> {
  const [{ data: wines, error: errWines }, { data: existing, error: errItems }] = await Promise.all([
    supabase
      .from("wines")
      .select("id, volume, count_in_stock")
      .eq("restaurant_id", session.restaurant_id),
    supabase.from("stock_count_items").select("wine_id").eq("session_id", session.id),
  ]);
  if (errWines) throw errWines;
  if (errItems) throw errItems;

  const present = new Set((existing ?? []).map((i) => i.wine_id as string));
  const missing = (wines ?? []).filter(
    (w) => !present.has(w.id) && !isGlassVolume(w.volume) && w.count_in_stock !== false,
  );
  if (missing.length === 0) return 0;

  const { data: lastStock } = await supabase.rpc("get_last_closed_stock", {
    p_restaurant_id: session.restaurant_id,
  });
  const stock: Record<string, number> = {};
  (lastStock ?? []).forEach((row: any) => {
    stock[row.wine_id] = row.last_qty;
  });

  const { error } = await supabase.from("stock_count_items").insert(
    missing.map((w) => ({
      session_id: session.id,
      wine_id: w.id,
      previous_qty: stock[w.id] ?? 0,
    })),
  );
  if (error) throw error;
  return missing.length;
}


function StockCountAdminPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["admin-sessions", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_count_sessions")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("reference_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["admin-session-counts", restaurantId, sessions.map((s) => s.id).join(",")],
    enabled: sessions.length > 0,
    queryFn: async () => {
      const ids = sessions.map((s) => s.id);
      const [{ data: items }, { data: issues }] = await Promise.all([
        supabase.from("stock_count_items").select("session_id, counted_qty, flag").in("session_id", ids),
        supabase.from("stock_count_issues").select("session_id, resolved_at").in("session_id", ids),
      ]);
      const map: Record<string, { counted: number; total: number; flags: number; openIssues: number }> = {};
      for (const id of ids) map[id] = { counted: 0, total: 0, flags: 0, openIssues: 0 };
      for (const it of items ?? []) {
        const m = map[it.session_id as string];
        if (!m) continue;
        m.total += 1;
        if (it.counted_qty !== null || it.flag != null) m.counted += 1;
        if (it.flag) m.flags += 1;
      }
      for (const is of issues ?? []) {
        const m = map[is.session_id as string];
        if (m && !is.resolved_at) m.openIssues += 1;
      }
      return map;
    },
  });

  if (selectedId) {
    const session = sessions.find((s) => s.id === selectedId);
    if (!session) {
      setSelectedId(null);
      return null;
    }
    return (
      <SessionDetail
        session={session}
        onBack={() => setSelectedId(null)}
        onDeleted={() => {
          setSelectedId(null);
          qc.invalidateQueries({ queryKey: ["admin-sessions"] });
        }}
      />
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revisão de contagens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audite, corrija ou exclua contagens feitas pelo staff. Editar uma sessão fechada exige reabrir antes.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data ref.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Iniciada em</th>
              <th className="px-4 py-3">Fechada em</th>
              <th className="px-4 py-3">Contados</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3">Problemas</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && sessions.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhuma contagem registrada.</td></tr>
            )}
            {sessions.map((s) => {
              const c = counts[s.id] ?? { counted: 0, total: 0, flags: 0, openIssues: 0 };
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{fmtDate(s.reference_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      s.status === "closed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}>
                      {s.status === "closed" ? "Fechada" : "Em andamento"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(s.started_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.closed_at ? new Date(s.closed_at).toLocaleString("pt-BR") : "-"}</td>
                  <td className="px-4 py-3">{c.counted}/{c.total}</td>
                  <td className="px-4 py-3">{c.flags > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{c.flags}</span> : "-"}</td>
                  <td className="px-4 py-3">{c.openIssues > 0 ? <span className="font-medium text-red-600 dark:text-red-400">{c.openIssues}</span> : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionDetail({
  session,
  onBack,
  onDeleted,
}: {
  session: SessionRow;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "flagged" | "pending">("all");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-session-items", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_count_items")
        .select(
          "id, wine_id, previous_qty, counted_qty, flag, flag_note, wine:wines(id, name, producer, vintage, volume, wine_type, internal_code, active_on_menu)",
        )
        .eq("session_id", session.id);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ItemRow[];
      return rows.sort((a, b) => {
        const ca = a.wine.internal_code ?? "";
        const cb = b.wine.internal_code ?? "";
        if (ca && cb && ca !== cb) return ca.localeCompare(cb);
        return a.wine.name.localeCompare(b.wine.name);
      });
    },
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["admin-session-issues", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_count_issues")
        .select("id, description, created_at, resolved_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IssueRow[];
    },
  });

  const editable = session.status === "draft";

  const searchNorm = useMemo(
    () =>
      search
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    [search],
  );

  const visible = useMemo(() => {
    let list = items;
    if (filter === "flagged") list = list.filter((i) => i.flag);
    else if (filter === "pending") list = list.filter((i) => i.counted_qty === null && !i.flag);
    if (searchNorm) {
      list = list.filter((i) => {
        const name = (i.wine.name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const producer = (i.wine.producer ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const code = (i.wine.internal_code ?? "").toLowerCase();
        return name.includes(searchNorm) || producer.includes(searchNorm) || code.includes(searchNorm);
      });
    }
    return list;
  }, [items, filter, searchNorm]);

  async function updateQty(item: ItemRow, qty: number) {
    if (!editable) {
      toast.error("Reabra a sessão para editar.");
      return;
    }
    qc.setQueryData<ItemRow[]>(["admin-session-items", session.id], (prev) =>
      (prev ?? []).map((i) => (i.id === item.id ? { ...i, counted_qty: qty } : i)),
    );
    const { error } = await supabase
      .from("stock_count_items")
      .update({ counted_qty: qty, counted_at: new Date().toISOString(), counted_by: user?.id ?? null })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["admin-session-items", session.id] });
    }
  }

  async function clearFlag(item: ItemRow) {
    const { error } = await supabase
      .from("stock_count_items")
      .update({ flag: null, flag_note: null })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-session-items", session.id] });
  }

  async function deleteItem(item: ItemRow) {
    if (!editable) {
      toast.error("Reabra a sessão para remover itens.");
      return;
    }
    if (!confirm(`Remover "${item.wine.name}" desta sessão?`)) return;
    const { error } = await supabase.from("stock_count_items").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-session-items", session.id] });
  }

  function toggleSel(wineId: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(wineId)) n.delete(wineId); else n.add(wineId);
      return n;
    });
  }

  async function includeInCatalog() {
    const ids = [...selected].filter((id) => items.some((i) => i.wine_id === id && !(i.wine as any).active_on_menu));
    if (ids.length === 0) return toast.info("Os rótulos selecionados já estão no cadastro de produtos.");
    setBusy(true);
    const { error } = await supabase.from("wines").update({ active_on_menu: true, count_in_stock: true }).in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} rótulo(s) incluído(s) no cadastro de produtos`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-session-items", session.id] });
    qc.invalidateQueries({ queryKey: ["wines"] });
  }

  async function resolveIssue(id: string) {
    const { error } = await supabase
      .from("stock_count_issues")
      .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-session-issues", session.id] });
  }

  async function deleteSession() {
    if (!confirm("Excluir esta sessão e todos os ajustes de estoque gerados por ela? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    // Remove ajustes vinculados primeiro
    await supabase.from("inventory_movements").delete().eq("source_session_id", session.id);
    const { error } = await supabase.from("stock_count_sessions").delete().eq("id", session.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sessão excluída");
    onDeleted();
  }

  async function syncWines() {
    setBusy(true);
    try {
      const added = await syncMissingWines(session);
      toast.success(
        added > 0
          ? `${added} rótulo(s) novo(s) adicionado(s) à contagem`
          : "Nenhum rótulo novo para adicionar",
      );
      qc.invalidateQueries({ queryKey: ["admin-session-items", session.id] });
      qc.invalidateQueries({ queryKey: ["admin-session-counts"] });
      qc.invalidateQueries({ queryKey: ["stock-count-session"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sincronizar rótulos");
    }
    setBusy(false);
  }

  async function reopen() {
    if (!confirm("Reabrir esta contagem? Os ajustes de estoque gerados serão removidos. Rótulos cadastrados depois do início serão adicionados para contagem.")) return;
    setBusy(true);
    await supabase.from("inventory_movements").delete().eq("source_session_id", session.id);
    const { error } = await supabase
      .from("stock_count_sessions")
      .update({ status: "draft", closed_at: null, closed_by: null })
      .eq("id", session.id);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    let added = 0;
    try {
      added = await syncMissingWines(session);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao adicionar rótulos novos");
    }
    setBusy(false);
    toast.success(
      added > 0
        ? `Sessão reaberta · ${added} rótulo(s) novo(s) adicionado(s)`
        : "Sessão reaberta para edição",
    );
    qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    qc.invalidateQueries({ queryKey: ["admin-session-items", session.id] });
    qc.invalidateQueries({ queryKey: ["stock-count-session"] });
  }


  async function closeAgain() {
    setBusy(true);
    const adjustments = items
      .map((i) => {
        if (i.flag === "duplicate" || i.flag === "should_not_count") return null;
        if (i.counted_qty === null) return null;
        const diff = i.counted_qty - i.previous_qty;
        return diff !== 0
          ? {
              wine_id: i.wine_id,
              restaurant_id: session.restaurant_id,
              movement_type: "adjustment" as const,
              quantity: diff,
              notes: `Ajuste por contagem (${session.reference_date}) — revisão admin`,
              created_by: user?.id ?? null,
              source_session_id: session.id,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (adjustments.length > 0) {
      const { error } = await supabase.from("inventory_movements").insert(adjustments);
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    const { error } = await supabase
      .from("stock_count_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user?.id ?? null })
      .eq("id", session.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sessão fechada novamente");
    qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    qc.invalidateQueries({ queryKey: ["stock-map"] });
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Contagem — {fmtDate(session.reference_date)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: <strong>{session.status === "closed" ? "Fechada" : "Em andamento"}</strong>
            {session.closed_at && ` · Fechada em ${new Date(session.closed_at).toLocaleString("pt-BR")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session.status === "closed" ? (
            <button onClick={reopen} disabled={busy} className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Reabrir
            </button>
          ) : (
            <>
              <button onClick={syncWines} disabled={busy} className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50">
                <PlusCircle className="h-4 w-4" /> Adicionar rótulos novos
              </button>
              <button onClick={closeAgain} disabled={busy} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Lock className="h-4 w-4" /> Fechar contagem
              </button>
            </>
          )}

          <button onClick={deleteSession} disabled={busy} className="flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Excluir sessão
          </button>
        </div>
      </div>

      {!editable && (
        <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          A sessão está fechada. Reabra para editar quantidades ou remover itens. Os ajustes de estoque gerados anteriormente serão recriados ao fechar de novo.
        </p>
      )}

      {issues.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Problemas reportados pelo staff
          </h2>
          <ul className="space-y-2 text-sm">
            {issues.map((is) => (
              <li key={is.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex-1">
                  <div className={is.resolved_at ? "line-through text-muted-foreground" : ""}>{is.description}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(is.created_at).toLocaleString("pt-BR")}
                    {is.resolved_at && ` · resolvido em ${new Date(is.resolved_at).toLocaleString("pt-BR")}`}
                  </div>
                </div>
                {!is.resolved_at && (
                  <button onClick={() => resolveIssue(is.id)} className="rounded border border-input px-2 py-1 text-xs hover:bg-accent">
                    <Check className="inline h-3 w-3" /> Resolver
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por rótulo, produtor ou código..."
            aria-label="Buscar rótulo"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm outline-none focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {search.trim() !== "" && (
          <span className="text-xs text-muted-foreground">
            {visible.length} de {items.length} rótulo(s)
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { key: "all", label: `Todos (${items.length})` },
          { key: "pending", label: `Pendentes (${items.filter((i) => i.counted_qty === null && !i.flag).length})` },
          { key: "flagged", label: `Sinalizados (${items.filter((i) => i.flag).length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rótulos marcados</span>
        <span className="text-sm text-primary">{selected.size} selecionado(s)</span>
        <button
          onClick={() => setSelected(new Set(visible.filter((i) => !(i.wine as any).active_on_menu).map((i) => i.wine_id)))}
          className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
        >
          Marcar os fora do cadastro
        </button>
        <button
          disabled={selected.size === 0 || busy}
          onClick={includeInCatalog}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          <PlusCircle className="h-3.5 w-3.5" /> Incluir no cadastro de produtos
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Marcar todos"
                  checked={visible.length > 0 && visible.every((i) => selected.has(i.wine_id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((i) => i.wine_id)) : new Set())}
                />
              </th>
              <th className="px-3 py-2">Cód.</th>
              <th className="px-3 py-2">Rótulo</th>
              <th className="px-3 py-2">Volume</th>
              <th className="px-3 py-2">Esperado</th>
              <th className="px-3 py-2">Contado</th>
              <th className="px-3 py-2">Diferença</th>
              <th className="px-3 py-2">Flag</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && visible.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhum item nesta visão.</td></tr>}
            {visible.map((i) => {
              const diff = i.counted_qty !== null ? i.counted_qty - i.previous_qty : null;
              return (
                <tr key={i.id} className={`border-b border-border last:border-0 ${i.flag ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Marcar ${i.wine.name}`} checked={selected.has(i.wine_id)} onChange={() => toggleSel(i.wine_id)} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i.wine.internal_code ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      {i.wine.name}
                      {!(i.wine as any).active_on_menu && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-600 dark:text-amber-400">Fora do cadastro</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[i.wine.producer, i.wine.vintage, i.wine.wine_type].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{i.wine.volume ?? "-"}</td>
                  <td className="px-3 py-2">{i.previous_qty}</td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <input
                        type="number"
                        value={i.counted_qty ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const num = v === "" ? null : Math.max(0, Number(v));
                          if (num !== null) updateQty(i, num);
                        }}
                        placeholder="-"
                        className="no-spin w-20 rounded border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      i.counted_qty ?? "-"
                    )}
                  </td>
                  <td className={`px-3 py-2 font-medium ${diff !== null && diff !== 0 ? (diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : ""}`}>
                    {diff === null ? "-" : diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="px-3 py-2">
                    {i.flag ? (
                      <div className="flex items-center gap-1 text-xs">
                        <Flag className="h-3 w-3 text-amber-500" />
                        <span className="text-muted-foreground">{i.flag}{i.flag_note ? ` — ${i.flag_note}` : ""}</span>
                        <button onClick={() => clearFlag(i)} className="ml-1 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editable && (
                      <button onClick={() => deleteItem(i)} className="text-xs text-destructive hover:underline">Remover</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
