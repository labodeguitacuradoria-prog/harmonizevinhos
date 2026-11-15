import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageDown, Loader2, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  migrateImages,
  scanExternalImages,
  type ImageFailure,
  type ImageWorkItem,
} from "@/lib/image-import.functions";

const BATCH = 4;
const PARALLEL = 3;

/** Ferramenta do Administrador Geral: traz para o sistema todas as fotos de vinhos que ainda vêm de outros sites. */
export default function ImageStorageTool({ onDone }: { onDone?: () => void }) {
  const scan = useServerFn(scanExternalImages);
  const migrate = useServerFn(migrateImages);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ImageWorkItem[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [stats, setStats] = useState({ imported: 0, renewed: 0 });
  const [failures, setFailures] = useState<ImageFailure[]>([]);
  const [finished, setFinished] = useState(false);

  async function runScan() {
    setScanning(true);
    setFinished(false);
    setFailures([]);
    setStats({ imported: 0, renewed: 0 });
    setDone(0);
    try {
      const res = await scan();
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível verificar as fotos.");
    } finally {
      setScanning(false);
    }
  }

  async function runMigration() {
    if (!items?.length) return;
    setRunning(true);
    setFinished(false);
    setFailures([]);
    setDone(0);
    let imported = 0;
    let renewed = 0;
    const fails: ImageFailure[] = [];
    const chunks: ImageWorkItem[][] = [];
    for (let i = 0; i < items.length; i += BATCH) chunks.push(items.slice(i, i + BATCH));
    let next = 0;
    let processed = 0;
    // Algumas levas em paralelo para não demorar com centenas de fotos.
    const worker = async () => {
      while (next < chunks.length) {
        const chunk = chunks[next++];
        try {
          const res = await migrate({ data: { items: chunk.map(({ table, id }) => ({ table, id })) } });
          imported += res.imported;
          renewed += res.renewed;
          fails.push(...res.failures);
        } catch {
          for (const it of chunk)
            fails.push({ table: it.table, id: it.id, label: it.label, place: it.place, url: "", reason: "Tempo esgotado. Rode a verificação de novo." });
        }
        processed += chunk.length;
        setDone(processed);
        setStats({ imported, renewed });
        setFailures([...fails]);
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    setRunning(false);
    setFinished(true);
    onDone?.();
  }

  const totalImports = items?.reduce((s, it) => s + it.imports, 0) ?? 0;
  const totalRenews = items?.reduce((s, it) => s + it.renews, 0) ?? 0;
  const progress = items?.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (running) return;
        setOpen(v);
        if (v && !items) runScan();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <ImageDown /> Fotos no sistema
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto no-scrollbar">
        <DialogHeader>
          <DialogTitle>Trazer as fotos dos vinhos para o sistema</DialogTitle>
          <DialogDescription>
            Fotos com link de outros sites somem quando o site muda e não saem nos PDFs. Esta ferramenta baixa cada foto,
            guarda no aplicativo e troca o link no cadastro — no Cadastro Global, nos vinhos de todos os restaurantes e nas vinícolas.
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando os cadastros...
          </p>
        ) : items ? (
          <div className="space-y-4">
            {items.length === 0 && !finished ? (
              <p className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Todas as fotos já estão guardadas no sistema.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xl font-bold text-primary">{items.length}</div>
                  <div className="text-[11px] uppercase text-muted-foreground">Cadastros</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xl font-bold text-primary">{totalImports}</div>
                  <div className="text-[11px] uppercase text-muted-foreground">Fotos de outros sites</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xl font-bold text-primary">{totalRenews}</div>
                  <div className="text-[11px] uppercase text-muted-foreground">Links a renovar</div>
                </div>
              </div>
            )}

            {(running || finished) && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  {done} de {items.length} cadastros · {stats.imported} fotos copiadas · {stats.renewed} links renovados
                </p>
              </div>
            )}

            {finished && (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Concluído. {failures.length ? `${failures.length} foto(s) não puderam ser baixadas.` : "Nenhuma falha."}
              </p>
            )}

            {failures.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Precisam de nova foto (envie pelo cadastro):
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-xs">
                  {failures.map((f, i) => (
                    <li key={`${f.id}-${i}`} className="flex flex-wrap items-center gap-x-2 border-b border-border/50 pb-1 last:border-0">
                      <span className="font-semibold">{f.label}</span>
                      <span className="text-muted-foreground">· {f.place}</span>
                      <span className="text-muted-foreground">— {f.reason}</span>
                      {f.url.startsWith("http") && (
                        <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                          link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={runScan} disabled={running || scanning}>
                Verificar de novo
              </Button>
              {items.length > 0 && !finished && (
                <Button type="button" onClick={runMigration} disabled={running}>
                  {running ? <Loader2 className="animate-spin" /> : <ImageDown />}
                  {running ? "Copiando fotos..." : "Trazer fotos para o sistema"}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
