import { useRef, useState } from "react";
import { ACCEPT } from "@/lib/file-accept";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, FileText, Upload, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { wineFileType, WINE_FILE_MAX_BYTES } from "@/lib/wine-file-input";
import { Button } from "@/components/ui/button";
import {
  extractWineFromFile,
  extractWineFromText,
  extractWineFromUrl,
  type ExtractedWine,
} from "@/lib/wine-extraction.functions";


type Props = {
  onExtracted: (data: ExtractedWine, meta?: { sourceFileUrl?: string; mimeType?: string }) => void;
};


export function WineAiExtractor({ onExtracted }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "text" | "url">("file");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileStage, setFileStage] = useState<"upload" | "analysis" | null>(null);
  const [fileError, setFileError] = useState("");
  const extractFile = useServerFn(extractWineFromFile);
  const extractText = useServerFn(extractWineFromText);
  const extractUrl = useServerFn(extractWineFromUrl);


  async function handleFile(file: File) {
    if (busy) return;
    setFileError("");
    if (file.size > WINE_FILE_MAX_BYTES) {
      setFileError("Arquivo maior que 15 MB.");
      toast.error("Arquivo maior que 15 MB.");
      return;
    }
    setBusy(true);
    setFileStage("upload");
    try {
      if (!file.size) throw new Error("O arquivo está vazio. Selecione outra ficha.");
      const { mimeType, extension } = wineFileType(file);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Sua sessão expirou. Entre novamente para enviar a ficha.");
      const path = `catalog/tech/${sessionData.session.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("product-media").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: mimeType,
      });
      if (uploadError) throw new Error("Não foi possível enviar a ficha. Verifique sua conexão e tente novamente.");
      const { data: signed, error: signedError } = await supabase.storage.from("product-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedError || !signed?.signedUrl) throw new Error("A ficha foi enviada, mas não foi possível abrir o arquivo. Tente novamente.");
      setFileStage("analysis");
      const res = await extractFile({
        data: { storagePath: path, mimeType },
      });
      onExtracted(res, { sourceFileUrl: signed.signedUrl, mimeType });
      toast.success("Ficha extraída! Revise os campos antes de salvar.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao extrair a ficha. Tente novamente.";
      setFileError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      setFileStage(null);
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

  async function handleUrl() {
    const value = url.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(value)) {
      toast.error("Informe um link válido começando com http:// ou https://");
      return;
    }
    setBusy(true);
    setUrlError("");
    try {
      const res = await extractUrl({ data: { url: value } });
      if (!res.ok) {
        setUrlError(res.error);
        toast.warning("Este site não permite leitura automática.");
        return;
      }
      onExtracted(res.data, { sourceFileUrl: value });
      toast.success("Link analisado! Revise os campos antes de salvar.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao analisar o link.");
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
        <button
          type="button"
          onClick={() => setTab("url")}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase transition ${
            tab === "url"
              ? "border-[#D4AF37] bg-[#1a1a1a] text-[#D4AF37]"
              : "border-[#2a2a2a] text-[#888] hover:text-[#D4AF37]"
          }`}
        >
          <Link2 className="h-3 w-3" /> Link da internet
        </button>
      </div>


      {tab === "file" ? (
        <>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="h-auto min-h-16 w-full whitespace-normal border-dashed border-primary/50 bg-background px-3 py-6 text-sm text-muted-foreground hover:bg-accent"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {fileStage === "upload" ? "Enviando ficha..." : "Analisando ficha..."}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 text-primary" />
              Selecionar PDF ou imagem da ficha
            </>
          )}
        </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT.techSheet}
            className="hidden"
            aria-label="Arquivo da ficha técnica"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </>
      ) : tab === "url" ? (
        <div className="space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleUrl();
              }
            }}
            placeholder="https://site-do-produtor.com/vinho..."
            className="w-full rounded-md border border-[#2a2a2a] bg-[#0b0b0b] p-3 text-sm text-white placeholder:text-[#555] focus:border-[#D4AF37] focus:outline-none"
            disabled={busy}
          />
          <p className="text-[11px] text-[#666]">
            Cole o link da página (ou do PDF) com as informações do vinho. A IA lê o conteúdo e preenche os campos.
          </p>
          {urlError ? (
            <div className="rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3 text-xs text-[#D4AF37]">
              <p>{urlError}</p>
              <button
                type="button"
                onClick={() => {
                  setUrlError("");
                  setTab("text");
                }}
                className="mt-2 font-bold underline underline-offset-2"
              >
                Abrir Texto colado
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleUrl}
            disabled={busy || url.trim().length < 10}
            className="flex items-center gap-2 rounded-md bg-[#D4AF37] px-4 py-2 text-xs font-bold uppercase text-black transition hover:bg-[#e5c04a] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            Extrair do link
          </button>
        </div>
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
      {fileError && <p role="alert" className="mt-2 text-sm text-destructive">{fileError}</p>}
    </div>
  );
}
