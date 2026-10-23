import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupplierPanel } from '@/lib/supplier-links.functions';
import { supplierSales } from '@/lib/supplier-panel';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, Wine, Package, TrendingUp, ShieldCheck, LockKeyhole } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

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
const monthLabel = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
function SupplierPage() {
  const { token } = Route.useParams();
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'zero'>('all');
  const { data, error, isLoading, isFetching, refetch } = useQuery({ queryKey: ['supplier-guest', token], queryFn: () => getSupplierPanel({ data: { token } }), retry: false, refetchInterval: 60000 });
  if (isLoading) return <div id="loader" className="fixed inset-0 flex items-center justify-center bg-background"><RefreshCw className="size-10 animate-spin text-primary" aria-label="Carregando painel" /></div>;
  if (error || !data?.ok) return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center"><BrandLogo /><LockKeyhole className="size-10 text-primary" /><h1 className="text-xl">Acesso indisponível</h1><p className="text-sm text-muted-foreground">{error ? 'Não foi possível carregar o painel. Tente novamente.' : data && !data.ok ? data.message : 'Peça um novo link ao restaurante.'}</p><Button variant="outline" onClick={() => refetch()}><RefreshCw />Tentar novamente</Button></main>;
  const selected = data.months.includes(month) ? month : data.months[data.months.length - 1];
  const stats = supplierSales(data.wines, data.sales, selected);
  const bottleWines = data.wines.filter(w => !/taça|taca|glass/i.test(w.volume ?? ''));
  const stockTotal = bottleWines.reduce((sum, w) => sum + (data.stock[w.id] ?? 0), 0);
  const zero = bottleWines.filter(w => data.stock[w.id] === 0).length;
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const wines = data.wines.filter(w => fold(`${w.name} ${w.producer ?? ''} ${w.internal_code ?? ''} ${w.grape ?? ''}`).includes(fold(search)) && (view === 'all' || (data.stock[w.id] === 0 && !/taça|taca|glass/i.test(w.volume ?? ''))));
  const chart = data.months.map(m => ({ month: monthLabel(m), bottles: supplierSales(data.wines, data.sales, m).bottles }));
  return <main className="mx-auto min-h-screen max-w-7xl px-4 pb-8 pt-5 md:px-8 md:pt-8">
    <header className="flex items-center justify-between gap-3 border-b border-border pb-5"><BrandLogo /><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:block">{new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><Button size="icon" variant="outline" aria-label="Atualizar painel" title="Atualizar painel" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={isFetching ? 'animate-spin' : ''} /></Button></div></header>
    <section className="flex flex-wrap items-end justify-between gap-4 py-6 md:py-8">
      <div className="min-w-0"><p className="mb-2 break-words text-sm text-muted-foreground">{data.supplierName}</p><h1 className="break-words text-2xl font-semibold uppercase text-primary md:text-3xl">{data.restaurantName}</h1><p className="mt-2 text-xs text-muted-foreground">Carteira de vinhos · {data.wines.length} rótulos</p></div>
      <label className="flex items-center gap-3 text-xs text-muted-foreground">Vendas<select aria-label="Mês das vendas" value={selected} onChange={e => setMonth(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-foreground">{data.months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
    </section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[{ icon: Package, label: 'Garrafas na contagem', value: data.stockDate ? number(stockTotal) : '—', sub: data.stockDate ? `Contagem de ${new Date(`${data.stockDate}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Sem contagem fechada' }, { icon: Wine, label: 'Garrafas vendidas', value: number(stats.bottles), sub: monthLabel(selected) }, { icon: TrendingUp, label: 'Venda dos seus rótulos', value: money(stats.revenue), sub: monthLabel(selected) }, { icon: Package, label: 'Rótulos sem garrafas', value: data.stockDate ? number(zero) : '—', sub: 'Na última contagem' }].map(k => <div key={k.label} className="min-w-0 rounded-lg border border-border bg-card p-4"><k.icon className="mb-3 size-4 text-primary" /><p className="text-[10px] uppercase text-muted-foreground">{k.label}</p><p className="mt-1 break-words text-xl font-semibold text-primary">{k.value}</p><p className="mt-2 text-[10px] text-muted-foreground">{k.sub}</p></div>)}
    </section>
    <section className="grid gap-6 border-b border-border py-6 lg:grid-cols-[2fr_1fr]">
      <div className="min-w-0"><h2 className="mb-4 text-xs font-semibold uppercase text-primary">Evolução das vendas · garrafas</h2><div className="h-48 w-full md:h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} width={35} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} formatter={(v: number) => [number(v), 'Garrafas']} /><Line dataKey="bottles" stroke="var(--gold)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div></div>
      <div className="flex flex-col justify-center border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><p className="text-xs uppercase text-muted-foreground">Reposição</p><p className="mt-2 text-3xl font-semibold text-primary">{zero}</p><p className="mt-2 text-sm">rótulos com estoque zerado na última contagem</p><Button variant="outline" className="mt-4 self-start" onClick={() => setView('zero')}><Package />Ver rótulos sem estoque</Button></div>
    </section>
    <section className="pt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase text-primary">Seus rótulos <span className="text-muted-foreground">({wines.length})</span></h2><div className="flex w-full flex-wrap gap-2 sm:w-auto"><div className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Pesquisar rótulos" placeholder="Rótulo, código ou uva" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><Button variant={view === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setView('all')}>Todos</Button><Button variant={view === 'zero' ? 'default' : 'outline'} size="sm" onClick={() => setView('zero')}>Zerados</Button></div></div>
      {!wines.length && <p className="py-8 text-sm text-muted-foreground">Nenhum rótulo encontrado.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">{wines.map(w => <article key={w.id} className="rounded-lg border border-border bg-card p-4"><div className="flex items-start gap-3">{w.image_url ? <img src={w.image_url} alt={w.name} className="h-20 w-12 shrink-0 rounded object-contain" referrerPolicy="no-referrer" /> : <Wine className="mt-2 size-6 shrink-0 text-primary" />}<div className="min-w-0"><h3 className="break-words text-sm font-semibold">{w.name}</h3><p className="mt-1 text-xs text-muted-foreground">{w.producer} {w.vintage ?? ''}</p><p className="mt-1 text-[10px] text-muted-foreground">{w.internal_code || 'Sem código'} · {w.volume || '—'}</p></div></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><dt className="text-muted-foreground">Última contagem</dt><dd className="mt-1 font-semibold text-primary">{data.stock[w.id] == null ? 'Não contado' : `${number(data.stock[w.id] ?? 0)} ${/taça|taca|glass/i.test(w.volume ?? '') ? 'un.' : 'gfa'}`}</dd></div><div><dt className="text-muted-foreground">Vendas · {monthLabel(selected)}</dt><dd className="mt-1">{/taça|taca|glass/i.test(w.volume ?? '') ? '—' : `${number(stats.byWine[w.id] ?? 0)} gfa`}</dd></div><div><dt className="text-muted-foreground">Custo</dt><dd className="mt-1">{money(w.cost_price)}</dd></div><div><dt className="text-muted-foreground">Preço na carta</dt><dd className="mt-1">{money(w.sale_price)}</dd></div></dl></article>)}</div>
      <table className="hidden w-full table-fixed text-left text-sm lg:table"><thead><tr>{['Rótulo', 'Código', 'Contagem', 'Vendas (gfa)', 'Custo', 'Carta'].map((t, i) => <th key={t} className={`sticky top-0 z-10 border-b border-border bg-background py-3 text-xs font-normal text-muted-foreground ${i === 0 ? 'w-[36%]' : ''}`}>{t}</th>)}</tr></thead><tbody>{wines.map(w => <tr key={w.id} className="border-b border-border"><td className="py-4 pr-4"><div className="flex items-center gap-3">{w.image_url ? <img src={w.image_url} alt={w.name} className="h-14 w-9 shrink-0 object-contain" referrerPolicy="no-referrer" /> : <Wine className="size-5 shrink-0 text-primary" />}<div className="min-w-0"><p className="break-words font-medium">{w.name}</p><p className="mt-1 text-xs text-muted-foreground">{w.producer} · {w.vintage ?? '—'} · {w.volume ?? '—'}</p></div></div></td><td className="break-words pr-2 text-xs text-muted-foreground">{w.internal_code || '—'}</td><td className="text-primary">{data.stock[w.id] == null ? '—' : number(data.stock[w.id] ?? 0)}</td><td>{/taça|taca|glass/i.test(w.volume ?? '') ? '—' : number(stats.byWine[w.id] ?? 0)}</td><td className="text-xs">{money(w.cost_price)}</td><td className="text-xs">{money(w.sale_price)}</td></tr>)}</tbody></table>
    </section>
    <footer className="mt-8 flex items-center gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />Acesso privado · {data.supplierName} · {data.restaurantName}</footer>
  </main>;
}
