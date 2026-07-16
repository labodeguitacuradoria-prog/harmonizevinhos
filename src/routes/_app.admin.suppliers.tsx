import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

export const Route = createFileRoute("/_app/admin/suppliers")({
  component: AdminSuppliers,
});

function AdminSuppliers() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["catalog-suppliers-approved"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_catalog")
        .select("id, name, trade_name, cnpj, commercial_email, contact_email, address_city, address_state")
        .eq("status", "approved")
        .order("name");
      return data ?? [];
    },
  });

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fornecedores — Catálogo global</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastros disponíveis para todos os restaurantes usarem ao registrar rótulos.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Novo fornecedor
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">E-mail</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum fornecedor no catálogo global.</td></tr>}
            {suppliers.map((s) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <SupplierForm onClose={() => setShowForm(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["catalog-suppliers-approved"] }); qc.invalidateQueries({ queryKey: ["supplier-catalog"] }); setShowForm(false); }} />
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

function SupplierForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  function up<K extends keyof Form>(k: K, v: Form[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      ...(Object.fromEntries(
        (Object.keys(f) as (keyof Form)[]).map((k) => [k, f[k].trim() === "" ? null : f[k].trim()])
      ) as Record<keyof Form, string | null>),
      name: f.name.trim(),
      status: "approved" as const,
      submitted_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("supplier_catalog").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor cadastrado no catálogo global");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary">Novo fornecedor — Catálogo global</h3>
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
              {saving ? "Salvando..." : "Salvar no catálogo global"}
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
