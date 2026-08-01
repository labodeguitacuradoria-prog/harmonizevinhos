import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/app/pairing-knowledge")({
  head: () => ({
    meta: [
      { title: "Manual do Sommelier — Regras de Harmonização" },
      {
        name: "description",
        content:
          "Cadastro das regras clássicas de harmonização, regras de barrica e notas que orientam o Sommelier IA.",
      },
      { property: "og:title", content: "Manual do Sommelier" },
      {
        property: "og:description",
        content: "Regras de harmonização que orientam as sugestões do Sommelier IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KnowledgePage,
});

type Rule = {
  id: string;
  kind: string;
  title: string;
  keywords: string[];
  guidance: string;
  active: boolean;
  sort_order: number;
};

const KINDS = [
  { value: "classic", label: "Harmonização clássica" },
  { value: "oak", label: "Passagem por barrica" },
  { value: "region", label: "Região / terroir" },
  { value: "note", label: "Nota livre" },
];

function KnowledgePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ kind: "classic", title: "", keywords: "", guidance: "" });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["pairing-knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pairing_knowledge")
        .select("id, kind, title, keywords, guidance, active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pairing_knowledge").insert({
        kind: form.kind,
        title: form.title.trim(),
        guidance: form.guidance.trim(),
        keywords: form.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        sort_order: (rules?.length ?? 0) * 10 + 1000,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ kind: "classic", title: "", keywords: "", guidance: "" });
      qc.invalidateQueries({ queryKey: ["pairing-knowledge"] });
      toast.success("Regra adicionada ao manual.");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar a regra."),
  });

  const toggle = useMutation({
    mutationFn: async (r: Rule) => {
      const { error } = await supabase
        .from("pairing_knowledge")
        .update({ active: !r.active })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pairing-knowledge"] }),
    onError: (e: any) => toast.error(e?.message || "Falha ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pairing_knowledge").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pairing-knowledge"] }),
    onError: (e: any) => toast.error(e?.message || "Falha ao excluir."),
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <header className="mb-5 flex items-center justify-between border-b border-border pb-4">
        <h1 className="page-title flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" /> Manual do Sommelier
        </h1>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Regras que orientam a IA
        </span>
      </header>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="section-title">Nova regra</div>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Título da regra"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            placeholder="Palavras-chave separadas por vírgula (ostra, vieira)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-3"
          />
          <textarea
            value={form.guidance}
            onChange={(e) => setForm({ ...form, guidance: e.target.value })}
            rows={3}
            placeholder="Orientação obrigatória que a IA deve seguir quando a regra for acionada."
            className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-3"
          />
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || form.title.trim().length < 3 || form.guidance.trim().length < 10}
          className="mt-3 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Adicionar regra
        </button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="section-title">Regras cadastradas</div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {(rules ?? []).map((r) => (
              <div
                key={r.id}
                className={`rounded-lg border p-3 ${r.active ? "border-border" : "border-border opacity-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-primary">{r.title}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {KINDS.find((k) => k.value === r.kind)?.label ?? r.kind}
                      {r.keywords?.length ? ` · ${r.keywords.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggle.mutate(r)}
                      className="rounded-md border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:text-primary"
                    >
                      {r.active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir a regra "${r.title}"?`)) remove.mutate(r.id);
                      }}
                      className="rounded-md border border-border p-1 text-muted-foreground hover:text-[#800020]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/80">{r.guidance}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
