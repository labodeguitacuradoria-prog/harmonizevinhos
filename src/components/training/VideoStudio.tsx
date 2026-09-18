import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clapperboard, ChevronUp, ChevronDown, Play, Eye, EyeOff, X } from "lucide-react";
import {
  getWineVideoImages,
  startTrainingVideo,
  advanceTrainingVideo,
  setTrainingVideoPublished,
  getTrainingVideoPreview,
} from "@/lib/training-video.functions";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Props = {
  restaurantId: string;
  wineId: string;
  wineName: string;
  videoStatus?: string | null;
  videoPublished?: boolean;
  onChanged: () => void;
};

export default function VideoStudio({
  restaurantId,
  wineId,
  wineName,
  videoStatus,
  videoPublished,
  onChanged,
}: Props) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [watching, setWatching] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wine-video-images", wineId],
    queryFn: () => getWineVideoImages({ data: { restaurant_id: restaurantId, wine_id: wineId } }),
  });

  useEffect(() => {
    setChosen(data?.images ?? []);
    setProgress(null);
  }, [data?.images, wineId]);

  const sceneCount = 7;
  const generatedScenes = Math.max(0, sceneCount - Math.min(chosen.length, sceneCount));

  function toggle(url: string) {
    setChosen((list) => (list.includes(url) ? list.filter((u) => u !== url) : [...list, url]));
  }

  function move(url: string, dir: -1 | 1) {
    setChosen((list) => {
      const i = list.indexOf(url);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = list.slice();
      const a = next[i]!;
      next[i] = next[j]!;
      next[j] = a;
      return next;
    });
  }

  async function generate() {
    setRunning(true);
    setProgress({ done: 0, total: sceneCount });
    try {
      await startTrainingVideo({
        data: {
          restaurant_id: restaurantId,
          wine_id: wineId,
          image_urls: chosen.slice(0, 7),
          scene_count: sceneCount,
        },
      });
      for (let i = 0; i < 400; i += 1) {
        const step = await advanceTrainingVideo({
          data: { restaurant_id: restaurantId, wine_id: wineId },
        });
        setProgress({ done: step.done, total: step.total });
        if (step.status === "ready") {
          toast.success("Vídeo pronto para revisar.");
          break;
        }
        if (step.status === "error") {
          toast.error(step.message ?? "Não foi possível criar o vídeo.");
          break;
        }
        await sleep(step.status === "waiting" ? 15000 : 6000);
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o vídeo.");
    } finally {
      setRunning(false);
    }
  }

  async function togglePublish() {
    try {
      await setTrainingVideoPublished({
        data: { restaurant_id: restaurantId, wine_id: wineId, published: !videoPublished },
      });
      toast.success(!videoPublished ? "Vídeo publicado para a equipe." : "Vídeo recolhido.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar o vídeo.");
    }
  }

  const images = data?.images ?? [];

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
        <Clapperboard className="h-3.5 w-3.5" /> Vídeo de 30 segundos
      </div>
      <p className="text-xs text-muted-foreground">
Cerca de 30 segundos em {sceneCount} cenas de 4 segundos. Escolha e ordene as fotos do rótulo;
        as cenas que faltarem são criadas pela inteligência artificial.
      </p>

      {isLoading ? (
        <div className="mt-2 text-xs text-muted-foreground">Carregando fotos...</div>
      ) : images.length === 0 ? (
        <div className="mt-2 text-xs text-muted-foreground">
          Este rótulo não tem fotos salvas. Todas as cenas serão criadas pela inteligência
          artificial.
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {images.map((url) => {
            const order = chosen.indexOf(url);
            return (
              <li key={url} className="flex items-center gap-2 rounded-md border border-border p-1.5">
                <input
                  type="checkbox"
                  checked={order >= 0}
                  onChange={() => toggle(url)}
                  className="h-4 w-4 accent-[var(--gold)]"
                />
                <div className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-background">
                  <img src={url} alt="" className="h-full w-full object-contain" />
                </div>
                <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                  {order >= 0 ? `Cena ${order + 1}` : "Fora do vídeo"}
                </span>
                {order >= 0 ? (
                  <>
                    <button
                      onClick={() => move(url, -1)}
                      aria-label="Subir"
                      className="rounded border border-border p-1 text-muted-foreground hover:bg-accent"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => move(url, 1)}
                      aria-label="Descer"
                      className="rounded border border-border p-1 text-muted-foreground hover:bg-accent"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={generate}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Clapperboard className="h-3.5 w-3.5" />
          {running ? "Criando vídeo..." : "Criar vídeo"}
        </button>
        {videoStatus === "draft" || videoStatus === "published" ? (
          <>
            <button
              onClick={() => setWatching(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:bg-accent"
            >
              <Play className="h-3.5 w-3.5" /> Assistir
            </button>
            <button
              onClick={togglePublish}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:bg-accent"
            >
              {videoPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {videoPublished ? "Recolher da equipe" : "Publicar para a equipe"}
            </button>
          </>
        ) : null}
      </div>

      {progress ? (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {progress.done} de {progress.total} cenas prontas
          {generatedScenes ? ` · ${generatedScenes} cena(s) criada(s) pela IA` : ""}
        </div>
      ) : null}

      {watching ? (
        <PreviewPlayer
          restaurantId={restaurantId}
          wineId={wineId}
          title={wineName}
          onClose={() => setWatching(false)}
        />
      ) : null}
    </div>
  );
}

function PreviewPlayer({
  restaurantId,
  wineId,
  title,
  onClose,
}: {
  restaurantId: string;
  wineId: string;
  title: string;
  onClose: () => void;
}) {
  const [part, setPart] = useState(0);
  const { data } = useQuery({
    queryKey: ["training-video-preview", wineId],
    queryFn: () => getTrainingVideoPreview({ data: { restaurant_id: restaurantId, wine_id: wineId } }),
  });
  const urls = data?.urls ?? [];
  const current = urls[part];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-3">
      <div className="w-full max-w-sm">
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar vídeo"
            className="rounded-md border border-border p-1.5 text-primary hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {current ? (
          <div className="relative">
            <video
              key={current}
              src={current}
              controls
              autoPlay
              playsInline
              onEnded={() => (part < urls.length - 1 ? setPart((v) => v + 1) : undefined)}
              className="aspect-[9/16] w-full bg-card object-contain"
            />
            {data?.captions?.[part] ? (
              <p className="pointer-events-none absolute inset-x-2 bottom-12 rounded bg-black/60 px-2 py-1 text-center text-sm text-white">
                {data.captions[part]}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando vídeo...</div>
        )}
        {urls.length ? (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            Cena {part + 1} de {urls.length}
          </div>
        ) : null}
      </div>
    </div>
  );
}
