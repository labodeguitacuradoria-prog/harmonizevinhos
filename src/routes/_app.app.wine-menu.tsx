import { MenuGuidedTour } from "@/components/printed-menu/MenuGuidedTour";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Printer,
  Info,
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
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { MenuPreview, resolveSheets } from "@/components/printed-menu/MenuPreview";
import { SectionHeadingControls } from "@/components/printed-menu/SectionHeadingControls";
import { MenuHelpDialog } from "@/components/printed-menu/MenuHelpDialog";
import { MediaUploader } from "@/components/MediaUploader";
import ModuleGate from "@/components/ModuleGate";
import type { CustomDesign } from "@/components/printed-menu/MenuPreview";
import { Button } from "@/components/ui/button";
import { MenuBackgroundControls } from "@/components/printed-menu/MenuBackgroundControls";
import { CustomMenuRequestDialog, CustomDesignPanel, SheetSequencer } from "@/components/printed-menu/CustomMenu";
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
  type MenuWineSymbol,
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
    wineSymbols?: Record<string, MenuWineSymbol>;
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
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState("");
  const [editingPrice, setEditingPrice] = useState("");
  const [editingSymbolUrl, setEditingSymbolUrl] = useState<string | null>(null);
  const [editingSymbolPosition, setEditingSymbolPosition] = useState<"left" | "right">("left");
  const [savedOpen, setSavedOpen] = useState(false);
  const [editorPanel, setEditorPanel] = useState<"exclusive" | "model" | "paper" | "header" | "background" | null>(null);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [marginsOpen, setMarginsOpen] = useState(false);
  const [marginsPage, setMarginsPage] = useState<string>("all");
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
    const priceRaw = editingPrice.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const price = priceRaw === "" ? null : Number(priceRaw);
    if (!name) return;
    if (price !== null && !Number.isFinite(price)) {
      toast.error("Informe um preço válido.");
      return;
    }
    setWineSymbols((current) => {
      const next = { ...current };
      if (editingSymbolUrl?.trim()) {
        next[id] = { url: editingSymbolUrl.trim(), position: editingSymbolPosition };
      } else {
        delete next[id];
      }
      return next;
    });
    setEditingWineId(null);
    const patch: { name: string; sale_price?: number } = { name };
    if (price !== null) patch.sale_price = price;
    const { error } = await supabase.from("wines").update(patch).eq("id", id);
    if (error) {
      toast.error("Não foi possível salvar o rótulo.");
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

  /** Cartas exclusivas só ficam visíveis ao cliente depois de disponibilizadas. */
  const { data: deliveredIds = [] } = useQuery({
    queryKey: ["custom-menu-delivered", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_menu_requests")
        .select("delivered_list_id")
        .eq("restaurant_id", restaurantId!)
        .eq("status", "delivered");
      if (error) throw error;
      return (data ?? []).map((r) => r.delivered_list_id).filter(Boolean) as string[];
    },
  });

  const visibleLists = useMemo(
    () =>
      isAdmin
        ? savedLists
        : savedLists.filter((l) => !l.visible_fields?.customDesign?.exclusive || deliveredIds.includes(l.id)),
    [isAdmin, savedLists, deliveredIds],
  );

  /** Na carta exclusiva o cliente mexe só em rótulos e preços; o layout é do administrador. */
  const lockedDesign = !isAdmin && !!customDesign.exclusive;
  const focusMode = isAdmin && !!customDesign.exclusive;
  const [focusIndex, setFocusIndex] = useState(0);

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
  const [wineSymbols, setWineSymbols] = useState<Record<string, MenuWineSymbol>>({});
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
          customDesign: customDesign.exclusive || customDesign.bgColor || customDesign.sheets?.length
            ? { ...customDesign, sheets: resolveSheets(customDesign, sections), requestId: customDesign.requestId ?? requestId }
            : null,
          wineSymbols,
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
    setWineSymbols(l.visible_fields?.wineSymbols ?? {});
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

  const [printTipOpen, setPrintTipOpen] = useState(false);

  const previewSheets = resolveSheets(customDesign, sections);
  const safeFocus = Math.min(focusIndex, Math.max(0, previewSheets.length - 1));
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
              <MenuHelpDialog />
              <MenuGuidedTour />
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
                        setWineSymbols({});
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
                data-tour="save"
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
                data-tour="print"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:opacity-90"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPrintTipOpen((v) => !v)}
                  className="inline-flex items-center justify-center rounded-md border border-border p-2 text-muted-foreground hover:bg-accent"
                  aria-label="Dica de impressão"
                  title="Dica de impressão"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
                {printTipOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground shadow-lg">
                    Ao imprimir no Chrome ou Edge, marque <b>“Gráficos de segundo plano”</b> em Mais configurações.
                    A data e o endereço do navegador <b>não</b> aparecem no PDF: a página já é preparada sem as margens
                    do navegador. Não é preciso desmarcar “Cabeçalhos e rodapés”.
                  </div>
                )}
              </div>


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
                    {visibleLists.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">
                        Nenhuma carta salva ainda.
                      </p>
                    ) : (
                      <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {visibleLists.map((l) => (
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
        {lockedDesign && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Esta é uma <b className="text-primary">carta exclusiva</b>: o layout é mantido pela nossa equipe. Aqui você
            adiciona ou retira rótulos, ajusta os preços, salva e imprime.
          </div>
        )}

      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* Painel de montagem */}
        <div className={`no-print space-y-5 no-scrollbar ${focusMode ? "lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1" : ""}`}>
          {isAdmin && restaurantId ? (
            <CustomDesignPanel
              value={customDesign}
              onChange={setCustomDesign}
              restaurantId={restaurantId}
              onDeliver={deliver}
              canDeliver={!!(customDesign.requestId ?? requestId)}
              expanded={editorPanel === "exclusive"}
              onExpandedChange={() => setEditorPanel((current) => current === "exclusive" ? null : "exclusive")}
              requestId={customDesign.requestId ?? requestId}
              sections={sections}
            />
          ) : null}

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Button variant="ghost" className="h-10 w-full justify-between rounded-none px-3 text-xs uppercase"
              aria-expanded={editorPanel === "background"}
              onClick={() => setEditorPanel((current) => current === "background" ? null : "background")}>
              Fundo da carta <ChevronDown className={editorPanel === "background" ? "rotate-180" : ""} />
            </Button>
            {editorPanel === "background" && <div className="border-t border-border p-3"><MenuBackgroundControls value={customDesign} onChange={setCustomDesign} /></div>}
          </div>

          {!lockedDesign && (
          <div className="space-y-2">
            <div data-tour="template" className="overflow-hidden rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setEditorPanel((current) => current === "model" ? null : "model")}
                className={`grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 text-left text-[11px] font-bold uppercase tracking-wider ${editorPanel === "model" ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent"}`}
                aria-expanded={editorPanel === "model"}
              >
                <span className="truncate">Modelo · {TEMPLATE_LIST.find((item) => item.key === template)?.label}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${editorPanel === "model" ? "rotate-180" : ""}`} />
              </button>
              {editorPanel === "model" ? (
                <div className="grid gap-1 border-t border-border p-2">
                  {TEMPLATE_LIST.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { setTemplate(item.key); setEditorPanel(null); }}
                      className={`rounded-md border px-3 py-2 text-left ${template === item.key ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"}`}
                    >
                      <span className="block text-xs font-bold text-primary">{item.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{item.desc}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setEditorPanel((current) => current === "paper" ? null : "paper")}
                className={`grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 text-left text-[11px] font-bold uppercase tracking-wider ${editorPanel === "paper" ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent"}`}
                aria-expanded={editorPanel === "paper"}
              >
                <span className="truncate">Papel · {activePaper.code} ({activePaper.dims})</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${editorPanel === "paper" ? "rotate-180" : ""}`} />
              </button>
              {editorPanel === "paper" ? (
                <div className="grid gap-1 border-t border-border p-2">
                  {PAPER_LIST.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setPaper(item.key);
                        setUseCustomPaper(false);
                        setMargins({ top: item.padMm, right: item.padMm, bottom: item.padMm, left: item.padMm });
                        setEditorPanel(null);
                      }}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 text-left ${!useCustomPaper && paper === item.key ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"}`}
                    >
                      <span className="text-xs font-bold text-primary">{item.code}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{item.dims}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setUseCustomPaper(true)}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 text-left ${useCustomPaper ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"}`}
                  >
                    <span className="text-xs font-bold text-primary">Personalizado</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">Definir medidas</span>
                  </button>
                  {useCustomPaper ? (
                    <div className="mt-1 grid grid-cols-2 gap-3 rounded-md border border-border bg-background p-3">
                      <MmField label="Largura (mm)" value={customW} onChange={setCustomW} min={60} max={420} />
                      <MmField label="Altura (mm)" value={customH} onChange={setCustomH} min={80} max={594} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setEditorPanel((current) => current === "header" ? null : "header")}
                className={`grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 text-left text-[11px] font-bold uppercase tracking-wider ${editorPanel === "header" ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent"}`}
                aria-expanded={editorPanel === "header"}
              >
                <span className="truncate">Cabeçalho e rodapé</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${editorPanel === "header" ? "rotate-180" : ""}`} />
              </button>
              {editorPanel === "header" ? (
              <div className="grid gap-3 border-t border-border p-3">
              <Field label="Nome desta carta (uso interno)" value={listName} onChange={setListName} />
              <Field label="Título impresso" value={title} onChange={setTitle} placeholder="Nome do restaurante" />
              <Field label="Subtítulo" value={subtitle} onChange={setSubtitle} placeholder="Carta de Vinhos" />
              <Field
                label="Rodapé"
                value={footer}
                onChange={setFooter}
                placeholder="Preços em reais          Atualizada em ..."
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Use espaços entre as expressões para afastá-las e alinhá-las no rodapé.
              </p>
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
              ) : null}
            </div>
          </div>
          )}

          {!lockedDesign && (
          <SheetSequencer
            value={customDesign}
            onChange={setCustomDesign}
            restaurantId={restaurantId ?? "restaurant"}
            sections={sections}
          />
          )}

          {!lockedDesign && (
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
{(() => {
                      const sheetList = resolveSheets(customDesign, sections);
                      const sel = sheetList.find((x) => x.id === marginsPage);
                      const cur = sel ? sel.margins ?? margins : margins;
                      const setCur = (patch: Partial<PageMargins>) => {
                        if (!sel) return setMargins((m) => ({ ...m, ...patch }));
                        const next = sheetList.map((x) => (x.id === sel.id ? { ...x, margins: { ...(x.margins ?? margins), ...patch } } : x));
                        setCustomDesign((d) => ({ ...d, sheets: next }));
                      };
                      const clearOwn = () => {
                        if (!sel) return;
                        setCustomDesign((d) => ({ ...d, sheets: sheetList.map((x) => (x.id === sel.id ? { ...x, margins: undefined } : x)) }));
                      };
                      return (
                        <>
                          {sheetList.length > 1 && (
                            <label className="mb-3 grid gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                              Página
                              <select
                                value={sel ? sel.id : "all"}
                                onChange={(e) => setMarginsPage(e.target.value)}
                                className="h-8 rounded border border-border bg-background px-2 text-xs normal-case text-foreground"
                              >
                                <option value="all">Todas as páginas (padrão)</option>
                                {sheetList.map((x, i) => (
                                  <option key={x.id} value={x.id}>
                                    {i + 1}. {x.kind === "wines" ? "Carta com os rótulos" : x.name?.trim() || x.title?.trim() || `Folha ${i + 1}`}
                                    {x.margins ? " •" : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <MmField label="Acima (mm)" value={cur.top} onChange={(top) => setCur({ top })} min={0} max={60} />
                            <MmField label="Abaixo (mm)" value={cur.bottom} onChange={(bottom) => setCur({ bottom })} min={0} max={60} />
                            <MmField label="Esquerda (mm)" value={cur.left} onChange={(left) => setCur({ left })} min={0} max={60} />
                            <MmField label="Direita (mm)" value={cur.right} onChange={(right) => setCur({ right })} min={0} max={60} />
                          </div>
                          {sel ? (
                            <button
                              onClick={clearOwn}
                              disabled={!sel.margins}
                              className="mt-3 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent disabled:opacity-40"
                            >
                              <RotateCcw className="h-3 w-3" /> Usar margens gerais
                            </button>
                          ) : (
                            <button
                              onClick={() => setMargins({ top: activePaper.padMm, right: activePaper.padMm, bottom: activePaper.padMm, left: activePaper.padMm })}
                              className="mt-3 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                            >
                              <RotateCcw className="h-3 w-3" /> Usar margem do papel
                            </button>
                          )}
                          {sheetList.length > 1 && (
                            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">Páginas marcadas com • têm margens próprias.</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}


          <div data-tour="sections" className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Seções ({totalItems} rótulos)
              </div>
              {!lockedDesign && (
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
              )}
            </div>

            {sections.length > 1 && (
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCollapsedIds(new Set(sections.map((s) => s.id)))}
                  className="rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                >Recolher tudo</button>
                <button
                  type="button"
                  onClick={() => setCollapsedIds(new Set())}
                  className="rounded border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-accent"
                >Expandir tudo</button>
              </div>
            )}
            <div className="mt-3 space-y-3">
              {(() => {
                const hidden = new Set<string>();
                let hideBelow: number | null = null;
                sections.forEach((s) => {
                  const l = sectionLevel(s);
                  if (hideBelow !== null && l > hideBelow) { hidden.add(s.id); return; }
                  hideBelow = collapsedIds.has(s.id) ? l : null;
                });
                return sections.map((sec, si) => ({ sec, si, hide: hidden.has(sec.id) }));
              })().map(({ sec, si, hide }) => {
                if (hide) return null;
                const lvl = sectionLevel(sec);
                const collapsed = collapsedIds.has(sec.id);
                const next = sections[si + 1];
                const childCount = (() => {
                  let n = 0;
                  for (let k = si + 1; k < sections.length && sectionLevel(sections[k]) > lvl; k++) n++;
                  return n;
                })();
                const hasContent = childCount > 0 || sec.wineIds.length > 0;
                void next;
                return (
                <div
                  key={sec.id}
                  onClick={() => setTargetSectionId(sec.id)}
                  style={{ marginLeft: `${(lvl - 1) * 1.5}rem` }}
                  className={`min-w-0 rounded-lg border bg-background p-3 ${targetSectionId === sec.id ? "border-primary" : "border-border"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!hasContent}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollapsedIds((p) => {
                          const n = new Set(p);
                          if (n.has(sec.id)) n.delete(sec.id); else n.add(sec.id);
                          return n;
                        });
                      }}
                      title={collapsed ? "Expandir" : "Recolher"}
                      aria-expanded={!collapsed}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-primary hover:bg-accent disabled:opacity-30"
                    >
                      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <span className="whitespace-nowrap text-[10px] uppercase text-muted-foreground">
                      {lvl > 1 ? "↳ " : ""}{lvl}º nível
                      {collapsed && hasContent && (
                        <span className="ml-1 normal-case text-primary">
                          ({sec.wineIds.length} rót.{childCount ? ` · ${childCount} subseç.` : ""})
                        </span>
                      )}
                    </span>
                    {lockedDesign ? (
                      <span className="min-w-[10rem] flex-1 truncate text-xs font-semibold uppercase tracking-wide text-primary">
                        {sec.title || "(sem título)"}
                      </span>
                    ) : (
                      <input
                        value={sec.title}
                        onChange={(e) =>
                          setSections((p) => p.map((s) => (s.id === sec.id ? { ...s, title: e.target.value } : s)))
                        }
                        className="min-w-[10rem] flex-1 rounded border border-input bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
                      />
                    )}
                    {!lockedDesign && (
                    <>
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
                    </>
                    )}
                  </div>

                  {!lockedDesign && headingEditorId === sec.id && (
                    <SectionHeadingControls
                      value={sec.headingStyle ?? {}}
                      onChange={(patch) => updateHeading(sec.id, patch)}
                      onReset={() => setSections((current) => current.map((s) => s.id === sec.id ? { ...s, headingStyle: undefined } : s))}
                    />
                  )}

                  <ul className={`mt-2 space-y-1 ${collapsedIds.has(sec.id) ? "hidden" : ""}`}>
                    {sec.wineIds.map((id, wi) => {
                      const w = winesById[id];
                      if (!w) return null;
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-foreground hover:bg-accent"
                        >
                          {editingWineId === id ? (
                            <div className="min-w-0 flex-1 space-y-3 rounded-md border border-border bg-card p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  autoFocus
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveWineName(id);
                                    if (e.key === "Escape") setEditingWineId(null);
                                  }}
                                  className="min-w-44 flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                                />
                                <input
                                  value={editingPrice}
                                  onChange={(e) => setEditingPrice(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveWineName(id);
                                    if (e.key === "Escape") setEditingWineId(null);
                                  }}
                                  inputMode="decimal"
                                  title="Preço de venda"
                                  className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs"
                                />
                                <IconBtn onClick={() => saveWineName(id)} title="Salvar rótulo, preço e símbolo">
                                  <Check className="h-3 w-3" />
                                </IconBtn>
                                <IconBtn onClick={() => setEditingWineId(null)} title="Cancelar">
                                  <X className="h-3 w-3" />
                                </IconBtn>
                              </div>
                              <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                                <MediaUploader
                                  label="Símbolo ao lado do rótulo (opcional)"
                                  value={editingSymbolUrl}
                                  onChange={setEditingSymbolUrl}
                                  folder={`printed-menu-symbols/${restaurantId ?? "restaurant"}`}
                                  kind="image"
                                />
                                <div>
                                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Posição</div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={editingSymbolPosition === "left" ? "secondary" : "outline"}
                                      className="h-8 text-[10px] uppercase"
                                      onClick={() => setEditingSymbolPosition("left")}
                                    >Esquerda</Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={editingSymbolPosition === "right" ? "secondary" : "outline"}
                                      className="h-8 text-[10px] uppercase"
                                      onClick={() => setEditingSymbolPosition("right")}
                                    >Direita</Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1 truncate">
                                {wineSymbols[id]?.url && wineSymbols[id].position === "left" ? (
                                  <img src={wineSymbols[id].url} alt="" className="mr-1 inline-block h-4 w-4 object-contain align-[-3px]" />
                                ) : null}
                                {w.name}
                                {w.vintage ? ` ${w.vintage}` : ""}
                                {wineSymbols[id]?.url && wineSymbols[id].position === "right" ? (
                                  <img src={wineSymbols[id].url} alt="" className="ml-1 inline-block h-4 w-4 object-contain align-[-3px]" />
                                ) : null}
                                <span className="ml-1 text-muted-foreground">{w.volume ?? ""}</span>
                              </span>
                              <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                                {Number(w.sale_price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <IconBtn
                                onClick={() => {
                                  setEditingWineId(id);
                                  setEditingName(w.name ?? "");
                                  setEditingPrice(String(w.sale_price ?? ""));
                                   setEditingSymbolUrl(wineSymbols[id]?.url ?? null);
                                   setEditingSymbolPosition(wineSymbols[id]?.position ?? "left");
                                }}
                                title="Editar nome e preço do rótulo"
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
        <div className={`print-root ${focusMode ? "lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" : ""}`}>
          {focusMode ? (
            <div className="no-print mb-2 flex items-center gap-2 rounded-lg border border-border bg-card p-1.5">
              <IconBtn onClick={() => setFocusIndex(Math.max(0, safeFocus - 1))} title="Página anterior">
                <span className="px-1 text-sm">‹</span>
              </IconBtn>
              <select
                value={safeFocus}
                onChange={(e) => setFocusIndex(Number(e.target.value))}
                className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              >
                {previewSheets.map((sh, i) => (
                  <option key={sh.id} value={i}>
                    {i + 1}/{previewSheets.length} · {sh.name || sh.title || (sh.kind === "wines" ? "Carta com os rótulos" : "Folha extra")}
                  </option>
                ))}
              </select>
              <IconBtn onClick={() => setFocusIndex(Math.min(previewSheets.length - 1, safeFocus + 1))} title="Próxima página">
                <span className="px-1 text-sm">›</span>
              </IconBtn>
            </div>
          ) : null}
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
          <div data-tour="preview" className="overflow-x-auto rounded-xl border border-border bg-neutral-200 p-4 print:border-0 print:bg-white print:p-0">
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
              wineSymbols={wineSymbols}
              focusSheetId={focusMode ? previewSheets[safeFocus]?.id ?? null : null}
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
