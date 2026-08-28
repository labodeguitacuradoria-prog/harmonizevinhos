import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Plus, X, Pencil, FileText, Mail, Phone, Globe, MapPin, Search, Check } from "lucide-react";
import { MediaUploader } from "@/components/MediaUploader";
import { formatBRPhone } from "@/lib/phone-format";
import { formatCEP } from "@/lib/cep-format";

type CatalogSupplier = {
  id: string;
  name: string;
  trade_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  address_city: string | null;
  address_state: string | null;
  phone: string | null;
  commercial_email: string | null;
  website: string | null;
};

export const Route = createFileRoute("/_app/app/suppliers")({
  component: SuppliersPage,
});

type Supplier = {
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
  payment_terms: string | null;
  delivery_lead_time: string | null;
  minimum_order: string | null;
  notes: string | null;
  catalog_id?: string | null;
};

type Material = {
  id: string;
  supplier_id: string;
  material_type: string;
  title: string;
  description: string | null;
  file_url: string | null;
  valid_until: string | null;
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

function SuppliersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const { restaurantId, user } = useAuth();

  // IDs relevantes para este restaurante: fornecedores com rótulos cadastrados
  // ou vinculados explicitamente ao restaurante (acesso liberado).
  const { data: activeSupplierIds = [] } = useQuery({
    queryKey: ["restaurant-supplier-ids", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const [{ data: ws }, { data: rsa }] = await Promise.all([
        supabase
          .from("wines")
          .select("supplier_id")
          .eq("restaurant_id", restaurantId!)
          .not("supplier_id", "is", null),
        supabase
          .from("restaurant_supplier_access")
          .select("supplier_id")
          .eq("restaurant_id", restaurantId!),
      ]);
      const ids = new Set<string>([
        ...((ws ?? []).map((w) => w.supplier_id as string)),
        ...((rsa ?? []).map((r) => r.supplier_id as string)),
      ]);
      return Array.from(ids);
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list", restaurantId, activeSupplierIds, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      const all = (data ?? []) as Supplier[];
      // Fornecedores com rótulos, vinculados ao restaurante, ou criados pelo usuário
      return all.filter(
        (s) => activeSupplierIds.includes(s.id) || (s as any).created_by === user?.id,
      );
    },
    enabled: !!restaurantId,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["supplier-materials-all"],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_materials").select("*");
      return (data ?? []) as Material[];
    },
  });

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-2xl">Fornecedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre seus fornecedores com dados completos e consulte materiais enviados por eles.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Novo fornecedor
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Nenhum fornecedor vinculado aos produtos deste restaurante. Cadastre um rótulo com fornecedor para que ele apareça aqui.
          </div>
        )}
        {suppliers.map((s) => {
          const mats = materials.filter((m) => m.supplier_id === s.id);
          return (
            <div key={s.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-primary truncate">{s.trade_name || s.name}</div>
                  {s.legal_name && <div className="text-xs text-muted-foreground truncate">{s.legal_name}</div>}
                  {s.cnpj && <div className="text-xs text-muted-foreground">CNPJ {s.cnpj}</div>}
                </div>
                <button
                  onClick={() => setEditing(s)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {s.primary_contact_name && (
                  <div>
                    <span className="text-foreground">{s.primary_contact_name}</span>
                    {s.primary_contact_role ? ` — ${s.primary_contact_role}` : ""}
                  </div>
                )}
                {(s.commercial_email || s.contact_email) && (
                  <div className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3" /> {s.commercial_email || s.contact_email}
                  </div>
                )}
                {s.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</div>}
                {s.website && (
                  <div className="flex items-center gap-1 truncate">
                    <Globe className="h-3 w-3" />
                    <a href={s.website} target="_blank" rel="noreferrer" className="underline">
                      {s.website}
                    </a>
                  </div>
                )}
                {(s.address_city || s.address_state) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {[s.address_city, s.address_state].filter(Boolean).join(" / ")}
                  </div>
                )}
              </div>

              {mats.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Materiais ({mats.length})
                  </div>
                  <ul className="space-y-1 text-xs">
                    {mats.slice(0, 3).map((m) => (
                      <li key={m.id} className="flex items-center gap-1 truncate">
                        <FileText className="h-3 w-3 text-primary" />
                        {m.file_url ? (
                          <a href={m.file_url} target="_blank" rel="noreferrer" className="truncate underline">
                            {m.title}
                          </a>
                        ) : (
                          <span className="truncate">{m.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <SupplierForm
          supplier={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["suppliers-list"] });
            qc.invalidateQueries({ queryKey: ["supplier-materials-all"] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SupplierForm({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [f, setF] = useState<Partial<Supplier>>(supplier ?? { address_country: "Brasil" });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"dados" | "materiais">("dados");

  const { data: materials = [], refetch } = useQuery({
    queryKey: ["supplier-materials", supplier?.id],
    enabled: !!supplier?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_materials")
        .select("*")
        .eq("supplier_id", supplier!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Material[];
    },
  });

  function up<K extends keyof Supplier>(k: K, v: Supplier[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name?.trim()) return toast.error("Informe o nome do fornecedor");
    setSaving(true);
    const { id: _id, ...rest } = f as any;
    delete (rest as any).created_at;
    delete (rest as any).updated_at;
    const payload = rest;
    if (supplier) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", supplier.id);
      setSaving(false);
      if (error) { console.error("supplier update", error); return toast.error(error.message); }
      toast.success("Fornecedor atualizado");
    } else {
      const { error } = await supabase
        .from("suppliers")
        .insert({ ...payload, name: payload.name!, created_by: user?.id });
      setSaving(false);
      if (error) { console.error("supplier insert", error); return toast.error(error.message); }
      toast.success("Fornecedor criado");
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary">
            {supplier ? "Editar fornecedor" : "Novo fornecedor"}
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {supplier && (
          <div className="mb-4 flex gap-1 border-b border-border">
            <TabBtn active={tab === "dados"} onClick={() => setTab("dados")}>Dados</TabBtn>
            <TabBtn active={tab === "materiais"} onClick={() => setTab("materiais")}>
              Materiais ({materials.length})
            </TabBtn>
          </div>
        )}

        {tab === "dados" && (
          <form onSubmit={save} className="space-y-4">
            {!supplier && (
              <CatalogSearch
                onPick={(c) => {
                  setF((s) => ({
                    ...s,
                    name: c.trade_name || c.name,
                    trade_name: c.trade_name ?? s.trade_name,
                    legal_name: c.legal_name ?? s.legal_name,
                    cnpj: c.cnpj ?? s.cnpj,
                    address_city: c.address_city ?? s.address_city,
                    address_state: c.address_state ?? s.address_state,
                    phone: c.phone ?? s.phone,
                    commercial_email: c.commercial_email ?? s.commercial_email,
                    website: c.website ?? s.website,
                    ...(({} as any)),
                    catalog_id: c.id as any,
                  } as any));
                  toast.success("Dados do catálogo aplicados. Preencha o restante e salve.");
                }}
              />
            )}
            <Section title="Identificação">
              <Field label="Nome / Apelido *">
                <input required value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} className={inp} />
              </Field>
              <Field label="Nome fantasia">
                <input value={f.trade_name ?? ""} onChange={(e) => up("trade_name", e.target.value)} className={inp} />
              </Field>
              <Field label="Razão social" wide>
                <input value={f.legal_name ?? ""} onChange={(e) => up("legal_name", e.target.value)} className={inp} />
              </Field>
              <Field label="CNPJ">
                <input
                  value={f.cnpj ?? ""}
                  onChange={(e) => up("cnpj", maskCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className={inp}
                />
              </Field>
              <Field label="Inscrição estadual">
                <input
                  value={f.state_registration ?? ""}
                  onChange={(e) => up("state_registration", e.target.value)}
                  className={inp}
                />
              </Field>
            </Section>

            <Section title="Endereço">
              <Field label="Logradouro" wide>
                <input value={f.address_street ?? ""} onChange={(e) => up("address_street", e.target.value)} className={inp} />
              </Field>
              <Field label="Número">
                <input value={f.address_number ?? ""} onChange={(e) => up("address_number", e.target.value)} className={inp} />
              </Field>
              <Field label="Complemento">
                <input value={f.address_complement ?? ""} onChange={(e) => up("address_complement", e.target.value)} className={inp} />
              </Field>
              <Field label="Bairro">
                <input value={f.address_district ?? ""} onChange={(e) => up("address_district", e.target.value)} className={inp} />
              </Field>
              <Field label="Cidade">
                <input value={f.address_city ?? ""} onChange={(e) => up("address_city", e.target.value)} className={inp} />
              </Field>
              <Field label="UF">
                <input value={f.address_state ?? ""} onChange={(e) => up("address_state", e.target.value)} className={inp} />
              </Field>
              <Field label="CEP">
                <input value={f.address_zip ?? ""} onChange={(e) => up("address_zip", formatCEP(e.target.value))} placeholder="00000-000" inputMode="numeric" className={inp} />
              </Field>
              <Field label="País">
                <input value={f.address_country ?? ""} onChange={(e) => up("address_country", e.target.value)} className={inp} />
              </Field>
            </Section>

            <Section title="Contatos">
              <Field label="Telefone">
                <input value={f.phone ?? ""} onChange={(e) => up("phone", formatBRPhone(e.target.value))} placeholder="+55 48 99125 3825" className={inp} />
              </Field>
              <Field label="WhatsApp">
                <input value={f.whatsapp ?? ""} onChange={(e) => up("whatsapp", formatBRPhone(e.target.value))} placeholder="+55 48 99125 3825" className={inp} />
              </Field>
              <Field label="E-mail comercial">
                <input
                  type="email"
                  value={f.commercial_email ?? ""}
                  onChange={(e) => up("commercial_email", e.target.value)}
                  className={inp}
                />
              </Field>
              <Field label="E-mail de acesso (portal)">
                <input
                  type="email"
                  value={f.contact_email ?? ""}
                  onChange={(e) => up("contact_email", e.target.value)}
                  className={inp}
                />
              </Field>
              <Field label="Site" wide>
                <input value={f.website ?? ""} onChange={(e) => up("website", e.target.value)} placeholder="https://" className={inp} />
              </Field>
            </Section>

            <Section title="Contato principal">
              <Field label="Nome">
                <input value={f.primary_contact_name ?? ""} onChange={(e) => up("primary_contact_name", e.target.value)} className={inp} />
              </Field>
              <Field label="Cargo">
                <input value={f.primary_contact_role ?? ""} onChange={(e) => up("primary_contact_role", e.target.value)} className={inp} />
              </Field>
              <Field label="Telefone">
                <input value={f.primary_contact_phone ?? ""} onChange={(e) => up("primary_contact_phone", formatBRPhone(e.target.value))} placeholder="+55 48 99125 3825" className={inp} />
              </Field>
              <Field label="E-mail">
                <input type="email" value={f.primary_contact_email ?? ""} onChange={(e) => up("primary_contact_email", e.target.value)} className={inp} />
              </Field>
            </Section>

            <Section title="Condições comerciais">
              <Field label="Prazo de pagamento">
                <input value={f.payment_terms ?? ""} onChange={(e) => up("payment_terms", e.target.value)} placeholder="Ex.: 30 dias" className={inp} />
              </Field>
              <Field label="Prazo de entrega">
                <input value={f.delivery_lead_time ?? ""} onChange={(e) => up("delivery_lead_time", e.target.value)} placeholder="Ex.: 5 dias úteis" className={inp} />
              </Field>
              <Field label="Pedido mínimo" wide>
                <input value={f.minimum_order ?? ""} onChange={(e) => up("minimum_order", e.target.value)} placeholder="Ex.: R$ 500,00 ou 12 gfas" className={inp} />
              </Field>
              <Field label="Observações" wide>
                <textarea rows={3} value={f.notes ?? ""} onChange={(e) => up("notes", e.target.value)} className={inp} />
              </Field>
            </Section>

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
        )}

        {tab === "materiais" && supplier && (
          <MaterialsManager supplierId={supplier.id} materials={materials} onChange={() => refetch()} canEdit />
        )}
      </div>
    </div>
  );
}

export function MaterialsManager({
  supplierId,
  materials,
  onChange,
  canEdit,
}: {
  supplierId: string;
  materials: Material[];
  onChange: () => void;
  canEdit: boolean;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("price_list");
  const [desc, setDesc] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim()) return toast.error("Informe um título");
    setSaving(true);
    const { error } = await supabase.from("supplier_materials").insert({
      supplier_id: supplierId,
      material_type: type,
      title,
      description: desc || null,
      file_url: fileUrl,
      valid_until: validUntil || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Material adicionado");
    setTitle("");
    setDesc("");
    setValidUntil("");
    setFileUrl(null);
    onChange();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("supplier_materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-sm font-medium text-primary mb-3">Adicionar material</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium">Tipo</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inp}>
                <option value="price_list">Lista de preços</option>
                <option value="presentation">Apresentação</option>
                <option value="tech_sheet">Ficha técnica</option>
                <option value="marketing">Material de marketing</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium">Título</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium">Descrição</span>
              <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className={inp} />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Válido até</span>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inp} />
            </label>
            <div>
              <MediaUploader
                label="Arquivo (PDF/imagem)"
                value={fileUrl}
                onChange={setFileUrl}
                folder={`supplier-materials/${supplierId}`}
                accept="application/pdf,image/*"
                kind="file"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={add}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {materials.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum material cadastrado.
          </div>
        )}
        {materials.map((m) => (
          <div key={m.id} className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
            <FileText className="mt-1 h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.title}</span>
                <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {labelType(m.material_type)}
                </span>
                {m.valid_until && (
                  <span className="text-xs text-muted-foreground">até {new Date(m.valid_until).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
              {m.description && <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>}
              {m.file_url && (
                <a href={m.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                  Abrir arquivo
                </a>
              )}
            </div>
            {canEdit && (
              <button onClick={() => remove(m.id)} className="rounded p-1 hover:bg-accent" aria-label="Remover">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function labelType(t: string) {
  const map: Record<string, string> = {
    price_list: "Lista de preços",
    presentation: "Apresentação",
    tech_sheet: "Ficha técnica",
    marketing: "Marketing",
    other: "Outro",
  };
  return map[t] ?? t;
}

const inp = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function CatalogSearch({ onPick }: { onPick: (c: any) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogSupplier[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  async function search(term: string) {
    setQ(term);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("supplier_catalog")
      .select("id,name,trade_name,legal_name,cnpj,address_city,address_state,phone,commercial_email,website")
      .eq("status", "approved")
      .or(`name.ilike.%${term}%,trade_name.ilike.%${term}%,legal_name.ilike.%${term}%,cnpj.ilike.%${term}%`)
      .limit(10);
    setResults((data ?? []) as CatalogSupplier[]);
    setOpen(true);
  }

  async function pick(c: CatalogSupplier) {
    const { data } = await supabase.from("supplier_catalog").select("*").eq("id", c.id).maybeSingle();
    onPick(data ?? c);
    setPicked(c.trade_name || c.name);
    setOpen(false);
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <Search className="h-3.5 w-3.5" /> Buscar no catálogo global de fornecedores
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Use um fornecedor já cadastrado no catálogo para preencher os dados automaticamente. Se não encontrar, preencha manualmente — o novo fornecedor será enviado como sugestão ao administrador.
      </p>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          onFocus={() => q && setOpen(true)}
          placeholder="Digite nome, razão social ou CNPJ..."
          className={inp}
        />
        {picked && (
          <div className="mt-1 flex items-center gap-1 text-xs text-primary">
            <Check className="h-3 w-3" /> {picked} — dados carregados
          </div>
        )}
        {open && results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pick(r)}
                className="block w-full border-b border-border/50 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div className="font-medium">{r.trade_name || r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[r.legal_name, r.cnpj, [r.address_city, r.address_state].filter(Boolean).join("/")]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
            ))}
          </div>
        )}
        {open && q.trim().length >= 2 && results.length === 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            Nenhum fornecedor aprovado encontrado. Preencha o formulário abaixo para criar um novo.
          </div>
        )}
      </div>
    </div>
  );
}
