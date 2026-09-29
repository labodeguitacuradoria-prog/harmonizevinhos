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

/** Sequência final de folhas. Converte a capa antiga e garante uma folha de rótulos. */
export function resolveSheets(cd: CustomDesign | null | undefined): MenuSheet[] {
  let list: MenuSheet[] = cd?.sheets?.length ? [...cd.sheets] : [];
  if (!cd?.sheets?.length && (cd?.coverImage || cd?.coverText)) {
    list.push({ id: "legacy-cover", kind: "extra", title: "", text: cd.coverText ?? "", image: cd.coverImage ?? "" });
  }
  if (!list.some((s) => s.kind === "wines")) list.push({ id: "wines", kind: "wines" });
  list = list.filter((s, i) => s.kind !== "wines" || list.findIndex((x) => x.kind === "wines") === i);
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
  customDesign,
}: Props) {
  const cd = customDesign?.exclusive ? customDesign : null;
  const t = TEMPLATES[template];
  const p = paperDef ?? paperOf(paper);
  const twoCols = t.columns === 2 && p.widthMm >= 148;

  const cleaned = sections.map((s) => ({ ...s, wineIds: s.wineIds.filter((id) => winesById[id]) }));
  const visibleSections = cleaned.filter((s, i) => {
    // No editor exclusivo, seções vazias também podem ser títulos editoriais.
    if (customDesign?.exclusive && s.title.trim()) return true;
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

  const sheets = cd ? resolveSheets(cd) : [{ id: "wines", kind: "wines" as const }];
  const extraPage = (s: MenuSheet, isLast: boolean) => {
    const lines = (s.text ?? "").split("\n");
    const onlyImage = s.image && !s.title?.trim() && !s.text?.trim();
    return (
      <div
        key={s.id}
        className={`printed-page relative flex flex-col items-center justify-center overflow-hidden ${t.page}`}
        style={{
          width: `${p.widthMm}mm`, maxWidth: "100%", minHeight: `${p.heightMm}mm`,
          background: cd?.bgColor || "#fff", color: cd?.textColor || "#000",
          padding: onlyImage ? 0 : `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
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

  const winesIndex = sheets.findIndex((s) => s.kind === "wines");
  return (
    <div id="print-area" className="printed-menu mx-auto flex w-full flex-col gap-4 print:gap-0" style={{ maxWidth: `${p.widthMm}mm` }}>
      {/* Define o tamanho da folha na impressão de acordo com a escolha do usuário */}
      <style>{`@media print { @page { size: ${p.cssSize}; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; } }`}</style>
      {sheets.slice(0, winesIndex).map((s) => extraPage(s, false))}
      <div
        className={`printed-page ${cd ? "" : "bg-white text-black"} ${t.page}`}
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
          padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
          minHeight: `${p.heightMm}mm`,
          width: `${p.widthMm}mm`,
          maxWidth: "100%",
          breakAfter: winesIndex < sheets.length - 1 ? "page" : "auto",
        }}
      >
        <header className={`${t.key === "minimal" ? "mb-10" : "mb-8"} ${textAlign[layout.headerAlign]}`}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={title ? `Logo ${title}` : "Logo do restaurante"}
              className={`mb-4 h-[18mm] w-auto object-contain ${logoPosClass}`}
            />
          ) : null}
          {title ? <h1 className={t.headerTitle} style={cd?.accentColor ? { color: cd.accentColor } : undefined}>{title}</h1> : null}
          {subtitle ? <div className={t.headerSubtitle}>{subtitle}</div> : null}
          {addressInHeader ? (
            <div className="mt-2 whitespace-pre-line text-[8pt] leading-snug text-black/70">
              {address}
            </div>
          ) : null}
          {t.key === "classic" ? (
            <div className={`mt-4 h-px w-24 bg-black/70 ${rulePosClass}`} />
          ) : null}
        </header>

        <div className={twoCols ? "[column-count:2] [column-gap:10mm]" : ""}>
          {visibleSections.map((sec) => {
            const lvl = sectionLevel(sec);
            const isSub = lvl > 1;
            const heading = sec.headingStyle;
            const headingColor = heading?.color && /^#[0-9a-fA-F]{6}$/.test(heading.color) ? heading.color : cd?.accentColor;
            const framed = heading?.frame && heading.frame !== "none";
            return (
            <section
              key={sec.id}
              className={`${isSub ? "mb-4 mt-[-6px]" : "mb-6"} break-inside-avoid`}
              style={isSub ? { marginLeft: `${(lvl - 2) * 4}mm` } : undefined}
            >
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
                  // A caixa preenchida usa o fundo da própria carta como cor de texto.
                  ...(heading?.frame === "filled" ? { color: cd?.bgColor || "#fff" } : {}),
                  overflowWrap: "anywhere",
                }}
              >
                {heading?.accent === "star" ? "✦ " : heading?.accent === "diamond" ? "◆ " : heading?.accent === "dash" ? "— " : ""}{sec.title}{heading?.accent === "star" ? " ✦" : heading?.accent === "diamond" ? " ◆" : heading?.accent === "dash" ? " —" : ""}
              </div>

              <ul className="mt-2.5 flex flex-col" style={{ gap: `${spacing.itemGap}pt` }}>
                {sec.wineIds.map((id) => {
                  const w = winesById[id];
                  const firstLine = wineMetaFirstLine(w, fields);
                  const grapeLine = wineMetaGrapeLine(w, fields);
                  return (
                    <li key={id} className="break-inside-avoid">
                      <div
                        className={`relative flex items-baseline gap-2 ${justifyAlign[layout.itemAlign]} ${textAlign[layout.itemAlign]}`}
                      >
                        <span className={`${t.itemName} ${layout.itemAlign === "center" ? "max-w-[78%]" : ""}`} style={nameStyle}>
                          {fields.code && w.internal_code ? (
                            <span className="mr-2 tabular-nums opacity-70">{w.internal_code}</span>
                          ) : null}
                          {w.name}
                        </span>
                        {layout.pricePosition === "far" && t.dotted && fields.price ? (
                          <span className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-black/50" />
                        ) : layout.pricePosition === "far" && (layout.itemAlign === "left" || layout.itemAlign === "right") ? (
                          <span className="flex-1" />
                        ) : null}
                        {fields.price && w.sale_price != null ? (
                          <span
                            className={`${t.itemPrice} ${
                              layout.pricePosition === "far" && layout.itemAlign === "center" ? "absolute right-0" : ""
                            }`}
                            style={priceStyle}
                          >
                            {formatPrice(w.sale_price, priceDecimals, priceCurrency)}
                          </span>
                        ) : null}
                      </div>
                      {firstLine ? (
                        <div
                          className={`${t.itemMeta} ${textAlign[layout.itemAlign]}`}
                          style={{ ...metaStyle, marginTop: `${spacing.nameGap}pt` }}
                        >
                          {firstLine}
                        </div>
                      ) : null}
                      {grapeLine ? (
                        <div
                          className={`${t.itemMeta} ${textAlign[layout.itemAlign]}`}
                          style={{ ...metaStyle, marginTop: `${firstLine ? spacing.lineGap : spacing.nameGap}pt` }}
                        >
                          {grapeLine}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
            );
          })}

          {visibleSections.length === 0 ? (
            <div className="py-20 text-center text-[10pt] text-black/50">
              Nenhum rótulo selecionado para esta carta.
            </div>
          ) : null}
        </div>

        {footer || addressInFooter ? (
          <footer className="mt-10 border-t border-black/30 pt-3 text-center text-black/70">
            {addressInFooter ? (
              <div className="whitespace-pre-line text-[8pt] leading-snug">{address}</div>
            ) : null}
            {footer ? (
              <div className="mt-1 text-[8pt] uppercase tracking-[0.2em]">{footer}</div>
            ) : null}
          </footer>
        ) : null}
      </div>
      {sheets.slice(winesIndex + 1).map((s, i, arr) => extraPage(s, i === arr.length - 1))}
    </div>
  );
}
