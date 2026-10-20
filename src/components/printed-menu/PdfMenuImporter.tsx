import { useRef, useState } from "react";
import { ACCEPT } from "@/lib/file-accept";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, FileUp, Loader2, Paperclip } from "lucide-react";
import { MediaUploader } from "@/components/MediaUploader";
import { resolveSheets, type CustomDesign, type MenuSheet } from "./MenuPreview";
import type { MenuSection } from "./templates";

type Attachment = { name: string; path: string; mime?: string | null };

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-[11px] font-bold uppercase tracking-wider ${open ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent"}`}
      >
        <span className="truncate">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-border p-3">{children}</div> : null}
    </div>
  );
}

/** Menu com setinha: fundo/textura por arquivo ou URL. */
export function BackgroundMenu({ value, onChange, restaurantId }: { value?: string; onChange: (url: string) => void; restaurantId: string }) {
  return (
    <Collapsible title={`Fundo / textura das páginas${value ? " · definido" : ""}`}>
      <MediaUploader
        label=""
        value={value || null}
        onChange={(u) => onChange(u ?? "")}
        accept="image/*,application/pdf"
        folder={`${restaurantId}/custom-menu`}
      />
    </Collapsible>
  );
}

async function uploadPng(blob: Blob, restaurantId: string) {
  const path = `${restaurantId}/custom-menu/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from("product-media").upload(path, blob, { contentType: "image/png" });
  if (error) throw error;
  const { data } = await supabase.storage.from("product-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? "";
}

/** Menu com setinha: importa uma carta em PDF e cria uma folha editável por página. */
export function PdfMenuImporter({
  value,
  onChange,
  restaurantId,
  requestId,
  sections,
}: {
  value: CustomDesign;
  onChange: (v: CustomDesign) => void;
  restaurantId: string;
  requestId?: string | null;
  sections: MenuSection[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"image" | "text">("image");
  const pickerRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [] } = useQuery({
    queryKey: ["custom-menu-request-attachments", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_menu_requests").select("attachments").eq("id", requestId!).maybeSingle();
      if (error) throw error;
      return ((data?.attachments as unknown as Attachment[]) ?? []).filter(
        (a) => a.mime === "application/pdf" || /\.pdf$/i.test(a.name),
      );
    },
  });

  async function importPdf(data: ArrayBuffer, label: string) {
    setBusy(label);
    try {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const doc = await pdfjs.getDocument({ data }).promise;
      const created: MenuSheet[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (mode === "image") {
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(4, 2400 / Math.max(base.width, base.height)) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
          const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao converter a página."))), "image/png"));
          const url = await uploadPng(blob, restaurantId);
          created.push({ id: crypto.randomUUID(), kind: "extra", name: `Importada · página ${n}`, title: "", text: "", image: url });
        } else {
          const content = await page.getTextContent();
          const lines: string[] = [];
          let current = "";
          let lastY: number | null = null;
          for (const item of content.items as Array<{ str: string; transform: number[] }>) {
            const y = Math.round(item.transform?.[5] ?? 0);
            if (lastY !== null && Math.abs(y - lastY) > 2) {
              if (current.trim()) lines.push(current.trim());
              current = "";
            }
            current += (current && !current.endsWith(" ") ? " " : "") + item.str;
            lastY = y;
          }
          if (current.trim()) lines.push(current.trim());
          const [first = "", ...rest] = lines;
          created.push({ id: crypto.randomUUID(), kind: "extra", name: `Importada · página ${n}`, title: first, text: rest.join("\n"), image: "" });
        }
      }
      const sheets = [...resolveSheets(value, sections), ...created];
      onChange({ ...value, sheets, coverImage: "", coverText: "" });
      toast.success(`${created.length} página(s) importada(s). Edite cada folha em "Folhas da carta".`);
    } catch (e) {
      toast.error(`Não foi possível importar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setBusy(null);
    }
  }

  async function importAttachment(a: Attachment) {
    const { data, error } = await supabase.storage.from("custom-menu-briefs").download(a.path);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo do pedido.");
    await importPdf(await data.arrayBuffer(), a.path);
  }

  return (
    <Collapsible title="Importar carta existente (PDF)">
      <p className="mb-3 text-[11px] text-muted-foreground">
        Cada página do PDF vira uma folha da carta, que você pode reordenar, editar ou excluir.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-1">
        {([
          ["image", "Design fiel (imagem)"],
          ["text", "Texto editável"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`rounded-md border px-2 py-1.5 text-[11px] ${mode === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {attachments.length > 0 ? (
        <div className="mb-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Enviados pelo restaurante</div>
          {attachments.map((a) => (
            <button
              key={a.path}
              type="button"
              disabled={!!busy}
              onClick={() => importAttachment(a)}
              className="flex w-full items-center gap-2 rounded border border-border px-2 py-1.5 text-left text-xs hover:border-primary disabled:opacity-50"
            >
              {busy === a.path ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        disabled={!!busy}
        onClick={() => pickerRef.current?.click()}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-3 text-xs text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {busy ? "Importando páginas..." : "Selecionar PDF do computador"}
      </button>
      <input
          ref={pickerRef}
          type="file"
          accept={ACCEPT.pdf}
          className="hidden"
          aria-label="PDF da carta"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await importPdf(await f.arrayBuffer(), "upload");
          }}
        />
    </Collapsible>
  );
}
