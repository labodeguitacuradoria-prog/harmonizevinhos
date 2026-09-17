import { Grape, Hammer, MapPin, BookOpen, Sparkles, Utensils, MessageSquareQuote, AlertTriangle, Wine as WineIcon } from "lucide-react";

export type StoryCardData = {
  name: string;
  style?: string | null;
  wine_type?: string | null;
  country?: string | null;
  producer?: string | null;
  vintage?: number | null;
  volume?: string | null;
  image_url?: string | null;
  sale_price?: number | null;
  grapes_line?: string | null;
  making_line?: string | null;
  origin_story?: string | null;
  name_meaning?: string | null;
  mouthfeel?: string | null;
  pairings?: string[] | null;
  sales_pitch?: string | null;
  fun_fact?: string | null;
  do_not_confuse?: string | null;
};

const money = (v?: number | null) =>
  typeof v === "number" && v > 0
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

function Block({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
        {icon}
        {title}
      </div>
      <div className="mt-1.5 text-sm leading-snug text-foreground">{children}</div>
    </section>
  );
}

/** Ficha rápida de um rótulo, pensada para uma tela de celular. */
export default function StoryCard({ card }: { card: StoryCardData }) {
  const price = money(card.sale_price);
  const meta = [card.producer, card.vintage ? String(card.vintage) : null, card.volume]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-2.5">
      <header className="rounded-xl border border-border bg-card p-3">
        <div className="flex gap-3">
          <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            {card.image_url ? (
              <img src={card.image_url} alt={card.name} className="h-full w-full object-contain" />
            ) : (
              <WineIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">
              {card.name}
            </h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {card.style || card.wine_type ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                  {card.style || card.wine_type}
                </span>
              ) : null}
              {card.country ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {card.country}
                </span>
              ) : null}
            </div>
            {meta ? <div className="mt-1 text-[11px] text-muted-foreground">{meta}</div> : null}
            {price ? (
              <div className="mt-1.5 text-lg font-bold text-primary">{price}</div>
            ) : null}
          </div>
        </div>
      </header>

      <Block icon={<Grape className="h-3.5 w-3.5" />} title="Uvas">
        {card.grapes_line}
      </Block>
      <Block icon={<Hammer className="h-3.5 w-3.5" />} title="Como é feito">
        {card.making_line}
      </Block>
      <Block icon={<MapPin className="h-3.5 w-3.5" />} title="De onde vem">
        {card.origin_story}
      </Block>
      <Block icon={<BookOpen className="h-3.5 w-3.5" />} title="Por que esse nome">
        {card.name_meaning}
      </Block>
      <Block icon={<Sparkles className="h-3.5 w-3.5" />} title="Como é na boca">
        {card.mouthfeel}
      </Block>
      {card.pairings?.length ? (
        <Block icon={<Utensils className="h-3.5 w-3.5" />} title="Combina com">
          <ul className="list-inside list-disc space-y-0.5">
            {card.pairings.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Block>
      ) : null}
      <Block icon={<MessageSquareQuote className="h-3.5 w-3.5" />} title="Fale assim na mesa">
        <span className="italic">“{card.sales_pitch}”</span>
      </Block>
      <Block icon={<Sparkles className="h-3.5 w-3.5" />} title="Curiosidade">
        {card.fun_fact}
      </Block>
      <Block icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Não confunda">
        {card.do_not_confuse}
      </Block>
    </div>
  );
}
