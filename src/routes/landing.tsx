import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wine,
  BarChart3,
  ClipboardList,
  Sparkles,
  Truck,
  Boxes,
  ScanLine,
  Building2,
  LineChart,
  ArrowRight,
  Check,
} from "lucide-react";
import dashboardShot from "@/assets/landing-dashboard.png";
import winesShot from "@/assets/landing-wines.png";
import mobileShot from "@/assets/landing-mobile.png";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Gestão de Vinhos para Restaurantes — Carta, CMV e Sommelier IA" },
      {
        name: "description",
        content:
          "Controle a carta de vinhos, custos, contagem de estoque, metas e harmonizações com IA. Painel de resultados diário para o owner do restaurante.",
      },
      {
        property: "og:title",
        content: "Gestão de Vinhos para Restaurantes — Carta, CMV e Sommelier IA",
      },
      {
        property: "og:description",
        content:
          "Cadastro de rótulos, vendas mensais, CMV por tipo, contagem no celular e harmonização por IA em uma só plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: BarChart3,
    title: "Painel de resultados",
    desc: "Faturamento, garrafas, taças, preço médio, CMV e taxa de rolha por mês ou ano, com metas em gráficos de rosca e comparativo com o ano anterior.",
  },
  {
    icon: Wine,
    title: "Cadastro completo do rótulo",
    desc: "Nome, produtor, safra, região, país, uvas, tipo, volume, custo, venda, fornecedor, código interno, características sensoriais e imagem padronizada.",
  },
  {
    icon: Sparkles,
    title: "IA que preenche por você",
    desc: "Leia a ficha técnica, a foto ou o PDF da carta e importe dezenas de rótulos de uma vez — depois revise e ajuste o que quiser.",
  },
  {
    icon: ClipboardList,
    title: "Vendas mensais em minutos",
    desc: "Lance garrafas e taças rótulo por rótulo em uma tela única, ou importe do relatório do PDV com leitura por IA.",
  },
  {
    icon: Boxes,
    title: "Contagem de estoque no celular",
    desc: "O staff conta com botões + e −, por tipo de vinho, com data de referência. O administrador revisa e corrige divergências.",
  },
  {
    icon: LineChart,
    title: "Engenharia da carta",
    desc: "Análise de preços por faixa (metodologia Harrington), giro por rótulo, top 5 no faturamento e CMV comparado por tipo de vinho.",
  },
  {
    icon: ScanLine,
    title: "Sommelier IA de harmonizações",
    desc: "Descreva o prato e receba a decomposição sensorial e sugestões de vinhos — inclusive em página pública para os seus clientes.",
  },
  {
    icon: Truck,
    title: "Fornecedores integrados",
    desc: "Ficha completa do fornecedor e acesso controlado para que ele acompanhe os rótulos que comercializa no seu restaurante.",
  },
  {
    icon: Building2,
    title: "Redes e multiunidades",
    desc: "Vários restaurantes na mesma conta, com visão consolidada da rede e perfis de acesso para admin, owner, staff e fornecedor.",
  },
];

const SUMMARY = [
  "Definir e organizar a carta de vinhos, ativando ou desativando rótulos",
  "Saber quanto cada rótulo vende por mês e qual margem realmente entrega",
  "Acompanhar metas mensais e anuais sem planilha",
  "Contar o estoque pelo celular e auditar as contagens",
  "Descobrir onde o CMV está fugindo, por tipo de vinho e por rótulo",
  "Oferecer harmonizações profissionais para a equipe e para o cliente",
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-primary" />
            <span className="page-title text-[13px] md:text-[15px]">
              Gestão de Vinhos
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/harmonizar"
              className="hidden rounded-md px-3 py-2 text-[12px] font-medium text-primary hover:bg-accent sm:block"
            >
              Harmonizar um prato
            </Link>
            <Link
              to="/auth"
              className="rounded-md px-3 py-2 text-[12px] font-medium hover:bg-accent"
            >
              Entrar
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 60% at 15% 0%, color-mix(in oklab, var(--wine) 45%, transparent) 0%, transparent 65%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
            <span className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-[color:var(--wine)]/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[2px] text-primary">
              <Sparkles className="h-3 w-3" /> Carta, custos e IA em um só lugar
            </span>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              A sua carta de vinhos gerenciada como um{" "}
              <span className="text-primary">centro de lucro</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground md:text-base">
              Cadastre rótulos com ficha técnica completa, lance as vendas de garrafas e
              taças, controle a contagem do estoque pelo celular e acompanhe faturamento,
              CMV e metas em um painel feito para ser consultado todos os dias.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Criar conta do restaurante <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/harmonizar"
                className="rounded-md border border-primary/60 px-5 py-3 text-sm font-semibold text-primary hover:bg-[color:var(--wine)]/20"
              >
                Testar harmonização grátis
              </Link>
            </div>

            <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-2xl">
              <img
                src={dashboardShot}
                alt="Painel de controle do restaurante Vinhedo do Porto com faturamento, CMV e metas"
                width={1600}
                height={1008}
                className="w-full rounded-lg"
              />
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
              Painel do mês — dados de demonstração
            </p>
          </div>
        </section>

        {/* O QUE É POSSÍVEL FAZER */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
            <h2 className="page-title text-base md:text-lg">O que você faz com o app</h2>
            <div className="mt-6 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {SUMMARY.map((s) => (
                <div key={s} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TELAS */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 md:grid-cols-2 md:py-20">
            <div>
              <h2 className="page-title text-base md:text-lg">A carta sob controle</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Cada rótulo com custo, preço de venda, giro mensal e status na carta. Filtros
                por coluna, cabeçalho fixo e ficha panorâmica do produto com imagem
                padronizada e histórico de vendas.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Alterações de preço não reescrevem o passado: o custo de cada venda fica
                congelado no histórico, então a margem dos meses anteriores permanece fiel.
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card p-2">
              <img
                src={winesShot}
                alt="Tabela da carta de vinhos da Trattoria San Lorenzo com custo, venda e giro mensal"
                loading="lazy"
                width={1408}
                height={912}
                className="w-full rounded-lg"
              />
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 md:grid-cols-2 md:py-20">
            <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-card p-2 md:order-2">
              <img
                src={mobileShot}
                alt="Contagem de estoque no celular no Bistrô Aurora com botões de mais e menos"
                loading="lazy"
                width={720}
                height={1104}
                className="w-full rounded-xl"
              />
            </div>
            <div className="md:order-1">
              <h2 className="page-title text-base md:text-lg">
                Feito para o salão, não só para o escritório
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                O staff faz a contagem no celular, rótulo por rótulo, com botões de + e − e
                data de referência. O administrador confere, corrige divergências e fecha a
                contagem.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                E na hora do atendimento, o Sommelier IA sugere harmonizações a partir da
                descrição do prato — com decomposição sensorial e justificativa.
              </p>
            </div>
          </div>
        </section>

        {/* FUNCIONALIDADES */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
            <h2 className="page-title text-base md:text-lg">Principais funcionalidades</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border bg-card p-5 transition hover:border-primary"
                >
                  <div className="inline-flex rounded-md border border-primary/40 bg-[color:var(--wine)]/20 p-2">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
            <div className="rounded-2xl border border-primary/40 bg-card p-8 text-center md:p-12">
              <h2 className="page-title text-base md:text-lg">
                Comece hoje pela sua carta
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
                Crie a conta do restaurante, importe a carta por foto ou PDF e veja o painel
                trabalhar a partir do primeiro mês lançado.
              </p>
              <Link
                to="/signup"
                className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Criar minha conta <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-[12px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Gestão de Vinhos para Restaurantes</span>
          <Link to="/harmonizar" className="text-primary hover:underline">
            Harmonizar um prato
          </Link>
        </div>
      </footer>
    </div>
  );
}
