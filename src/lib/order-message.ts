// Monta o texto do pedido de compra e gera links de envio (e-mail / WhatsApp).

export type OrderMessageItem = {
  name: string;
  producer?: string | null;
  vintage?: number | null;
  volume?: string | null;
  internal_code?: string | null;
  qty: number;
  notes?: string | null;
};

export type OrderMessageInput = {
  restaurantName: string;
  supplierName: string;
  expectedDate?: string | null;
  notes?: string | null;
  items: OrderMessageItem[];
};

function fmtDate(d?: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export function buildOrderText(input: OrderMessageInput): string {
  const lines: string[] = [];
  lines.push(`Pedido de vinhos - ${input.restaurantName}`);
  lines.push(`Fornecedor: ${input.supplierName}`);
  lines.push(`Data do pedido: ${new Date().toLocaleDateString("pt-BR")}`);
  const exp = fmtDate(input.expectedDate);
  if (exp) lines.push(`Previsão de entrega desejada: ${exp}`);
  lines.push("");
  lines.push("Itens:");
  input.items.forEach((it, i) => {
    const parts = [it.name];
    if (it.producer) parts.push(it.producer);
    if (it.vintage) parts.push(String(it.vintage));
    if (it.volume) parts.push(it.volume);
    let line = `${i + 1}. ${parts.join(" | ")} - ${it.qty} gf`;
    if (it.internal_code) line += ` (cód. ${it.internal_code})`;
    if (it.notes) line += ` - ${it.notes}`;
    lines.push(line);
  });
  const totalBottles = input.items.reduce((s, i) => s + i.qty, 0);
  lines.push("");
  lines.push(`Total: ${input.items.length} rótulo(s) / ${totalBottles} garrafa(s)`);
  if (input.notes) {
    lines.push("");
    lines.push(`Observações: ${input.notes}`);
  }
  lines.push("");
  lines.push("Favor confirmar recebimento deste pedido e prazo de entrega.");
  return lines.join("\n");
}

export function buildOrderSubject(input: Pick<OrderMessageInput, "restaurantName">): string {
  return `Pedido de vinhos - ${input.restaurantName} - ${new Date().toLocaleDateString("pt-BR")}`;
}

export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function whatsappLink(phone: string, body: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}
