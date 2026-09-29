import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Printer,
  Save,
  Plus,
  Minus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  ScrollText,
  RotateCcw,
  Pencil,
  Check,
  ZoomIn,
  ZoomOut,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { MenuPreview } from "@/components/printed-menu/MenuPreview";
import { SectionHeadingControls } from "@/components/printed-menu/SectionHeadingControls";
import ModuleGate from "@/components/ModuleGate";
import type { CustomDesign } from "@/components/printed-menu/MenuPreview";
import { Button } from "@/components/ui/button";
import { CustomMenuRequestDialog, CustomDesignPanel } from "@/components/printed-menu/CustomMenu";
import {
  DEFAULT_SPACING,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_LAYOUT,
  DEFAULT_PAGE_MARGINS,
  DEFAULT_VISIBLE_FIELDS,
  FONT_LIST,
  normalizeFields,
  type MenuTypography,
  PAPER_LIST,
  TEMPLATE_LIST,
  autoSections,
  sectionKey,
  sectionLevel,
  customPaper,
  isGlassVol,
  paperOf,
  typeLabel,
  type MenuSection,
  type SectionHeadingStyle,
  type MenuSpacing,
  type MenuLayout,
  type PageMargins,
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
    priceCurrency?: boolean;
    spacing?: MenuSpacing;
    typography?: MenuTypography;
    layout?: MenuLayout;
    margins?: PageMargins;
    customPaper?: { widthMm: number; heightMm: number; padMm: number };
    customDesign?: CustomDesign | null;
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
  { key: "region", label: "Região" },
  { key: "country", label: "País" },
  { key: "grape", label: "Uvas" },
  { key: "volume", label: "Volume" },
  { key: "price", label: "Preço" },
];

function newId() {
  return `sec-${Math.random().toString(36).slice(2, 9)}`;
}

/** Nome da seção nas listas de seleção, com o nível hierárquico. */
function sectionOptionLabel(s: MenuSection) {
  const lvl = sectionLevel(s);
  return `${"↳ ".repeat(Math.max(0, lvl - 1))}${lvl}º · ${s.title || "(sem título)"}`;
}


function WineMenuPage() {
  const { restaurantId, memberships, role } = useAuth();
  const isAdmin = role === "admin";
  const [customDesign, setCustomDesign] = useState<CustomDesign>({});
  const [requestOpen, setRequestOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("request");
    if (id) setRequestId(id);
  }, []);
  const queryClient = useQueryClient();

  const restaurantName = useMemo(
    () => memberships.find((m) => m.restaurantId === restaurantId)?.name ?? "",
    [memberships, restaurantId],
  );

  const [editingWineId, setEditingWineId] = useState<string | null>(null);
  const [headingEditorId, setHeadingEditorId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [marginsOpen, setMarginsOpen] = useState(false);
  const [priceFormatOpen, setPriceFormatOpen] = useState(false);

  useEffect(() => {
    if (!savedOpen) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-saved-dropdown]")) setSavedOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [savedOpen]);

  useEffect(() => {
    if (!customOpen) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-custom-dropdown]")) setCustomOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [customOpen]);

  useEffect(() => {
    if (!spacingOpen) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-spacing-dropdown]")) setSpacingOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [spacingOpen]);

  useEffect(() => {
    if (!fontOpen) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-font-dropdown]")) setFontOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [fontOpen]);

  useEffect(() => {
    if (!layoutOpen && !marginsOpen && !priceFormatOpen) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (layoutOpen && !target.closest("[data-layout-dropdown]")) setLayoutOpen(false);
      if (marginsOpen && !target.closest("[data-margins-dropdown]")) setMarginsOpen(false);
      if (priceFormatOpen && !target.closest("[data-price-format-dropdown]")) setPriceFormatOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [layoutOpen, marginsOpen, priceFormatOpen]);

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
          "id,name,internal_code,producer,vintage,region,appellation,country,grape,wine_type,style,volume,sale_price,active_on_menu",
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
  const [typography, setTypography] = useState<MenuTypography>(DEFAULT_TYPOGRAPHY);
  const [layout, setLayout] = useState<MenuLayout>(DEFAULT_LAYOUT);
  const [margins, setMargins] = useState<PageMargins>(DEFAULT_PAGE_MARGINS);

  const activePaper = useMemo(
    () => (useCustomPaper ? customPaper(customW, customH, customPad) : paperOf(paper)),
    [useCustomPaper, customW, customH, customPad, paper],
  );
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [addressPosition, setAddressPosition] = useState<"header" | "footer">("header");
  const [fields, setFields] = useState<VisibleFields>(DEFAULT_VISIBLE_FIELDS);
  const [priceDecimals, setPriceDecimals] = useState(true);
  const [priceCurrency, setPriceCurrency] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.8);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [groupMode, setGroupMode] = useState<"type" | "style">(() => {
    if (typeof window === "undefined") return "type";
    return (localStorage.getItem("wine-menu-group-mode") as "type" | "style") || "type";
  });
  function regroup(mode: "type" | "style") {
    setGroupMode(mode);
    try { localStorage.setItem("wine-menu-group-mode", mode); } catch {}
    setSections(autoSections(wines.filter((w) => w.active_on_menu !== false), mode));
  }
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
    setSections(autoSections(wines.filter((w) => w.active_on_menu !== false), groupMode));
    setInitialized(true);
  }, [initialized, isLoading, wines]);

  useEffect(() => {
    if (!title && restaurantName) setTitle(restaurantName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantName]);

  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const targetExists = !!targetSectionId && sections.some((s) => s.id === targetSectionId);
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

  function addWine(wineId: string, sectionId?: string | null) {
    setSections((prev) => {
      const w = winesById[wineId];
      const targetTitle = w ? sectionKey(w as any, groupMode) : "Outros";
      let target = sectionId ? prev.find((s) => s.id === sectionId) : prev.find((s) => s.title === targetTitle);
      if (!target) {
        return [...prev, { id: newId(), title: targetTitle, wineIds: [wineId] }];
      }
      return prev.map((s) => (s.id === target!.id ? { ...s, wineIds: [...s.wineIds, wineId] } : s));
    });
  }

  function moveWineTo(fromId: string, wineId: string, toId: string) {
    if (fromId === toId) return;
    setSections((prev) =>
      prev.map((s) =>
        s.id === fromId
          ? { ...s, wineIds: s.wineIds.filter((id) => id !== wineId) }
          : s.id === toId
            ? { ...s, wineIds: [...s.wineIds, wineId] }
            : s,
      ),
    );
  }

  function addSection(sub: boolean) {
    setSections((p) => {
      const idx = targetSectionId ? p.findIndex((s) => s.id === targetSectionId) : -1;
      const parentLevel = idx >= 0 ? sectionLevel(p[idx]) : 1;
      const level = sub ? Math.min(parentLevel + 1, 5) : 1;
      const sec = {
        id: newId(),
        title: sub ? `Nova seção de ${level}º nível` : "Nova seção",
        wineIds: [] as string[],
        sub: level > 1,
        level,
      };
      setTimeout(() => setTargetSectionId(sec.id), 0);
      if (!sub || idx < 0) return [...p, sec];
      let end = idx + 1;
      while (end < p.length && sectionLevel(p[end]) > parentLevel) end++;
      return [...p.slice(0, end), sec, ...p.slice(end)];
    });
  }

  /** Promove (-1) ou rebaixa (+1) o nível hierárquico da seção. */
  function changeLevel(sectionId: string, dir: -1 | 1) {
    setSections((p) =>
      p.map((s) => {
        if (s.id !== sectionId) return s;
        const level = Math.min(Math.max(sectionLevel(s) + dir, 1), 5);
        return { ...s, level, sub: level > 1 };
      }),
    );
  }

  function updateHeading(sectionId: string, patch: Partial<SectionHeadingStyle>) {
    setSections((current) => current.map((section) => section.id === sectionId
      ? { ...section, headingStyle: { ...section.headingStyle, ...patch } }
      : section));
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

  async function save(asNew = false): Promise<boolean> {
    if (!restaurantId) return false;
    let name = listName.trim();
    if (!currentId || asNew || !name) {
      const suggested = asNew ? `${name || "Carta de Vinhos"} (cópia)` : name || "Carta de Vinhos";
      const typed = window.prompt("Dê um nome para esta carta:", suggested);
      if (typed === null) return false;
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
           priceCurrency,
          spacing,
          typography,
          layout,
          margins,
          customPaper: useCustomPaper ? { widthMm: customW, heightMm: customH, padMm: customPad } : null,
          customDesign: customDesign.exclusive ? { ...customDesign, requestId: customDesign.requestId ?? requestId } : null,
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
      return false;
    }
    toast.success(asNew ? "Carta duplicada." : "Carta salva.");
    queryClient.invalidateQueries({ queryKey: ["printed-wine-lists", restaurantId] });
    return true;
  }

  async function deliver() {
    if (!customDesign.exclusive) return toast.error("Ative o design exclusivo antes de disponibilizar.");
    const ok = await save(false);
    if (!ok) return;
    const { data } = await supabase
      .from("printed_wine_lists")
      .select("id")
      .eq("restaurant_id", restaurantId!)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    const rid = customDesign.requestId ?? requestId;
    if (rid && data) {
      const { error } = await supabase
        .from("custom_menu_requests")
        .update({ status: "delivered", delivered_list_id: data.id })
        .eq("id", rid);
      if (error) return toast.error(`Não foi possível disponibilizar: ${error.message}`);
    }
    toast.success("Carta disponibilizada! O restaurante já a encontra em Cartas salvas.");
  }

  function loadSaved(l: SavedList) {
    setCurrentId(l.id);
    setListName(l.name);
    setTemplate((l.template as TemplateKey) ?? "classic");
    setTitle(l.header_title ?? "");
    setSubtitle(l.header_subtitle ?? "");
    setFooter(l.footer_text ?? "");
    setFields(normalizeFields(l.visible_fields));
    setAddressPosition(l.visible_fields?.addressPosition === "footer" ? "footer" : "header");
    setPriceDecimals(l.visible_fields?.priceDecimals !== false);
    setPriceCurrency(l.visible_fields?.priceCurrency === true);
    setLogoUrl(l.logo_url ?? "");
    setCustomDesign(l.visible_fields?.customDesign ?? {});
    setAddress(l.address_text ?? "");
    setPaper((l.paper_size as PaperKey) ?? "a4");
    setSpacing({ ...DEFAULT_SPACING, ...(l.visible_fields?.spacing ?? {}) });
    setTypography({ ...(l.visible_fields?.typography ?? {}) });
    setLayout({ ...DEFAULT_LAYOUT, ...(l.visible_fields?.layout ?? {}) });
    const cp = l.visible_fields?.customPaper;
    setUseCustomPaper(!!cp);
    if (cp) {
      setCustomW(cp.widthMm);
      setCustomH(cp.heightMm);
      setCustomPad(cp.padMm ?? 12);
    }
    const fallbackMargin = cp?.padMm ?? paperOf(l.paper_size).padMm;
    setMargins({
      top: l.visible_fields?.margins?.top ?? fallbackMargin,
      right: l.visible_fields?.margins?.right ?? fallbackMargin,
      bottom: l.visible_fields?.margins?.bottom ?? fallbackMargin,
      left: l.visible_fields?.margins?.left ?? fallbackMargin,
    });
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
              <div className="relative">
                <button
                  onClick={() => setNewMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
                >
                  Nova carta <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {newMenuOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-card p-1 shadow-lg">
                    <button
                      onClick={() => {
                        setCurrentId(null);
                        setListName("");
                        setCustomDesign({});
                        setNewMenuOpen(false);
                        toast.info("Nova carta: ao salvar, você escolhe o nome.");
                      }}
                      className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-accent"
                    >
                      <b>Carta com modelo pronto</b>
                      <div className="text-[10px] text-muted-foreground">Clássico, Duas colunas, Minimalista, Casual, Moderno</div>
                    </button>
                    <button
                      onClick={() => {
                        setNewMenuOpen(false);
                        setRequestOpen(true);
                      }}
                      className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-accent"
                    >
                      <b className="text-primary">Carta personalizada ✦</b>
                      <div className="text-[10px] text-muted-foreground">Nossa equipe desenha uma carta exclusiva</div>
                    </button>
                  </div>
                )}
              </div>
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
                              <div className="text-xs">
                                {l.name}
                                {l.visible_fields?.customDesign?.exclusive ? (
                                  <span className="ml-1.5 rounded bg-primary/15 px-1 text-[9px] font-bold uppercase text-primary">Exclusiva</span>
                                ) : null}
                              </div>
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

        {requestOpen && restaurantId && (
          <CustomMenuRequestDialog restaurantId={restaurantId} onClose={() => setRequestOpen(false)} />
        )}
        {isAdmin && restaurantId && (
          <CustomDesignPanel
            value={customDesign}
            onChange={setCustomDesign}
            restaurantId={restaurantId}
            onDeliver={deliver}
            canDeliver={!!(customDesign.requestId ?? requestId)}
          />
        )}

        {/* Modelos */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  setCustomOpen(false);
                  setMargins({ top: p.padMm, right: p.padMm, bottom: p.padMm, left: p.padMm });
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
            <div className="relative" data-custom-dropdown>
              <button
                onClick={() => {
                  setUseCustomPaper(true);
                  setCustomOpen((v) => !v);
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  useCustomPaper ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">Personalizado</div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${customOpen ? "rotate-180" : ""}`} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Você define as medidas</div>
              </button>
              {customOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
                  <div className="grid gap-3">
                    <MmField label="Largura (mm)" value={customW} onChange={setCustomW} min={60} max={420} />
                    <MmField label="Altura (mm)" value={customH} onChange={setCustomH} min={80} max={594} />
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                    Exemplos: 100 × 210 mm (folha estreita), 150 × 300 mm (carta alta). 10 mm = 1 cm.
                  </p>
                </div>
              )}
            </div>
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
            <div className="mt-4 grid grid-cols-2 gap-2">
            {fields.price ? (
              <div className="relative" data-price-format-dropdown>
                <button
                  onClick={() => setPriceFormatOpen((v) => !v)}
                  aria-expanded={priceFormatOpen}
                  className={`inline-flex h-9 w-full items-center justify-between gap-1.5 rounded border px-2.5 text-[10px] uppercase tracking-wide transition-colors hover:bg-accent ${
                    priceFormatOpen ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  Formato do preço
                  <ChevronDown className={`h-3 w-3 transition-transform ${priceFormatOpen ? "rotate-180" : ""}`} />
                </button>
                {priceFormatOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
                    <CompactChoice
                      label="Casas decimais"
                      value={priceDecimals ? "with" : "without"}
                      options={[{ value: "with", label: "Com centavos" }, { value: "without", label: "Sem centavos" }]}
                      onChange={(value) => setPriceDecimals(value === "with")}
                    />
                    <div className="mt-3">
                      <CompactChoice
                        label="Símbolo da moeda"
                        value={priceCurrency ? "with" : "without"}
                        options={[{ value: "with", label: "Com R$" }, { value: "without", label: "Sem R$" }]}
                        onChange={(value) => setPriceCurrency(value === "with")}
                      />
                    </div>
                    <p className="mt-3 text-[10px] text-muted-foreground">
                      Exemplo: {priceCurrency ? "R$ " : ""}{priceDecimals ? "120,00" : "120"}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
            <div className="relative" data-spacing-dropdown>
              <button
                onClick={() => setSpacingOpen((v) => !v)}
                aria-expanded={spacingOpen}
                className={`inline-flex h-9 w-full items-center justify-between gap-1.5 rounded border px-2.5 text-[10px] uppercase tracking-wide transition-colors hover:bg-accent ${
                  spacingOpen ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                }`}
              >
                Espaçamento
                <ChevronDown className={`h-3 w-3 transition-transform ${spacingOpen ? "rotate-180" : ""}`} />
              </button>
              {spacingOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-border bg-card p-3 shadow-lg">
                  <div className="grid gap-4">
                    <SpaceStepper
                      label="Do rótulo para a linha de baixo"
                      value={spacing.nameGap}
                      onChange={(v) => setSpacing((s) => ({ ...s, nameGap: v }))}
                    />
                    <SpaceStepper
                      label="Entre as linhas de informação"
                      value={spacing.lineGap}
                      onChange={(v) => setSpacing((s) => ({ ...s, lineGap: v }))}
                    />
                    <SpaceStepper
                      label="Entre um rótulo e o próximo"
                      value={spacing.itemGap}
                      max={24}
                      onChange={(v) => setSpacing((s) => ({ ...s, itemGap: v }))}
                    />
                    <button
                      onClick={() => setSpacing(DEFAULT_SPACING)}
                      className="justify-self-start inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                    >
                      <RotateCcw className="h-3 w-3" /> Voltar ao padrão
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative" data-font-dropdown>
              <button
                onClick={() => setFontOpen((v) => !v)}
                aria-expanded={fontOpen}
                className={`inline-flex h-9 w-full items-center justify-between gap-1.5 rounded border px-2.5 text-[10px] uppercase tracking-wide transition-colors hover:bg-accent ${
                  fontOpen ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                }`}
              >
                Fontes e tamanhos
                <ChevronDown className={`h-3 w-3 transition-transform ${fontOpen ? "rotate-180" : ""}`} />
              </button>
              {fontOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-border bg-card p-3 shadow-lg">
                  <div className="grid gap-4">
                    <FontControl
                      label="Nome do rótulo"
                      font={typography.nameFont}
                      size={typography.nameSize}
                      defaultSize={11}
                      onFont={(f) => setTypography((t) => ({ ...t, nameFont: f }))}
                      onSize={(s) => setTypography((t) => ({ ...t, nameSize: s }))}
                    />
                    <FontControl
                      label="Seções de 1º nível"
                      font={typography.sectionFont}
                      size={typography.sectionSize}
                      defaultSize={12}
                      onFont={(f) => setTypography((t) => ({ ...t, sectionFont: f }))}
                      onSize={(s) => setTypography((t) => ({ ...t, sectionSize: s }))}
                    />
                    <FontControl
                      label="Subseções (2º nível e seguintes)"
                      font={typography.subSectionFont}
                      size={typography.subSectionSize}
                      defaultSize={9.5}
                      onFont={(f) => setTypography((t) => ({ ...t, subSectionFont: f }))}
                      onSize={(s) => setTypography((t) => ({ ...t, subSectionSize: s }))}
                    />

                    <FontControl
                      label="Informações do rótulo"
                      font={typography.metaFont}
                      size={typography.metaSize}
                      defaultSize={9}
                      onFont={(f) => setTypography((t) => ({ ...t, metaFont: f }))}
                      onSize={(s) => setTypography((t) => ({ ...t, metaSize: s }))}
                    />
                    <FontControl
                      label="Preço"
                      font={typography.priceFont}
                      size={typography.priceSize}
                      defaultSize={11}
                      onFont={(f) => setTypography((t) => ({ ...t, priceFont: f }))}
                      onSize={(s) => setTypography((t) => ({ ...t, priceSize: s }))}
                    />
                    <button
                      onClick={() => setTypography({})}
                      className="justify-self-start inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                    >
                      <RotateCcw className="h-3 w-3" /> Usar fontes do modelo
                    </button>
                  </div>
                </div>
              )}
            </div>
              <div className="relative" data-layout-dropdown>
                <button
                  onClick={() => setLayoutOpen((v) => !v)}
                  aria-expanded={layoutOpen}
                  className={`inline-flex h-9 w-full items-center justify-between gap-1.5 rounded border px-2.5 text-[10px] uppercase tracking-wide transition-colors hover:bg-accent ${
                    layoutOpen ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  Alinhamento e preço
                  <ChevronDown className={`h-3 w-3 transition-transform ${layoutOpen ? "rotate-180" : ""}`} />
                </button>
                {layoutOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
                    <AlignChoice
                      label="Cabeçalho (título e subtítulo)"
                      value={layout.headerAlign}
                      onChange={(value) => setLayout((current) => ({ ...current, headerAlign: value }))}
                    />
                    <div className="mt-3">
                      <AlignChoice
                        label="Tipo de vinho"
                        value={layout.sectionAlign}
                        onChange={(value) => setLayout((current) => ({ ...current, sectionAlign: value }))}
                      />
                    </div>
                    <div className="mt-3">
                      <AlignChoice
                        label="Nome do rótulo"
                        value={layout.itemAlign}
                        onChange={(value) => setLayout((current) => ({ ...current, itemAlign: value }))}
                      />
                    </div>
                    <div className="mt-3">
                      <CompactChoice
                        label="Preço em relação ao rótulo"
                        value={layout.pricePosition}
                        options={[{ value: "near", label: "Próximo" }, { value: "far", label: "Distante" }]}
                        onChange={(value) => setLayout((current) => ({ ...current, pricePosition: value as MenuLayout["pricePosition"] }))}
                      />
                    </div>
                    <button
                      onClick={() => setLayout(DEFAULT_LAYOUT)}
                      className="mt-3 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                    >
                      <RotateCcw className="h-3 w-3" /> Voltar ao padrão
                    </button>
                  </div>
                )}
              </div>
              <div className="relative" data-margins-dropdown>
                <button
                  onClick={() => setMarginsOpen((v) => !v)}
                  aria-expanded={marginsOpen}
                  className={`inline-flex h-9 w-full items-center justify-between gap-1.5 rounded border px-2.5 text-[10px] uppercase tracking-wide transition-colors hover:bg-accent ${
                    marginsOpen ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  Margens da página
                  <ChevronDown className={`h-3 w-3 transition-transform ${marginsOpen ? "rotate-180" : ""}`} />
                </button>
                {marginsOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <MmField label="Acima (mm)" value={margins.top} onChange={(top) => setMargins((m) => ({ ...m, top }))} min={0} max={60} />
                      <MmField label="Abaixo (mm)" value={margins.bottom} onChange={(bottom) => setMargins((m) => ({ ...m, bottom }))} min={0} max={60} />
                      <MmField label="Esquerda (mm)" value={margins.left} onChange={(left) => setMargins((m) => ({ ...m, left }))} min={0} max={60} />
                      <MmField label="Direita (mm)" value={margins.right} onChange={(right) => setMargins((m) => ({ ...m, right }))} min={0} max={60} />
                    </div>
                    <button
                      onClick={() => setMargins({ top: activePaper.padMm, right: activePaper.padMm, bottom: activePaper.padMm, left: activePaper.padMm })}
                      className="mt-3 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                    >
                      <RotateCcw className="h-3 w-3" /> Usar margem do papel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>


          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Seções ({totalItems} rótulos)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addSection(false)}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-3 w-3" /> Seção
                </button>
                <button
                  onClick={() => addSection(true)}
                  title="Cria uma seção do nível seguinte dentro da seção selecionada"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-3 w-3" /> Subseção
                </button>
                <div className="inline-flex overflow-hidden rounded border border-border text-[10px] uppercase" title="Classificar vinhos por">
                  {(["type", "style"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => regroup(m)}
                      className={`px-2 py-1 ${groupMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                    >
                      {m === "type" ? "Por tipo" : "Por estilo"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => regroup(groupMode)}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                >
                  <RotateCcw className="h-3 w-3" /> Reagrupar
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {sections.map((sec, si) => {
                const lvl = sectionLevel(sec);
                return (
                <div
                  key={sec.id}
                  onClick={() => setTargetSectionId(sec.id)}
                  style={{ marginLeft: `${(lvl - 1) * 1.5}rem` }}
                  className={`rounded-lg border bg-background p-3 ${targetSectionId === sec.id ? "border-primary" : "border-border"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-[10px] uppercase text-muted-foreground">
                      {lvl > 1 ? "↳ " : ""}{lvl}º nível
                    </span>
                    <input
                      value={sec.title}
                      onChange={(e) =>
                        setSections((p) => p.map((s) => (s.id === sec.id ? { ...s, title: e.target.value } : s)))
                      }
                      className="flex-1 rounded border border-input bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
                    />
                    <Button
                      type="button"
                      variant={headingEditorId === sec.id ? "secondary" : "outline"}
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Personalizar título desta seção"
                      aria-label={`Personalizar título de ${sec.title}`}
                      aria-expanded={headingEditorId === sec.id}
                      onClick={(e) => { e.stopPropagation(); setHeadingEditorId(headingEditorId === sec.id ? null : sec.id); }}
                    ><Type className="h-4 w-4" /></Button>
                    <IconBtn onClick={() => changeLevel(sec.id, -1)} title="Subir um nível">
                      <span className="text-[10px] font-bold">←</span>
                    </IconBtn>
                    <IconBtn onClick={() => changeLevel(sec.id, 1)} title="Descer um nível">
                      <span className="text-[10px] font-bold">→</span>
                    </IconBtn>
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

                  {headingEditorId === sec.id && (
                    <SectionHeadingControls
                      value={sec.headingStyle ?? {}}
                      onChange={(patch) => updateHeading(sec.id, patch)}
                      onReset={() => setSections((current) => current.map((s) => s.id === sec.id ? { ...s, headingStyle: undefined } : s))}
                    />
                  )}

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
                              {sections.length > 1 && (
                                <select
                                  value={sec.id}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => moveWineTo(sec.id, id, e.target.value)}
                                  title="Mover para outra seção"
                                  className="max-w-[7rem] rounded border border-input bg-card px-1 py-0.5 text-[10px]"
                                >
                                  {sections.map((s2) => (
                                    <option key={s2.id} value={s2.id}>
                                      {sectionOptionLabel(s2)}
                                    </option>
                                  ))}
                                </select>
                              )}
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
                );
              })}
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
            <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              Incluir em:
              <select
                value={targetExists ? targetSectionId! : ""}
                onChange={(e) => setTargetSectionId(e.target.value || null)}
                className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="">Automático (pelo tipo/estilo)</option>
                {sections.map((s2) => (
                  <option key={s2.id} value={s2.id}>
                    {sectionOptionLabel(s2)}
                  </option>
                ))}
              </select>
            </label>
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
                    onClick={() => addWine(w.id, targetExists ? targetSectionId : undefined)}
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
          <div className="no-print mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>Pré-visualização · {activePaper.code} ({activePaper.dims})</span>
            <div className="flex items-center gap-1 rounded border border-border bg-card p-1 tracking-normal">
              <IconBtn onClick={() => setPreviewZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))} title="Diminuir página">
                <ZoomOut className="h-3.5 w-3.5" />
              </IconBtn>
              <button
                onClick={() => setPreviewZoom(1)}
                className="min-w-12 px-1 text-center text-[10px] tabular-nums text-primary"
                title="Voltar ao tamanho de 100%"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <IconBtn onClick={() => setPreviewZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(1))))} title="Aumentar página">
                <ZoomIn className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-neutral-200 p-4 print:border-0 print:bg-white print:p-0">
            <div className="menu-preview-zoom" style={{ zoom: previewZoom }}>
              <MenuPreview
              customDesign={customDesign}
              template={template}
              paper={paper}
              paperDef={activePaper}
              spacing={spacing}
              typography={typography}
              layout={layout}
              margins={margins}
              logoUrl={logoUrl}
              address={address}
              addressPosition={addressPosition}
              title={title}
              subtitle={subtitle}
              footer={footer}
              fields={fields}
              priceDecimals={priceDecimals}
              priceCurrency={priceCurrency}
              sections={sections}
              winesById={winesById}
              />
            </div>
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

function SpaceStepper({
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
  const step = 0.5;
  const dec = () => onChange(Math.max(0, Number((value - step).toFixed(1))));
  const inc = () => onChange(Math.min(max, Number((value + step).toFixed(1))));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-primary">{value}pt</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={dec}
          title="Diminuir"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={inc}
          title="Aumentar"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FontControl({
  label,
  font,
  size,
  defaultSize,
  onFont,
  onSize,
}: {
  label: string;
  font?: (typeof FONT_LIST)[number]["key"];
  size?: number;
  defaultSize: number;
  onFont: (f: (typeof FONT_LIST)[number]["key"] | undefined) => void;
  onSize: (s: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <select
          value={font ?? ""}
          onChange={(e) => onFont((e.target.value || undefined) as never)}
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        >
          <option value="">Fonte do modelo</option>
          {FONT_LIST.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={6}
          max={40}
          step={0.5}
          value={size ?? defaultSize}
          onChange={(e) => onSize(Number(e.target.value))}
          className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-xs tabular-nums"
        />
        <span className="text-[10px] text-muted-foreground">pt</span>
      </div>
    </div>
  );
}

function CompactChoice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded border px-2 py-1.5 text-[10px] uppercase tracking-wide ${
              value === option.value ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlignChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MenuLayout["headerAlign"];
  onChange: (value: MenuLayout["headerAlign"]) => void;
}) {
  const options = [
    { value: "left", icon: AlignLeft, title: "Esquerda" },
    { value: "center", icon: AlignCenter, title: "Centro" },
    { value: "right", icon: AlignRight, title: "Direita" },
  ] as const;
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              title={option.title}
              className={`inline-flex h-8 flex-1 items-center justify-center rounded border transition-colors ${
                value === option.value
                  ? "border-primary bg-accent text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
