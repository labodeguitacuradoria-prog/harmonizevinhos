import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun, ScrollText, UtensilsCrossed, DollarSign, LayoutDashboard, GraduationCap, Wine } from "lucide-react";
import type { AppModule } from "@/lib/modules";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "La Bodeguita Vinhos — Pacotes" },
      {
        name: "description",
        content:
          "Escolha seu pacote: carta de vinhos para impressão, harmonização, análise de preços ou gestão completa dos vinhos.",
      },
      { property: "og:title", content: "La Bodeguita Vinhos — Pacotes" },
      {
        property: "og:description",
        content:
          "Escolha seu pacote: carta de vinhos para impressão, harmonização, análise de preços ou gestão completa dos vinhos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

type Pack = {
  module: AppModule;
  title: string;
  icon: React.ReactNode;
  description: string;
  bullets: string[];
  highlight?: boolean;
  available?: boolean;
};

const PACKS: Pack[] = [
  {
    module: "printed_menu",
    title: "Impressão de Cartas de Vinhos",
    icon: <ScrollText className="h-5 w-5" />,
    description:
      "Monte e imprima uma carta elegante a partir dos seus rótulos, sem depender de designer ou planilha.",
    bullets: ["Modelos prontos e seções", "Seu logotipo e suas cores", "PDF pronto para impressão"],
    highlight: true,
  },
  {
    module: "full",
    title: "Gestão Completa dos Vinhos",
    icon: <LayoutDashboard className="h-5 w-5" />,
    description:
      "Tudo em um só lugar: painel de controle, estoque, vendas, pedidos, fornecedores, carta e harmonização.",
    bullets: ["Faturamento, CMV e estoque", "Contagens e pedidos", "Fornecedores e equipe"],
  },
  {
    module: "pairing",
    title: "Harmonização",
    icon: <UtensilsCrossed className="h-5 w-5" />,
    description:
      "Sugestões de harmonização entre os pratos do seu menu e os vinhos da sua própria carta.",
    bullets: ["Prato a prato", "Sugestões por rótulo", "Apoio ao salão e ao cliente"],
    available: false,
  },
  {
    module: "pricing",
    title: "Precificação",
    icon: <DollarSign className="h-5 w-5" />,
    description:
      "Veja faixas de preço, margens e onde sua carta está desequilibrada, com sugestões de ajuste.",
    bullets: ["Faixas de preço e margens", "Simulações de preço", "Sugestões de rótulos por faixa"],
    available: false,
  },
  {
    module: "training",
    title: "Treinamento do Staff",
    icon: <GraduationCap className="h-5 w-5" />,
    description:
      "Fichas rápidas de cada rótulo para a equipe estudar pelo celular, com linguagem de salão e desafio para fixar.",
    bullets: ["Uma tela por rótulo", "Frase pronta para a mesa", "Desafio com pontuação"],
    available: false,
  },
];

function Landing() {
  const navigateHome = useNavigate();
  // Retorno do login com Google: entra direto no painel.
  useEffect(() => {
    let pending = false;
    try { pending = sessionStorage.getItem("oauth-pending") === "1"; } catch { /* ignora */ }
    if (!pending) return;
    const go = () => {
      try { sessionStorage.removeItem("oauth-pending"); } catch { /* ignora */ }
      navigateHome({ to: "/app" });
    };
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    return () => sub.subscription.unsubscribe();
  }, [navigateHome]);

  const { theme, toggle } = useTheme();
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppModule | null>(null);

  function markSelection(module: AppModule, mode: "signup" | "signin") {
    setSelected(module);
    setPending(`${module}:${mode}`);
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <Wine className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            La Bodeguita Vinhos
          </span>
        </div>
        <button
          onClick={toggle}
          title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition-colors hover:border-primary"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Escuro"}</span>
        </button>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-16">
        <h1 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-4xl">
          Escolha o pacote que você quer usar
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Você começa apenas com a sua carta de vinhos. Depois pode somar outros pacotes quando
          quiser.
        </p>

        <div className="mt-8 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PACKS.map((p) => {
            const active = selected ? selected === p.module : !!p.highlight;
            const available = p.available !== false;
            return (
            <div
              key={p.module}
              className="relative flex h-full flex-col rounded-2xl border bg-card p-5 transition-all duration-150"
              style={{
                borderColor: active
                  ? "color-mix(in oklab, var(--gold) 55%, transparent)"
                  : "var(--border)",
                boxShadow: active
                  ? "0 0 24px color-mix(in oklab, var(--wine) 28%, transparent)"
                  : undefined,
              }}
            >
              {p.highlight && !selected && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                  Mais procurado
                </span>
              )}
              {selected === p.module && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                  Escolhido
                </span>
              )}
              {!available && (
                <span className="absolute -top-2.5 right-4 rounded-full border border-border bg-card px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Em desenvolvimento
                </span>
              )}
              <div className="flex items-center gap-2 text-primary">
                {p.icon}
                <h2 className="text-sm font-semibold leading-snug text-foreground">{p.title}</h2>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                {p.description}
              </p>
              <ul className="mt-4 space-y-1.5">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-[11px] text-muted-foreground">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {b}
                  </li>
                ))}
              </ul>
              {!available && (
                <p className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  Este módulo ainda está em desenvolvimento e será liberado em breve.
                </p>
              )}
              <div className="mt-auto space-y-2 border-t border-border pt-4">
                {available ? (
                  <>
                    <a
                      href={`/auth?mode=signup&module=${p.module}`}
                      onClick={() => markSelection(p.module, "signup")}
                      aria-busy={pending === `${p.module}:signup`}
                      className="block w-full rounded-md bg-primary px-4 py-2.5 text-center text-[12px] font-semibold text-primary-foreground transition-all duration-100 hover:opacity-90 active:scale-[0.98] active:brightness-90"
                    >
                      {pending === `${p.module}:signup` ? "Abrindo…" : "Experimente grátis"}
                    </a>
                    <a
                      href={`/auth?mode=signin&module=${p.module}`}
                      onClick={() => markSelection(p.module, "signin")}
                      aria-busy={pending === `${p.module}:signin`}
                      className="block w-full rounded-md border border-border px-4 py-2.5 text-center text-[12px] font-semibold text-primary transition-all duration-100 hover:border-primary active:scale-[0.98] active:bg-accent"
                    >
                      {pending === `${p.module}:signin` ? "Abrindo…" : "Entrar"}
                    </a>
                  </>
                ) : (
                  <>
                    <span
                      aria-disabled="true"
                      className="block w-full cursor-not-allowed rounded-md bg-muted px-4 py-2.5 text-center text-[12px] font-semibold text-muted-foreground opacity-70"
                    >
                      Experimente grátis
                    </span>
                    <span
                      aria-disabled="true"
                      className="block w-full cursor-not-allowed rounded-md border border-border px-4 py-2.5 text-center text-[12px] font-semibold text-muted-foreground opacity-70"
                    >
                      Entrar
                    </span>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
