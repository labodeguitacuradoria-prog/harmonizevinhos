import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, FileText, Upload, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  extractWineFromFile,
  extractWineFromText,
  extractWineFromUrl,
  type ExtractedWine,
} from "@/lib/wine-extraction.functions";


type Props = {
  onExtracted: (data: ExtractedWine, meta?: { sourceFileUrl?: string; mimeType?: string }) => void;
};


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function WineAiExtractor({ onExtracted }: Props) {
  const [tab, setTab] = useState<"file" | "text" | "url">("file");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const extractFile = useServerFn(extractWineFromFile);
  const extractText = useServerFn(extractWineFromText);
  const extractUrl = useServerFn(extractWineFromUrl);


  async function handleFile(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo maior que 15 MB.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToBase64(file);

      // Upload paralelo ao storage para persistir a ficha original
      let sourceFileUrl: string | undefined;
      try {
        const ext = file.name.split(".").pop() || (file.type.startsWith("image/") ? "img" : "pdf");
        const path = `catalog/tech/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-media").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (!upErr) {
          const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(path, 60 * 60 * 24 * 365);
          sourceFileUrl = signed?.signedUrl;
        }
      } catch { /* upload é opcional */ }

      const res = await extractFile({
        data: { fileBase64: dataUrl, mimeType: file.type || "application/pdf" },
      });
      onExtracted(res, { sourceFileUrl, mimeType: file.type });
      toast.success("Ficha extraída! Revise os campos antes de salvar.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao extrair a ficha.");
    } finally {
      setBusy(false);
    }
  }


  async function handleText() {
    if (text.trim().length < 20) {
      toast.error("Cole um texto com mais detalhes.");
      return;
    }
    setBusy(true);
    try {
      const res = await extractText({ data: { text } });
      onExtracted(res);
      toast.success("Texto extraído! Revise os campos antes de salvar.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao extrair o texto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#D4AF37]/40 bg-[#141414] p-4">
      <div className="mb-3 flex items-center gap-2 text-[#D4AF37]">
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Extração automática por IA
        </span>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("file")}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase transition ${
            tab === "file"
              ? "border-[#D4AF37] bg-[#1a1a1a] text-[#D4AF37]"
              : "border-[#2a2a2a] text-[#888] hover:text-[#D4AF37]"
          }`}
        >
          <Upload className="h-3 w-3" /> Ficha técnica (PDF/imagem)
        </button>
        <button
          type="button"
          onClick={() => setTab("text")}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase transition ${
            tab === "text"
              ? "border-[#D4AF37] bg-[#1a1a1a] text-[#D4AF37]"
              : "border-[#2a2a2a] text-[#888] hover:text-[#D4AF37]"
          }`}
        >
          <FileText className="h-3 w-3" /> Texto colado
        </button>
      </div>

      {tab === "file" ? (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#D4AF37]/50 bg-[#0b0b0b] px-3 py-6 text-sm text-[#888] hover:bg-[#1a1a1a]">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
              Analisando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 text-[#D4AF37]" />
              Selecionar PDF ou imagem da ficha
            </>
          )}
          <input
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Cole aqui o texto da ficha técnica, descrição do site do produtor ou notas de degustação..."
            className="w-full rounded-md border border-[#2a2a2a] bg-[#0b0b0b] p-3 text-sm text-white placeholder:text-[#555] focus:border-[#D4AF37] focus:outline-none"
            disabled={busy}
          />
          <button
            type="button"
            onClick={handleText}
            disabled={busy || text.trim().length < 20}
            className="flex items-center gap-2 rounded-md bg-[#D4AF37] px-4 py-2 text-xs font-bold uppercase text-black transition hover:bg-[#e5c04a] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Extrair dados
          </button>
        </div>
      )}
    </div>
  );
}
