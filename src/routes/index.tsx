import { createFileRoute, Link } from "@tanstack/react-router";
import { Wine, BarChart3, Users, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Vinhos para Restaurantes" },
      {
        name: "description",
        content:
          "Plataforma completa para gestão da carta de vinhos, estoque e relacionamento com fornecedores.",
      },
      { property: "og:title", content: "Gestão de Vinhos para Restaurantes" },
      {
        property: "og:description",
        content: "Gestão de adega, vendas e portal para fornecedores em um só lugar.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Wine className="h-6 w-6 text-primary" />
            <span className="page-title">Gestão de Vinhos para Restaurantes</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              to="/auth"
              className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Entrar
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 md:py-28">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            A gestão da sua carta de vinhos, <span className="text-primary">sem planilha</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Cadastre rótulos, controle adega, monitore vendas e dê visibilidade
            aos seus fornecedores — tudo em uma plataforma feita para
            restaurantes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Criar conta do restaurante
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-input px-5 py-3 text-sm font-medium hover:bg-accent"
            >
              Já tenho acesso
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-3">
          <Feature
            icon={<Wine className="h-5 w-5" />}
            title="Catálogo e adega"
            text="Cadastre rótulos, safras, produtores e acompanhe quantidade em estoque em tempo real."
          />
          <Feature
            icon={<BarChart3 className="h-5 w-5" />}
            title="Vendas e margens"
            text="Registre saídas, veja markup praticado e o desempenho de cada rótulo."
          />
          <Feature
            icon={<Users className="h-5 w-5" />}
            title="Portal do fornecedor"
            text="Compartilhe dados (com sua autorização) e fortaleça a relação com importadores e produtores."
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-8">
          <div className="flex items-start gap-4">
            <Shield className="mt-1 h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">
                Você controla quem vê seus dados.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Por padrão, nenhum fornecedor enxerga estoque, vendas ou preço
                do seu restaurante. Você libera caso a caso.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Gestão de Vinhos para Restaurantes
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
