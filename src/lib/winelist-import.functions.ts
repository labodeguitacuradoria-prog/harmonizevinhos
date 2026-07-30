import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGateway } from "./ai-gateway.server";

const SYSTEM_PROMPT = `Você é um Sommelier especialista em digitalizar CARTAS DE VINHOS de restaurantes.
Receberá uma carta de vinhos (PDF, foto ou texto). Sua missão é extrair TODOS os rótulos listados, linha por linha, sem inventar nada.

Regras:
1. Extraia CADA item da carta como um objeto no array "itens". Não resuma, não agrupe, não pule linhas. Cartas longas podem ter dezenas de itens — liste todos os que estiverem visíveis no material.
2. "nome" = nome do rótulo exatamente como aparece (sem o produtor quando ele estiver em linha/seção separada).
3. "produtor" = vinícola/produtor quando identificável; caso contrário null.
4. "safra" = ano (inteiro). Se a carta disser "S/S", "NV", "sem safra" ou não informar, retorne null.
5. "pais" e "regiao" quando a carta informar (muitas cartas organizam por país/região em títulos de seção — use o título da seção vigente). Caso contrário null.
6. "uvas" = castas citadas, separadas por vírgula. Null se ausente.
7. "tipo" = OBRIGATORIAMENTE um destes: "Tinto", "Branco", "Rosé", "Espumante", "Fortificado". Deduza pela seção da carta (ex: seção "ESPUMANTES" → Espumante). Se realmente impossível, null.
8. "volume": use "750 ml" como padrão para garrafa inteira. Se a carta indicar meia garrafa use "375 ml", mini "187 ml", magnum "1500 ml". Se o item for venda em taça (colunas "taça", "glass", "cálice") retorne "Taça".
9. "preco" = preço de VENDA ao cliente em reais, número. Converta "R$ 189,00" → 189. Se houver dois preços (taça e garrafa), gere DOIS itens separados: um com volume "Taça" e o preço da taça, outro com "750 ml" e o preço da garrafa. Se não houver preço, null.
10. "codigo" = código interno/referência do restaurante quando a carta trouxer (números curtos antes do nome). Null caso contrário.
11. "secao" = título da seção onde o item aparece (ex: "TINTOS - ITÁLIA").
12. "confianca" = "alta", "media" ou "baixa" conforme a legibilidade daquela linha específica.

ATENÇÃO:
- Nunca invente rótulos que não estão na carta.
- Não repita o mesmo rótulo duas vezes, exceto quando existirem preços distintos por volume (taça x garrafa).
- Ignore textos institucionais, harmonizações genéricas, rodapés e menus de comida.`;

const ItemSchema = z.object({
  nome: z.string(),
  produtor: z.string().nullable(),
  safra: z.number().nullable(),
  pais: z.string().nullable(),
  regiao: z.string().nullable(),
  uvas: z.string().nullable(),
  tipo: z.string().nullable(),
  volume: z.string().nullable(),
  preco: z.number().nullable(),
  codigo: z.string().nullable(),
  secao: z.string().nullable(),
  confianca: z.string().nullable(),
});

const ResultSchema = z.object({ itens: z.array(ItemSchema) });

export type WineListItem = z.infer<typeof ItemSchema>;

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  return v == null ? null : String(v);
}

function coerce(parsed: any): WineListItem[] {
  const arr = Array.isArray(parsed?.itens) ? parsed.itens : Array.isArray(parsed) ? parsed : [];
  return arr
    .filter((it: any) => it && typeof it === "object" && (it.nome || it.name))
    .map((it: any) => ({
      nome: String(it.nome ?? it.name ?? "").trim(),
      produtor: str(it.produtor),
      safra: num(it.safra),
      pais: str(it.pais),
      regiao: str(it.regiao),
      uvas: str(it.uvas),
      tipo: str(it.tipo),
      volume: str(it.volume),
      preco: num(it.preco),
      codigo: str(it.codigo),
      secao: str(it.secao),
      confianca: str(it.confianca),
    }))
    .filter((it: WineListItem) => it.nome.length > 1);
}

async function callModel(userContent: unknown): Promise<WineListItem[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
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
      console.error("[winelist-import] Resposta fora do formato. Prévia:", raw.slice(0, 400));
      throw new Error(
        "A IA não conseguiu ler esta carta. Tente uma imagem com mais resolução, envie página por página, ou cole o texto da carta.",
      );
    }
    console.error("[winelist-import] Erro na chamada da IA:", error);
    throw error;
  }
}

const FileInput = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().min(1),
});

export const extractWineListFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FileInput.parse(d))
  .handler(async ({ data }) => {
    let base64 = data.fileBase64;
    const c = base64.indexOf(",");
    if (c !== -1) base64 = base64.substring(c + 1);

    const isImage = data.mimeType.startsWith("image/");
    const instruction =
      "Digitalize esta carta de vinhos e devolva TODOS os rótulos encontrados no formato JSON solicitado.";
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

export const extractWineListFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TextInput.parse(d))
  .handler(async ({ data }) => {
    return callModel([
      {
        type: "text" as const,
        text: `Digitalize a carta de vinhos abaixo e devolva TODOS os rótulos:\n\n"""\n${data.text}\n"""`,
      },
    ]);
  });
