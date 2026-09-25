import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DishSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  section: z.string().nullable(),
});
export type MenuDish = z.infer<typeof DishSchema>;

const EXTRACT_SYSTEM = `Você digitaliza CARDÁPIOS de comida de restaurantes.
Extraia cada prato como item de "dishes": "name" (nome do prato), "description" (ingredientes/preparo quando houver, senão null), "section" (entrada, principal, sobremesa etc., senão null).
Ignore bebidas, vinhos, preços e textos institucionais. Não invente pratos.`;

function friendly(e: unknown): never {
  const msg = String((e as any)?.message ?? e);
  console.error("[menu-pairing]", msg);
  if (/402|credit/i.test(msg)) throw new Error("Créditos de IA esgotados. Recarregue em Configurações → Planos e créditos.");
  if (/429|rate/i.test(msg)) throw new Error("Muitas solicitações agora. Aguarde um instante e tente de novo.");
  throw new Error("A IA não conseguiu concluir a análise. Tente novamente.");
}

export const extractMenuDishes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        text: z.string().max(40000).optional(),
        fileBase64: z.string().optional(),
        mimeType: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { structuredResponse } = await import("./ai-responses.server");
    const content: any[] = [{ type: "text", text: "Extraia todos os pratos deste cardápio." }];
    if (data.fileBase64 && data.mimeType) {
      let b64 = data.fileBase64;
      const c = b64.indexOf(",");
      if (c !== -1) b64 = b64.slice(c + 1);
      content.push(
        data.mimeType.startsWith("image/")
          ? { type: "image", image: `data:${data.mimeType};base64,${b64}` }
          : { type: "file", data: b64, mediaType: data.mimeType },
      );
    } else if (data.text?.trim()) {
      content.push({ type: "text", text: `"""\n${data.text}\n"""` });
    } else throw new Error("Envie o cardápio em arquivo ou texto.");
    try {
      const out = await structuredResponse({
        system: EXTRACT_SYSTEM,
        messages: [{ role: "user", content }],
        schema: z.object({ dishes: z.array(DishSchema) }),
      });
      return out.dishes.filter((d) => d.name.trim());
    } catch (e) {
      friendly(e);
    }
  });

const PickSchema = z.object({
  wine_id: z.string(),
  score: z.number(),
  reason: z.string(),
  table_phrase: z.string(),
});
const ResultSchema = z.object({
  dish: z.string(),
  profile: z.string(),
  picks: z.array(PickSchema),
  gap: z.boolean(),
  gap_note: z.string().nullable(),
});
export type DishPairing = Omit<z.infer<typeof ResultSchema>, "picks"> & {
  picks: (z.infer<typeof PickSchema> & { wine: WineLite | null })[];
};
export type WineLite = {
  id: string;
  name: string;
  producer: string | null;
  wine_type: string | null;
  country: string | null;
  volume: string | null;
  sale_price: number;
  internal_code: string | null;
};

const PAIR_SYSTEM = `Você é o sommelier do restaurante. Harmonize cada prato EXCLUSIVAMENTE com os vinhos da carta fornecida (identificados por "id").
Para cada prato:
- "profile": uma frase curta com o perfil sensorial do prato (intensidade, gordura, acidez, doçura, sal/umami, picância).
- "picks": até 3 vinhos da carta, do melhor para o pior, com "score" 0 a 10 de aderência, "reason" (1 frase técnica) e "table_phrase" (frase curta e vendedora que o garçom diz na mesa). Use SOMENTE ids existentes na carta. Priorize variedade de preço quando houver opções equivalentes e inclua opção em taça se adequada.
- "gap": true quando NENHUM vinho da carta atinge score 7 ou mais.
- "gap_note": quando gap for true, indique o estilo de vinho que faltaria na carta para esse prato (ex.: "Branco aromático com leve doçura, como Riesling"); caso contrário null.
Regras: peixe gordo evita tintos tânicos; sobremesa exige vinho igual ou mais doce; picância evita álcool alto e tanino. Não invente vinhos. Responda em português.`;

export const pairMenuWithWineList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        restaurantId: z.string().uuid(),
        dishes: z.array(DishSchema).min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: wines, error } = await context.supabase
      .from("wines")
      .select(
        "id, name, producer, vintage, wine_type, style, grape, country, region, body, tannin, acidity, sugar_level, oak_months, volume, sale_price, internal_code",
      )
      .eq("restaurant_id", data.restaurantId)
      .eq("active_on_menu", true)
      .limit(400);
    if (error) throw new Error("Não foi possível ler a carta de vinhos.");
    if (!wines?.length) throw new Error("Nenhum vinho ativo na carta deste restaurante.");

    const list = wines
      .map((w) =>
        [
          `id=${w.id}`,
          w.name,
          w.producer,
          w.vintage,
          w.wine_type,
          w.style,
          w.grape,
          [w.region, w.country].filter(Boolean).join("/"),
          w.body && `corpo ${w.body}`,
          w.tannin && `tanino ${w.tannin}`,
          w.acidity && `acidez ${w.acidity}`,
          w.sugar_level,
          w.oak_months ? `${w.oak_months}m madeira` : null,
          w.volume,
          `R$${w.sale_price}`,
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n");
    const dishes = data.dishes
      .map((d, i) => `${i + 1}. ${d.name}${d.description ? ` — ${d.description}` : ""}${d.section ? ` [${d.section}]` : ""}`)
      .join("\n");

    const { structuredResponse } = await import("./ai-responses.server");
    let out: { results: z.infer<typeof ResultSchema>[] };
    try {
      out = await structuredResponse({
        system: PAIR_SYSTEM,
        messages: [
          {
            role: "user",
            content: `CARTA DE VINHOS:\n${list}\n\nPRATOS (devolva um resultado por prato, na mesma ordem, com "dish" igual ao nome):\n${dishes}`,
          },
        ],
        schema: z.object({ results: z.array(ResultSchema) }),
      });
    } catch (e) {
      friendly(e);
    }
    const byId = new Map(wines.map((w) => [w.id, w]));
    return out.results.map((r) => {
      const picks = r.picks
        .filter((p) => byId.has(p.wine_id))
        .slice(0, 3)
        .map((p) => {
          const w = byId.get(p.wine_id)!;
          return {
            ...p,
            wine: {
              id: w.id,
              name: w.name,
              producer: w.producer,
              wine_type: w.wine_type,
              country: w.country,
              volume: w.volume,
              sale_price: Number(w.sale_price),
              internal_code: w.internal_code,
            } as WineLite,
          };
        });
      const gap = r.gap || !picks.length || picks.every((p) => p.score < 7);
      return { ...r, picks, gap, gap_note: gap ? r.gap_note ?? "Nenhum rótulo da carta atende bem este prato." : null };
    }) as DishPairing[];
  });
