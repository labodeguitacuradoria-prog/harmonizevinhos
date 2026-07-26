import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileText, Image as ImageIcon, Link2, Loader2 } from "lucide-react";
import { normalizeProductImage } from "@/lib/image-normalize";

type Props = {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  folder: string;
  kind?: "image" | "file";
  /** When true (default for images), the file/URL is normalized to a
   *  standardized white-background PNG with the subject at ~2/3 of frame. */
  normalize?: boolean;
};

export function MediaUploader({
  label,
  value,
  onChange,
  accept = "image/*",
  folder,
  kind = "image",
  normalize,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const shouldNormalize = (normalize ?? (kind === "image"));

  async function uploadBlob(blob: Blob, ext: string) {
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-media").upload(path, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: blob.type || undefined,
    });
    if (error) throw error;
    const { data } = await supabase.storage
      .from("product-media")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? null;
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      if (shouldNormalize) {
        const blob = await normalizeProductImage(file);
        const url = await uploadBlob(blob, "png");
        if (url) onChange(url);
      } else {
        const ext = file.name.split(".").pop() ?? "bin";
        const url = await uploadBlob(file, ext);
        if (url) onChange(url);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setUploading(false);
    }
  }

  async function handleUrl() {
    const v = urlInput.trim();
    if (!v) return;
    setUploading(true);
    try {
      if (shouldNormalize) {
        const blob = await normalizeProductImage(v);
        const url = await uploadBlob(blob, "png");
        if (url) {
          onChange(url);
          setUrlInput("");
        }
      } else {
        onChange(v);
        setUrlInput("");
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível processar a imagem dessa URL.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border p-2">
          {kind === "image" ? (
            <img src={value} alt="" className="h-16 w-16 rounded border border-border bg-white object-contain" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
              <FileText className="h-6 w-6" />
            </div>
          )}
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex-1 truncate text-xs text-primary underline"
          >
            Ver arquivo
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded p-1 hover:bg-accent"
            aria-label="Remover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground hover:bg-accent">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processando...
              </>
            ) : (
              <>
                {kind === "image" ? <ImageIcon className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                Selecionar arquivo
              </>
            )}
            <input
              type="file"
              accept={accept}
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {kind === "image" && (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1.5 rounded-md border border-input bg-background px-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="ou cole a URL da imagem (https://...)"
                  className="w-full bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
                  disabled={uploading}
                />
              </div>
              <button
                type="button"
                onClick={handleUrl}
                disabled={uploading || !urlInput.trim()}
                className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                Usar URL
              </button>
            </div>
          )}
          {shouldNormalize && kind === "image" && (
            <p className="text-[10px] text-muted-foreground/70">
              A imagem é padronizada com fundo branco e a garrafa em ~2/3 do quadro.
            </p>
          )}
        </>
      )}
    </div>
  );
}

type GalleryProps = {
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
  folder: string;
};

export function MediaGallery({ label, values, onChange, folder }: GalleryProps) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {values.map((url) => (
          <div key={url} className="relative">
            <img src={url} alt="" className="h-20 w-full rounded border border-border bg-white object-contain" />
            <button
              type="button"
              onClick={() => onChange(values.filter((u) => u !== url))}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
              aria-label="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <MediaUploader
          label=""
          value={null}
          onChange={(url) => url && onChange([...values, url])}
          folder={folder}
        />
      </div>
    </div>
  );
}
