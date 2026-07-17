import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Edit, Check, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/admin/suppliers")({
  component: AdminSuppliers,
});

type Form = {
  name: string;
  trade_name: string;
  legal_name: string;
  cnpj: string;
  state_registration: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_district: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country: string;
  phone: string;
  whatsapp: string;
  contact_email: string;
  commercial_email: string;
  website: string;
  primary_contact_name: string;
  primary_contact_role: string;
  primary_contact_phone: string;
  primary_contact_email: string;
  specialties: string;
  regions: string;
  notes: string;
};

const empty: Form = {
  name: "", trade_name: "", legal_name: "", cnpj: "", state_registration: "",
  address_street: "", address_number: "", address_complement: "", address_district: "",
  address_city: "", address_state: "", address_zip: "", address_country: "Brasil",
  phone: "", whatsapp: "", contact_email: "", commercial_email: "", website: "",
  primary_contact_name: "", primary_contact_role: "", primary_contact_phone: "", primary_contact_email: "",
  specialties: "", regions: "", notes: "",
};

// Fields used to compute completeness (~ same set as the form)
const COMPLETENESS_FIELDS: (keyof Form)[] = [
  "name", "trade_name", "legal_name", "cnpj",
  "address_street", "address_city", "address_state", "address_zip",
  "phone", "commercial_email", "website",
  "primary_contact_name", "primary_contact_phone", "primary_contact_email",
  "specialties", "regions",
];

function completeness(s: Record<string, any>): number {
  const filled = COMPLETENESS_FIELDS.filter((k) => {
    const v = s[k];
    return v != null && String(v).trim() !== "";
  }).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

function AdminSuppliers() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [tab, setTab] = useState<"approved" | "pending" | "rejected">("approved");

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["catalog-suppliers-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_catalog")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => suppliers.filter((s: any) => s.status === tab),
    [suppliers, tab]
  );

  const counts = useMemo(() => ({
    approved: suppliers.filter((s: any) => s.status === "approved").length,
    pending: suppliers.filter((s: any) => s.status === "pending").length,
    rejected: suppliers.filter((s: any) => s.status === "rejected").length,
  }), [suppliers]);

  function openNew() {
    setEditing({ form: { ...empty } });
  }
  function openEdit(row: any) {
    const f: Form = { ...empty };
    (Object.keys(empty) as (keyof Form)[]).forEach((k) => {
      f[k] = row[k] ?? (k === "address_country" ? "Brasil" : "");
    });
    setEditing({ id: row.id, form: f });
  }

  async function approve(id: string) {
    const { error } = await supabase.from("supplier_catalog")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor aprovado");
    qc.invalidateQueries({ queryKey: ["catalog-suppliers-all"] });
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fornecedores — Catálogo global</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastros globais. Nomes citados em rótulos e ainda não catalogados aparecem como pendentes.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Novo fornecedor
        </button>
      </div>

      <div className="mt-6 flex gap-2 border-b border-border">
        {(["approved", "pending", "rejected"] as const).map((s) => (
          <button key={s} onClick={() => setTab(s)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {s === "approved" ? "Aprovados" : s === "pending" ? "Pendentes" : "Rejeitados"} <span className="ml-1 text-xs">({counts[s]})</span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Completude</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum fornecedor.</td></tr>
            )}
            {filtered.map((s: any) => {
              const pct = completeness(s);
              const color = pct >= 80 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-red-500";
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <div>{s.trade_name || s.name}</div>
                    {s.trade_name && s.name !== s.trade_name && (
                      <div className="text-xs text-muted-foreground">{s.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.cnpj ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {[s.address_city, s.address_state].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.commercial_email || s.contact_email || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-muted">
                        <div className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${color}`}>{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} title="Editar" className="rounded-md p-1.5 hover:bg-accent">
                        <Edit className="h-4 w-4 text-primary" />
                      </button>
                      {s.status === "pending" && (
                        <button onClick={() => approve(s.id)} title="Aprovar" className="rounded-md p-1.5 hover:bg-accent">
                          <Check className="h-4 w-4 text-emerald-500" />
                        </button>
                      )}
                      {s.status === "pending" && <Clock className="h-4 w-4 text-amber-500 mt-1.5" />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <SupplierForm
          id={editing.id}
          initial={editing.form}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["catalog-suppliers-all"] }); qc.invalidateQueries({ queryKey: ["supplier-catalog"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function SupplierForm({ id, initial, onClose, onSaved }: { id?: string; initial: Form; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);

  function up<K extends keyof Form>(k: K, v: Form[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = Object.fromEntries(
      (Object.keys(f) as (keyof Form)[]).map((k) => [k, f[k].trim() === "" ? null : f[k].trim()])
    ) as Record<keyof Form, string | null>;
    payload.name = f.name.trim();

    let error;
    if (id) {
      ({ error } = await supabase.from("supplier_catalog").update(payload).eq("id", id));
    } else {
      ({ error } = await supabase.from("supplier_catalog").insert({
        ...payload,
        status: "approved" as const,
        submitted_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(id ? "Fornecedor atualizado" : "Fornecedor cadastrado no catálogo global");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary">{id ? "Editar fornecedor" : "Novo fornecedor"} — Catálogo global</h3>
            <p className="text-xs text-muted-foreground">Ficha completa. Ficará disponível para todos os restaurantes.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <Section title="Identificação">
            <F label="Nome / Apelido *"><input required value={f.name} onChange={(e) => up("name", e.target.value)} className={inp} /></F>
            <F label="Nome fantasia"><input value={f.trade_name} onChange={(e) => up("trade_name", e.target.value)} className={inp} /></F>
            <F label="Razão social" wide><input value={f.legal_name} onChange={(e) => up("legal_name", e.target.value)} className={inp} /></F>
            <F label="CNPJ"><input value={f.cnpj} onChange={(e) => up("cnpj", maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" className={inp} /></F>
            <F label="Inscrição estadual"><input value={f.state_registration} onChange={(e) => up("state_registration", e.target.value)} className={inp} /></F>
          </Section>

          <Section title="Endereço">
            <F label="Logradouro" wide><input value={f.address_street} onChange={(e) => up("address_street", e.target.value)} className={inp} /></F>
            <F label="Número"><input value={f.address_number} onChange={(e) => up("address_number", e.target.value)} className={inp} /></F>
            <F label="Complemento"><input value={f.address_complement} onChange={(e) => up("address_complement", e.target.value)} className={inp} /></F>
            <F label="Bairro"><input value={f.address_district} onChange={(e) => up("address_district", e.target.value)} className={inp} /></F>
            <F label="CEP"><input value={f.address_zip} onChange={(e) => up("address_zip", e.target.value)} className={inp} /></F>
            <F label="Cidade"><input value={f.address_city} onChange={(e) => up("address_city", e.target.value)} className={inp} /></F>
            <F label="UF"><input value={f.address_state} onChange={(e) => up("address_state", e.target.value)} className={inp} /></F>
            <F label="País"><input value={f.address_country} onChange={(e) => up("address_country", e.target.value)} className={inp} /></F>
          </Section>

          <Section title="Contatos">
            <F label="Telefone"><input value={f.phone} onChange={(e) => up("phone", e.target.value)} className={inp} /></F>
            <F label="WhatsApp"><input value={f.whatsapp} onChange={(e) => up("whatsapp", e.target.value)} className={inp} /></F>
            <F label="E-mail de contato"><input type="email" value={f.contact_email} onChange={(e) => up("contact_email", e.target.value)} className={inp} /></F>
            <F label="E-mail comercial"><input type="email" value={f.commercial_email} onChange={(e) => up("commercial_email", e.target.value)} className={inp} /></F>
            <F label="Site" wide><input value={f.website} onChange={(e) => up("website", e.target.value)} className={inp} /></F>
          </Section>

          <Section title="Contato principal">
            <F label="Nome"><input value={f.primary_contact_name} onChange={(e) => up("primary_contact_name", e.target.value)} className={inp} /></F>
            <F label="Cargo"><input value={f.primary_contact_role} onChange={(e) => up("primary_contact_role", e.target.value)} className={inp} /></F>
            <F label="Telefone"><input value={f.primary_contact_phone} onChange={(e) => up("primary_contact_phone", e.target.value)} className={inp} /></F>
            <F label="E-mail"><input type="email" value={f.primary_contact_email} onChange={(e) => up("primary_contact_email", e.target.value)} className={inp} /></F>
          </Section>

          <Section title="Perfil comercial">
            <F label="Especialidades" wide><input value={f.specialties} onChange={(e) => up("specialties", e.target.value)} placeholder="Ex.: Vinhos franceses, espumantes premium…" className={inp} /></F>
            <F label="Regiões atendidas" wide><input value={f.regions} onChange={(e) => up("regions", e.target.value)} className={inp} /></F>
            <F label="Observações" wide><textarea rows={3} value={f.notes} onChange={(e) => up("notes", e.target.value)} className={inp} /></F>
          </Section>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {saving ? "Salvando..." : (id ? "Salvar alterações" : "Salvar no catálogo global")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inp = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}
