import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Check, X, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/app/supplier-catalog-admin")({
  component: SupplierCatalogAdmin,
});

type CatalogSupplier = {
  id: string;
  name: string;
  trade_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  state_registration: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  phone: string | null;
  whatsapp: string | null;
  contact_email: string | null;
  commercial_email: string | null;
  website: string | null;
  primary_contact_name: string | null;
  primary_contact_role: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  specialties: string | null;
  regions: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_by: string | null;
  created_at: string;
};

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function SupplierCatalogAdmin() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [editing, setEditing] = useState<CatalogSupplier | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["supplier-catalog", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalog")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CatalogSupplier[];
    },
  });

  if (role !== "admin") {
    return (
      <div className="p-10 text-sm text-muted-foreground">
        Acesso restrito a administradores do sistema.
      </div>
    );
  }

  async function approve(id: string) {
    const { error } = await supabase
      .from("supplier_catalog")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor aprovado no catálogo global");
    qc.invalidateQueries({ queryKey: ["supplier-catalog"] });
  }

  async function reject(id: string) {
    const { error } = await supabase.from("supplier_catalog").update({ status: "rejected" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rejeitado");
    qc.invalidateQueries({ queryKey: ["supplier-catalog"] });
  }

  async function remove(id: string) {
    if (!confirm("Remover definitivamente esta entrada?")) return;
    const { error } = await supabase.from("supplier_catalog").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["supplier-catalog"] });
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="page-title text-2xl">Catálogo global de fornecedores</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Revise sugestões enviadas pelos restaurantes e aprove entradas para uso compartilhado.
      </p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "pending" ? "Pendentes" : t === "approved" ? "Aprovados" : "Rejeitados"} ({rows.length})
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nome / Fantasia</th>
              <th className="px-3 py-2">Razão social</th>
              <th className="px-3 py-2">CNPJ</th>
              <th className="px-3 py-2">Cidade/UF</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Nada por aqui.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.trade_name || r.name}</div>
                  {r.trade_name && r.name !== r.trade_name && (
                    <div className="text-xs text-muted-foreground">{r.name}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{r.legal_name || "—"}</td>
                <td className="px-3 py-2 text-xs">{r.cnpj || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {[r.address_city, r.address_state].filter(Boolean).join("/") || "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.commercial_email || r.contact_email || r.phone || "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded p-1.5 hover:bg-accent"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {tab !== "approved" && (
                      <button
                        onClick={() => approve(r.id)}
                        className="rounded p-1.5 text-green-500 hover:bg-accent"
                        title="Aprovar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    {tab !== "rejected" && (
                      <button
                        onClick={() => reject(r.id)}
                        className="rounded p-1.5 text-amber-500 hover:bg-accent"
                        title="Rejeitar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded p-1.5 text-destructive hover:bg-accent"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["supplier-catalog"] });
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  row,
  onClose,
  onSaved,
}: {
  row: CatalogSupplier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<CatalogSupplier>(row);
  const [saving, setSaving] = useState(false);

  function up<K extends keyof CatalogSupplier>(k: K, v: CatalogSupplier[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { id, created_at, submitted_by, ...payload } = f as any;
    const { error } = await supabase.from("supplier_catalog").update(payload).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary">Editar fornecedor do catálogo</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Nome / Apelido *">
              <input required value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} className={inp} />
            </L>
            <L label="Nome fantasia">
              <input value={f.trade_name ?? ""} onChange={(e) => up("trade_name", e.target.value)} className={inp} />
            </L>
            <L label="Razão social" wide>
              <input value={f.legal_name ?? ""} onChange={(e) => up("legal_name", e.target.value)} className={inp} />
            </L>
            <L label="CNPJ">
              <input
                value={f.cnpj ?? ""}
                onChange={(e) => up("cnpj", maskCNPJ(e.target.value))}
                className={inp}
              />
            </L>
            <L label="Inscrição estadual">
              <input value={f.state_registration ?? ""} onChange={(e) => up("state_registration", e.target.value)} className={inp} />
            </L>
            <L label="Cidade">
              <input value={f.address_city ?? ""} onChange={(e) => up("address_city", e.target.value)} className={inp} />
            </L>
            <L label="UF">
              <input value={f.address_state ?? ""} onChange={(e) => up("address_state", e.target.value)} className={inp} />
            </L>
            <L label="Telefone">
              <input value={f.phone ?? ""} onChange={(e) => up("phone", e.target.value)} className={inp} />
            </L>
            <L label="WhatsApp">
              <input value={f.whatsapp ?? ""} onChange={(e) => up("whatsapp", e.target.value)} className={inp} />
            </L>
            <L label="E-mail comercial">
              <input value={f.commercial_email ?? ""} onChange={(e) => up("commercial_email", e.target.value)} className={inp} />
            </L>
            <L label="Site">
              <input value={f.website ?? ""} onChange={(e) => up("website", e.target.value)} className={inp} />
            </L>
            <L label="Contato principal">
              <input value={f.primary_contact_name ?? ""} onChange={(e) => up("primary_contact_name", e.target.value)} className={inp} />
            </L>
            <L label="Cargo do contato">
              <input value={f.primary_contact_role ?? ""} onChange={(e) => up("primary_contact_role", e.target.value)} className={inp} />
            </L>
            <L label="Especialidades" wide>
              <input
                value={f.specialties ?? ""}
                onChange={(e) => up("specialties", e.target.value)}
                placeholder="Ex.: Vinhos franceses, espumantes premium..."
                className={inp}
              />
            </L>
            <L label="Regiões atendidas" wide>
              <input value={f.regions ?? ""} onChange={(e) => up("regions", e.target.value)} className={inp} />
            </L>
            <L label="Observações" wide>
              <textarea rows={3} value={f.notes ?? ""} onChange={(e) => up("notes", e.target.value)} className={inp} />
            </L>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inp = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function L({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
