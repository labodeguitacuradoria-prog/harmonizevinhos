import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupplierPanel } from '@/lib/supplier-links.functions';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, ShieldCheck, LockKeyhole, BarChart3 } from 'lucide-react';
import { BarChart } from '@/routes/_app.app.dashboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const Route = createFileRoute('/fornecedor/$token')({
  head: () => ({ meta: [
    { title: 'Painel do fornecedor — La Bodeguita' },
    { name: 'description', content: 'Informações exclusivas dos seus vinhos no restaurante.' },
    { property: 'og:title', content: 'Painel do fornecedor — La Bodeguita' },
    { property: 'og:description', content: 'Acompanhamento de contagens, vendas e preços dos rótulos fornecidos.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex,nofollow' }, { name: 'referrer', content: 'no-referrer' },
  ] }), component: SupplierPage,
});
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (n: number) => n.toLocaleString('pt-BR');
function SupplierPage() {
  const { token } = Route.useParams();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'zero'>('all');
  const [chartWine, setChartWine] = useState<string | null>(null);
  const { data, error, isLoading, isFetching, refetch } = useQuery({ queryKey: ['supplier-guest', token], queryFn: () => getSupplierPanel({ data: { token } }), retry: false, refetchInterval: 60000 });
  if (isLoading) return <div id="loader" className="fixed inset-0 flex items-center justify-center bg-background"><RefreshCw className="size-10 animate-spin text-primary" aria-label="Carregando painel" /></div>;
  if (error || !data?.ok) return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center"><BrandLogo /><LockKeyhole className="size-10 text-primary" /><h1 className="text-xl">Acesso indisponível</h1><p className="text-sm text-muted-foreground">{error ? 'Não foi possível carregar o painel. Tente novamente.' : data && !data.ok ? data.message : 'Peça um novo link ao restaurante.'}</p><Button variant="outline" onClick={() => refetch()}><RefreshCw />Tentar novamente</Button></main>;
  const monthly = (id: string) => (data.monthly?.[id] ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const stockDateLabel = data.stockDate ? new Date(data.stockDate.length === 10 ? `${data.stockDate}T12:00:00` : data.stockDate).toLocaleDateString('pt-BR') : null;
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const wines = data.wines.filter(w => fold(`${w.name} ${w.producer ?? ''} ${w.internal_code ?? ''} ${w.grape ?? ''}`).includes(fold(search)) && (view === 'all' || (data.stock[w.id] === 0 && !/taça|taca|glass/i.test(w.volume ?? ''))));
  const chartTarget = data.wines.find(w => w.id === chartWine) ?? null;
  const markup = (w: { cost_price: number; sale_price: number }) => w.cost_price > 0 ? `${(w.sale_price / w.cost_price).toFixed(2).replace('.', ',')}x` : '—';
  return <main className="mx-auto min-h-screen max-w-7xl px-4 pb-8 pt-5 md:px-8 md:pt-8">
    <header className="flex items-center justify-between gap-3 border-b border-border pb-5"><BrandLogo /><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:block">{new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><Button size="icon" variant="outline" aria-label="Atualizar painel" title="Atualizar painel" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={isFetching ? 'animate-spin' : ''} /></Button></div></header>
    <section className="flex flex-wrap items-end justify-between gap-4 py-6 md:py-8">
      <div className="min-w-0"><p className="mb-2 break-words text-sm text-muted-foreground">{data.supplierName}</p><h1 className="break-words text-2xl font-semibold uppercase text-primary md:text-3xl">{data.restaurantName}</h1></div>
    </section>
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase text-primary">Seus rótulos <span className="text-muted-foreground">({wines.length})</span></h2><div className="flex w-full flex-wrap gap-2 sm:w-auto"><div className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Pesquisar rótulos" placeholder="Rótulo, código ou uva" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><Button variant={view === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setView('all')}>Todos</Button><Button variant={view === 'zero' ? 'default' : 'outline'} size="sm" onClick={() => setView('zero')}>Zerados</Button></div></div>
      {!wines.length && <p className="py-8 text-sm text-muted-foreground">Nenhum rótulo encontrado.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">{wines.map(w => <article key={w.id} className="rounded-lg border border-border bg-card p-4"><h3 className="break-words text-sm font-semibold">{w.name}</h3><p className="mt-1 text-xs text-muted-foreground">{w.producer} {w.vintage ?? ''}</p><p className="mt-1 text-[10px] text-muted-foreground">{w.internal_code || 'Sem código'} · {w.volume || '—'}</p><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><dt className="text-muted-foreground">Estoque</dt><dd className="mt-1 font-semibold text-primary">{data.stock[w.id] == null ? 'Não contado' : number(data.stock[w.id] ?? 0)}</dd>{data.stock[w.id] != null && stockDateLabel && <dd className="text-[10px] text-muted-foreground">{stockDateLabel}</dd>}</div><div><dt className="text-muted-foreground">Venda mensal</dt><dd className="mt-1">{monthly(w.id)}</dd></div><div><dt className="text-muted-foreground">Custo</dt><dd className="mt-1">{money(w.cost_price)}</dd></div><div><dt className="text-muted-foreground">Preço na carta</dt><dd className="mt-1">{money(w.sale_price)}</dd></div><div><dt className="text-muted-foreground">Markup</dt><dd className="mt-1">{markup(w)}</dd></div><div><Button size="sm" variant="outline" onClick={() => setChartWine(w.id)}><BarChart3 />Gráficos</Button></div></dl></article>)}</div>
      <table className="hidden w-full table-fixed text-left text-sm lg:table"><thead><tr>{['Código', 'Rótulo', 'Custo', 'Preço de venda', 'Markup', 'Estoque', 'Venda mensal', 'Gráficos'].map((t, i) => <th key={t} className={`sticky top-0 z-10 border-b border-border bg-background py-3 pr-2 text-xs font-normal text-muted-foreground ${i === 1 ? 'w-[30%]' : ''}`}>{t}</th>)}</tr></thead><tbody>{wines.map(w => <tr key={w.id} className="border-b border-border"><td className="break-words pr-2 text-xs text-muted-foreground">{w.internal_code || '—'}</td><td className="py-4 pr-4"><p className="break-words font-medium">{w.name}</p><p className="mt-1 text-xs text-muted-foreground">{w.producer} · {w.vintage ?? '—'} · {w.volume ?? '—'}</p></td><td className="text-xs">{money(w.cost_price)}</td><td className="text-xs">{money(w.sale_price)}</td><td className="text-xs">{markup(w)}</td><td>{data.stock[w.id] == null ? <span className="text-muted-foreground">—</span> : <><div className="font-medium leading-none text-primary">{number(data.stock[w.id] ?? 0)}</div>{stockDateLabel && <div className="mt-0.5 text-[10px] text-muted-foreground">{stockDateLabel}</div>}</>}</td><td>{monthly(w.id)}</td><td><Button size="sm" variant="outline" onClick={() => setChartWine(w.id)} aria-label={`Ver gráficos de ${w.name}`}><BarChart3 />Ver</Button></td></tr>)}</tbody></table>
      <Dialog open={!!chartTarget} onOpenChange={o => !o && setChartWine(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="text-primary">{chartTarget?.name}</DialogTitle></DialogHeader>{chartTarget && <div className="grid gap-6 md:grid-cols-[3fr_2fr]"><div className="min-w-0"><p className="mb-3 text-xs font-semibold uppercase text-primary">Vendas · garrafas</p><BarChart curr={data.wineYears?.[chartTarget.id]?.curr ?? Array(12).fill(0)} prev={data.wineYears?.[chartTarget.id]?.prev ?? Array(12).fill(0)} currentYear={data.currentYear} previousYear={data.currentYear - 1} valueSuffix=" gfa" toggleLabel="Gfa" height={220} /></div><div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Participação no restaurante</p><p className="mb-3 text-sm font-semibold">Garrafas vendidas ({data.bottleMonths ?? 0} {data.bottleMonths === 1 ? 'mês' : 'meses'})</p><ShareDonut share={data.bottleShares?.[chartTarget.id] ?? 0} hasData={(data.bottleMonths ?? 0) > 0} /></div></div>}</DialogContent></Dialog>
    </section>
    <section className="py-8">
      <h2 className="mb-4 text-xs font-semibold uppercase text-primary">Evolução das vendas · garrafas · {data.currentYear - 1} x {data.currentYear}</h2>
      <BarChart curr={data.yearCurr} prev={data.yearPrev} currentYear={data.currentYear} previousYear={data.currentYear - 1} valueSuffix=" gfa" toggleLabel="Gfa" height={240} />
    </section>
    <footer className="mt-8 flex items-center gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />Acesso privado · {data.supplierName} · {data.restaurantName}</footer>
  </main>;
}

function ShareDonut({ share, hasData }: { share: number; hasData: boolean }) {
  const size = 200, stroke = 26, r = (size - stroke) / 2 - 6, c = size / 2, circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, share / 100));
  if (!hasData) return <div className="mx-auto flex items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground" style={{ width: size, height: size }}>Sem dados</div>;
  return <svg className="mx-auto" width={size} height={size} viewBox={`0 0 ${size} ${size}`}><defs><linearGradient id="supplier-share-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold)" /><stop offset="100%" stopColor="var(--wine)" /></linearGradient></defs><circle cx={c} cy={c} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} /><circle cx={c} cy={c} r={r} fill="none" stroke="url(#supplier-share-grad)" strokeWidth={stroke} strokeDasharray={`${circ * frac} ${circ}`} transform={`rotate(-90 ${c} ${c})`} /><text x={c} y={c - 2} textAnchor="middle" className="fill-primary" style={{ fontSize: 30, fontWeight: 700 }}>{share.toFixed(1).replace('.', ',')}%</text><text x={c} y={c + 20} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>das garrafas vendidas</text></svg>;
}
