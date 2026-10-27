import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Share2, Link2, Copy, Send, Eye, Ban, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { publicOrigin } from '@/lib/public-origin';
import { createSupplierLink, revokeSupplierLink, setSupplierSharing, getSupplierLinkToken, deleteSupplierLink } from '@/lib/supplier-links.functions';

export const Route = createFileRoute('/_app/app/sharing')({
  head: () => ({ meta: [
    { title: 'Compartilhamento com fornecedores — La Bodeguita' },
    { name: 'description', content: 'Autorize fornecedores e envie acesso rápido às informações dos rótulos do restaurante.' },
    { property: 'og:title', content: 'Compartilhamento com fornecedores — La Bodeguita' },
    { property: 'og:description', content: 'Acesso exclusivo dos fornecedores aos seus rótulos no restaurante.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: SharingPage,
});

function SharingPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState<30 | 90>(30);
  const [fresh, setFresh] = useState<Record<string, { token: string; expires_at: string }>>({});
  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['my-suppliers', restaurantId], enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return [];
      const ids = new Set<string>();
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('wines').select('supplier_id').eq('restaurant_id', restaurantId).not('supplier_id', 'is', null).order('id').range(offset, offset + 999);
        if (error) throw error;
        for (const w of data ?? []) if (w.supplier_id) ids.add(w.supplier_id);
        if (!data || data.length < 1000) break;
      }
      if (!ids.size) return [];
      const { data, error } = await supabase.from('suppliers').select('id,name,contact_email,whatsapp,phone').in('id', [...ids]).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: access = [] } = useQuery({ queryKey: ['rsa', restaurantId], enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase.from('restaurant_supplier_access').select('supplier_id,enabled').eq('restaurant_id', restaurantId);
      if (error) throw error; return data ?? [];
    },
  });
  const { data: links = [] } = useQuery({ queryKey: ['supplier-links', restaurantId], enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase.from('supplier_access_links').select('id,supplier_id,created_at,expires_at,revoked_at,last_access_at').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });
  async function action(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try { await fn(); await Promise.all([qc.invalidateQueries({ queryKey: ['rsa'] }), qc.invalidateQueries({ queryKey: ['supplier-links'] })]); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível concluir.'); }
    finally { setBusy(null); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success('Link copiado.'); }
    catch { toast.error('Não foi possível copiar. Selecione o endereço exibido.'); }
  }
  return <div className="p-6 md:p-10">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div className="flex min-w-0 items-center gap-3"><Share2 className="size-6 shrink-0 text-primary" /><h1 className="text-xl font-semibold uppercase text-primary">Compartilhamento com fornecedores</h1></div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Validade do novo link<select aria-label="Validade do novo link" value={days} onChange={e => setDays(Number(e.target.value) as 30 | 90)} className="h-9 rounded-md border border-border bg-background px-3 text-foreground"><option value={30}>30 dias</option><option value={90}>90 dias</option></select></label>
    </header>
    <p className="mt-4 text-sm text-muted-foreground">Acesso somente aos rótulos do fornecedor: contagem, vendas e preços de custo e carta. Gerar um link autoriza o compartilhamento.</p>
    {isLoading && <div className="py-10 text-muted-foreground">Carregando fornecedores…</div>}
    {error && <div role="alert" className="py-8 text-destructive">Não foi possível carregar os fornecedores.</div>}
    {!isLoading && !error && !suppliers.length && <div className="py-12 text-muted-foreground">Nenhum fornecedor vinculado aos produtos deste restaurante.</div>}
    <ul className="mt-6 divide-y divide-border">
      {suppliers.map(s => {
        const on = access.find(a => a.supplier_id === s.id)?.enabled ?? false;
        const current = fresh[s.id];
        const url = current ? `${publicOrigin()}/fornecedor/${current.token}` : '';
        const supplierLinks = links.filter(l => l.supplier_id === s.id);
        const text = `Olá! Confira as informações dos seus vinhos no restaurante pela La Bodeguita:\n${url}\nAcesso até ${current ? new Date(current.expires_at).toLocaleDateString('pt-BR') : ''}. Este link é privado; não o encaminhe.`;
        const rawPhone = (s.whatsapp || s.phone || '').replace(/\D/g, '');
        const phone = rawPhone.length === 10 || rawPhone.length === 11 ? `55${rawPhone}` : rawPhone;
        return <li key={s.id} className="py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0"><h2 className="break-words text-lg font-medium">{s.name}</h2><p className="break-all text-xs text-muted-foreground">{s.contact_email}</p></div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch aria-label={`Compartilhar com ${s.name}`} checked={on} disabled={busy === s.id} onCheckedChange={enabled => action(s.id, async () => { if (!restaurantId) return; await setSupplierSharing({ data: { restaurant_id: restaurantId, supplier_id: s.id, enabled } }); toast.success(enabled ? 'Compartilhamento ativado.' : 'Acesso desativado.'); })} />{on ? 'Autorizado' : 'Desativado'}</label>
              <Button size="sm" disabled={!!busy} onClick={() => action(s.id, async () => { if (!restaurantId) return; const result = await createSupplierLink({ data: { restaurant_id: restaurantId, supplier_id: s.id, days } }); setFresh(prev => ({ ...prev, [s.id]: result })); toast.success('Link pronto para enviar.'); })}>{busy === s.id ? <Loader2 className="animate-spin" /> : <Link2 />}{supplierLinks.length ? 'Gerar novo link' : 'Gerar link'}</Button>
            </div>
          </div>
          {current && <div className="mt-4 border-l-2 border-primary pl-4">
            <input aria-label={`Link de ${s.name}`} readOnly value={url} className="w-full min-w-0 border-b border-border bg-transparent py-2 text-xs text-primary" onFocus={e => e.target.select()} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copy(url)}><Copy />Copiar link</Button>
              <Button variant="outline" size="sm" asChild><a href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><Send />Enviar por WhatsApp</a></Button>
              <Button variant="outline" size="sm" asChild><a href={`/fornecedor/${current.token}`} target="_blank" rel="noopener noreferrer"><Eye />Ver como fornecedor</a></Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Você pode reabrir, copiar ou reenviar este link abaixo enquanto estiver ativo.</p>
          </div>}
          {supplierLinks.map(l => {
            const active = !l.revoked_at && new Date(l.expires_at).getTime() > Date.now();
            const withToken = (fn: (u: string, exp: string) => void) => action(s.id, async () => { const r = await getSupplierLinkToken({ data: { id: l.id } }); fn(`${publicOrigin()}/fornecedor/${r.token}`, r.expires_at); });
            const msg = (u: string, exp: string) => `Olá! Confira as informações dos seus vinhos no restaurante pela La Bodeguita:\n${u}\nAcesso até ${new Date(exp).toLocaleDateString('pt-BR')}. Este link é privado; não o encaminhe.`;
            return <div key={l.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{l.revoked_at ? 'Revogado' : !active ? 'Expirado' : !on ? 'Suspenso' : 'Link ativo'} · Até {new Date(l.expires_at).toLocaleDateString('pt-BR')} · Último acesso: {l.last_access_at ? new Date(l.last_access_at).toLocaleString('pt-BR') : 'ainda não acessado'}</span>
              <div className="flex flex-wrap gap-1">
                {active && <>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { const w = window.open('', '_blank'); withToken(u => { if (w) w.location.href = u; else window.open(u, '_blank'); }).catch(() => w?.close()); }}><Eye />Ver como fornecedor</Button>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => withToken(u => copy(u))}><Copy />Copiar</Button>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { const w = window.open('', '_blank'); withToken((u, exp) => { const href = `https://wa.me/${phone}?text=${encodeURIComponent(msg(u, exp))}`; if (w) w.location.href = href; else window.open(href, '_blank'); }); }}><Send />Reenviar</Button>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => action(s.id, async () => { await revokeSupplierLink({ data: { id: l.id } }); setFresh(prev => { const next = { ...prev }; delete next[s.id]; return next; }); toast.success('Link revogado.'); })}><Ban />Revogar</Button>
                </>}
                {!active && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => action(s.id, async () => { await deleteSupplierLink({ data: { id: l.id } }); toast.success('Link excluído.'); })}><Trash2 />Excluir</Button>}
              </div>
            </div>;
          })}
        </li>;
      })}
    </ul>
  </div>;
}
