import {
  DEFAULT_SPACING,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_LAYOUT,
  DEFAULT_PAGE_MARGINS,
  TEMPLATES,
  fontCss,
  formatPrice,
  paperOf,
  wineMetaFirstLine,
  wineMetaGrapeLine,
  sectionLevel,
  type MenuSection,
  type MenuSpacing,
  type MenuLayout,
  type PageMargins,
  type MenuTypography,
  type MenuWine,
  type MenuWineSymbol,
  type PaperDef,
  type PaperKey,
  type TemplateKey,
  type VisibleFields,
} from "./templates";

export type MenuSheet = {
  id: string;
  kind: "extra" | "wines";
  /** Nome interno da folha na lista do editor — nunca aparece na impressão. */
  name?: string;
  title?: string;
  text?: string;
  image?: string;
  /** Seções impressas nesta página de rótulos. Ausente em cartas antigas. */
  sectionIds?: string[];
  /** Margens próprias desta folha (mm); ausente = usa as margens gerais. */
  margins?: PageMargins;
};

export type CustomDesign = {
  exclusive?: boolean;
  requestId?: string | null;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  backgroundImage?: string;
  coverImage?: string;
  coverText?: string;
  sheets?: MenuSheet[];
};

/** Sequência final de folhas. Converte cartas antigas e distribui cada seção uma única vez. */
export function resolveSheets(cd: CustomDesign | null | undefined, sections: MenuSection[] = []): MenuSheet[] {
  let list: MenuSheet[] = cd?.sheets?.length ? [...cd.sheets] : [];
  if (!cd?.sheets?.length && (cd?.coverImage || cd?.coverText)) {
    list.push({ id: "legacy-cover", kind: "extra", title: "", text: cd.coverText ?? "", image: cd.coverImage ?? "" });
  }
  if (!list.some((s) => s.kind === "wines")) list.push({ id: "wines", kind: "wines" });
  const validIds = new Set(sections.map((section) => section.id));
  const claimed = new Set<string>();
  const wineIndexes = list.flatMap((sheet, index) => sheet.kind === "wines" ? [index] : []);
  const legacySinglePage = wineIndexes.length === 1 && list[wineIndexes[0]]?.sectionIds === undefined;
  list = list.map((sheet, index) => {
    if (sheet.kind !== "wines") return sheet;
    const requested = legacySinglePage && index === wineIndexes[0]
      ? sections.map((section) => section.id)
      : (sheet.sectionIds ?? []);
    const sectionIds = requested.filter((id) => validIds.has(id) && !claimed.has(id));
    sectionIds.forEach((id) => claimed.add(id));
    return { ...sheet, sectionIds };
  });
  const unassigned = sections.map((section) => section.id).filter((id) => !claimed.has(id));
  if (unassigned.length) {
    const firstWineIndex = list.findIndex((sheet) => sheet.kind === "wines");
    const firstWine = list[firstWineIndex];
    list[firstWineIndex] = { ...firstWine, sectionIds: [...(firstWine.sectionIds ?? []), ...unassigned] };
  }
  return list;
}

type Props = {
  customDesign?: CustomDesign | null;
  template: TemplateKey;
  paper: PaperKey;
  paperDef?: PaperDef;
  spacing?: MenuSpacing;
  layout?: MenuLayout;
  margins?: PageMargins;
  typography?: MenuTypography;
  title: string;
  subtitle: string;
  footer: string;
  logoUrl?: string;
  address?: string;
  addressPosition?: "header" | "footer";
  fields: VisibleFields;
  priceDecimals?: boolean;
  priceCurrency?: boolean;
  sections: MenuSection[];
  winesById: Record<string, MenuWine>;
  wineSymbols?: Record<string, MenuWineSymbol>;
  /** Quando definido, só esta folha aparece na tela (todas continuam na impressão). */
  focusSheetId?: string | null;
};

// Folha em branco, pronta para impressão. A área com id="print-area"
// é a única impressa (ver regras @media print em styles.css).
export function MenuPreview({
  template,
  paper,
  paperDef,
  spacing = DEFAULT_SPACING,
  layout = DEFAULT_LAYOUT,
  margins = DEFAULT_PAGE_MARGINS,
  typography = DEFAULT_TYPOGRAPHY,
  title,
  subtitle,
  footer,
  logoUrl,
  address,
  addressPosition = "header",
  fields,
  priceDecimals = true,
  priceCurrency = false,
  sections,
  winesById,
  wineSymbols = {},
  customDesign,
  focusSheetId,
}: Props) {
  const cd = customDesign?.exclusive ? customDesign : null;
  const t = TEMPLATES[template];
  const p = paperDef ?? paperOf(paper);
  const twoCols = t.columns === 2 && p.widthMm >= 148;

  const cleaned = sections.map((s) => ({ ...s, wineIds: s.wineIds.filter((id) => winesById[id]) }));
  const visibleSections = cleaned.filter((s, i) => {
    // Uma seção nomeada pode funcionar como título, mesmo antes de receber rótulos.
    if (s.title.trim()) return true;
    if (s.wineIds.length > 0) return true;
    const lvl = sectionLevel(s);
    // Cabeçalho pai continua visível quando alguma seção filha tem rótulos
    for (let j = i + 1; j < cleaned.length && sectionLevel(cleaned[j]) > lvl; j++) {
      if (cleaned[j].wineIds.length) return true;
    }
    return false;
  });


  const nameStyle = {
    fontFamily: fontCss(typography.nameFont),
    fontSize: typography.nameSize ? `${typography.nameSize}pt` : undefined,
  };
  const sectionStyle = {
    fontFamily: fontCss(typography.sectionFont),
    fontSize: typography.sectionSize ? `${typography.sectionSize}pt` : undefined,
  };
  /** Estilo dos títulos de 2º nível ou mais profundos. */
  const subSectionStyle = (level: number) => {
    const scale = Math.pow(0.92, Math.max(0, level - 2));
    const basePt = typography.subSectionSize ?? (typography.sectionSize ? typography.sectionSize * 0.8 : 9);
    return {
      fontFamily: fontCss(typography.subSectionFont) ?? fontCss(typography.sectionFont),
      fontSize: `${Number((basePt * scale).toFixed(2))}pt`,
    };
  };

  const metaStyle = {
    fontFamily: fontCss(typography.metaFont),
    fontSize: typography.metaSize ? `${typography.metaSize}pt` : undefined,
  };
  const priceStyle = {
    fontFamily: fontCss(typography.priceFont) ?? fontCss(typography.nameFont),
    fontSize: typography.priceSize
      ? `${typography.priceSize}pt`
      : typography.nameSize
        ? `${typography.nameSize}pt`
        : undefined,
  };

  const addressInHeader = !!address && addressPosition === "header";
  const addressInFooter = !!address && addressPosition === "footer";

  const textAlign = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  } as const;
  const justifyAlign = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  } as const;

  const logoPosClass =
    t.key === "minimal"
      ? ""
      : layout.headerAlign === "center"
        ? "mx-auto"
        : layout.headerAlign === "right"
          ? "ml-auto"
          : "";
  const rulePosClass =
    layout.headerAlign === "left" ? "" : layout.headerAlign === "right" ? "ml-auto" : "mx-auto";

  const sheets = resolveSheets(customDesign, cleaned);
  const extraPage = (s: MenuSheet, isLast: boolean) => {
    const lines = (s.text ?? "").split("\n");
    const onlyImage = s.image && !s.title?.trim() && !s.text?.trim();
    const m = s.margins ?? margins;
    return (
      <div
        key={s.id}
        className={`printed-page relative flex flex-col items-center justify-center overflow-hidden ${t.page}`}
        style={{
          width: `${p.widthMm}mm`, maxWidth: "100%", minHeight: `${p.heightMm}mm`,
          background: cd?.bgColor || "#fff", color: cd?.textColor || "#000",
          padding: onlyImage ? 0 : `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`,
          breakAfter: isLast ? "auto" : "page",
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
        }}
      >
        {s.image ? (
          <img
            src={s.image}
            alt={s.title || "Folha"}
            className={onlyImage ? "absolute inset-0 h-full w-full object-cover" : "mb-6 max-h-[45%] max-w-full object-contain"}
          />
        ) : null}
        {s.title?.trim() ? (
          <h2 className="relative mb-4 text-center text-[20pt] uppercase tracking-[0.18em]" style={{ color: cd?.accentColor || undefined }}>
            {s.title}
          </h2>
        ) : null}
        {s.text?.trim() ? (
          <div className="relative w-full max-w-[150mm] text-[11pt] leading-relaxed">
            {lines.map((l, i) => {
              const m = l.match(/^\s*[•\-*]\s+(.*)$/);
              if (m) return <div key={i} className="flex gap-2 pl-2"><span>•</span><span>{m[1]}</span></div>;
              return l.trim() ? <p key={i} className="mb-2 text-center whitespace-pre-line">{l}</p> : <div key={i} className="h-2" />;
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const winePage = (sheet: MenuSheet, isLast: boolean) => {
    const pageSections = visibleSections.filter((section) => sheet.sectionIds?.includes(section.id));
    const wm = sheet.margins ?? margins;
    return (
      <div
        key={sheet.id}
        className={`printed-page flex flex-col ${cd ? "" : "bg-white text-black"} ${t.page}`}
        style={{
          ...(cd
            ? {
                backgroundColor: cd.bgColor || "#fff",
                color: cd.textColor || "#000",
                backgroundImage: cd.backgroundImage ? `url(${cd.backgroundImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              }
            : {}),
          padding: `${wm.top}mm ${wm.right}mm ${wm.bottom}mm ${wm.left}mm`,
          minHeight: `${p.heightMm}mm`,
          width: `${p.widthMm}mm`,
          maxWidth: "100%",
          breakAfter: isLast ? "auto" : "page",
        }}
      >
        <header className={`${t.key === "minimal" ? "mb-10" : "mb-8"} ${textAlign[layout.headerAlign]}`}>
          {logoUrl ? (
            <img src={logoUrl} alt={title ? `Logo ${title}` : "Logo do restaurante"} className={`mb-4 h-[18mm] w-auto object-contain ${logoPosClass}`} />
          ) : null}
          {title ? <h1 className={`${t.headerTitle} whitespace-pre-wrap`} style={cd?.accentColor ? { color: cd.accentColor } : undefined}>{title}</h1> : null}
          {subtitle ? <div className={`${t.headerSubtitle} whitespace-pre-wrap`}>{subtitle}</div> : null}
          {addressInHeader ? <div className="mt-2 whitespace-pre-line text-[8pt] leading-snug text-black/70">{address}</div> : null}
          {t.key === "classic" ? <div className={`mt-4 h-px w-24 bg-black/70 ${rulePosClass}`} /> : null}
        </header>

        <div className={`flex-1 ${twoCols ? "[column-count:2] [column-gap:10mm]" : ""}`}>
          {pageSections.map((sec) => {
            const lvl = sectionLevel(sec);
            const isSub = lvl > 1;
            const heading = sec.headingStyle;
            const headingColor = heading?.color && /^#[0-9a-fA-F]{6}$/.test(heading.color) ? heading.color : cd?.accentColor;
            const framed = heading?.frame && heading.frame !== "none";
            const accentImage = heading?.accent === "image" ? heading.accentImageUrl?.trim() : undefined;
            const accentImageSize = Math.min(40, Math.max(6, heading?.accentImageSize ?? 16));
            const textAccent = heading?.accent === "star" ? "✦" : heading?.accent === "diamond" ? "◆" : heading?.accent === "dash" ? "—" : null;
            return (
              <section key={sec.id} className={`${isSub ? "mb-4 mt-[-6px]" : "mb-6"} break-inside-avoid`} style={isSub ? { marginLeft: `${(lvl - 2) * 4}mm` } : undefined}>
                <div
                  className={`${isSub ? "pb-0.5 font-semibold uppercase opacity-80" : `${t.sectionTitle} ${t.rule} pb-1`} ${textAlign[heading?.align ?? layout.sectionAlign]} ${heading?.underline ? "underline underline-offset-4" : ""} ${framed ? "w-full px-3 py-1.5" : ""}`}
                  style={{
                    ...(isSub ? subSectionStyle(lvl) : sectionStyle),
                    fontFamily: fontCss(heading?.font) ?? (isSub ? subSectionStyle(lvl).fontFamily : sectionStyle.fontFamily),
                    fontSize: heading?.size ? `${heading.size}pt` : (isSub ? subSectionStyle(lvl).fontSize : sectionStyle.fontSize),
                    color: headingColor,
                    borderColor: headingColor,
                    letterSpacing: heading?.letterSpacing != null ? `${heading.letterSpacing}pt` : undefined,
                    fontWeight: heading?.bold === true ? 700 : heading?.bold === false ? 400 : undefined,
                    border: framed ? `1px solid ${headingColor || "#000"}` : undefined,
                    backgroundColor: heading?.frame === "filled" ? (headingColor || "#000") : undefined,
                    ...(heading?.frame === "filled" ? { color: cd?.bgColor || "#fff" } : {}),
                    overflowWrap: "anywhere",
                  }}
                >
                  <span className={`inline-flex max-w-full items-center gap-2 ${justifyAlign[heading?.align ?? layout.sectionAlign]}`}>
                    {accentImage ? <img src={accentImage} alt="" className="shrink-0 object-contain" style={{ width: `${accentImageSize}pt`, height: `${accentImageSize}pt` }} /> : textAccent ? <span aria-hidden="true">{textAccent}</span> : null}
                    <span className="min-w-0">{sec.title}</span>
                    {accentImage ? <img src={accentImage} alt="" className="shrink-0 object-contain" style={{ width: `${accentImageSize}pt`, height: `${accentImageSize}pt` }} /> : textAccent ? <span aria-hidden="true">{textAccent}</span> : null}
                  </span>
                </div>
                <ul className="mt-2.5 flex flex-col" style={{ gap: `${spacing.itemGap}pt` }}>
                  {sec.wineIds.map((id) => {
                    const w = winesById[id];
                    const symbol = wineSymbols[id];
                    const firstLine = wineMetaFirstLine(w, fields);
                    const grapeLine = wineMetaGrapeLine(w, fields);
                    return (
                      <li key={id} className="break-inside-avoid">
                        <div className={`relative flex items-baseline gap-2 ${justifyAlign[layout.itemAlign]} ${textAlign[layout.itemAlign]}`}>
                          <span className={`${t.itemName} ${layout.itemAlign === "center" ? "max-w-[78%]" : ""}`} style={nameStyle}>
                            {symbol?.url && symbol.position === "left" ? <img src={symbol.url} alt="" className="mr-1 inline-block h-[1.15em] w-[1.15em] object-contain align-[-0.15em]" /> : null}
                            {fields.code && w.internal_code ? <span className="mr-2 tabular-nums opacity-70">{w.internal_code}</span> : null}
                            {w.name}
                            {symbol?.url && symbol.position === "right" ? <img src={symbol.url} alt="" className="ml-1 inline-block h-[1.15em] w-[1.15em] object-contain align-[-0.15em]" /> : null}
                          </span>
                          {layout.pricePosition === "far" && t.dotted && fields.price ? <span className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-black/50" /> : layout.pricePosition === "far" && (layout.itemAlign === "left" || layout.itemAlign === "right") ? <span className="flex-1" /> : null}
                          {fields.price && w.sale_price != null ? <span className={`${t.itemPrice} ${layout.pricePosition === "far" && layout.itemAlign === "center" ? "absolute right-0" : ""}`} style={priceStyle}>{formatPrice(w.sale_price, priceDecimals, priceCurrency)}</span> : null}
                        </div>
                        {firstLine ? <div className={`${t.itemMeta} ${textAlign[layout.itemAlign]}`} style={{ ...metaStyle, marginTop: `${spacing.nameGap}pt` }}>{firstLine}</div> : null}
                        {grapeLine ? <div className={`${t.itemMeta} ${textAlign[layout.itemAlign]}`} style={{ ...metaStyle, marginTop: `${firstLine ? spacing.lineGap : spacing.nameGap}pt` }}>{grapeLine}</div> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {pageSections.length === 0 ? <div className="py-20 text-center text-[10pt] text-black/50">Nenhuma seção escolhida para esta página.</div> : null}
        </div>
        {footer || addressInFooter ? (
          <footer className="mt-auto border-t border-black/30 pt-3 text-center text-black/70">
            {addressInFooter ? <div className="whitespace-pre-line text-[8pt] leading-snug">{address}</div> : null}
            {footer ? <div className="mt-1 w-full whitespace-break-spaces text-[8pt] uppercase tracking-[0.2em]">{footer}</div> : null}
          </footer>
        ) : null}
      </div>
    );
  };

  return (
    <div id="print-area" className="printed-menu mx-auto flex w-full flex-col gap-4 print:gap-0" style={{ maxWidth: `${p.widthMm}mm` }}>
      {/* Define o tamanho da folha na impressão de acordo com a escolha do usuário */}
      {/* margin: 0 na página elimina o carimbo do navegador (data e endereço)
          na impressão/PDF; as margens do usuário vêm do padding das folhas. */}
      <style>{`@media print { @page { size: ${p.cssSize}; margin: 0; } }`}</style>
      {(() => {
        const render = (list: MenuSheet[]) => list.map((sheet) => {
          const index = sheets.indexOf(sheet);
          return sheet.kind === "wines"
            ? winePage(sheet, index === sheets.length - 1)
            : extraPage(sheet, index === sheets.length - 1);
        });
        const focused = focusSheetId ? sheets.filter((s) => s.id === focusSheetId) : [];
        if (!focused.length) return render(sheets);
        return (
          <>
            <div className="flex flex-col gap-4 print:hidden">{render(focused)}</div>
            <div className="hidden print:block">{render(sheets)}</div>
          </>
        );
      })()}
    </div>
  );
}
