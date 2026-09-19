import { useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const W = 1080;
const H = 1920;
const FPS = 30;
const SECONDS_PER_IMAGE = 4;
export const MIN_SLIDESHOW_IMAGES = 3;

type Props = {
  /** Imagem principal do rótulo (sempre a primeira cena). */
  mainImage?: string | null;
  /** Imagens da galeria, na ordem salva. */
  gallery: string[];
  wineName?: string | null;
  folder: string;
  onCreated: (video: { title: string; url: string }) => void;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, zoom: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const scale = Math.min(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

export default function SlideshowCreator({ mainImage, gallery, wineName, folder, onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const isImage = (u: string) => !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
  const sources = [mainImage, ...gallery]
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .filter(isImage);
  const unique = Array.from(new Set(sources));
  const enough = unique.length >= MIN_SLIDESHOW_IMAGES;

  async function create() {
    setBusy(true);
    setProgress(0);
    try {
      const loaded: HTMLImageElement[] = [];
      for (const src of unique) {
        const img = await loadImage(src);
        if (img) loaded.push(img);
      }
      if (loaded.length < MIN_SLIDESHOW_IMAGES) {
        toast.error(`Não foi possível ler imagens suficientes (mínimo ${MIN_SLIDESHOW_IMAGES}).`);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível preparar o vídeo neste aparelho.");

      const stream = canvas.captureStream(FPS);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });
      rec.start();

      const framesPerImage = SECONDS_PER_IMAGE * FPS;
      const totalFrames = framesPerImage * loaded.length;
      let frame = 0;
      const step = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

      for (let i = 0; i < loaded.length; i += 1) {
        const img = loaded[i]!;
        for (let f = 0; f < framesPerImage; f += 1) {
          const t = f / framesPerImage;
          const zoom = 0.92 + t * 0.08;
          drawCover(ctx, img, zoom);
          if (t < 0.12) {
            ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.12})`;
            ctx.fillRect(0, 0, W, H);
          }
          frame += 1;
          setProgress(Math.round((frame / totalFrames) * 100));
          await step();
        }
      }

      rec.stop();
      const blob = await done;
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const path = `${folder}/slideshow-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-media")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("product-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!data?.signedUrl) throw new Error("Falha ao salvar o vídeo.");

      onCreated({
        title: `Slideshow — ${wineName?.trim() || "rótulo"}`,
        url: data.signedUrl,
      });
      toast.success("Vídeo criado e adicionado aos vídeos do rótulo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o vídeo.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="rounded-md border border-[#D4AF37]/40 bg-[#141414]/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
            Criar vídeo com a galeria
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {enough
              ? `${unique.length} imagens — começa pela imagem do rótulo, ${SECONDS_PER_IMAGE}s por imagem (~${unique.length * SECONDS_PER_IMAGE}s).`
              : `Adicione imagens na galeria: são necessárias ao menos ${MIN_SLIDESHOW_IMAGES} imagens (há ${unique.length}).`}
          </div>
        </div>
        <button
          type="button"
          disabled={!enough || busy}
          onClick={create}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#D4AF37]/50 bg-[#1a1a1a] px-3 py-2 text-xs font-bold uppercase text-[#D4AF37] transition hover:bg-[#D4AF37] hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
          {busy ? `Criando ${progress}%` : "Criar slideshow"}
        </button>
      </div>
    </div>
  );
}
