import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Upload, Trash2, X, Download } from "lucide-react";

export const DOC_TYPES = [
  { value: "invoice", label: "Nota Fiscal" },
  { value: "boleto", label: "Boleto" },
  { value: "payment_proof", label: "Comprovante de pagamento" },
  { value: "supplier_confirmation", label: "Confirmação do fornecedor" },
  { value: "other", label: "Outro" },
] as const;

export type DocType = (typeof DOC_TYPES)[number]["value"];

export const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label]),
);

type DocRow = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  amount: number | null;
  due_date: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
};

const inp =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrderDocumentsDialog({
  orderId,
  restaurantId,
  canManage,
  onClose,
}: {
  orderId: string;
  restaurantId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [docType, setDocType] = useState<DocType>("invoice");
  const [docNumber, setDocNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["order-documents", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_documents")
        .select(
          "id, doc_type, doc_number, amount, due_date, storage_path, file_name, mime_type, size_bytes, notes, created_at",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as DocRow[];
    },
  });

  async function upload() {
    if (!file) return toast.error("Escolha o arquivo (PDF ou imagem)");
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${restaurantId}/${orderId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("order-documents")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);
      const { error } = await supabase.from("purchase_order_documents").insert({
        order_id: orderId,
        doc_type: docType,
        doc_number: docNumber || null,
        amount: amount ? Number(amount.replace(",", ".")) : null,
        due_date: dueDate || null,
        notes: notes || null,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw new Error(error.message);
      toast.success("Documento anexado");
      setFile(null);
      setDocNumber("");
      setAmount("");
      setDueDate("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["order-documents", orderId] });
      qc.invalidateQueries({ queryKey: ["order-documents-count"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao anexar documento");
    } finally {
      setBusy(false);
    }
  }

  async function open(doc: DocRow) {
    const { data, error } = await supabase.storage
      .from("order-documents")
      .createSignedUrl(doc.storage_path, 300);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank");
  }

  async function remove(doc: DocRow) {
    if (!confirm(`Excluir ${doc.file_name}?`)) return;
    await supabase.storage.from("order-documents").remove([doc.storage_path]);
    const { error } = await supabase.from("purchase_order_documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Documento excluído");
    qc.invalidateQueries({ queryKey: ["order-documents", orderId] });
    qc.invalidateQueries({ queryKey: ["order-documents-count"] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="mt-6 w-full max-w-3xl rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-primary">
            <FileText className="h-4 w-4" /> Documentos do pedido
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {canManage && (
          <div className="mt-4 rounded-lg border border-border bg-background p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tipo
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocType)}
                  className={`mt-1 ${inp}`}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Número / referência
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="ex.: NF 12345"
                  className={`mt-1 ${inp}`}
                />
              </label>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Valor (R$)
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`mt-1 ${inp}`}
                />
              </label>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Vencimento
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`mt-1 ${inp}`}
                />
              </label>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground lg:col-span-2">
                Observação
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${inp}`} />
              </label>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground lg:col-span-2">
                Arquivo (PDF ou imagem)
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className={`mt-1 ${inp}`}
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                disabled={busy}
                onClick={upload}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                <Upload className="h-4 w-4" /> {busy ? "Enviando..." : "Anexar documento"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Arquivo</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-4 text-xs text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-xs text-muted-foreground">
                    Nenhum documento anexado. Guarde aqui a Nota Fiscal, boletos e comprovantes deste pedido.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{d.doc_number ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{d.amount != null ? money(Number(d.amount)) : "-"}</td>
                  <td className="px-3 py-2 text-xs">
                    {d.due_date ? new Date(`${d.due_date}T12:00:00`).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => open(d)} className="text-primary hover:underline">
                      {d.file_name}
                    </button>
                    {d.notes && <div className="text-[10px] text-muted-foreground">{d.notes}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => open(d)} title="Abrir/baixar">
                        <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </button>
                      {canManage && (
                        <button onClick={() => remove(d)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
