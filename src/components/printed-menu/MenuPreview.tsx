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

export type CustomDesign = {
  exclusive?: boolean;
  requestId?: string | null;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  backgroundImage?: string;
  coverImage?: string;
  coverText?: string;
};

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

  const visibleSections = sections
    .map((s) => ({ ...s, wineIds: s.wineIds.filter((id) => winesById[id]) }))
    .filter((s) => s.wineIds.length > 0);

  const nameStyle = {
    fontFamily: fontCss(typography.nameFont),
    fontSize: typography.nameSize ? `${typography.nameSize}pt` : undefined,
  };
  const sectionStyle = {
    fontFamily: fontCss(typography.sectionFont),
    fontSize: typography.sectionSize ? `${typography.sectionSize}pt` : undefined,
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

  return (
    <div id="print-area" className="printed-menu mx-auto w-full" style={{ maxWidth: `${p.widthMm}mm` }}>
      {/* Define o tamanho da folha na impressão de acordo com a escolha do usuário */}
      <style>{`@media print { @page { size: ${p.cssSize}; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; } }`}</style>
      {cd?.coverImage || cd?.coverText ? (
        <div
          className="printed-page relative flex items-center justify-center overflow-hidden"
          style={{
            width: `${p.widthMm}mm`, maxWidth: "100%", minHeight: `${p.heightMm}mm`,
            background: cd.bgColor || "#fff", color: cd.textColor || "#000",
            breakAfter: "page",
          }}
        >
          {cd.coverImage ? <img src={cd.coverImage} alt="Capa" className="absolute inset-0 h-full w-full object-cover" /> : null}
          {cd.coverText ? (
            <div className="relative whitespace-pre-line px-[15mm] text-center text-[22pt] uppercase tracking-[0.2em]" style={{ color: cd.accentColor || undefined }}>
              {cd.coverText}
            </div>
          ) : null}
        </div>
      ) : null}
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
          {visibleSections.map((sec) => (
            <section key={sec.id} className="mb-6 break-inside-avoid">
              <div
                className={`${t.sectionTitle} ${t.rule} pb-1 ${textAlign[layout.sectionAlign]}`}
                style={{ ...sectionStyle, ...(cd?.accentColor ? { color: cd.accentColor, borderColor: cd.accentColor } : {}) }}
              >
                {sec.title}
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
          ))}
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
    </div>
  );
}
