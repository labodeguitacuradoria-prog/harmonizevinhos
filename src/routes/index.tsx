import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Harmonize Vinhos" },
      {
        name: "description",
        content:
          "Aumente sua lucratividade, controle seu estoque, monitore suas vendas, cadastre seus rótulos e dê visibilidade aos seus fornecedores.",
      },
      { property: "og:title", content: "Harmonize Vinhos" },
      {
        property: "og:description",
        content:
          "Aumente sua lucratividade, controle seu estoque, monitore suas vendas, cadastre seus rótulos e dê visibilidade aos seus fornecedores.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-black text-foreground">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6">
        <section className="py-20 md:py-28">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            A gestão da sua carta de vinhos, <span className="text-primary">sem planilha</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Aumente sua lucratividade, controle seu estoque, monitore suas vendas,
            cadastre seus rótulos e dê visibilidade aos seus fornecedores — tudo
            em uma plataforma feita para restaurantes.
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
      </main>
    </div>
  );
}
