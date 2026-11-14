import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grape } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type WineryPick = { name: string; website: string | null; country: string | null; region: string | null };

/** Busca no banco de vinícolas para pré-preencher um fornecedor. */
export function WineryPicker({ onPick }: { onPick: (w: WineryPick) => void }) {
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["winery-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () =>
      (await supabase.from("wineries").select("name, website, country, region").ilike("name", `%${q.trim()}%`).order("name").limit(8)).data ?? [],
  });
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary"><Grape className="h-3 w-3" /> Importar dados de uma vinícola (opcional)</div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite o nome da vinícola…" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
      {data.length > 0 && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border">
          {data.map((w) => (
            <button type="button" key={w.name} onClick={() => { onPick(w); setQ(""); }} className="block w-full px-2 py-1.5 text-left text-sm hover:bg-accent">
              {w.name} <span className="text-xs text-muted-foreground">{[w.region, w.country].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
