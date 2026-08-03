import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGateway } from "./ai-gateway.server";

const SYSTEM_PROMPT = `Você digitaliza RELATÓRIOS DE VENDAS de vinhos de restaurantes (PDF, planilha exportada, foto ou texto).

Extraia TODAS as linhas de produto que representem venda de vinhos (garrafa ou taça).

Regras:
1. Cada linha vira um objeto no array "itens". Não resuma, não agrupe, não pule linhas.
2. "nome" = descrição do produto exatamente como aparece no relatório.
3. "codigo" = código interno / PLU / referência do restaurante quando existir; senão null.
4. "safra" = ano (inteiro) quando aparecer no nome; senão null.
5. "volume" = "750 ml" para garrafa, "375 ml", "187 ml", "1500 ml", ou "Taça" quando a linha indicar venda em taça/glass/cálice. Se não houver indicação, null.
6. "quantidade" = quantidade vendida (número). Se houver colunas de quantidade e valor, use a coluna de quantidade.
7. "faturamento" = valor TOTAL vendido daquela linha em reais (número). Converta "R$ 1.234,50" → 1234.5. Se só houver preço unitário, multiplique pela quantidade.
8. "confianca" = "alta", "media" ou "baixa" conforme a legibilidade daquela linha.
9. Ignore totais, subtotais, cabeçalhos, rodapés, taxas de serviço, comidas e bebidas que não sejam vinho.

Nunca invente linhas que não estão no documento.`;

const ItemSchema = z.object({
  nome: z.string(),
  codigo: z.string().nullable(),
  safra: z.number().nullable(),
  volume: z.string().nullable(),
  quantidade: z.number().nullable(),
  faturamento: z.number().nullable(),
  confianca: z.string().nullable(),
});

const ResultSchema = z.object({ itens: z.array(ItemSchema) });

export type SalesImportItem = z.infer<typeof ItemSchema>;

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  return v == null ? null : String(v);
}

function coerce(parsed: any): SalesImportItem[] {
  const arr = Array.isArray(parsed?.itens) ? parsed.itens : Array.isArray(parsed) ? parsed : [];
  return arr
    .filter((it: any) => it && typeof it === "object" && (it.nome || it.name))
    .map((it: any) => ({
      nome: String(it.nome ?? it.name ?? "").trim(),
      codigo: str(it.codigo),
      safra: num(it.safra),
      volume: str(it.volume),
      quantidade: num(it.quantidade),
      faturamento: num(it.faturamento),
      confianca: str(it.confianca),
    }))
    .filter((it: SalesImportItem) => it.nome.length > 1);
}

async function callModel(userContent: unknown): Promise<SalesImportItem[]> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const gateway = createLovableAiGateway(apiKey);
  const model = gateway("google/gemini-3-flash-preview");

  try {
    const { output } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent as any }],
      output: Output.object({ schema: ResultSchema }),
      maxOutputTokens: 32768,
      temperature: 0.1,
    });
    return coerce(output);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const raw = error.text ?? "";
      const tryParse = (s: string) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      };
      let parsed: any = tryParse(raw);
      if (!parsed) {
        const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fence?.[1] ?? raw;
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");
        if (start !== -1 && end > start) parsed = tryParse(candidate.substring(start, end + 1));
      }
      if (parsed) {
        const items = coerce(parsed);
        if (items.length) return items;
      }
      throw new Error(
        "A IA não conseguiu ler este relatório. Tente um PDF com melhor qualidade, envie página por página, ou cole o texto da tabela.",
      );
    }
    throw error;
  }
}

const FileInput = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().min(1),
});

export const extractSalesFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FileInput.parse(d))
  .handler(async ({ data }) => {
    let base64 = data.fileBase64;
    const c = base64.indexOf(",");
    if (c !== -1) base64 = base64.substring(c + 1);

    const isImage = data.mimeType.startsWith("image/");
    const instruction =
      "Digitalize este relatório de vendas e devolva TODAS as linhas de vinho no formato JSON solicitado.";
    const userContent = isImage
      ? [
          { type: "text" as const, text: instruction },
          { type: "image" as const, image: `data:${data.mimeType};base64,${base64}` },
        ]
      : [
          { type: "text" as const, text: instruction },
          { type: "file" as const, data: base64, mediaType: data.mimeType },
        ];

    return callModel(userContent);
  });

const TextInput = z.object({ text: z.string().min(10) });

export const extractSalesFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TextInput.parse(d))
  .handler(async ({ data }) => {
    return callModel([
      {
        type: "text" as const,
        text: `Digitalize o relatório de vendas abaixo e devolva TODAS as linhas de vinho:\n\n"""\n${data.text}\n"""`,
      },
    ]);
  });
