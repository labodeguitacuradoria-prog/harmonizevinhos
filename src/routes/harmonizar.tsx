import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { harmonizeDish, type DishProfile } from "@/lib/harmonize.functions";
import { TypewriterText } from "@/components/TypewriterText";
import capa from "@/assets/harmonizar-capa.png.asset.json";

export const Route = createFileRoute("/harmonizar")({
  head: () => ({
    meta: [
      { title: "Me conte o prato que escolho o vinho perfeito" },
      {
        name: "description",
        content:
          "Descreva seu prato e receba gratuitamente sugestões de harmonização de vinhos nacionais e internacionais. Sem cadastro.",
      },
      { property: "og:title", content: "Me conte o prato que escolho o vinho perfeito" },
      {
        property: "og:description",
        content: "Sommelier virtual gratuito: descreva o prato e descubra o vinho ideal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicPairings,
});

function PublicPairings() {
  const [dish, setDish] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<DishProfile | null>(null);
  const run = useServerFn(harmonizeDish);

  async function analyze() {
    const text = dish.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setProfile(null);
    try {
      setProfile(await run({ data: { dish: text } }));
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível analisar o prato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-background">
      <img
        src={capa.url}
        alt="Taça de vinho sobre a mesa de um restaurante"
        className="fixed inset-0 h-full w-full object-cover"
      />
      <div className="fixed inset-0 bg-background/55" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <h1 className="max-w-2xl text-3xl font-light uppercase leading-tight tracking-wide text-foreground sm:text-5xl">
          Me conte o prato que
          <br />
          escolho o vinho perfeito
        </h1>

        <div className="mt-8 flex w-full max-w-2xl items-center gap-2 rounded-full border border-border/80 bg-background/60 px-6 py-3 backdrop-blur-sm focus-within:border-primary">
          <input
            value={dish}
            onChange={(e) => setDish(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="Digite aqui."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={analyze}
            disabled={busy || dish.trim().length < 3}
            aria-label="Harmonizar"
            className="text-muted-foreground transition hover:text-primary disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </button>
        </div>

        {profile && (
          <section className="mt-10 max-w-3xl rounded-xl border border-border bg-card/85 p-6 backdrop-blur-sm">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-primary">
              {profile.name}
            </div>
            <TypewriterText
              text={profile.explanation}
              className="whitespace-pre-line text-sm leading-relaxed text-foreground/90"
            />
          </section>
        )}
      </div>
    </main>
  );
}
