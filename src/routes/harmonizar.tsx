import { createFileRoute, Link } from "@tanstack/react-router";
import { Wine, UtensilsCrossed } from "lucide-react";
import { PairingStudio } from "@/components/PairingStudio";

export const Route = createFileRoute("/harmonizar")({
  head: () => ({
    meta: [
      { title: "Harmonização de Vinhos com IA — Sommelier Virtual" },
      {
        name: "description",
        content:
          "Descreva seu prato e receba gratuitamente a análise sensorial e sugestões de harmonização de vinhos nacionais e internacionais. Sem cadastro.",
      },
      { property: "og:title", content: "Harmonização de Vinhos com IA — Sommelier Virtual" },
      {
        property: "og:description",
        content:
          "Sommelier virtual gratuito: análise sensorial do prato e sugestões de vinhos, sem precisar criar conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPairings,
});

function PublicPairings() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2">
            <Wine className="h-6 w-6 text-primary" />
            <span className="page-title text-base">Sommelier Virtual</span>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-primary">
              Para restaurantes
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <h1 className="page-title mb-2 flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5" /> Harmonizações
        </h1>
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          Livre e sem cadastro: descreva o prato e o sommelier de IA decompõe os blocos de sabor e
          sugere caminhos de harmonização nacionais e internacionais.
        </p>

        <PairingStudio />
      </main>

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          Gestão de Vinhos — módulo público de harmonização.
        </div>
      </footer>
    </div>
  );
}
