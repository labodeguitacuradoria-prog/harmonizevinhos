import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { structuredResponse } from "./ai-responses.server";

const SYSTEM_PROMPT = `Você digitaliza RELATÓRIOS DE ESTOQUE / INVENTÁRIO de vinhos de restaurantes (PDF, planilha, foto de contagem ou texto).

Extraia TODAS as linhas de produto que sejam vinhos com quantidade em estoque.

Regras:
1. Cada linha vira um objeto em "itens". Não resuma, não agrupe, não pule linhas.
2. "codigo" = código interno / PLU / SKU / referência do restaurante. É a informação MAIS IMPORTANTE: copie exatamente como aparece (mantenha zeros à esquerda). Se não existir, null.
3. "nome" = descrição do produto como aparece.
4. "produtor" = vinícola/produtor se identificável; senão null.
5. "safra" = ano inteiro quando aparecer; senão null.
6. "volume" = "750 ml", "375 ml", "1500 ml" etc. quando indicado; senão null.
7. "quantidade" = quantidade em estoque em garrafas (número). Se houver várias colunas, use o saldo/estoque atual.
8. "custo" = custo unitário em reais quando houver (converta "R$ 1.234,50" → 1234.5); senão null.
9. "confianca" = "alta", "media" ou "baixa".
10. Ignore totais, cabeçalhos, rodapés e itens que não sejam vinho.

Nunca invente linhas.`;

const ItemSchema = z.object({
  codigo: z.string().nullable(),
  nome: z.string(),
  produtor: z.string().nullable(),
  safra: z.number().nullable(),
  volume: z.string().nullable(),
  quantidade: z.number().nullable(),
  custo: z.number().nullable(),
  confianca: z.string().nullable(),
});
const ResultSchema = z.object({ itens: z.array(ItemSchema) });
export type StockImportItem = z.infer<typeof ItemSchema>;

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}
function coerce(parsed: any): StockImportItem[] {
  const arr = Array.isArray(parsed?.itens) ? parsed.itens : Array.isArray(parsed) ? parsed : [];
  return arr
    .filter((it: any) => it && typeof it === "object" && (it.nome || it.codigo))
    .map((it: any) => ({
      codigo: str(it.codigo),
      nome: String(it.nome ?? "").trim(),
      produtor: str(it.produtor),
      safra: num(it.safra),
      volume: str(it.volume),
      quantidade: num(it.quantidade),
      custo: num(it.custo),
      confianca: str(it.confianca),
    }));
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractJson(raw: string): any {
  const t = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  let p = t(raw);
  if (!p) {
    const c = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw;
    const a = c.indexOf("{"), b = c.lastIndexOf("}");
    if (a !== -1 && b > a) p = t(c.substring(a, b + 1));
  }
  return p;
}

async function callModel(userContent: unknown): Promise<StockImportItem[]> {
  const out = await structuredResponse({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent as any }],
    schema: ResultSchema,
  });
  const items = coerce(out);
  if (items.length) return items;
  throw new Error("A IA não conseguiu ler este estoque. Tente um arquivo mais nítido ou cole o texto da tabela.");
}

export const extractStockFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fileBase64: z.string().min(10), mimeType: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    let b64 = data.fileBase64;
    const c = b64.indexOf(",");
    if (c !== -1) b64 = b64.substring(c + 1);
    const instruction = "Digitalize este relatório de estoque e devolva TODAS as linhas de vinho com código e quantidade.";
    return callModel(
      data.mimeType.startsWith("image/")
        ? [{ type: "text", text: instruction }, { type: "image", image: `data:${data.mimeType};base64,${b64}` }]
        : [{ type: "text", text: instruction }, { type: "file", data: b64, mediaType: data.mimeType }],
    );
  });

export const extractStockFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(5) }).parse(d))
  .handler(async ({ data }) =>
    callModel([{ type: "text", text: `Digitalize o estoque abaixo e devolva TODAS as linhas de vinho:\n\n"""\n${data.text.slice(0, 200000)}\n"""` }]),
  );
