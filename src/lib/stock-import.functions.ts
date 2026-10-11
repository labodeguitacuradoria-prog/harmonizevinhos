import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGateway } from "./ai-gateway.server";

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
function extractJson(raw: string): any {
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
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Serviço de IA não configurado.");
  const gateway = createLovableAiGateway(apiKey);
  const messages = [{ role: "user" as const, content: userContent as any }];
  try {
    const { output } = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      system: SYSTEM_PROMPT,
      messages,
      output: Output.object({ schema: ResultSchema }),
      maxOutputTokens: 32768,
      temperature: 0.1,
    });
    const items = coerce(output);
    if (items.length) return items;
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) throw error;
    const items = coerce(extractJson(error.text ?? ""));
    if (items.length) return items;
  }
  const { text } = await generateText({
    model: gateway("google/gemini-3.1-pro-preview"),
    system: SYSTEM_PROMPT + `\n\nResponda APENAS com JSON válido no formato {"itens":[...]}.`,
    messages,
    maxOutputTokens: 32768,
    temperature: 0,
  });
  const items = coerce(extractJson(text ?? ""));
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
