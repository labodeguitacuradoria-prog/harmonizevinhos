import { createFileRoute } from "@tanstack/react-router";
import { UtensilsCrossed, ExternalLink } from "lucide-react";
import { PairingStudio } from "@/components/PairingStudio";
import ModuleGate from "@/components/ModuleGate";

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
  component: () => (
    <ModuleGate route="/app/pairings">
      <PairingsPage />
    </ModuleGate>
  ),
});

function PairingsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="page-title flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5" /> Harmonizações
        </h1>
        <a
          href="/harmonizar"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary"
        >
          <ExternalLink className="h-3 w-3" /> Link público
        </a>
      </header>

      <PairingStudio />
    </div>
  );
}
