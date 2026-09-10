import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun, ScrollText, UtensilsCrossed, DollarSign, LayoutDashboard, Wine } from "lucide-react";
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
    module: "pairing",
    title: "Harmonização",
    icon: <UtensilsCrossed className="h-5 w-5" />,
    description:
      "Sugestões de harmonização entre os pratos do seu menu e os vinhos da sua própria carta.",
    bullets: ["Prato a prato", "Sugestões por rótulo", "Apoio ao salão e ao cliente"],
  },
  {
    module: "pricing",
    title: "Precificação",
    icon: <DollarSign className="h-5 w-5" />,
    description:
      "Veja faixas de preço, margens e onde sua carta está desequilibrada, com sugestões de ajuste.",
    bullets: ["Faixas de preço e margens", "Simulações de preço", "Sugestões de rótulos por faixa"],
  },
  {
    module: "full",
    title: "Gestão Completa dos Vinhos",
    icon: <LayoutDashboard className="h-5 w-5" />,
    description:
      "Tudo em um só lugar: painel de controle, estoque, vendas, pedidos, fornecedores, carta e harmonização.",
    bullets: ["Faturamento, CMV e estoque", "Contagens e pedidos", "Fornecedores e equipe"],
  },
];

function Landing() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/app", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/app", replace: true });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  function go(module: AppModule, mode: "signup" | "signin") {
    setPending(`${module}:${mode}`);
    // Navegação imediata; o estado só serve para dar retorno visual ao clique.
    void navigate({ to: "/auth", search: { mode, module } }).finally(() => setPending(null));
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

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PACKS.map((p) => (
            <div
              key={p.module}
              className="relative flex flex-col rounded-2xl border bg-card p-5"
              style={{
                borderColor: p.highlight
                  ? "color-mix(in oklab, var(--gold) 55%, transparent)"
                  : "var(--border)",
                boxShadow: p.highlight
                  ? "0 0 24px color-mix(in oklab, var(--wine) 28%, transparent)"
                  : undefined,
              }}
            >
              {p.highlight && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                  Mais procurado
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
              <div className="mt-6 space-y-2 border-t border-border pt-4">
                <button
                  onClick={() => go(p.module, "signup")}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
                >
                  Experimente grátis
                </button>
                <button
                  onClick={() => go(p.module, "signin")}
                  className="w-full rounded-md border border-border px-4 py-2.5 text-[12px] font-semibold text-primary hover:border-primary"
                >
                  Entrar
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
