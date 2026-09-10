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
  Pencil,
  Check,

} from "lucide-react";
import { toast } from "sonner";
import { MenuPreview } from "@/components/printed-menu/MenuPreview";
import ModuleGate from "@/components/ModuleGate";
import {
  DEFAULT_SPACING,
  DEFAULT_VISIBLE_FIELDS,
  PAPER_LIST,
  TEMPLATE_LIST,
  autoSections,
  customPaper,
  isGlassVol,
  paperOf,
  typeLabel,
  type MenuSection,
  type MenuSpacing,
  type MenuWine,
  type PaperKey,
  type TemplateKey,
  type VisibleFields,
} from "@/components/printed-menu/templates";

export const Route = createFileRoute("/_app/app/wine-menu")({
  component: () => (
    <ModuleGate route="/app/wine-menu">
      <WineMenuPage />
    </ModuleGate>
  ),
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
  visible_fields: VisibleFields & {
    addressPosition?: "header" | "footer";
    priceDecimals?: boolean;
    spacing?: MenuSpacing;
    customPaper?: { widthMm: number; heightMm: number; padMm: number };
  };
  sections: MenuSection[];
  logo_url: string | null;
  address_text: string | null;
  paper_size: string | null;
  updated_at: string;
};

const FIELD_LABELS: { key: keyof VisibleFields; label: string }[] = [
  { key: "code", label: "Código" },
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

  const [editingWineId, setEditingWineId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);

  useEffect(() => {
    if (!savedOpen) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-saved-dropdown]")) setSavedOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [savedOpen]);

  async function saveWineName(id: string) {
    const name = editingName.trim();
    setEditingWineId(null);
    if (!name) return;
    const { error } = await supabase.from("wines").update({ name }).eq("id", id);
    if (error) {
      toast.error("Não foi possível salvar o nome do rótulo.");
      return;
    }
    toast.success("Rótulo atualizado.");
    queryClient.invalidateQueries({ queryKey: ["wine-menu-wines", restaurantId] });
  }


  const { data: wines = [], isLoading } = useQuery({
    queryKey: ["wine-menu-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select(
          "id,name,internal_code,producer,vintage,region,appellation,country,grape,wine_type,volume,sale_price,active_on_menu",
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
  const [useCustomPaper, setUseCustomPaper] = useState(false);
  const [customW, setCustomW] = useState(210);
  const [customH, setCustomH] = useState(297);
  const [customPad, setCustomPad] = useState(12);
  const [spacing, setSpacing] = useState<MenuSpacing>(DEFAULT_SPACING);
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [addressPosition, setAddressPosition] = useState<"header" | "footer">("header");
  const [fields, setFields] = useState<VisibleFields>(DEFAULT_VISIBLE_FIELDS);
  const [priceDecimals, setPriceDecimals] = useState(true);
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
    let name = listName.trim();
    if (!currentId || asNew || !name) {
      const suggested = asNew ? `${name || "Carta de Vinhos"} (cópia)` : name || "Carta de Vinhos";
      const typed = window.prompt("Dê um nome para esta carta:", suggested);
      if (typed === null) return;
      name = typed.trim() || suggested;
      setListName(name);
    }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name,
      template,
      header_title: title,
      header_subtitle: subtitle,
      footer_text: footer,
      visible_fields: JSON.parse(
        JSON.stringify({
          ...fields,
          addressPosition,
          priceDecimals,
          spacing,
          customPaper: useCustomPaper ? { widthMm: customW, heightMm: customH, padMm: customPad } : null,
        }),
      ),
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
    setPriceDecimals(l.visible_fields?.priceDecimals !== false);
    setLogoUrl(l.logo_url ?? "");
    setAddress(l.address_text ?? "");
    setPaper((l.paper_size as PaperKey) ?? "a4");
    setSpacing({ ...DEFAULT_SPACING, ...(l.visible_fields?.spacing ?? {}) });
    const cp = l.visible_fields?.customPaper;
    setUseCustomPaper(!!cp);
    if (cp) {
      setCustomW(cp.widthMm);
      setCustomH(cp.heightMm);
      setCustomPad(cp.padMm ?? 12);
    }
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
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                onClick={() => {
                  setCurrentId(null);
                  setListName("");
                  toast.info("Nova carta: ao salvar, você escolhe o nome.");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
              >
                Nova carta
              </button>
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

              {/* Cartas salvas — dropdown */}
              <div className="relative" data-saved-dropdown>
                <button
                  onClick={() => setSavedOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                    currentId ? "border-primary text-primary hover:bg-accent" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {currentId ? listName || "Carta salva" : "Cartas salvas"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${savedOpen ? "rotate-180" : ""}`} />
                </button>
                {savedOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Cartas salvas
                    </div>
                    {savedLists.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">
                        Nenhuma carta salva ainda.
                      </p>
                    ) : (
                      <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {savedLists.map((l) => (
                          <li
                            key={l.id}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 ${
                              currentId === l.id ? "bg-accent" : "hover:bg-accent"
                            }`}
                          >
                            <button
                              onClick={() => {
                                loadSaved(l);
                                setSavedOpen(false);
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="text-xs">{l.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(l.updated_at).toLocaleDateString("pt-BR")}
                              </div>
                            </button>
                            <IconBtn onClick={() => deleteSaved(l.id)} title="Excluir carta">
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconBtn>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
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
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PAPER_LIST.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPaper(p.key);
                  setUseCustomPaper(false);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  !useCustomPaper && paper === p.key
                    ? "border-primary bg-accent"
                    : "border-border bg-card hover:border-primary/60"
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-primary">{p.code}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.dims}</div>
              </button>
            ))}
            <button
              onClick={() => setUseCustomPaper(true)}
              className={`rounded-xl border p-3 text-left transition ${
                useCustomPaper ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/60"
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-primary">Personalizado</div>
              <div className="mt-1 text-xs text-muted-foreground">Você define largura e altura</div>
            </button>
          </div>
          {useCustomPaper ? (
            <div className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
              <MmField label="Largura (mm)" value={customW} onChange={setCustomW} min={60} max={420} />
              <MmField label="Altura (mm)" value={customH} onChange={setCustomH} min={80} max={594} />
              <MmField label="Margem interna (mm)" value={customPad} onChange={setCustomPad} min={0} max={40} />
              <p className="sm:col-span-3 text-[11px] text-muted-foreground">
                Exemplos: 100 × 210 mm (folha estreita), 150 × 300 mm (carta alta). 10 mm = 1 cm.
              </p>
            </div>
          ) : null}
        </div>

        {/* Espaçamento das linhas */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Espaçamento das linhas</div>
          <div className="mt-2 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
            <SpaceSlider
              label="Do rótulo para a linha de baixo"
              value={spacing.nameGap}
              onChange={(v) => setSpacing((s) => ({ ...s, nameGap: v }))}
            />
            <SpaceSlider
              label="Entre as linhas de informação"
              value={spacing.lineGap}
              onChange={(v) => setSpacing((s) => ({ ...s, lineGap: v }))}
            />
            <SpaceSlider
              label="Entre um rótulo e o próximo"
              value={spacing.itemGap}
              max={24}
              onChange={(v) => setSpacing((s) => ({ ...s, itemGap: v }))}
            />
            <button
              onClick={() => setSpacing(DEFAULT_SPACING)}
              className="sm:col-span-3 justify-self-start inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
            >
              <RotateCcw className="h-3 w-3" /> Voltar ao padrão
            </button>
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
            {fields.price ? (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Formato do preço</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { dec: true, label: "Com centavos (120,00)" },
                    { dec: false, label: "Sem centavos (120)" },
                  ].map((o) => (
                    <button
                      key={String(o.dec)}
                      onClick={() => setPriceDecimals(o.dec)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        priceDecimals === o.dec ? "border-primary text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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
                          {editingWineId === id ? (
                            <>
                              <input
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveWineName(id);
                                  if (e.key === "Escape") setEditingWineId(null);
                                }}
                                className="flex-1 rounded border border-input bg-card px-2 py-1 text-xs"
                              />
                              <IconBtn onClick={() => saveWineName(id)} title="Salvar nome">
                                <Check className="h-3 w-3" />
                              </IconBtn>
                              <IconBtn onClick={() => setEditingWineId(null)} title="Cancelar">
                                <X className="h-3 w-3" />
                              </IconBtn>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 truncate">
                                {w.name}
                                {w.vintage ? ` ${w.vintage}` : ""}
                                <span className="ml-1 text-muted-foreground">{w.volume ?? ""}</span>
                              </span>
                              <IconBtn
                                onClick={() => {
                                  setEditingWineId(id);
                                  setEditingName(w.name ?? "");
                                }}
                                title="Editar nome do rótulo"
                              >
                                <Pencil className="h-3 w-3" />
                              </IconBtn>
                              <IconBtn onClick={() => moveWine(sec.id, wi, -1)} title="Subir">
                                <ChevronUp className="h-3 w-3" />
                              </IconBtn>
                              <IconBtn onClick={() => moveWine(sec.id, wi, 1)} title="Descer">
                                <ChevronDown className="h-3 w-3" />
                              </IconBtn>
                            </>
                          )}

                          {editingWineId !== id && (
                            <IconBtn onClick={() => removeWine(sec.id, id)} title="Retirar da carta">
                              <X className="h-3 w-3" />
                            </IconBtn>
                          )}

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
              priceDecimals={priceDecimals}
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

function MmField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function SpaceSlider({
  label,
  value,
  onChange,
  max = 12,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-primary">{value}</span>
      </label>
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary"
      />
    </div>
  );
}
