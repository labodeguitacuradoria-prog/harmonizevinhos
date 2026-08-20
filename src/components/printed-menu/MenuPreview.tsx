import {
  TEMPLATES,
  formatPrice,
  paperOf,
  wineMeta,
  type MenuSection,
  type MenuWine,
  type PaperKey,
  type TemplateKey,
  type VisibleFields,
} from "./templates";

type Props = {
  template: TemplateKey;
  paper: PaperKey;
  title: string;
  subtitle: string;
  footer: string;
  logoUrl?: string;
  address?: string;
  addressPosition?: "header" | "footer";
  fields: VisibleFields;
  sections: MenuSection[];
  winesById: Record<string, MenuWine>;
};

// Folha em branco, pronta para impressão. A área com id="print-area"
// é a única impressa (ver regras @media print em styles.css).
export function MenuPreview({
  template,
  paper,
  title,
  subtitle,
  footer,
  logoUrl,
  address,
  addressPosition = "header",
  fields,
  sections,
  winesById,
}: Props) {
  const t = TEMPLATES[template];
  const p = paperOf(paper);
  const twoCols = t.columns === 2 && p.widthMm >= 148;

  const visibleSections = sections
    .map((s) => ({ ...s, wineIds: s.wineIds.filter((id) => winesById[id]) }))
    .filter((s) => s.wineIds.length > 0);

  const addressInHeader = !!address && addressPosition === "header";
  const addressInFooter = !!address && addressPosition === "footer";

  return (
    <div id="print-area" className="printed-menu mx-auto w-full" style={{ maxWidth: `${p.widthMm}mm` }}>
      {/* Define o tamanho da folha na impressão de acordo com a escolha do usuário */}
      <style>{`@media print { @page { size: ${p.cssSize}; margin: ${p.padMm}mm; } }`}</style>
      <div
        className={`printed-page bg-white text-black ${t.page}`}
        style={{
          padding: `${p.padMm}mm`,
          minHeight: `${p.heightMm}mm`,
          width: `${p.widthMm}mm`,
          maxWidth: "100%",
        }}
      >
        <header className={t.key === "minimal" ? "mb-10" : "mb-8"}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={title ? `Logo ${title}` : "Logo do restaurante"}
              className={`mb-4 h-[18mm] w-auto object-contain ${
                t.key === "minimal" ? "" : "mx-auto"
              }`}
            />
          ) : null}
          <h1 className={t.headerTitle}>{title || "Carta de Vinhos"}</h1>
          {subtitle ? <div className={t.headerSubtitle}>{subtitle}</div> : null}
          {addressInHeader ? (
            <div
              className={`mt-2 whitespace-pre-line text-[8pt] leading-snug text-black/70 ${
                t.key === "minimal" ? "" : "text-center"
              }`}
            >
              {address}
            </div>
          ) : null}
          {t.key === "classic" ? <div className="mx-auto mt-4 h-px w-24 bg-black/70" /> : null}
        </header>

        <div className={twoCols ? "[column-count:2] [column-gap:10mm]" : ""}>
          {visibleSections.map((sec) => (
            <section key={sec.id} className="mb-6 break-inside-avoid">
              <div className={`${t.sectionTitle} ${t.rule} pb-1`}>{sec.title}</div>
              <ul className="mt-2.5 space-y-2">
                {sec.wineIds.map((id) => {
                  const w = winesById[id];
                  const meta = wineMeta(w, fields);
                  return (
                    <li key={id} className="break-inside-avoid">
                      <div className="flex items-baseline gap-2">
                        <span className={t.itemName}>{w.name}</span>
                        {t.dotted && fields.price ? (
                          <span className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-black/50" />
                        ) : (
                          <span className="flex-1" />
                        )}
                        {fields.price && w.sale_price != null ? (
                          <span className={t.itemPrice}>{formatPrice(w.sale_price)}</span>
                        ) : null}
                      </div>
                      {meta ? <div className={t.itemMeta}>{meta}</div> : null}
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
