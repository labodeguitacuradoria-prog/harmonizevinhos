import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { harmonizeDish, type DishProfile } from "@/lib/harmonize.functions";
import { DishRadarChart } from "@/components/DishRadarChart";

export const Route = createFileRoute("/_app/app/pairings")({
  head: () => ({
    meta: [
      { title: "Harmonizações — Sommelier IA" },
      {
        name: "description",
        content:
          "Descreva o prato e receba a decomposição sensorial e sugestões de harmonização de vinhos nacionais e internacionais.",
      },
      { property: "og:title", content: "Harmonizações — Sommelier IA" },
      {
        property: "og:description",
        content: "Decomposição sensorial de pratos e sugestões de harmonização por IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PairingsPage,
});

const EXAMPLES = [
  "Risoto de cogumelos com parmesão de 24 meses",
  "Ostras frescas com limão siciliano",
  "Costela bovina assada 12 horas na brasa",
  "Curry tailandês de camarão com leite de coco",
];

function PairingsPage() {
  const [dish, setDish] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<DishProfile | null>(null);
  const run = useServerFn(harmonizeDish);

  async function analyze(text: string) {
    if (text.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await run({ data: { dish: text.trim() } });
      setProfile(res);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível analisar o prato.");
    } finally {
      setBusy(false);
    }
  }

  const paragraphs = (profile?.explanation ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="page-title flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5" /> Harmonizações
        </h1>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Sommelier IA · decomposição de pratos
        </span>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-primary">
          Descreva o prato
        </label>
        <textarea
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          rows={3}
          placeholder="Ex.: Magret de pato com redução de laranja e purê de mandioquinha"
          className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => analyze(dish)}
            disabled={busy || dish.trim().length < 3}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Harmonizar
          </button>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setDish(ex);
                analyze(ex);
              }}
              disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {busy && !profile && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Decompondo os blocos de sabor do prato...
        </div>
      )}

      {profile && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="section-title">Perfil sensorial</div>
            <div className="mb-1 text-sm font-bold text-primary">{profile.name}</div>
            <div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              {profile.cookingMethod}
            </div>
            <DishRadarChart
              values={[
                { label: "Intens.", value: profile.intensity },
                { label: "Acidez", value: profile.acidity },
                { label: "Gordura", value: profile.fat },
                { label: "Doçura", value: profile.sweetness },
                { label: "Sal", value: profile.salt },
                { label: "Picância", value: profile.spice },
                { label: "Amargor", value: profile.bitterness },
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.ingredients.map((i) => (
                <span
                  key={i}
                  className="rounded-md border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground"
                >
                  {i}
                </span>
              ))}
            </div>
            {(profile.peixe_gordo || profile.sobremesa) && (
              <div className="mt-3 space-y-1 text-[11px]">
                {profile.peixe_gordo && (
                  <div className="rounded-md border border-[#800020] bg-[#800020]/15 px-2 py-1 text-foreground">
                    Alerta: peixe gordo — evite tintos tânicos ou amadeirados.
                  </div>
                )}
                {profile.sobremesa && (
                  <div className="rounded-md border border-primary/60 bg-primary/10 px-2 py-1 text-foreground">
                    Prato doce — o vinho deve ser igual ou mais doce.
                  </div>
                )}
              </div>
            )}
            {!!profile.rules?.length && (
              <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                Regras aplicadas: {profile.rules.join(" · ")}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="section-title">Parecer do sommelier</div>
            <div className="space-y-4">
              {paragraphs.map((p, i) => (
                <div key={i}>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {i === 0
                      ? "Análise sensorial"
                      : i === 1
                        ? "Seleção nacional"
                        : "Seleção internacional"}
                  </div>
                  <p
                    className="text-sm leading-relaxed text-foreground/90"
                    dangerouslySetInnerHTML={{
                      __html: p.replace(/\*\*(.+?)\*\*/g, '<strong class="text-primary">$1</strong>'),
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
