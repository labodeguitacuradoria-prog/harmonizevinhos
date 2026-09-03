import { useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown, ClipboardCopy, TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle, Lightbulb, BarChart3, Calendar, CalendarRange } from "lucide-react";
import { targetsFor, type IndicatorKey } from "@/components/DashboardTargetsEditor";

type WineRow = {
  id: string;
  name: string;
  wine_type: string | null;
  volume: string | null;
  cost_price: number | null;
  sale_price: number | null;
  active_on_menu: boolean | null;
};

type Movement = {
  wine_id: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  occurred_at: string;
};

type CorkageRow = {
  reference_year: number;
  reference_month: number;
  quantity: number;
  total_amount: number;
};

type TargetRow = {
  id: string;
  indicator: string;
  reference_year: number;
  reference_month: number | null;
  target_value: number;
};

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const isGlassVol = (v: string | null | undefined) => !!v && /taça|taca|glass/i.test(v);
const fmtBRL = (n: number, d = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

type Status = "good" | "warn" | "bad" | "neutral";

const statusColor: Record<Status, string> = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-red-400",
  neutral: "text-muted-foreground",
};
const statusDot: Record<Status, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  neutral: "bg-muted-foreground",
};

function pctVar(curr: number, prev: number): { pct: number; status: Status; label: string } {
  if (prev === 0 && curr === 0) return { pct: 0, status: "neutral", label: "—" };
  if (prev === 0) return { pct: 100, status: "good", label: "novo período" };
  const pct = ((curr - prev) / prev) * 100;
  const status: Status = pct >= 2 ? "good" : pct <= -2 ? "bad" : "warn";
  const sign = pct >= 0 ? "+" : "";
  return { pct, status, label: `${sign}${pct.toFixed(1)}%` };
}

function VarBadge({ pct, label, status }: { pct: number; label: string; status: Status }) {
  const Icon = status === "good" ? TrendingUp : status === "bad" ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold ${statusColor[status]}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

function BulletRow({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 py-1 text-[12px] leading-snug text-foreground">
      <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[status]}`} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-[color:var(--surface-2)] p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
        {icon}
        {title}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

export default function SalesDiagnosticReport({
  open,
  onClose,
  wines,
  movements,
  corkage,
  stockMap,
  targets,
  currentYear,
  previousYear,
  currentMonth,
}: {
  open: boolean;
  onClose: () => void;
  wines: WineRow[];
  movements: Movement[];
  corkage: CorkageRow[];
  stockMap: Record<string, number>;
  targets: TargetRow[];
  currentYear: number;
  previousYear: number;
  currentMonth: number;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const diag = useMemo(() => {
    const wineById: Record<string, WineRow> = {};
    for (const w of wines) wineById[w.id] = w;

    // Find last month with any sale in current year
    const perMonth: Record<number, { bottles: number; glasses: number; rev: number; cost: number }> = {};
    for (let i = 0; i < 12; i++) perMonth[i] = { bottles: 0, glasses: 0, rev: 0, cost: 0 };
    const perMonthPrev = JSON.parse(JSON.stringify(perMonth)) as typeof perMonth;

    // Per-wine aggregates
    const perWineMonth: Record<string, { bottles: number; glasses: number; rev: number }> = {};
    const perWineYTD: Record<string, { bottles: number; glasses: number; rev: number }> = {};
    const perWinePrevYTD: Record<string, { bottles: number; glasses: number; rev: number }> = {};

    const perTypeMonth: Record<string, { units: number; rev: number }> = {};
    const perTypeYTD: Record<string, { units: number; rev: number }> = {};

    for (const m of movements) {
      const d = new Date(m.occurred_at);
      const y = d.getFullYear();
      const mo = d.getMonth();
      if (y !== currentYear && y !== previousYear) continue;
      const w = wineById[m.wine_id];
      const price = Number(m.unit_price ?? w?.sale_price ?? 0);
      const cost = (Number(m.unit_cost ?? 0) > 0 ? Number(m.unit_cost) : Number(w?.cost_price ?? 0) || 0);
      const q = m.quantity ?? 0;
      const rev = price * q;
      const isGlass = w && isGlassVol(w.volume);
      const bucket = y === currentYear ? perMonth[mo] : perMonthPrev[mo];
      bucket.rev += rev;
      bucket.cost += cost * q;
      if (isGlass) bucket.glasses += q;
      else bucket.bottles += q;
    }

    // Determine reference month = last month with sales in current year (else last month of prev year)
    let refMonth = -1;
    for (let i = Math.min(currentMonth, 11); i >= 0; i--) {
      const pm = perMonth[i];
      if (pm.bottles + pm.glasses + pm.rev > 0) { refMonth = i; break; }
    }
    const usingCurrentYearMonth = refMonth >= 0;
    if (refMonth < 0) {
      for (let i = 11; i >= 0; i--) {
        const pm = perMonthPrev[i];
        if (pm.bottles + pm.glasses + pm.rev > 0) { refMonth = i; break; }
      }
    }

    const monthYear = usingCurrentYearMonth ? currentYear : previousYear;
    const prevMonthIdx = refMonth > 0 ? refMonth - 1 : 11;
    const prevMonthYear = refMonth > 0 ? monthYear : monthYear - 1;

    // Month buckets
    const monthCurr = refMonth >= 0
      ? (usingCurrentYearMonth ? perMonth[refMonth] : perMonthPrev[refMonth])
      : { bottles: 0, glasses: 0, rev: 0, cost: 0 };
    const monthPrev = refMonth >= 0
      ? (prevMonthYear === currentYear ? perMonth[prevMonthIdx] : perMonthPrev[prevMonthIdx])
      : { bottles: 0, glasses: 0, rev: 0, cost: 0 };

    // Add corkage
    const corkMonth = { amt: 0, qty: 0 };
    const corkPrevMonth = { amt: 0, qty: 0 };
    const corkYTD = { amt: 0, qty: 0 };
    const corkPrevYTD = { amt: 0, qty: 0 };
    for (const c of corkage) {
      const mo = (c.reference_month || 1) - 1;
      if (c.reference_year === monthYear && mo === refMonth) {
        corkMonth.amt += Number(c.total_amount || 0);
        corkMonth.qty += Number(c.quantity || 0);
      }
      if (c.reference_year === prevMonthYear && mo === prevMonthIdx) {
        corkPrevMonth.amt += Number(c.total_amount || 0);
        corkPrevMonth.qty += Number(c.quantity || 0);
      }
      if (c.reference_year === currentYear && mo <= (usingCurrentYearMonth ? refMonth : 11)) {
        corkYTD.amt += Number(c.total_amount || 0);
        corkYTD.qty += Number(c.quantity || 0);
      }
      if (c.reference_year === previousYear && mo <= (usingCurrentYearMonth ? refMonth : 11)) {
        corkPrevYTD.amt += Number(c.total_amount || 0);
        corkPrevYTD.qty += Number(c.quantity || 0);
      }
    }

    // Per wine month + YTD (based on same monthYear + limit to refMonth)
    for (const m of movements) {
      const d = new Date(m.occurred_at);
      const y = d.getFullYear();
      const mo = d.getMonth();
      const w = wineById[m.wine_id];
      if (!w) continue;
      const price = Number(m.unit_price ?? w.sale_price ?? 0);
      const q = m.quantity ?? 0;
      const rev = price * q;
      const isGlass = isGlassVol(w.volume);
      const typeKey = (w.wine_type || "sem-tipo").toString();

      const addTo = (bag: typeof perWineMonth, id: string) => {
        if (!bag[id]) bag[id] = { bottles: 0, glasses: 0, rev: 0 };
        bag[id].rev += rev;
        if (isGlass) bag[id].glasses += q; else bag[id].bottles += q;
      };
      const addType = (bag: typeof perTypeMonth) => {
        if (!bag[typeKey]) bag[typeKey] = { units: 0, rev: 0 };
        bag[typeKey].units += q;
        bag[typeKey].rev += rev;
      };

      if (y === monthYear && mo === refMonth) {
        addTo(perWineMonth, w.id);
        addType(perTypeMonth);
      }
      if (y === currentYear && (usingCurrentYearMonth ? mo <= refMonth : true)) {
        addTo(perWineYTD, w.id);
        addType(perTypeYTD);
      }
      if (y === previousYear && (usingCurrentYearMonth ? mo <= refMonth : true)) {
        addTo(perWinePrevYTD, w.id);
      }
    }

    // YTD totals
    const ytdCurr = { bottles: 0, glasses: 0, rev: 0, cost: 0 };
    const ytdPrev = { bottles: 0, glasses: 0, rev: 0, cost: 0 };
    const upTo = usingCurrentYearMonth ? refMonth : 11;
    for (let i = 0; i <= upTo; i++) {
      ytdCurr.bottles += perMonth[i].bottles;
      ytdCurr.glasses += perMonth[i].glasses;
      ytdCurr.rev += perMonth[i].rev;
      ytdCurr.cost += perMonth[i].cost;
      ytdPrev.bottles += perMonthPrev[i].bottles;
      ytdPrev.glasses += perMonthPrev[i].glasses;
      ytdPrev.rev += perMonthPrev[i].rev;
      ytdPrev.cost += perMonthPrev[i].cost;
    }

    // Add corkage to totals for faturamento
    const monthRevTotal = monthCurr.rev + corkMonth.amt;
    const monthPrevRevTotal = monthPrev.rev + corkPrevMonth.amt;
    const ytdRevTotal = ytdCurr.rev + corkYTD.amt;
    const ytdPrevRevTotal = ytdPrev.rev + corkPrevYTD.amt;

    // CMV
    const cmvMonth = monthCurr.rev > 0 ? (monthCurr.cost / monthCurr.rev) * 100 : 0;
    const cmvYTD = ytdCurr.rev > 0 ? (ytdCurr.cost / ytdCurr.rev) * 100 : 0;

    // Ticket médio (por unidade vendida — vinhos)
    const unitsMonth = monthCurr.bottles + monthCurr.glasses;
    const unitsMonthPrev = monthPrev.bottles + monthPrev.glasses;
    const unitsYTD = ytdCurr.bottles + ytdCurr.glasses;
    const unitsYTDPrev = ytdPrev.bottles + ytdPrev.glasses;
    const ticketMonth = unitsMonth > 0 ? monthCurr.rev / unitsMonth : 0;
    const ticketYTD = unitsYTD > 0 ? ytdCurr.rev / unitsYTD : 0;

    // Representatividade taças
    const glassShareVolMonth = unitsMonth > 0 ? (monthCurr.glasses / unitsMonth) * 100 : 0;
    const glassShareVolYTD = unitsYTD > 0 ? (ytdCurr.glasses / unitsYTD) * 100 : 0;

    // Revenue by glass vs bottle needs approximation from perWine (already tracked)
    let revGlassMonth = 0, revBottleMonth = 0;
    for (const id in perWineMonth) {
      const w = wineById[id]; if (!w) continue;
      const bag = perWineMonth[id];
      const isG = isGlassVol(w.volume);
      // rev bag mixes; use bag.rev pro-rated by ratio of units in bag
      const tot = bag.bottles + bag.glasses;
      if (tot === 0) continue;
      if (isG) revGlassMonth += bag.rev; else revBottleMonth += bag.rev;
    }
    let revGlassYTD = 0, revBottleYTD = 0;
    for (const id in perWineYTD) {
      const w = wineById[id]; if (!w) continue;
      const bag = perWineYTD[id];
      if (isGlassVol(w.volume)) revGlassYTD += bag.rev; else revBottleYTD += bag.rev;
    }
    const glassShareRevMonth = monthCurr.rev > 0 ? (revGlassMonth / monthCurr.rev) * 100 : 0;
    const glassShareRevYTD = ytdCurr.rev > 0 ? (revGlassYTD / ytdCurr.rev) * 100 : 0;

    // Champions
    const topByRev = (bag: typeof perWineMonth) => {
      let bestId = ""; let best = 0;
      for (const id in bag) {
        if (bag[id].rev > best) { best = bag[id].rev; bestId = id; }
      }
      return { id: bestId, val: best };
    };
    const topByVol = (bag: typeof perWineMonth) => {
      let bestId = ""; let best = 0;
      for (const id in bag) {
        const u = bag[id].bottles + bag[id].glasses;
        if (u > best) { best = u; bestId = id; }
      }
      return { id: bestId, val: best };
    };
    const topTypeByVol = (bag: typeof perTypeMonth) => {
      let key = ""; let best = 0;
      for (const k in bag) {
        if (bag[k].units > best) { best = bag[k].units; key = k; }
      }
      return { key, val: best };
    };

    const champRevMonth = topByRev(perWineMonth);
    const champVolMonth = topByVol(perWineMonth);
    const champStyleMonth = topTypeByVol(perTypeMonth);
    const champRevYTD = topByRev(perWineYTD);
    const champVolYTD = topByVol(perWineYTD);
    const champStyleYTD = topTypeByVol(perTypeYTD);

    // Zero-sale wines (active on menu, YTD)
    const zeroSaleYTD = wines
      .filter((w) => w.active_on_menu !== false)
      .filter((w) => !perWineYTD[w.id] || (perWineYTD[w.id].bottles + perWineYTD[w.id].glasses) === 0)
      .map((w) => w.name);
    const zeroSaleMonth = wines
      .filter((w) => w.active_on_menu !== false)
      .filter((w) => !perWineMonth[w.id] || (perWineMonth[w.id].bottles + perWineMonth[w.id].glasses) === 0)
      .map((w) => w.name);

    // Faixa de preço com baixa adesão (5 faixas por preço de venda)
    const active = wines.filter((w) => w.active_on_menu !== false && !isGlassVol(w.volume) && (w.sale_price || 0) > 0);
    const prices = active.map((w) => Number(w.sale_price)).sort((a, b) => a - b);
    let priceBracketLow: string | null = null;
    if (prices.length >= 5) {
      const min = prices[0], max = prices[prices.length - 1];
      const step = (max - min) / 5 || 1;
      const brackets = Array.from({ length: 5 }, (_, i) => ({
        min: min + step * i,
        max: i === 4 ? max : min + step * (i + 1),
        units: 0,
        rev: 0,
      }));
      for (const w of active) {
        const p = Number(w.sale_price);
        let idx = Math.min(4, Math.floor((p - min) / step));
        if (idx < 0) idx = 0;
        const bag = perWineYTD[w.id];
        if (bag) {
          brackets[idx].units += bag.bottles + bag.glasses;
          brackets[idx].rev += bag.rev;
        }
      }
      // Bracket with lowest units
      let worst = brackets[0]; let worstIdx = 0;
      brackets.forEach((b, i) => { if (b.units < worst.units) { worst = b; worstIdx = i; } });
      priceBracketLow = `Faixa B${worstIdx + 1} (R$ ${fmtBRL(worst.min)}–${fmtBRL(worst.max)}): ${worst.units} un. no YTD`;
    }

    // Giro do estoque (YTD): unidades vendidas YTD / estoque atual + vendas YTD
    const stockUnits = Object.values(stockMap).reduce((a, b) => a + (Number(b) || 0), 0);
    const giroYTD = stockUnits > 0 ? ytdCurr.bottles / stockUnits : 0;
    const monthsElapsed = usingCurrentYearMonth ? (refMonth + 1) : 12;
    const giroAnualizado = giroYTD > 0 && monthsElapsed > 0 ? (giroYTD * 12) / monthsElapsed : 0;

    // Corkage trend
    const corkVarMonth = pctVar(corkMonth.amt, corkPrevMonth.amt);
    const corkVarYTD = pctVar(corkYTD.amt, corkPrevYTD.amt);

    // Targets: faturamento vs meta
    const revTargets = targetsFor(targets, "faturamento" as IndicatorKey);
    const targetMonth = revTargets.monthly[refMonth] || 0;
    let targetYTD = 0;
    if (revTargets.annual) {
      // Distribute annual pro-rata
      targetYTD = (revTargets.annual / 12) * (usingCurrentYearMonth ? refMonth + 1 : 12);
    } else {
      for (let i = 0; i <= (usingCurrentYearMonth ? refMonth : 11); i++) {
        targetYTD += revTargets.monthly[i] || 0;
      }
    }
    const metaMonthDiff = targetMonth > 0 ? ((monthRevTotal - targetMonth) / targetMonth) * 100 : null;
    const metaYTDDiff = targetYTD > 0 ? ((ytdRevTotal - targetYTD) / targetYTD) * 100 : null;

    return {
      refMonth, monthYear, prevMonthIdx, prevMonthYear, usingCurrentYearMonth,
      monthRevTotal, monthPrevRevTotal, ytdRevTotal, ytdPrevRevTotal,
      unitsMonth, unitsMonthPrev, unitsYTD, unitsYTDPrev,
      monthCurr, monthPrev, ytdCurr, ytdPrev,
      corkMonth, corkPrevMonth, corkYTD, corkPrevYTD,
      corkVarMonth, corkVarYTD,
      ticketMonth, ticketYTD,
      glassShareVolMonth, glassShareRevMonth, glassShareVolYTD, glassShareRevYTD,
      champRevMonth, champVolMonth, champStyleMonth, champRevYTD, champVolYTD, champStyleYTD,
      zeroSaleMonth, zeroSaleYTD,
      priceBracketLow, giroAnualizado, stockUnits,
      cmvMonth, cmvYTD,
      metaMonthDiff, metaYTDDiff, targetMonth, targetYTD,
      wineById,
    };
  }, [wines, movements, corkage, stockMap, targets, currentYear, previousYear, currentMonth]);

  if (!open) return null;

  const monthLabelStr = diag.refMonth >= 0
    ? `${MONTHS[diag.refMonth]}/${String(diag.monthYear).slice(-2)}`
    : "—";
  const prevMonthLabelStr = diag.refMonth >= 0
    ? `${MONTHS[diag.prevMonthIdx]}/${String(diag.prevMonthYear).slice(-2)}`
    : "—";

  const varRev = pctVar(diag.monthRevTotal, diag.monthPrevRevTotal);
  const varUnits = pctVar(diag.unitsMonth, diag.unitsMonthPrev);
  const varRevYTD = pctVar(diag.ytdRevTotal, diag.ytdPrevRevTotal);
  const varUnitsYTD = pctVar(diag.unitsYTD, diag.unitsYTDPrev);

  const cmvStatus = (v: number): Status => (v === 0 ? "neutral" : v <= 33 ? "good" : v <= 38 ? "warn" : "bad");

  const metaStatus = (d: number | null): Status =>
    d === null ? "neutral" : d >= 0 ? "good" : d <= -10 ? "bad" : "warn";
  const metaLabel = (d: number | null) =>
    d === null ? "sem meta" : `${d >= 0 ? "+" : ""}${d.toFixed(1)}% vs meta`;

  const nameOf = (id: string) => diag.wineById[id]?.name || "—";

  async function copySummary() {
    const lines: string[] = [];
    lines.push(`Diagnóstico de Vendas — ${monthLabelStr} / YTD ${currentYear}`);
    lines.push("");
    lines.push(`— Desempenho do Mês (${monthLabelStr} vs ${prevMonthLabelStr}) —`);
    lines.push(`• Faturamento: R$ ${fmtBRL(diag.monthRevTotal)} (${varRev.label})`);
    lines.push(`• Unidades vendidas: ${diag.unitsMonth} (garrafas ${diag.monthCurr.bottles} / taças ${diag.monthCurr.glasses}) — ${varUnits.label}`);
    lines.push(`• Ticket médio: R$ ${fmtBRL(diag.ticketMonth, 2)}`);
    lines.push(`• Taças: ${diag.glassShareVolMonth.toFixed(1)}% do volume / ${diag.glassShareRevMonth.toFixed(1)}% do faturamento`);
    lines.push(`• Estilo campeão: ${diag.champStyleMonth.key || "—"} (${diag.champStyleMonth.val} un.)`);
    lines.push(`• Rótulo campeão de faturamento: ${nameOf(diag.champRevMonth.id)} (R$ ${fmtBRL(diag.champRevMonth.val)})`);
    lines.push(`• Rótulo campeão de volume: ${nameOf(diag.champVolMonth.id)} (${diag.champVolMonth.val} un.)`);
    lines.push(`• CMV do mês: ${diag.cmvMonth.toFixed(1)}%`);
    lines.push(`• Taxa de rolha: R$ ${fmtBRL(diag.corkMonth.amt)} (${diag.corkVarMonth.label})`);
    lines.push(`• Meta: ${metaLabel(diag.metaMonthDiff)}`);
    lines.push(`• Rótulos sem venda no mês: ${diag.zeroSaleMonth.length}`);
    lines.push("");
    lines.push(`— Visão Acumulada (YTD ${currentYear}) —`);
    lines.push(`• Faturamento YTD: R$ ${fmtBRL(diag.ytdRevTotal)} (${varRevYTD.label} vs ${previousYear})`);
    lines.push(`• Unidades YTD: ${diag.unitsYTD} — ${varUnitsYTD.label} vs ${previousYear}`);
    lines.push(`• Ticket médio YTD: R$ ${fmtBRL(diag.ticketYTD, 2)}`);
    lines.push(`• Taças YTD: ${diag.glassShareVolYTD.toFixed(1)}% vol / ${diag.glassShareRevYTD.toFixed(1)}% fat.`);
    lines.push(`• Estilo campeão YTD: ${diag.champStyleYTD.key || "—"} (${diag.champStyleYTD.val} un.)`);
    lines.push(`• Rótulo campeão YTD (fat.): ${nameOf(diag.champRevYTD.id)} (R$ ${fmtBRL(diag.champRevYTD.val)})`);
    lines.push(`• Rótulo campeão YTD (vol.): ${nameOf(diag.champVolYTD.id)} (${diag.champVolYTD.val} un.)`);
    lines.push(`• CMV YTD: ${diag.cmvYTD.toFixed(1)}%`);
    lines.push(`• Taxa de rolha YTD: R$ ${fmtBRL(diag.corkYTD.amt)} (${diag.corkVarYTD.label})`);
    lines.push(`• Giro anualizado do estoque: ${diag.giroAnualizado.toFixed(2)}x`);
    lines.push(`• Meta YTD: ${metaLabel(diag.metaYTDDiff)}`);
    lines.push(`• Rótulos sem venda no YTD: ${diag.zeroSaleYTD.length}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  function exportPDF() {
    window.print();
  }

  // Recommendation heuristics
  const recMonth: string[] = [];
  if (diag.zeroSaleMonth.length >= 3) {
    recMonth.push(`Acionar giro dos ${diag.zeroSaleMonth.length} rótulos sem venda no mês (sugestões de sommelier, degustação, taça-do-dia).`);
  }
  if (diag.champStyleMonth.key) {
    recMonth.push(`Explorar o desempenho do estilo "${diag.champStyleMonth.key}" com destaque na carta e no salão.`);
  }
  if (diag.cmvMonth > 35) {
    recMonth.push(`CMV do mês em ${diag.cmvMonth.toFixed(1)}% acima do ideal (≤33%) — revisar precificação dos rótulos de maior giro.`);
  }
  if (varRev.status === "bad") {
    recMonth.push(`Queda de faturamento ${varRev.label} — programar ação comercial para o próximo mês.`);
  }
  if (recMonth.length === 0) recMonth.push("Indicadores do mês dentro do esperado — manter o plano atual.");

  const recYTD: string[] = [];
  if (diag.zeroSaleYTD.length >= 5) {
    recYTD.push(`Realizar ação para girar os ${diag.zeroSaleYTD.length} rótulos estagnados no ano (promoção, harmonização, degustação orientada).`);
  }
  if (diag.priceBracketLow) {
    recYTD.push(`Baixa adesão na ${diag.priceBracketLow.toLowerCase()} — revisar mix e comunicação.`);
  }
  if (diag.cmvYTD > 33) {
    recYTD.push(`CMV YTD em ${diag.cmvYTD.toFixed(1)}% — renegociar custos com fornecedores dos top-5 rótulos de volume.`);
  }
  if (diag.giroAnualizado > 0 && diag.giroAnualizado < 4) {
    recYTD.push(`Giro anualizado baixo (${diag.giroAnualizado.toFixed(2)}x) — reduzir compras dos rótulos de baixa saída.`);
  }
  if (diag.metaYTDDiff !== null && diag.metaYTDDiff < -5) {
    recYTD.push(`Faturamento YTD ${metaLabel(diag.metaYTDDiff).toLowerCase()} — recalibrar mix e ticket médio para recuperar.`);
  }
  if (recYTD.length === 0) recYTD.push("Ano dentro do plano — priorizar consistência dos estilos campeões.");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 sm:p-4 print:static print:bg-white print:p-0">
      <div
        className="relative max-h-[100dvh] w-full max-w-6xl overflow-y-auto no-scrollbar rounded-none border-0 bg-card p-4 sm:max-h-[90vh] sm:rounded-xl sm:border sm:border-border sm:p-6 print:max-h-none print:max-w-full print:overflow-visible print:rounded-none print:border-0 print:bg-white print:text-black"
        ref={printRef}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground print:hidden"
              aria-label="Voltar"
            >
              <ArrowLeft size={13} /> Voltar
            </button>
            <div className="min-w-0">
              <h2 className="page-title truncate text-base">Diagnóstico de vendas</h2>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Referência do mês: <span className="text-foreground">{monthLabelStr}</span> · YTD {currentYear}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 print:hidden">
            <button
              onClick={copySummary}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:border-primary"
            >
              <ClipboardCopy size={13} /> {copied ? "Copiado!" : "Copiar Resumo"}
            </button>
            <button
              onClick={exportPDF}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition hover:opacity-90"
            >
              <FileDown size={13} /> Exportar PDF
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* MONTH BLOCK */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Calendar size={16} className="text-primary" />
              <div>
                <div className="text-[13px] font-semibold text-foreground">📅 Desempenho do Mês</div>
                <div className="text-[10px] text-muted-foreground">
                  {monthLabelStr} vs {prevMonthLabelStr}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <SectionCard icon={<BarChart3 size={12} />} title="Indicadores Chave">
                <BulletRow status={varUnits.status}>
                  Volume: <b>{diag.unitsMonth}</b> un. (garrafas <b>{diag.monthCurr.bottles}</b> / taças <b>{diag.monthCurr.glasses}</b>) <VarBadge {...varUnits} />
                </BulletRow>
                <BulletRow status={varRev.status}>
                  Faturamento: <b>R$ {fmtBRL(diag.monthRevTotal)}</b> · ticket médio <b>R$ {fmtBRL(diag.ticketMonth, 2)}</b> <VarBadge {...varRev} />
                </BulletRow>
                <BulletRow status="neutral">
                  Taças: <b>{diag.glassShareVolMonth.toFixed(1)}%</b> do volume · <b>{diag.glassShareRevMonth.toFixed(1)}%</b> do faturamento
                </BulletRow>
                <BulletRow status={metaStatus(diag.metaMonthDiff)}>
                  Meta do mês: <b>{metaLabel(diag.metaMonthDiff)}</b>
                  {diag.targetMonth > 0 ? <span className="text-muted-foreground"> (R$ {fmtBRL(diag.targetMonth)})</span> : null}
                </BulletRow>
              </SectionCard>

              <SectionCard icon={<Trophy size={12} />} title="Destaques & Estilos Campeões">
                <BulletRow status="good">
                  Estilo mais vendido: <b>{diag.champStyleMonth.key || "—"}</b> ({diag.champStyleMonth.val} un.)
                </BulletRow>
                <BulletRow status="good">
                  Campeão de faturamento: <b>{nameOf(diag.champRevMonth.id)}</b> — R$ {fmtBRL(diag.champRevMonth.val)}
                </BulletRow>
                <BulletRow status="good">
                  Campeão de volume: <b>{nameOf(diag.champVolMonth.id)}</b> — {diag.champVolMonth.val} un.
                </BulletRow>
              </SectionCard>

              <SectionCard icon={<AlertTriangle size={12} />} title="Pontos de Atenção & Gargalos">
                <BulletRow status={diag.zeroSaleMonth.length > 0 ? "warn" : "good"}>
                  Rótulos sem venda no mês: <b>{diag.zeroSaleMonth.length}</b>
                  {diag.zeroSaleMonth.length > 0 && (
                    <span className="text-muted-foreground"> · {diag.zeroSaleMonth.slice(0, 3).join(", ")}{diag.zeroSaleMonth.length > 3 ? "…" : ""}</span>
                  )}
                </BulletRow>
                <BulletRow status={cmvStatus(diag.cmvMonth)}>
                  CMV do mês: <b>{diag.cmvMonth.toFixed(1)}%</b> {diag.cmvMonth > 33 && <span className="text-muted-foreground">(meta ≤ 33%)</span>}
                </BulletRow>
                <BulletRow status={diag.corkVarMonth.status === "bad" ? "warn" : "neutral"}>
                  Taxa de rolha: <b>R$ {fmtBRL(diag.corkMonth.amt)}</b> ({diag.corkMonth.qty} un.) <VarBadge {...diag.corkVarMonth} />
                </BulletRow>
              </SectionCard>

              <SectionCard icon={<Lightbulb size={12} />} title="Ação Recomendada">
                {recMonth.slice(0, 2).map((r, i) => (
                  <BulletRow key={i} status="good">{r}</BulletRow>
                ))}
              </SectionCard>
            </div>
          </div>

          {/* YTD BLOCK */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <CalendarRange size={16} className="text-primary" />
              <div>
                <div className="text-[13px] font-semibold text-foreground">📈 Visão Acumulada do Ano (YTD)</div>
                <div className="text-[10px] text-muted-foreground">
                  {currentYear} até {monthLabelStr} vs {previousYear}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <SectionCard icon={<BarChart3 size={12} />} title="Indicadores Chave">
                <BulletRow status={varUnitsYTD.status}>
                  Volume YTD: <b>{diag.unitsYTD}</b> un. (gfa <b>{diag.ytdCurr.bottles}</b> / taças <b>{diag.ytdCurr.glasses}</b>) <VarBadge {...varUnitsYTD} />
                </BulletRow>
                <BulletRow status={varRevYTD.status}>
                  Faturamento YTD: <b>R$ {fmtBRL(diag.ytdRevTotal)}</b> · ticket <b>R$ {fmtBRL(diag.ticketYTD, 2)}</b> <VarBadge {...varRevYTD} />
                </BulletRow>
                <BulletRow status="neutral">
                  Taças YTD: <b>{diag.glassShareVolYTD.toFixed(1)}%</b> vol · <b>{diag.glassShareRevYTD.toFixed(1)}%</b> fat.
                </BulletRow>
                <BulletRow status={metaStatus(diag.metaYTDDiff)}>
                  Meta YTD: <b>{metaLabel(diag.metaYTDDiff)}</b>
                  {diag.targetYTD > 0 ? <span className="text-muted-foreground"> (R$ {fmtBRL(diag.targetYTD)})</span> : null}
                </BulletRow>
              </SectionCard>

              <SectionCard icon={<Trophy size={12} />} title="Destaques & Estilos Campeões">
                <BulletRow status="good">
                  Estilo mais vendido: <b>{diag.champStyleYTD.key || "—"}</b> ({diag.champStyleYTD.val} un.)
                </BulletRow>
                <BulletRow status="good">
                  Campeão de faturamento: <b>{nameOf(diag.champRevYTD.id)}</b> — R$ {fmtBRL(diag.champRevYTD.val)}
                </BulletRow>
                <BulletRow status="good">
                  Campeão de volume: <b>{nameOf(diag.champVolYTD.id)}</b> — {diag.champVolYTD.val} un.
                </BulletRow>
              </SectionCard>

              <SectionCard icon={<AlertTriangle size={12} />} title="Pontos de Atenção & Gargalos">
                <BulletRow status={diag.zeroSaleYTD.length >= 5 ? "bad" : diag.zeroSaleYTD.length > 0 ? "warn" : "good"}>
                  Estoque parado: <b>{diag.zeroSaleYTD.length}</b> rótulos sem venda no ano
                  {diag.zeroSaleYTD.length > 0 && (
                    <span className="text-muted-foreground"> · {diag.zeroSaleYTD.slice(0, 3).join(", ")}{diag.zeroSaleYTD.length > 3 ? "…" : ""}</span>
                  )}
                </BulletRow>
                <BulletRow status={diag.priceBracketLow ? "warn" : "neutral"}>
                  Faixa de preço com baixa adesão: <b>{diag.priceBracketLow || "sem dados suficientes"}</b>
                </BulletRow>
                <BulletRow status={diag.giroAnualizado === 0 ? "neutral" : diag.giroAnualizado < 4 ? "warn" : "good"}>
                  Giro anualizado do estoque: <b>{diag.giroAnualizado.toFixed(2)}x</b>
                  <span className="text-muted-foreground"> (estoque atual: {diag.stockUnits} un.)</span>
                </BulletRow>
                <BulletRow status={cmvStatus(diag.cmvYTD)}>
                  CMV YTD: <b>{diag.cmvYTD.toFixed(1)}%</b>
                </BulletRow>
                <BulletRow status={diag.corkVarYTD.status === "bad" ? "warn" : "neutral"}>
                  Tendência taxa de rolha YTD: <b>R$ {fmtBRL(diag.corkYTD.amt)}</b> ({diag.corkYTD.qty} un.) <VarBadge {...diag.corkVarYTD} />
                </BulletRow>
              </SectionCard>

              <SectionCard icon={<Lightbulb size={12} />} title="Ação Recomendada">
                {recYTD.slice(0, 2).map((r, i) => (
                  <BulletRow key={i} status="good">{r}</BulletRow>
                ))}
              </SectionCard>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[10px] text-muted-foreground print:text-black">
          Dados calculados a partir das vendas registradas, contagens de estoque e taxas de rolha lançadas.
          Variações comparam mês atual com o anterior e YTD com o mesmo período do ano passado.
        </p>
      </div>
    </div>
  );
}
