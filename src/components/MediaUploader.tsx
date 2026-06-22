import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";

type Props = {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  folder: string;
  kind?: "image" | "file";
};

export function MediaUploader({ label, value, onChange, accept = "image/*", folder, kind = "image" }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = await supabase.storage.from("product-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    setUploading(false);
    if (data?.signedUrl) onChange(data.signedUrl);
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border p-2">
          {kind === "image" ? (
            <img src={value} alt="" className="h-16 w-16 rounded object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
              <FileText className="h-6 w-6" />
            </div>
          )}
          <a href={value} target="_blank" rel="noreferrer" className="flex-1 truncate text-xs text-primary underline">
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
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground hover:bg-accent">
          {uploading ? (
            "Enviando..."
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
            }}
          />
        </label>
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
            <img src={url} alt="" className="h-20 w-full rounded border border-border object-cover" />
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
