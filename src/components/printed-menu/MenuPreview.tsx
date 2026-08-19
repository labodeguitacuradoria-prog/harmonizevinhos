import {
  TEMPLATES,
  formatPrice,
  wineMeta,
  type MenuSection,
  type MenuWine,
  type TemplateKey,
  type VisibleFields,
} from "./templates";

type Props = {
  template: TemplateKey;
  title: string;
  subtitle: string;
  footer: string;
  fields: VisibleFields;
  sections: MenuSection[];
  winesById: Record<string, MenuWine>;
};

// Folha A4 em branco, pronta para impressão. A área com id="print-area"
// é a única impressa (ver regras @media print em styles.css).
export function MenuPreview({ template, title, subtitle, footer, fields, sections, winesById }: Props) {
  const t = TEMPLATES[template];

  const visibleSections = sections
    .map((s) => ({ ...s, wineIds: s.wineIds.filter((id) => winesById[id]) }))
    .filter((s) => s.wineIds.length > 0);

  return (
    <div id="print-area" className="printed-menu mx-auto w-full max-w-[210mm]">
      <div className={`printed-page bg-white px-[14mm] py-[14mm] text-black ${t.page}`}>
        <header className={t.key === "minimal" ? "mb-10" : "mb-8"}>
          <h1 className={t.headerTitle}>{title || "Carta de Vinhos"}</h1>
          {subtitle ? <div className={t.headerSubtitle}>{subtitle}</div> : null}
          {t.key === "classic" ? <div className="mx-auto mt-4 h-px w-24 bg-black/70" /> : null}
        </header>

        <div className={t.columns === 2 ? "[column-count:2] [column-gap:10mm]" : ""}>
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

        {footer ? (
          <footer className="mt-10 border-t border-black/30 pt-3 text-center text-[8pt] uppercase tracking-[0.2em] text-black/70">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
