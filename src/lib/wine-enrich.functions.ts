import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGateway } from "./ai-gateway.server";

const EnrichSchema = z.object({
  suggested_retail_price: z.number().nullable(),
  price_rationale: z.string().nullable(),
  appellation: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  producer: z.string().nullable(),
  grape: z.string().nullable(),
  wine_type: z.string().nullable(),
  style: z.string().nullable(),
  alcohol_pct: z.number().nullable(),
  sugar_level: z.string().nullable(),
  sugar_g_l: z.number().nullable(),
  acidity: z.string().nullable(),
  acidity_g_l: z.number().nullable(),
  acidity_ph: z.number().nullable(),
  body: z.string().nullable(),
  tannin: z.string().nullable(),
  oak_months: z.number().nullable(),
  production_method: z.string().nullable(),
  elaboration: z.string().nullable(),
  aging: z.string().nullable(),
  serving_temp_min: z.number().nullable(),
  serving_temp_max: z.number().nullable(),
  tasting_notes: z.string().nullable(),
  pairing_notes: z.string().nullable(),
  awards: z.array(z.string()).nullable(),
  sommelier_weights: z
    .object({
      corpo: z.number().nullable(),
      acidez: z.number().nullable(),
      taninos: z.number().nullable(),
      docura: z.number().nullable(),
      estagioBarrica: z.number().nullable(),
      intensidadeAromatica: z.number().nullable(),
    })
    .nullable(),
  confidence: z.number().nullable(),
  notes: z.string().nullable(),
});

export type EnrichedWine = z.infer<typeof EnrichSchema>;

const SYSTEM = `Você é um Sommelier Master of Wine e analista de mercado de vinhos no Brasil.
Receberá a identificação de um rótulo (nome, produtor, safra, país, região, tipo, estilo) e os campos que ainda estão vazios no cadastro.
Use seu conhecimento do rótulo e do mercado brasileiro para completar as informações faltantes, com rigor técnico.

REGRAS:
- "suggested_retail_price": preço estimado de VENDA AO CONSUMIDOR FINAL no varejo brasileiro (BRL, apenas número, ex: 189.9). Considere importação, impostos e posicionamento da marca. Se não conseguir estimar com razoabilidade, retorne null.
- "price_rationale": 1 a 2 frases explicando a base da estimativa (faixa de preço, comparáveis, safra).
- "appellation": denominação oficial para vinhos europeus (ex: "AOC Saint-Émilion Grand Cru", "DOCG Barolo", "DO Rioja", "DOC Douro"). Para vinhos não europeus, null.
- "wine_type": um de "Tinto", "Branco", "Espumante", "Rosé", "Doce", "Fortificado".
- "style": um de "ESPUMANTE", "BRANCO LEVE", "BRANCO AROMÁTICO", "BRANCO ENCORPADO", "ROSÉ", "TINTO LEVE", "TINTO MÉDIO", "TINTO ENCORPADO", "FORTIFICADO".
- "sugar_level": "Seco", "Meio-seco", "Suave" ou "Doce". "body": "Leve", "Médio" ou "Encorpado". "tannin"/"acidity": "Baixo", "Médio" ou "Alto".
- "sommelier_weights": inteiros de 1 a 10 (corpo, acidez, taninos, docura, estagioBarrica, intensidadeAromatica) — preencha sempre.
- "confidence": 0 a 100, sua confiança geral na identificação do rótulo.
- NÃO invente prêmios: "awards" apenas se realmente conhecidos; caso contrário [].
- Todo campo que você não souber deve ser null. Nunca chute dados de laudo químico com precisão falsa: para álcool use o valor típico do rótulo.
- Responda somente com o JSON do esquema.`;

const Input = z.object({
  name: z.string().min(1),
  producer: z.string().nullable().optional(),
  vintage: z.number().nullable().optional(),
  country: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  wine_type: z.string().nullable().optional(),
  style: z.string().nullable().optional(),
  missingFields: z.array(z.string()).optional(),
});

export const enrichWineFromWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const gateway = createLovableAiGateway(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const identity = [
      `Rótulo: ${data.name}`,
      data.producer ? `Produtor: ${data.producer}` : null,
      data.vintage ? `Safra: ${data.vintage}` : null,
      data.country ? `País: ${data.country}` : null,
      data.region ? `Região: ${data.region}` : null,
      data.wine_type ? `Tipo: ${data.wine_type}` : null,
      data.style ? `Estilo: ${data.style}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const missing = data.missingFields?.length
      ? `\n\nCampos vazios no cadastro (priorize estes): ${data.missingFields.join(", ")}`
      : "";

    try {
      const { output } = await generateText({
        model,
        system: SYSTEM,
        prompt: `${identity}${missing}\n\nEstime o preço de venda ao consumidor final no Brasil (BRL) e complete as informações técnicas e sensoriais.`,
        output: Output.object({ schema: EnrichSchema }),
        maxOutputTokens: 8192,
        temperature: 0.3,
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const raw = error.text ?? "";
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end > start) {
          try {
            const parsed = EnrichSchema.partial().parse(JSON.parse(raw.substring(start, end + 1)));
            return parsed as EnrichedWine;
          } catch { /* ignora */ }
        }
        throw new Error("A IA retornou uma resposta fora do formato esperado. Tente novamente.");
      }
      throw error;
    }
  });
