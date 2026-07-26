import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Play, RefreshCcw, CheckCircle2, AlertCircle, ImageOff } from "lucide-react";
import { normalizeProductImage } from "@/lib/image-normalize";

export const Route = createFileRoute("/_app/app/normalize-images")({
  component: NormalizeImagesPage,
});

type Row = {
  id: string;
  table: "wines" | "wine_catalog";
  name: string;
  producer: string | null;
  image_url: string | null;
  status: "idle" | "running" | "done" | "error" | "skipped";
  newUrl?: string | null;
  message?: string;
};

async function uploadNormalizedBlob(blob: Blob, folder: string): Promise<string | null> {
  const path = `${folder}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from("product-media")
    .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "image/png" });
  if (error) throw error;
  const { data } = await supabase.storage
    .from("product-media")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
}

function NormalizeImagesPage() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"restaurant" | "catalog">("restaurant");

  async function load() {
    setLoading(true);
    const list: Row[] = [];

    if (scope === "restaurant") {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user?.id ?? "")
        .limit(1);
      const restId = rest?.[0]?.id;
      if (restId) {
        const { data } = await supabase
          .from("wines")
          .select("id, name, producer, image_url")
          .eq("restaurant_id", restId)
          .not("image_url", "is", null)
          .order("name");
        for (const w of data ?? []) {
          list.push({
            id: w.id,
            table: "wines",
            name: w.name,
            producer: w.producer,
            image_url: w.image_url,
            status: "idle",
          });
        }
      }
    } else {
      const { data } = await supabase
        .from("wine_catalog")
        .select("id, name, producer, image_url")
        .not("image_url", "is", null)
        .order("name");
      for (const w of data ?? []) {
        list.push({
          id: w.id,
          table: "wine_catalog",
          name: w.name,
          producer: w.producer,
          image_url: w.image_url,
          status: "idle",
        });
      }
    }
    setRows(list);
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, scope]);

  async function processOne(row: Row) {
    if (!row.image_url) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "running", message: undefined } : r)));
    try {
      const blob = await normalizeProductImage(row.image_url);
      const folder = row.table === "wine_catalog" ? "catalog" : "wines";
      const newUrl = await uploadNormalizedBlob(blob, folder);
      if (!newUrl) throw new Error("Upload falhou");
      const { error } = await supabase
        .from(row.table)
        .update({ image_url: newUrl })
        .eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "done", newUrl } : r)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao normalizar";
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "error", message: msg } : r)));
    }
  }

  async function processAll() {
    setBusy(true);
    for (const r of rows) {
      if (r.status === "done") continue;
      // read latest state each loop to allow abort in future
      // eslint-disable-next-line no-await-in-loop
      await processOne(r);
    }
    setBusy(false);
    toast.success("Processamento concluído.");
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      done: rows.filter((r) => r.status === "done").length,
      err: rows.filter((r) => r.status === "error").length,
      pending: rows.filter((r) => r.status === "idle" || r.status === "running").length,
    };
  }, [rows]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="page-title text-2xl">Normalizar imagens</h1>
          <p className="text-xs text-muted-foreground">
            Aplica em imagens já salvas: fundo branco, garrafa ocupando ~2/3 do quadro (PNG 800×1000).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px]">
            <button
              onClick={() => setScope("restaurant")}
              className={`rounded px-3 py-1 font-semibold uppercase tracking-wide transition ${scope === "restaurant" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Meus vinhos
            </button>
            {role === "admin" && (
              <button
                onClick={() => setScope("catalog")}
                className={`rounded px-3 py-1 font-semibold uppercase tracking-wide transition ${scope === "catalog" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Catálogo global
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading || busy}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Recarregar
          </button>
          <button
            type="button"
            onClick={processAll}
            disabled={loading || busy || rows.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Normalizar todas
          </button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-3 text-xs">
        <Stat label="Total" value={stats.total} />
        <Stat label="Concluídas" value={stats.done} tone="primary" />
        <Stat label="Pendentes" value={stats.pending} />
        <Stat label="Erros" value={stats.err} tone="danger" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando imagens...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma imagem para processar neste escopo.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={`${r.table}-${r.id}`} className="rounded-xl border border-border bg-card p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_140px] md:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{r.producer || "—"}</div>
                  {r.message && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                      <AlertCircle className="h-3 w-3" /> {r.message}
                    </div>
                  )}
                </div>
                <ImageCell label="Antes" src={r.image_url} />
                <ImageCell label="Depois" src={r.newUrl ?? null} highlight={r.status === "done"} />
                <div className="flex flex-col items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => processOne(r)}
                    disabled={r.status === "running" || busy}
                    className="flex items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {r.status === "running" ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Processando</>
                    ) : r.status === "done" ? (
                      <><CheckCircle2 className="h-3 w-3" /> Refazer</>
                    ) : (
                      <><Play className="h-3 w-3" /> Normalizar</>
                    )}
                  </button>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "primary" | "danger" }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        tone === "primary" ? "border-primary/40 bg-primary/10" : tone === "danger" ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"
      }`}
    >
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold ${
          tone === "primary" ? "text-primary" : tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ImageCell({ label, src, highlight }: { label: string; src: string | null; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 flex h-32 items-center justify-center overflow-hidden rounded border bg-white ${highlight ? "border-primary" : "border-border"}`}>
        {src ? (
          <img src={src} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageOff className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map: Record<Row["status"], { label: string; cls: string }> = {
    idle: { label: "aguardando", cls: "text-muted-foreground" },
    running: { label: "processando", cls: "text-primary" },
    done: { label: "ok", cls: "text-emerald-500" },
    error: { label: "erro", cls: "text-destructive" },
    skipped: { label: "ignorado", cls: "text-muted-foreground" },
  };
  const s = map[status];
  return <span className={`text-center text-[10px] uppercase tracking-wide ${s.cls}`}>{s.label}</span>;
}
