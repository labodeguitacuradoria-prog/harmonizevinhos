import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wine,
  ShieldAlert,
  ClipboardList,
  Sun,
  Moon,
  Check,
  AlertTriangle,
  Flag,
  Image as ImageIcon,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import {
  openAccessLink,
  getGuestDashboardData,
  getGuestStockSession,
  saveGuestCount,
  saveGuestFlag,
  saveGuestIssue,
  closeGuestCount,
} from "@/lib/guest-access.functions";
import { DashboardPage } from "@/routes/_app.app.dashboard";
import StaffTraining from "@/components/training/StaffTraining";
import StaffPairings from "@/components/StaffPairings";


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
  const deviceKind = kind === "desktop" ? "desktop" : "celular";
  const { data, isLoading } = useQuery({
    queryKey: ["guest-access", token],
    retry: false,
    queryFn: () => openAccessLink({ data: { token, kind: deviceKind } }),
  });

  if (isLoading) return <Loading />;
  if (!data || !data.ok) return <Blocked message={data?.message ?? "Link inválido."} />;
  if (data.scope === "pairings") return <StaffPairings token={token} />;
  if (data.scope === "training") return <StaffTraining token={token} />;
  if (data.scope === "stock_count") return <GuestStock token={token} />;
  return <GuestDashboard token={token} kind={deviceKind as "celular" | "desktop"} />;
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
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
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

type GuestItem = {
  id: string;
  wine_id: string;
  previous_qty: number;
  counted_qty: number | null;
  flag: string | null;
  flag_note: string | null;
  name: string;
  producer: string | null;
  vintage: number | null;
  volume: string | null;
  internal_code: string | null;
  wine_type: string | null;
  image_url: string | null;
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
const TYPE_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "Espumante", label: "Espumantes" },
  { key: "Branco", label: "Brancos" },
  { key: "Rosé", label: "Rosés" },
  { key: "Tinto", label: "Tintos" },
  { key: "Fortificado", label: "Fortificados" },
  { key: "others", label: "Outros" },
] as const;

const FLAG_OPTIONS = [
  { key: "not_registered", label: "Falta um rótulo (não cadastrado)" },
  { key: "wrong", label: "Rótulo errado / diferente da garrafa" },
  { key: "duplicate", label: "Cadastro duplicado" },
  { key: "should_not_count", label: "Não deveria ser contado" },
  { key: "other", label: "Outro problema" },
];

function normalizeType(t: string | null) {
  if (!t) return null;
  return LEGACY_TYPE_MAP[t] ?? t;
}

function GuestStock({ token }: { token: string }) {
  const { theme, toggle } = useTheme();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["guest-stock", token],
    retry: false,
    queryFn: () => getGuestStockSession({ data: { token } }),
  });

  const [filter, setFilter] = useState<string>("all");
  const [local, setLocal] = useState<Record<string, number | null>>({});
  const [localFlags, setLocalFlags] = useState<Record<string, { flag: string | null; note: string | null }>>({});
  const [flagFor, setFlagFor] = useState<GuestItem | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const items = useMemo<GuestItem[]>(() => {
    const rows = (data && data.ok ? (data.items as unknown as GuestItem[]) : []) ?? [];
    return rows.map((i) => ({
      ...i,
      counted_qty: local[i.id] !== undefined ? local[i.id] : i.counted_qty,
      flag: localFlags[i.id] ? localFlags[i.id].flag : i.flag,
      flag_note: localFlags[i.id] ? localFlags[i.id].note : i.flag_note,
    }));
  }, [data, local, localFlags]);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "pending") return items.filter((i) => i.counted_qty === null && !i.flag);
    if (filter === "others")
      return items.filter((i) => {
        const t = normalizeType(i.wine_type);
        return !t || !CANONICAL_TYPES.includes(t);
      });
    return items.filter((i) => normalizeType(i.wine_type) === filter);
  }, [items, filter]);

  const groups = useMemo(() => {
    const g: Record<string, GuestItem[]> = {};
    for (const it of visible) {
      const t = normalizeType(it.wine_type) ?? "Outros";
      const key = CANONICAL_TYPES.includes(t) ? t : "Outros";
      (g[key] ??= []).push(it);
    }
    const keys = Object.keys(g).sort((a, b) => {
      const ai = CANONICAL_TYPES.indexOf(a);
      const bi = CANONICAL_TYPES.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return keys.map((k) => ({ key: k, rows: g[k] }));
  }, [visible]);

  if (isLoading) return <Loading />;
  if (!data || !data.ok) return <Blocked message={data?.message ?? "Link inválido."} />;

  const session = data.session;
  const resolved = items.filter((i) => i.counted_qty !== null || i.flag).length;
  const total = items.length;
  const allDone = total > 0 && resolved === total;

  async function setQty(item: GuestItem, qty: number | null) {
    const v = qty === null ? null : Math.max(0, qty);
    setLocal((p) => ({ ...p, [item.id]: v }));
    const res = await saveGuestCount({ data: { token, item_id: item.id, qty: v } });
    if (!res.ok) toast.error(res.message ?? "Não foi possível salvar.");
  }

  async function applyFlag(item: GuestItem, flag: string | null, note: string) {
    setLocalFlags((p) => ({ ...p, [item.id]: { flag, note: note || null } }));
    const res = await saveGuestFlag({ data: { token, item_id: item.id, flag, note: note || null } });
    if (!res.ok) toast.error(res.message ?? "Não foi possível salvar o aviso.");
    else toast.success(flag ? "Aviso registrado." : "Aviso removido.");
  }

  async function close() {
    if (!session) return;
    setClosing(true);
    const res = await closeGuestCount({ data: { token, session_id: session.id } });
    setClosing(false);
    if (!res.ok) {
      if (res.code === "pending") setFilter("pending");
      toast.error(res.message ?? "Não foi possível salvar a contagem.");
      return;
    }
    setDone("Contagem salva e enviada ao restaurante. Obrigado!");
    toast.success("Contagem salva com sucesso.");
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center">
          <Check className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm text-foreground">{done}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {resolved} de {total} rótulos registrados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Cabeçalho */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Wine className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          {data.restaurantName}
        </div>
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-primary"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={() => window.close()}
          aria-label="Fechar tela"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {!session ? (
        <div className="m-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <ClipboardList className="mb-2 h-5 w-5 text-primary" />
          Nenhum rótulo disponível para contagem neste restaurante.
        </div>
      ) : (
        <>
          <div className="border-b border-border px-4 pb-3 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold leading-tight">Contagem de Estoque</h1>
                <p className="text-xs text-muted-foreground">
                  Referência: {new Date(session.reference_date + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    filter === f.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => setIssueOpen(true)}
                className="ml-auto flex items-center gap-1 rounded-full border border-amber-500/40 px-2.5 py-1 text-[11px] font-medium text-amber-500"
              >
                <AlertTriangle className="h-3 w-3" /> Reportar
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar p-3 pb-28">
            {visible.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum rótulo neste filtro.
              </p>
            )}
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.key} <span className="text-muted-foreground/60">({g.rows.length})</span>
                </h2>
                <div className="space-y-1.5">
                  {g.rows.map((item) => {
                    const flagged = !!item.flag;
                    const counted = item.counted_qty !== null;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-2 rounded-lg border bg-card px-3 py-2 ${
                          flagged
                            ? "border-amber-500/60"
                            : counted
                              ? "border-primary/60"
                              : "border-border"
                        }`}
                      >
                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex items-start gap-1.5">
                            {item.internal_code && (
                              <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                                {item.internal_code}
                              </span>
                            )}
                            <span className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                            {[item.volume, item.producer, item.vintage].filter(Boolean).join(" · ") || "—"}
                            {flagged && item.flag_note ? (
                              <span className="ml-2 text-amber-500">⚑ {item.flag_note}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div className="flex items-center gap-0.5">
                            {item.image_url && (
                              <button
                                type="button"
                                onClick={() => setZoomImg(item.image_url!)}
                                aria-label="Ver rótulo"
                                className="inline-flex h-8 w-8 items-center justify-center rounded p-0 text-primary"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setFlagFor(item)}
                              aria-label="Sinalizar problema"
                              className={`inline-flex h-8 w-8 items-center justify-center rounded p-0 ${flagged ? "text-amber-500" : "text-muted-foreground"}`}
                            >
                              <Flag className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              aria-label="Diminuir"
                              onClick={() => setQty(item, item.counted_qty === null ? 0 : Math.max(0, item.counted_qty - 1))}
                              className="flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              placeholder="—"
                              value={item.counted_qty ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "") {
                                  setLocal((p) => ({ ...p, [item.id]: null }));
                                  return;
                                }
                                setQty(item, Math.max(0, parseInt(v, 10) || 0));
                              }}
                              onBlur={(e) => {
                                if (e.target.value === "") setQty(item, null);
                              }}
                              className="h-8 w-12 rounded border border-input bg-background text-center text-sm font-semibold"
                            />
                            <button
                              type="button"
                              aria-label="Aumentar"
                              onClick={() => setQty(item, item.counted_qty === null ? 0 : item.counted_qty + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
            <div className="text-sm">
              <span className="font-semibold">{resolved}</span>
              <span className="text-muted-foreground"> de {total} resolvidos</span>
            </div>
            <button
              onClick={close}
              disabled={closing}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                allDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              } disabled:opacity-50`}
            >
              {closing ? "Salvando..." : "Salvar contagem"}
            </button>
          </div>
        </>
      )}


      {flagFor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setFlagFor(null)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Sinalizar problema</h3>
                <p className="text-xs text-muted-foreground">{flagFor.name}</p>
              </div>
              <button onClick={() => setFlagFor(null)} className="rounded p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <FlagForm
              item={flagFor}
              onSave={async (flag, note) => {
                const it = flagFor;
                setFlagFor(null);
                await applyFlag(it, flag, note);
              }}
            />
          </div>
        </div>
      )}

      {issueOpen && session && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setIssueOpen(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Reportar problema</h3>
                <p className="text-xs text-muted-foreground">
                  Ex: falta um rótulo, rótulo errado, cadastro duplicado. A contagem segue normalmente.
                </p>
              </div>
              <button onClick={() => setIssueOpen(false)} className="rounded p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <IssueForm
              onSave={async (text) => {
                const res = await saveGuestIssue({ data: { token, session_id: session.id, description: text } });
                setIssueOpen(false);
                if (!res.ok) toast.error(res.message ?? "Não foi possível enviar.");
                else {
                  toast.success("Problema enviado ao restaurante.");
                  refetch();
                }
              }}
            />
          </div>
        </div>
      )}

      {zoomImg && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomImg(null)}>
          <img src={zoomImg} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

function FlagForm({
  item,
  onSave,
}: {
  item: GuestItem;
  onSave: (flag: string | null, note: string) => Promise<void>;
}) {
  const [flag, setFlag] = useState<string | null>(item.flag);
  const [note, setNote] = useState(item.flag_note ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <>
      <div className="space-y-1.5">
        {FLAG_OPTIONS.map((opt) => (
          <label
            key={opt.key}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              flag === opt.key ? "border-primary" : "border-input"
            }`}
          >
            <input type="radio" name="guest-flag" checked={flag === opt.key} onChange={() => setFlag(opt.key)} />
            {opt.label}
          </label>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Observação (opcional)"
        className="mt-3 w-full rounded-md border border-input bg-background p-2 text-sm"
      />
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={saving || !item.flag}
          onClick={async () => {
            setSaving(true);
            await onSave(null, "");
          }}
          className="text-xs text-muted-foreground disabled:opacity-40"
        >
          Remover sinalização
        </button>
        <button
          type="button"
          disabled={!flag || saving}
          onClick={async () => {
            setSaving(true);
            await onSave(flag, note);
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
    </>
  );
}

function IssueForm({ onSave }: { onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Ex: encontrei uma garrafa do Pizzato Reserva 2019 que não está na lista."
        className="w-full rounded-md border border-input bg-background p-2 text-sm"
      />
      <button
        type="button"
        disabled={text.trim().length < 3 || saving}
        onClick={async () => {
          setSaving(true);
          await onSave(text.trim());
        }}
        className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Enviando..." : "Enviar"}
      </button>
    </>
  );
}

