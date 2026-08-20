import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Printer,
  Save,
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  ScrollText,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { MenuPreview } from "@/components/printed-menu/MenuPreview";
import {
  DEFAULT_VISIBLE_FIELDS,
  PAPER_LIST,
  TEMPLATE_LIST,
  autoSections,
  isGlassVol,
  typeLabel,
  type MenuSection,
  type MenuWine,
  type PaperKey,
  type TemplateKey,
  type VisibleFields,
} from "@/components/printed-menu/templates";

export const Route = createFileRoute("/_app/app/wine-menu")({
  component: WineMenuPage,
  head: () => ({
    meta: [
      { title: "Carta de Vinhos para Impressão | Gestão de Vinhos" },
      {
        name: "description",
        content:
          "Monte, organize e imprima a carta de vinhos do seu restaurante em modelos prontos, sempre com os preços atualizados.",
      },
      { property: "og:title", content: "Carta de Vinhos para Impressão" },
      {
        property: "og:description",
        content: "Modelos prontos para montar e imprimir a carta de vinhos do restaurante.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type SavedList = {
  id: string;
  name: string;
  template: string;
  header_title: string | null;
  header_subtitle: string | null;
  footer_text: string | null;
  visible_fields: VisibleFields & { addressPosition?: "header" | "footer" };
  sections: MenuSection[];
  logo_url: string | null;
  address_text: string | null;
  paper_size: string | null;
  updated_at: string;
};

const FIELD_LABELS: { key: keyof VisibleFields; label: string }[] = [
  { key: "producer", label: "Produtor" },
  { key: "vintage", label: "Safra" },
  { key: "origin", label: "Região / País" },
  { key: "grape", label: "Uvas" },
  { key: "volume", label: "Volume" },
  { key: "price", label: "Preço" },
];

function newId() {
  return `sec-${Math.random().toString(36).slice(2, 9)}`;
}

function WineMenuPage() {
  const { restaurantId, memberships } = useAuth();
  const queryClient = useQueryClient();

  const restaurantName = useMemo(
    () => memberships.find((m) => m.restaurantId === restaurantId)?.name ?? "",
    [memberships, restaurantId],
  );

  const { data: wines = [], isLoading } = useQuery({
    queryKey: ["wine-menu-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select(
          "id,name,producer,vintage,region,appellation,country,grape,wine_type,volume,sale_price,active_on_menu",
        )
        .eq("restaurant_id", restaurantId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as MenuWine[];
    },
  });

  const { data: savedLists = [] } = useQuery({
    queryKey: ["printed-wine-lists", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printed_wine_lists")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavedList[];
    },
  });

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [listName, setListName] = useState("Carta de Vinhos");
  const [template, setTemplate] = useState<TemplateKey>("classic");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [footer, setFooter] = useState("");
  const [paper, setPaper] = useState<PaperKey>("a4");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [addressPosition, setAddressPosition] = useState<"header" | "footer">("header");
  const [fields, setFields] = useState<VisibleFields>(DEFAULT_VISIBLE_FIELDS);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const winesById = useMemo(() => {
    const map: Record<string, MenuWine> = {};
    for (const w of wines) map[w.id] = w;
    return map;
  }, [wines]);

  // Primeira carga: agrupa automaticamente os rótulos ativos na carta.
  useEffect(() => {
    if (initialized || isLoading || wines.length === 0) return;
    setSections(autoSections(wines.filter((w) => w.active_on_menu !== false)));
    setInitialized(true);
  }, [initialized, isLoading, wines]);

  useEffect(() => {
    if (!title && restaurantName) setTitle(restaurantName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantName]);

  const usedIds = useMemo(() => new Set(sections.flatMap((s) => s.wineIds)), [sections]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wines.filter(
      (w) =>
        !usedIds.has(w.id) &&
        (q === "" ||
          w.name.toLowerCase().includes(q) ||
          (w.producer ?? "").toLowerCase().includes(q)),
    );
  }, [wines, usedIds, search]);

  const totalItems = usedIds.size;

  function addWine(wineId: string, sectionId?: string) {
    setSections((prev) => {
      const w = winesById[wineId];
      const targetTitle = isGlassVol(w?.volume) ? "Vinhos em taça" : typeLabel(w?.wine_type ?? null);
      let target = sectionId ? prev.find((s) => s.id === sectionId) : prev.find((s) => s.title === targetTitle);
      if (!target) {
        return [...prev, { id: newId(), title: targetTitle, wineIds: [wineId] }];
      }
      return prev.map((s) => (s.id === target!.id ? { ...s, wineIds: [...s.wineIds, wineId] } : s));
    });
  }

  function removeWine(sectionId: string, wineId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, wineIds: s.wineIds.filter((id) => id !== wineId) } : s)),
    );
  }

  function moveWine(sectionId: string, index: number, dir: -1 | 1) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const next = [...s.wineIds];
        const j = index + dir;
        if (j < 0 || j >= next.length) return s;
        [next[index], next[j]] = [next[j], next[index]];
        return { ...s, wineIds: next };
      }),
    );
  }

  function moveSection(index: number, dir: -1 | 1) {
    setSections((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function save(asNew = false) {
    if (!restaurantId) return;
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: listName || "Carta de Vinhos",
      template,
      header_title: title,
      header_subtitle: subtitle,
      footer_text: footer,
      visible_fields: JSON.parse(JSON.stringify({ ...fields, addressPosition })),
      sections: JSON.parse(JSON.stringify(sections)),
      logo_url: logoUrl || null,
      address_text: address || null,
      paper_size: paper,
    };
    let error;
    if (currentId && !asNew) {
      ({ error } = await supabase.from("printed_wine_lists").update(payload).eq("id", currentId));
    } else {
      const res = await supabase.from("printed_wine_lists").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setCurrentId(res.data.id as string);
    }
    setSaving(false);
    if (error) {
      console.error("[wine-menu] save error", error);
      toast.error(`Não foi possível salvar: ${error.message}`);
      return;
    }
    toast.success(asNew ? "Carta duplicada." : "Carta salva.");
    queryClient.invalidateQueries({ queryKey: ["printed-wine-lists", restaurantId] });
  }

  function loadSaved(l: SavedList) {
    setCurrentId(l.id);
    setListName(l.name);
    setTemplate((l.template as TemplateKey) ?? "classic");
    setTitle(l.header_title ?? "");
    setSubtitle(l.header_subtitle ?? "");
    setFooter(l.footer_text ?? "");
    setFields({ ...DEFAULT_VISIBLE_FIELDS, ...(l.visible_fields ?? {}) });
    setAddressPosition(l.visible_fields?.addressPosition === "footer" ? "footer" : "header");
    setLogoUrl(l.logo_url ?? "");
    setAddress(l.address_text ?? "");
    setPaper((l.paper_size as PaperKey) ?? "a4");
    setSections(Array.isArray(l.sections) ? l.sections : []);
    setInitialized(true);
    toast.success(`Carta "${l.name}" carregada.`);
  }

  async function deleteSaved(id: string) {
    const { error } = await supabase.from("printed_wine_lists").delete().eq("id", id);
    if (error) {
      toast.error(`Não foi possível excluir: ${error.message}`);
      return;
    }
    if (currentId === id) setCurrentId(null);
    queryClient.invalidateQueries({ queryKey: ["printed-wine-lists", restaurantId] });
    toast.success("Carta excluída.");
  }

  return (
    <div className="p-4 md:p-8">
      <div className="no-print">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              className="flex items-center gap-2 text-xl font-semibold uppercase tracking-[2px] text-primary md:text-2xl"
            >
              <ScrollText className="h-5 w-5" /> Carta impressa
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Monte a carta com os rótulos do restaurante, escolha um modelo e imprima. Os preços vêm sempre do
              cadastro atual.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-accent disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Salvar
            </button>
            {currentId && (
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:opacity-90"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Modelos */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.key}
              onClick={() => setTemplate(t.key)}
              className={`rounded-xl border p-4 text-left transition ${
                template === t.key ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/60"
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-primary">{t.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Tamanho do papel */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Tamanho do papel</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PAPER_LIST.map((p) => (
              <button
                key={p.key}
                onClick={() => setPaper(p.key)}
                className={`rounded-xl border p-3 text-left transition ${
                  paper === p.key ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/60"
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-primary">{p.code}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.dims}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* Painel de montagem */}
        <div className="no-print space-y-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Cabeçalho e rodapé</div>
            <div className="mt-3 grid gap-3">
              <Field label="Nome desta carta (uso interno)" value={listName} onChange={setListName} />
              <Field label="Título impresso" value={title} onChange={setTitle} placeholder="Nome do restaurante" />
              <Field label="Subtítulo" value={subtitle} onChange={setSubtitle} placeholder="Carta de Vinhos" />
              <Field
                label="Rodapé"
                value={footer}
                onChange={setFooter}
                placeholder="Preços em reais · Atualizada em ..."
              />
              <Field
                label="Logo (link da imagem)"
                value={logoUrl}
                onChange={setLogoUrl}
                placeholder="https://.../logo.png"
              />
              <div className="grid gap-1.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Endereço / contato
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder={"Rua Exemplo, 123 - Jardins, São Paulo\n(11) 99999-0000 · @restaurante"}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="mt-1 flex gap-2">
                  {(["header", "footer"] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setAddressPosition(pos)}
                      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                        addressPosition === pos
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {pos === "header" ? "No cabeçalho" : "No rodapé"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Informações do rótulo</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FIELD_LABELS.map((f) => (
                <label
                  key={f.key}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                    fields[f.key] ? "border-primary text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={fields[f.key]}
                    onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.checked }))}
                    className="h-3.5 w-3.5"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Seções ({totalItems} rótulos)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSections((p) => [...p, { id: newId(), title: "Nova seção", wineIds: [] }])}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-3 w-3" /> Seção
                </button>
                <button
                  onClick={() => setSections(autoSections(wines.filter((w) => w.active_on_menu !== false)))}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                >
                  <RotateCcw className="h-3 w-3" /> Reagrupar
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {sections.map((sec, si) => (
                <div key={sec.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={sec.title}
                      onChange={(e) =>
                        setSections((p) => p.map((s) => (s.id === sec.id ? { ...s, title: e.target.value } : s)))
                      }
                      className="flex-1 rounded border border-input bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
                    />
                    <IconBtn onClick={() => moveSection(si, -1)} title="Subir seção">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn onClick={() => moveSection(si, 1)} title="Descer seção">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      onClick={() => setSections((p) => p.filter((s) => s.id !== sec.id))}
                      title="Remover seção"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {sec.wineIds.map((id, wi) => {
                      const w = winesById[id];
                      if (!w) return null;
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-foreground hover:bg-accent"
                        >
                          <span className="flex-1 truncate">
                            {w.name}
                            {w.vintage ? ` ${w.vintage}` : ""}
                            <span className="ml-1 text-muted-foreground">{w.volume ?? ""}</span>
                          </span>
                          <IconBtn onClick={() => moveWine(sec.id, wi, -1)} title="Subir">
                            <ChevronUp className="h-3 w-3" />
                          </IconBtn>
                          <IconBtn onClick={() => moveWine(sec.id, wi, 1)} title="Descer">
                            <ChevronDown className="h-3 w-3" />
                          </IconBtn>
                          <IconBtn onClick={() => removeWine(sec.id, id)} title="Retirar da carta">
                            <X className="h-3 w-3" />
                          </IconBtn>
                        </li>
                      );
                    })}
                    {sec.wineIds.length === 0 && (
                      <li className="px-2 py-1 text-[11px] text-muted-foreground">Seção vazia.</li>
                    )}
                  </ul>
                </div>
              ))}
              {sections.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhuma seção. Use "Reagrupar" para montar automaticamente por tipo.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Rótulos fora da carta ({available.length})
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar rótulo ou produtor..."
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            />
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto no-scrollbar">
              {available.map((w) => (
                <li key={w.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent">
                  <span className="flex-1 truncate">
                    {w.name}
                    {w.vintage ? ` ${w.vintage}` : ""}
                    <span className="ml-1 text-muted-foreground">
                      {typeLabel(w.wine_type)} {w.volume ?? ""}
                    </span>
                  </span>
                  <button
                    onClick={() => addWine(w.id)}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] uppercase text-primary hover:bg-background"
                  >
                    <Plus className="h-3 w-3" /> Incluir
                  </button>
                </li>
              ))}
              {available.length === 0 && (
                <li className="px-2 py-2 text-[11px] text-muted-foreground">Todos os rótulos já estão na carta.</li>
              )}
            </ul>
          </div>

          {savedLists.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Cartas salvas</div>
              <ul className="mt-3 space-y-1">
                {savedLists.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent">
                    <span className="flex-1 truncate">
                      {l.name}
                      <span className="ml-2 text-muted-foreground">
                        {new Date(l.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                    </span>
                    <button
                      onClick={() => loadSaved(l)}
                      className="rounded border border-border px-2 py-0.5 text-[10px] uppercase text-primary hover:bg-background"
                    >
                      Abrir
                    </button>
                    <IconBtn onClick={() => deleteSaved(l.id)} title="Excluir carta">
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Pré-visualização */}
        <div className="print-root">
          <div className="no-print mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Pré-visualização · {PAPER_LIST.find((p) => p.key === paper)?.code} ({PAPER_LIST.find((p) => p.key === paper)?.dims})
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-neutral-200 p-4 print:border-0 print:bg-white print:p-0">
            <MenuPreview
              template={template}
              paper={paper}
              logoUrl={logoUrl}
              address={address}
              addressPosition={addressPosition}
              title={title}
              subtitle={subtitle}
              footer={footer}
              fields={fields}
              sections={sections}
              winesById={winesById}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:border-primary hover:text-primary"
    >
      {children}
    </button>
  );
}
