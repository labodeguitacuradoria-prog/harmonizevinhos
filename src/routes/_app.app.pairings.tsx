import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UtensilsCrossed, ExternalLink } from "lucide-react";
import { PairingStudio } from "@/components/PairingStudio";
import { MenuPairingStudio } from "@/components/MenuPairingStudio";
import ModuleGate from "@/components/ModuleGate";

export const Route = createFileRoute("/_app/app/pairings")({
  head: () => ({
    meta: [
      { title: "Harmonizações — Cardápio x Carta de Vinhos" },
      {
        name: "description",
        content:
          "Cruze o cardápio do restaurante com a carta de vinhos e receba as melhores harmonizações, frases de mesa e alertas de gaps.",
      },
      { property: "og:title", content: "Harmonizações — Cardápio x Carta de Vinhos" },
      {
        property: "og:description",
        content: "Harmonização do cardápio usando somente os vinhos da carta do restaurante.",
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
  const [tab, setTab] = useState<"menu" | "open">("menu");
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

      <div className="mb-5 flex gap-2">
        {([
          ["menu", "Cardápio x Carta"],
          ["open", "Sugestão aberta"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg border px-4 py-2 text-[11px] font-bold uppercase transition ${
              tab === k
                ? "border-primary bg-card text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "menu" ? <MenuPairingStudio /> : <PairingStudio />}
    </div>
  );
}
