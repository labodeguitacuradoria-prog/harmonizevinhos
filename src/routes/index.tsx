import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { BrandLogo } from "@/components/BrandLogo";
import { Moon, Sun, ScrollText, UtensilsCrossed, DollarSign, LayoutDashboard, GraduationCap, Wine } from "lucide-react";
import type { AppModule } from "@/lib/modules";
import landingBg from "@/assets/landing-restaurant-bg.jpg";

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
    available: true,
  },
  {
    module: "pricing",
    title: "Precificação",
    icon: <DollarSign className="h-5 w-5" />,
    description:
      "Veja faixas de preço, margens e onde sua carta está desequilibrada, com sugestões de ajuste.",
    bullets: ["Faixas de preço e margens", "Simulações de preço", "Sugestões de rótulos por faixa"],
    available: true,
  },
  {
    module: "training",
    title: "Treinamento do Staff",
    icon: <GraduationCap className="h-5 w-5" />,
    description:
      "Fichas rápidas de cada rótulo para a equipe estudar pelo celular, com linguagem de salão e desafio para fixar.",
    bullets: ["Uma tela por rótulo", "Frase pronta para a mesa", "Desafio com pontuação"],
    available: true,
  },
];

function Landing() {
  const navigateHome = useNavigate();
  const [returningFromGoogle, setReturningFromGoogle] = useState(false);
  // Retorno do login com Google: entra direto no painel.
  useEffect(() => {
    let pending = false;
    try {
      const raw = sessionStorage.getItem("oauth-pending");
      const ts = raw ? Number(raw) : 0;
      // Só vale para um retorno recente; marcas antigas são descartadas.
      pending = !!ts && Date.now() - ts < 10 * 60_000;
      if (!pending && raw) sessionStorage.removeItem("oauth-pending");
    } catch { /* ignora */ }
    if (!pending) return;
    setReturningFromGoogle(true);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      try { sessionStorage.removeItem("oauth-pending"); } catch { /* ignora */ }
      navigateHome({ to: "/app" });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    // Se a sessão não chegar, volta a mostrar os pacotes em vez de ficar parado.
    const giveUp = window.setTimeout(() => {
      if (done) return;
      try { sessionStorage.removeItem("oauth-pending"); } catch { /* ignora */ }
      setReturningFromGoogle(false);
    }, 12_000);
    return () => {
      window.clearTimeout(giveUp);
      sub.subscription.unsubscribe();
    };
  }, [navigateHome]);

  const { theme, toggle } = useTheme();
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppModule | null>(null);

  if (returningFromGoogle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-b-transparent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Entrando com Google…
        </span>
      </div>
    );
  }

  function markSelection(module: AppModule, mode: "signup" | "signin") {
    setSelected(module);
    setPending(`${module}:${mode}`);
  }


  return (
    <div className="landing-page relative min-h-screen bg-background text-foreground">
      {/* Fundo: salão de restaurante com véu escuro para manter a leitura */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <img src={landingBg} alt="" className="h-full w-full object-cover" />
        <div className="landing-veil absolute inset-0" />
      </div>
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <BrandLogo />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="landing-button landing-button-outline landing-button-compact"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Escuro"}</span>
          </button>
          <a href="/auth?mode=signin" className="landing-button landing-button-primary landing-button-compact">
            Entrar
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl flex-col px-5 pb-6">
        <h1 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-4xl">
          Escolha o pacote que você quer usar
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Você começa apenas com a sua carta de vinhos. Depois pode somar outros pacotes quando
          quiser.
        </p>

        <div className="mt-6 grid items-stretch gap-3 lg:grid-cols-5">
          {PACKS.map((p) => {
            const active = selected ? selected === p.module : !!p.highlight;
            const available = p.available !== false;
            return (
            <div
              key={p.module}
              className="relative flex h-full flex-col rounded-2xl border p-4 backdrop-blur-2xl transition-all duration-150 lg:p-5"
              style={{
                background: "var(--landing-card-bg)",
                borderColor: active
                  ? "color-mix(in oklab, var(--gold) 60%, transparent)"
                  : "color-mix(in oklab, var(--foreground) 18%, transparent)",
                boxShadow: active
                  ? "0 24px 48px -12px rgb(0 0 0 / 0.55), 0 0 28px color-mix(in oklab, var(--wine) 32%, transparent), inset 0 1px 0 color-mix(in oklab, var(--foreground) 16%, transparent)"
                  : "0 20px 40px -14px rgb(0 0 0 / 0.5), inset 0 1px 0 color-mix(in oklab, var(--foreground) 12%, transparent)",
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
              <div className="flex items-center gap-2 text-primary lg:flex-col lg:items-start lg:gap-3">
                <span className="shrink-0 lg:[&>svg]:h-7 lg:[&>svg]:w-7">{p.icon}</span>
                <h2 className="text-sm font-semibold leading-snug text-foreground lg:text-[15px]">{p.title}</h2>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                {p.description}
              </p>
              <ul className="mt-3 space-y-1.5">
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
              <div className="mt-auto space-y-2 border-t border-border pt-3">
                {available ? (
                  <>
                    <a
                      href={`/auth?mode=signup&module=${p.module}`}
                      onClick={() => markSelection(p.module, "signup")}
                      aria-busy={pending === `${p.module}:signup`}
                      className="landing-button landing-button-primary w-full"
                    >
                      {pending === `${p.module}:signup` ? "Abrindo…" : "Experimente grátis"}
                    </a>
                  </>
                ) : (
                  <span
                    aria-disabled="true"
                    className="landing-button landing-button-disabled w-full"
                  >
                    Experimente grátis
                  </span>
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
