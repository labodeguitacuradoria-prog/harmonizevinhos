import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Mail,
  MessageCircle,
  Copy,
  PackageCheck,
  X,
  Trash2,
  Send,
  FileText,
} from "lucide-react";
import {
  buildOrderText,
  buildOrderSubject,
  mailtoLink,
  whatsappLink,
} from "@/lib/order-message";
import { OrderDocumentsDialog } from "@/components/OrderDocumentsDialog";


export const Route = createFileRoute("/_app/app/orders")({
  head: () => ({
    meta: [
      { title: "Pedidos a fornecedores | Gestão de Vinhos" },
      {
        name: "description",
        content:
          "Solicite vinhos aos fornecedores por e-mail ou WhatsApp e acompanhe o que foi pedido e recebido.",
      },
      { property: "og:title", content: "Pedidos a fornecedores" },
      {
        property: "og:description",
        content: "Envio de pedidos por e-mail ou WhatsApp e acompanhamento de recebimentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

type Supplier = {
  id: string;
  name: string;
  contact_email: string | null;
  commercial_email: string | null;
  whatsapp: string | null;
  phone: string | null;
};

type WineRow = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  volume: string | null;
  internal_code: string | null;
  cost_price: number | null;
  supplier_id: string | null;
};

type OrderRow = {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  status: string;
  sent_at: string | null;
  sent_channel: string | null;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
};


type ItemRow = {
  id: string;
  order_id: string;
  wine_id: string;
  qty_bottles: number;
  qty_received: number;
  unit_cost: number | null;
  item_notes: string | null;
  status: string;
  received_at: string | null;
};

const inp =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const fInp =
  "w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  partial: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function OrdersPage() {
  const { restaurantId, memberships, canManageActive } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [receiving, setReceiving] = useState<ItemRow | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [docsOrderId, setDocsOrderId] = useState<string | null>(null);

  const restaurantName =
    memberships.find((m) => m.restaurantId === restaurantId)?.name ?? "Restaurante";

  const { data: restaurantInfo } = useQuery({
    queryKey: ["orders-restaurant-info", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("name, cnpj")
        .eq("id", restaurantId!)
        .maybeSingle();
      return data ?? null;
    },
  });

  const restaurantCnpj = restaurantInfo?.cnpj ?? null;



  const { data: suppliers = [] } = useQuery({
    queryKey: ["orders-suppliers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, contact_email, commercial_email, whatsapp, phone")
        .order("name");
      return (data ?? []) as Supplier[];
    },
  });

  const { data: wines = [] } = useQuery({
    queryKey: ["orders-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wines")
        .select("id, name, producer, vintage, volume, internal_code, cost_price, supplier_id")
        .eq("restaurant_id", restaurantId!)
        .order("name");
      return (data ?? []) as WineRow[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["orders", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("purchase_orders")
        .select("id, restaurant_id, supplier_id, status, sent_at, sent_channel, expected_date, notes, created_at")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false });
      const list = (orders ?? []) as OrderRow[];
      if (list.length === 0) return { orders: list, items: [] as ItemRow[] };
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("id, order_id, wine_id, qty_bottles, qty_received, unit_cost, item_notes, status, received_at")
        .in("order_id", list.map((o) => o.id));
      return { orders: list, items: (items ?? []) as ItemRow[] };
    },
  });

  const orders = data?.orders ?? [];
  const items = data?.items ?? [];

  const { data: docCount = {} } = useQuery({
    queryKey: ["order-documents-count", restaurantId, orders.length],
    enabled: orders.length > 0,
    queryFn: async () => {
      const { data: docs } = await supabase
        .from("purchase_order_documents")
        .select("order_id")
        .in("order_id", orders.map((o) => o.id));
      const m: Record<string, number> = {};
      (docs ?? []).forEach((d) => {
        m[d.order_id] = (m[d.order_id] ?? 0) + 1;
      });
      return m;
    },
  });


  const supplierById = useMemo(() => {
    const m: Record<string, Supplier> = {};
    suppliers.forEach((s) => (m[s.id] = s));
    return m;
  }, [suppliers]);
  const wineById = useMemo(() => {
    const m: Record<string, WineRow> = {};
    wines.forEach((w) => (m[w.id] = w));
    return m;
  }, [wines]);
  const orderById = useMemo(() => {
    const m: Record<string, OrderRow> = {};
    orders.forEach((o) => (m[o.id] = o));
    return m;
  }, [orders]);

  // ----- filtros por coluna -----
  const [fSupplier, setFSupplier] = useState("");
  const [fWine, setFWine] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fChannel, setFChannel] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const rows = useMemo(() => {
    return items
      .map((it) => {
        const o = orderById[it.order_id];
        const w = wineById[it.wine_id];
        const s = o ? supplierById[o.supplier_id] : undefined;
        return { it, o, w, s };
      })
      .filter((r) => r.o)
      .filter((r) => (fSupplier ? r.o!.supplier_id === fSupplier : true))
      .filter((r) =>
        fWine
          ? (r.w?.name ?? "").toLowerCase().includes(fWine.toLowerCase()) ||
            (r.w?.internal_code ?? "").toLowerCase().includes(fWine.toLowerCase())
          : true,
      )
      .filter((r) => (fStatus ? r.it.status === fStatus : true))
      .filter((r) => (fChannel ? (r.o!.sent_channel ?? "") === fChannel : true))
      .filter((r) => (fFrom ? r.o!.created_at.slice(0, 10) >= fFrom : true))
      .filter((r) => (fTo ? r.o!.created_at.slice(0, 10) <= fTo : true))
      .sort((a, b) => (a.o!.created_at < b.o!.created_at ? 1 : -1));
  }, [items, orderById, wineById, supplierById, fSupplier, fWine, fStatus, fChannel, fFrom, fTo]);

  const kpi = useMemo(() => {
    const open = orders.filter((o) => ["sent", "partial"].includes(o.status)).length;
    let pendingBottles = 0;
    let pendingValue = 0;
    let late = 0;
    const now = Date.now();
    items.forEach((it) => {
      if (it.status === "cancelled" || it.status === "received") return;
      const pend = Math.max(0, it.qty_bottles - it.qty_received);
      pendingBottles += pend;
      pendingValue += pend * Number(it.unit_cost ?? 0);
      const o = orderById[it.order_id];
      if (o?.sent_at && now - +new Date(o.sent_at) > 15 * 864e5) late += 1;
    });
    return { open, pendingBottles, pendingValue, late };
  }, [orders, items, orderById]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  async function receive(item: ItemRow, qty: number, date: string) {
    const total = Math.min(item.qty_bottles, item.qty_received + qty);
    const { error } = await supabase
      .from("purchase_order_items")
      .update({ qty_received: total, received_at: new Date(date).toISOString() })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Recebimento registrado");
    qc.invalidateQueries({ queryKey: ["orders"] });
    setReceiving(null);
  }

  async function bulkReceive() {
    const today = new Date().toISOString();
    for (const id of selectedIds) {
      const it = items.find((i) => i.id === id);
      if (!it) continue;
      await supabase
        .from("purchase_order_items")
        .update({ qty_received: it.qty_bottles, received_at: today })
        .eq("id", it.id);
    }
    toast.success(`${selectedIds.length} item(ns) marcados como recebidos`);
    setSelected({});
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function cancelItem(it: ItemRow) {
    const { error } = await supabase
      .from("purchase_order_items")
      .update({ status: "cancelled" })
      .eq("id", it.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function deleteOrder(orderId: string) {
    if (!confirm("Apagar este pedido e todos os seus itens?")) return;
    const { error } = await supabase.from("purchase_orders").delete().eq("id", orderId);
    if (error) return toast.error(error.message);
    toast.success("Pedido apagado");
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function markSent(orderId: string, channel: "email" | "whatsapp" | "manual") {
    const o = orderById[orderId];
    if (!o) return;
    await supabase
      .from("purchase_orders")
      .update({
        sent_channel: channel,
        sent_at: new Date().toISOString(),
        status: (o.status === "draft" ? "sent" : o.status) as
          | "draft"
          | "sent"
          | "partial"
          | "received"
          | "cancelled",
      })
      .eq("id", orderId);
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function copyOrderText(orderId: string) {
    const text = orderTextFor(orderId);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success("Texto do pedido copiado — cole no e-mail ou WhatsApp");
    await markSent(orderId, "manual");
  }

  async function openManualEmail(orderId: string) {
    const order = orderById[orderId];
    if (!order) return;
    const supplier = supplierById[order.supplier_id];
    const to = supplier?.commercial_email || supplier?.contact_email || "";
    window.open(
      mailtoLink(to, buildOrderSubject({ restaurantName, restaurantCnpj }), orderTextFor(orderId)),
      "_blank",
    );
    await markSent(orderId, "email");
  }


  function orderTextFor(orderId: string) {
    const o = orderById[orderId];
    if (!o) return "";
    const its = items.filter((i) => i.order_id === orderId && i.status !== "cancelled");
    return buildOrderText({
      restaurantName,
      restaurantCnpj,
      supplierName: supplierById[o.supplier_id]?.name ?? "Fornecedor",
      expectedDate: o.expected_date,
      notes: o.notes,
      items: its.map((i) => {
        const w = wineById[i.wine_id];
        return {
          name: w?.name ?? "Rótulo",
          producer: w?.producer ?? null,
          vintage: w?.vintage ?? null,
          volume: w?.volume ?? null,
          internal_code: w?.internal_code ?? null,
          qty: i.qty_bottles,
          notes: i.item_notes,
        };
      }),
    });
  }

  async function sendWhatsapp(orderId: string) {
    const o = orderById[orderId];
    if (!o) return;
    const s = supplierById[o.supplier_id];
    const phone = s?.whatsapp || s?.phone;
    if (!phone) return toast.error("Fornecedor sem WhatsApp cadastrado");
    window.open(whatsappLink(phone, orderTextFor(orderId)), "_blank");
    await markSent(orderId, "whatsapp");
  }


  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold uppercase tracking-[0.12em] text-primary md:text-2xl">
            Pedidos a fornecedores
          </h1>
        </div>
        {canManageActive && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Novo pedido
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pedidos abertos" value={String(kpi.open)} />
        <Kpi label="Garrafas pendentes" value={String(kpi.pendingBottles)} />
        <Kpi label="Valor pendente" value={money(kpi.pendingValue)} />
        <Kpi label="Itens atrasados (15d)" value={String(kpi.late)} />
      </div>

      {canManageActive && (
        <div className="mt-4 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          O pedido é registrado no sistema e o texto pode ser copiado para enviar por e-mail ou WhatsApp.
          Use o ícone de documentos em cada linha para guardar a Nota Fiscal, boletos e comprovantes do pedido.
        </div>
      )}


      {selectedIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/50 bg-card p-3">
          <span className="text-xs uppercase tracking-wide text-primary">
            {selectedIds.length} item(ns) selecionados
          </span>
          <button
            onClick={bulkReceive}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <PackageCheck className="h-3.5 w-3.5" /> Marcar como recebidos
          </button>
          <button onClick={() => setSelected({})} className="text-xs text-muted-foreground">
            Limpar seleção
          </button>
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Fornecedor</th>
              <th className="px-3 py-2">Rótulo</th>
              <th className="px-3 py-2">Cód.</th>
              <th className="px-3 py-2 text-right">Solicit.</th>
              <th className="px-3 py-2 text-right">Recebido</th>
              <th className="px-3 py-2 text-right">Pendente</th>
              <th className="px-3 py-2 text-right">Custo un.</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-2 py-2"></th>
              <th className="px-2 py-2">
                <div className="flex gap-1">
                  <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={fInp} />
                  <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className={fInp} />
                </div>
              </th>
              <th className="px-2 py-2">
                <select value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} className={fInp}>
                  <option value="">Todos</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </th>
              <th className="px-2 py-2" colSpan={2}>
                <input
                  value={fWine}
                  onChange={(e) => setFWine(e.target.value)}
                  placeholder="Filtrar rótulo/código"
                  className={fInp}
                />
              </th>
              <th className="px-2 py-2" colSpan={5}></th>
              <th className="px-2 py-2">
                <select value={fChannel} onChange={(e) => setFChannel(e.target.value)} className={fInp}>
                  <option value="">Todos</option>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="manual">Manual</option>
                </select>
              </th>
              <th className="px-2 py-2">
                <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={fInp}>
                  <option value="">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="partial">Parcial</option>
                  <option value="received">Recebido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={13} className="p-6 text-sm text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={13} className="p-6 text-sm text-muted-foreground">
                  Nenhum pedido encontrado. Clique em “Novo pedido” para solicitar vinhos a um fornecedor.
                </td>
              </tr>
            )}
            {rows.map(({ it, o, w, s }) => {
              const pend = Math.max(0, it.qty_bottles - it.qty_received);
              return (
                <tr key={it.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      disabled={it.status === "received" || it.status === "cancelled"}
                      onChange={(e) => setSelected((p) => ({ ...p, [it.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(o!.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">{s?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/app/wines"
                      search={{ wine: it.wine_id } as never}
                      className="text-primary hover:underline"
                    >
                      {w?.name ?? "Rótulo"}
                    </Link>
                    {it.item_notes && (
                      <div className="text-[10px] text-muted-foreground">{it.item_notes}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{w?.internal_code ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{it.qty_bottles}</td>
                  <td className="px-3 py-2 text-right">{it.qty_received}</td>
                  <td className="px-3 py-2 text-right">{pend}</td>
                  <td className="px-3 py-2 text-right">{it.unit_cost ? money(Number(it.unit_cost)) : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {money(Number(it.unit_cost ?? 0) * it.qty_bottles)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {o!.sent_channel === "email" ? "E-mail" : o!.sent_channel === "whatsapp" ? "WhatsApp" : o!.sent_channel ? "Manual" : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={it.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {canManageActive && pend > 0 && it.status !== "cancelled" && (
                        <button
                          onClick={() => setReceiving(it)}
                          title="Registrar recebimento"
                          className="text-primary"
                        >
                          <PackageCheck className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDocsOrderId(o!.id)}
                        title="Documentos do pedido (NF, boletos, comprovantes)"
                        className="relative"
                      >
                        <FileText
                          className={`h-4 w-4 ${docCount[o!.id] ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                        />
                        {!!docCount[o!.id] && (
                          <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                            {docCount[o!.id]}
                          </span>
                        )}
                      </button>
                      {canManageActive && (
                        <>
                          <button onClick={() => copyOrderText(o!.id)} title="Copiar texto do pedido">
                            <Copy className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </button>
                          <button onClick={() => openManualEmail(o!.id)} title="Abrir e-mail com o pedido">
                            <Mail className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </button>
                          <button onClick={() => sendWhatsapp(o!.id)} title="Abrir WhatsApp com o pedido">
                            <MessageCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </button>
                          {it.status !== "cancelled" && it.status !== "received" && (
                            <button onClick={() => cancelItem(it)} title="Cancelar item">
                              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                          <button onClick={() => deleteOrder(o!.id)} title="Apagar pedido">
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && restaurantId && (
        <NewOrderDialog
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          restaurantCnpj={restaurantCnpj}
          onOpenManualEmail={(to, body) => window.open(mailtoLink(to, buildOrderSubject({ restaurantName, restaurantCnpj }), body), "_blank")}
          suppliers={suppliers}
          wines={wines}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            qc.invalidateQueries({ queryKey: ["orders"] });
          }}
        />
      )}

      {docsOrderId && restaurantId && (
        <OrderDocumentsDialog
          orderId={docsOrderId}
          restaurantId={restaurantId}
          canManage={!!canManageActive}
          onClose={() => setDocsOrderId(null)}
        />
      )}


      {receiving && (
        <ReceiveDialog
          item={receiving}
          wineName={wineById[receiving.wine_id]?.name ?? "Rótulo"}
          onClose={() => setReceiving(null)}
          onConfirm={(qty, date) => receive(receiving, qty, date)}
        />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <b className="mt-1 block text-base text-primary">{value}</b>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "received"
      ? "border-primary/60 text-primary"
      : status === "partial"
        ? "border-amber-500/60 text-amber-400"
        : status === "cancelled"
          ? "border-border text-muted-foreground line-through"
          : "border-border text-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ReceiveDialog({
  item,
  wineName,
  onClose,
  onConfirm,
}: {
  item: ItemRow;
  wineName: string;
  onClose: () => void;
  onConfirm: (qty: number, date: string) => void;
}) {
  const pend = Math.max(0, item.qty_bottles - item.qty_received);
  const [qty, setQty] = useState(String(pend));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Modal title="Registrar recebimento" onClose={onClose}>
      <p className="text-sm text-muted-foreground">{wineName}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Garrafas recebidas
          <input value={qty} onChange={(e) => setQty(e.target.value)} className={`mt-1 ${inp}`} />
        </label>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inp}`} />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        O recebimento gera automaticamente a entrada no estoque.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => {
            const n = Math.max(0, Math.min(pend, parseInt(qty || "0", 10)));
            if (!n) return toast.error("Informe a quantidade recebida");
            onConfirm(n, date);
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Confirmar
        </button>
      </div>
    </Modal>
  );
}

function NewOrderDialog({
  restaurantId,
  restaurantName,
  restaurantCnpj,
  emailStatus,
  onConnectEmail,
  onSendEmail,
  onOpenManualEmail,
  suppliers,
  wines,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  restaurantName: string;
  restaurantCnpj: string | null;
  emailStatus: EmailStatus | null;
  onConnectEmail: () => void;
  onSendEmail: (orderId: string) => Promise<{ sentFromEmail: string; providerMessageId: string | null }>;
  onOpenManualEmail: (to: string, body: string) => void;
  suppliers: Supplier[];
  wines: WineRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Record<string, { qty: string; cost: string; notes: string }>>({});
  const [saving, setSaving] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const list = useMemo(() => {
    const base = supplierId ? wines.filter((w) => w.supplier_id === supplierId) : [];
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.internal_code ?? "").toLowerCase().includes(q) ||
        (w.producer ?? "").toLowerCase().includes(q),
    );
  }, [supplierId, wines, search]);

  const chosen = Object.entries(lines).filter(([, v]) => parseInt(v.qty || "0", 10) > 0);
  const totalBottles = chosen.reduce((s, [, v]) => s + parseInt(v.qty || "0", 10), 0);
  const totalValue = chosen.reduce(
    (s, [, v]) => s + parseInt(v.qty || "0", 10) * Number(v.cost || 0),
    0,
  );

  function text() {
    return buildOrderText({
      restaurantName,
      restaurantCnpj,
      supplierName: supplier?.name ?? "Fornecedor",
      expectedDate: expected || null,
      notes: notes || null,
      items: chosen.map(([wineId, v]) => {
        const w = wines.find((x) => x.id === wineId);
        if (!w) {
          return {
            name: "Rótulo",
            producer: null,
            vintage: null,
            volume: null,
            internal_code: null,
            qty: parseInt(v.qty || "0", 10),
            notes: v.notes || null,
          };
        }
        return {
          name: w.name,
          producer: w.producer,
          vintage: w.vintage,
          volume: w.volume,
          internal_code: w.internal_code,
          qty: parseInt(v.qty || "0", 10),
          notes: v.notes || null,
        };
      }),
    });
  }

  async function save(channel: "draft" | "email" | "whatsapp" | "manual") {
    if (!supplierId) return toast.error("Escolha o fornecedor");
    if (chosen.length === 0) return toast.error("Informe a quantidade de pelo menos um rótulo");
    setSaving(true);
    try {
      const isDraft = channel === "draft" || channel === "email";
      const body = text();
      const { data: order, error } = await supabase
        .from("purchase_orders")
        .insert({
          restaurant_id: restaurantId,
          supplier_id: supplierId,
          status: isDraft ? "draft" : "sent",
          sent_at: isDraft ? null : new Date().toISOString(),
          sent_channel: isDraft ? null : channel,
          expected_date: expected || null,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const payload = chosen.map(([wineId, v]) => ({
        order_id: order!.id,
        wine_id: wineId,
        qty_bottles: parseInt(v.qty || "0", 10),
        unit_cost: v.cost ? Number(v.cost) : null,
        item_notes: v.notes || null,
      }));
      const { error: itemErr } = await supabase.from("purchase_order_items").insert(payload);
      if (itemErr) throw new Error(itemErr.message);

      if (channel === "email") {
        const to = supplier?.commercial_email || supplier?.contact_email;
        if (!to) toast.error("Fornecedor sem e-mail — pedido salvo, use o WhatsApp ou copie o texto");
        else {
          try {
            const result = await onSendEmail(order!.id);
            toast.success(`Pedido enviado por ${result.sentFromEmail}`);
          } catch (e) {
            toast.error(e instanceof Error ? `${e.message}. Pedido salvo como rascunho.` : "Pedido salvo como rascunho.");
          }
        }
      }
      if (channel === "whatsapp") {
        const phone = supplier?.whatsapp || supplier?.phone;
        if (!phone) toast.error("Fornecedor sem WhatsApp — pedido salvo, use o e-mail ou copie o texto");
        else window.open(whatsappLink(phone, body), "_blank");
      }
      toast.success(isDraft ? "Rascunho salvo" : "Pedido registrado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar pedido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Novo pedido" onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Fornecedor
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setLines({});
            }}
            className={`mt-1 ${inp}`}
          >
            <option value="">Selecione...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Previsão de entrega
          <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={`mt-1 ${inp}`} />
        </label>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Observações do pedido
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${inp}`} />
        </label>
      </div>

      {supplierId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
          <div className="text-xs text-muted-foreground">
            E-mail será enviado por: <span className="text-foreground">{emailStatus?.connectedEmail ?? "Gmail não conectado"}</span>
          </div>
          {!emailStatus?.connected && (
            <button onClick={onConnectEmail} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-primary">
              <PlugZap className="h-3.5 w-3.5" /> Conectar Gmail
            </button>
          )}
        </div>
      )}

      {supplierId && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar rótulo por nome, produtor ou código interno"
            className={`mt-4 ${inp}`}
          />
          <div className="mt-3 max-h-[45vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Rótulo</th>
                  <th className="px-3 py-2">Cód.</th>
                  <th className="px-3 py-2 w-24 text-right">Garrafas</th>
                  <th className="px-3 py-2 w-28 text-right">Custo un.</th>
                  <th className="px-3 py-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-xs text-muted-foreground">
                      Nenhum rótulo deste fornecedor. Vincule o fornecedor aos rótulos em Produtos.
                    </td>
                  </tr>
                )}
                {list.map((w) => {
                  const l = lines[w.id] ?? { qty: "", cost: "", notes: "" };
                  return (
                    <tr key={w.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <div>{w.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {[w.producer, w.vintage, w.volume].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{w.internal_code ?? "-"}</td>
                      <td className="px-3 py-2">
                        <input
                          value={l.qty}
                          onChange={(e) =>
                            setLines((p) => ({
                              ...p,
                              [w.id]: {
                                ...l,
                                qty: e.target.value.replace(/\D/g, ""),
                                cost: l.cost || String(w.cost_price ?? ""),
                              },
                            }))
                          }
                          className="w-20 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={l.cost}
                          onChange={(e) => setLines((p) => ({ ...p, [w.id]: { ...l, cost: e.target.value } }))}
                          placeholder={String(w.cost_price ?? "")}
                          className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={l.notes}
                          onChange={(e) => setLines((p) => ({ ...p, [w.id]: { ...l, notes: e.target.value } }))}
                          placeholder="ex.: 2 caixas de 6"
                          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-xs text-muted-foreground">
          {chosen.length} rótulo(s) · {totalBottles} garrafa(s) · {money(totalValue)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(text());
              toast.success("Texto do pedido copiado");
            }}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Copy className="h-4 w-4" /> Copiar texto
          </button>
          <button
            disabled={saving}
            onClick={() => save("draft")}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Salvar rascunho
          </button>
          <button
            disabled={saving}
            onClick={() => save("manual")}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Send className="h-4 w-4" /> Registrar como enviado
          </button>
          <button
            disabled={saving || !supplierId}
            onClick={() => {
              const to = supplier?.commercial_email || supplier?.contact_email;
              if (!to) return toast.error("Fornecedor sem e-mail cadastrado");
              onOpenManualEmail(to, text());
            }}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Copy className="h-4 w-4" /> E-mail manual
          </button>
          <button
            disabled={saving}
            onClick={() => save("email")}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Mail className="h-4 w-4" /> Enviar por e-mail
          </button>
          <button
            disabled={saving}
            onClick={() => save("whatsapp")}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div
        className={`mt-6 w-full rounded-xl border border-border bg-card p-5 ${wide ? "max-w-5xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

export { ORDER_STATUS_LABEL };
