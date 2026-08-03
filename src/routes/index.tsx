import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Wine } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Harmonize Vinhos" },
      {
        name: "description",
        content:
          "Plataforma completa para harmonização de vinhos com comidas de forma simples e descomplicada",
      },
      { property: "og:title", content: "Harmonize Vinhos" },
      {
        property: "og:description",
        content: "Plataforma completa para harmonização de vinhos com comidas de forma simples e descomplicada",
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
              to="/harmonizar"
              className="rounded-md px-4 py-2 text-sm font-medium text-primary hover:bg-accent"
            >
              Harmonizar um prato
            </Link>
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
            <Link
              to="/harmonizar"
              className="rounded-md border border-primary px-5 py-3 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Harmonizar um prato (grátis, sem cadastro)
            </Link>

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

