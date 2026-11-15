import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { groupCards, type QuickCard } from "@/lib/quick-guide";

// Simulação do papel/tela do guia: fundo branco e tinta preta, como no PDF (não segue o tema escuro do app).
const PAPER = "#ffffff";
const INK = "rgb(25,25,25)";
const MUTED = "rgb(110,110,110)";
const LINE = "rgb(222,222,222)";
const rgb = (c: [number, number, number]) => `rgb(${c.join(",")})`;

function Label({ children }: { children: ReactNode }) {
  return <div style={{ color: MUTED, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}
function Block({ children, last }: { children: ReactNode; last?: boolean }) {
  return <div style={{ padding: "12px 0", borderBottom: last ? "none" : `1px solid ${LINE}` }}>{children}</div>;
}
function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {items.map((t) => (
        <span key={t} style={{ border: "1px solid rgb(160,160,160)", borderRadius: 999, padding: "3px 11px", fontSize: 15, color: INK }}>{t}</span>
      ))}
    </div>
  );
}
function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline" style={{ gap: 10, padding: "10px 0", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ width: 92, flexShrink: 0, color: MUTED, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{k}</div>
      <div style={{ fontSize: 16, color: INK, flex: 1 }}>{children}</div>
    </div>
  );
}

export function QuickGuideCardView({ card: c, photo, onBack }: { card: QuickCard; photo: string | null; onBack?: () => void }) {
  return (
    <article style={{ background: PAPER, color: INK, fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif', borderRadius: 14, overflow: "hidden" }}>
      <div className="flex items-center justify-between" style={{ background: rgb(c.band.bg), color: rgb(c.band.fg), padding: "10px 14px", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em" }}>{c.header}</span>
        {c.code && (
          <span style={{ background: "#fff", color: rgb(c.type === "sparkling" ? c.band.fg : c.band.bg), borderRadius: 999, padding: "2px 12px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>Nº {c.code}</span>
        )}
      </div>
      <div style={{ padding: "6px 16px 18px" }}>
        {onBack && (
          <button type="button" onClick={onBack} className="flex items-center" style={{ color: MUTED, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", padding: "8px 0" }}>
            <ChevronLeft size={16} /> ÍNDICE
          </button>
        )}
        <div className="flex" style={{ gap: 14, paddingTop: onBack ? 0 : 10 }}>
          <div className="flex items-center justify-center" style={{ width: 104, height: 200, flexShrink: 0 }}>
            {photo ? <img src={photo} alt={c.name} className="max-h-full max-w-full object-contain" loading="lazy" /> : <span style={{ fontSize: 12, color: MUTED }}>sem foto</span>}
          </div>
          <div className="min-w-0" style={{ paddingTop: 6 }}>
            {c.producer && <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>{c.producer}</div>}
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15, marginTop: 4 }}>{c.name}</div>
            {c.country && <div style={{ fontSize: 15.5, fontWeight: 600, marginTop: 10 }}>{c.country}</div>}
            {c.region && <div style={{ fontSize: 15, color: MUTED }}>{c.region}</div>}
            {c.price && <div style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>{c.price}</div>}
          </div>
        </div>
        <div style={{ marginTop: 10, borderTop: `1px solid ${LINE}` }}>
          {c.grapes && <Row k="Uvas">{c.grapes}</Row>}
          {c.body && (
            <Row k="Corpo">
              <span className="inline-flex items-center" style={{ gap: 5, marginRight: 10, verticalAlign: "middle" }}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <span key={k} style={{ width: 11, height: 11, borderRadius: 99, border: `1.5px solid ${INK}`, background: k < c.bodyDots ? INK : "transparent" }} />
                ))}
              </span>
              {c.body.toLowerCase()}
            </Row>
          )}
          {c.dosage && <Row k="Dosagem de açúcar"><b>{c.dosage}</b></Row>}
          {c.maturation && <Block><Label>Maturação</Label><div style={{ fontSize: 16, lineHeight: 1.4 }}>{c.maturation}</div></Block>}
          {c.visual.length > 0 && <Block><Label>Visual</Label><Pills items={c.visual} /></Block>}
          {c.nose.length > 0 && <Block><Label>Olfato</Label><Pills items={c.nose} /></Block>}
          {c.palate.length > 0 && <Block><Label>Paladar</Label><Pills items={c.palate} /></Block>}
          {c.dishes.length > 0 && (
            <Block last>
              <Label>Combina com</Label>
              <ul style={{ fontSize: 16, lineHeight: 1.45, paddingLeft: 18, listStyle: "disc" }}>{c.dishes.map((d) => <li key={d}>{d}</li>)}</ul>
            </Block>
          )}
        </div>
        {c.pitch && (
          <div style={{ border: `1.5px solid ${INK}`, borderRadius: 10, padding: "10px 14px", marginTop: 6 }}>
            <Label>Fale assim à mesa</Label>
            <div style={{ fontSize: 16.5, fontStyle: "italic", lineHeight: 1.4 }}>“{c.pitch}”</div>
          </div>
        )}
        {c.temp && (
          <div className="flex items-baseline justify-between" style={{ marginTop: 14 }}>
            <span style={{ color: MUTED, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em" }}>TEMPERATURA DE SERVIÇO</span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{c.temp}</span>
          </div>
        )}
      </div>
    </article>
  );
}

/** Índice por tipo + ficha aberta. Usado na tela do gestor (prévia) e no link da equipe. */
export function QuickGuideViewer({ cards, photoUrl, initialId }: { cards: QuickCard[]; photoUrl: (c: QuickCard) => string | null; initialId?: string }) {
  const [term, setTerm] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialId ?? null);
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return cards;
    return cards.filter((c) => [c.code, c.name, c.producer, c.grapes, c.country, c.region, ...c.dishes].join(" ").toLowerCase().includes(t));
  }, [cards, term]);
  const open = cards.find((c) => c.id === openId);

  if (open) return <QuickGuideCardView card={open} photo={open.hasPhoto ? photoUrl(open) : null} onBack={() => setOpenId(null)} />;

  return (
    <div style={{ background: PAPER, color: INK, borderRadius: 14, padding: "14px 14px 8px", fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif' }}>
      <div className="relative" style={{ marginBottom: 8 }}>
        <Search size={17} color={MUTED} className="absolute" style={{ left: 10, top: 11 }} />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Código, vinho, uva ou prato…"
          style={{ width: "100%", border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 10px 9px 34px", fontSize: 16, color: INK, background: PAPER }}
        />
      </div>
      {groupCards(filtered).map((g) => (
        <section key={g.type} style={{ marginTop: 10 }}>
          <div className="flex items-center" style={{ gap: 8, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", padding: "6px 0" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: rgb(g.cards[0].band.bg) }} />
            {g.label.toUpperCase()}
          </div>
          {g.cards.map((c) => (
            <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="flex w-full items-baseline text-left" style={{ gap: 10, padding: "11px 2px", borderBottom: `1px solid ${LINE}` }}>
              <span style={{ width: 44, flexShrink: 0, fontWeight: 700, fontSize: 15 }}>{c.code || "—"}</span>
              <span className="min-w-0 flex-1" style={{ fontSize: 15.5 }}>
                {c.name}
                {c.producer && <span style={{ color: MUTED, fontSize: 13 }}> · {c.producer}</span>}
              </span>
              {c.price && <span style={{ color: MUTED, fontSize: 13.5, whiteSpace: "nowrap" }}>{c.price}</span>}
            </button>
          ))}
        </section>
      ))}
      {!filtered.length && <p style={{ padding: 12, fontSize: 15, color: MUTED }}>Nenhum vinho encontrado.</p>}
    </div>
  );
}
