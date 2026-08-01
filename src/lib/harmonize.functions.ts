import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGateway } from "./ai-gateway.server";
import { DISH_DECOMPOSITION_PROMPT } from "./sommelier-prompt";

const DishInput = z.object({ dish: z.string().min(3).max(2000) });

const ProfileSchema = z.object({
  name: z.string(),
  intensity: z.number(),
  acidity: z.number(),
  fat: z.number(),
  sweetness: z.number(),
  salt: z.number(),
  spice: z.number(),
  bitterness: z.number(),
  peixe_gordo: z.boolean(),
  sobremesa: z.boolean(),
  ingredients: z.array(z.string()),
  cookingMethod: z.string(),
});

export type DishProfile = z.infer<typeof ProfileSchema> & {
  explanation: string;
  rules?: string[];
};


export const harmonizeDish = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DishInput.parse(d))
  .handler(async ({ data }): Promise<DishProfile> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Serviço de IA não configurado.");

    // Regras da base de conhecimento (curadas pelo Administrador Geral)
    let rules: { title: string; keywords: string[]; guidance: string }[] = [];
    try {
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      const url = process.env["SUPABASE_URL"];
      if (key && url) {
        const sb = createClient(url, key, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
                h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: rows } = await sb
          .from("pairing_knowledge")
          .select("title, keywords, guidance")
          .eq("active", true)
          .order("sort_order");
        rules = (rows ?? []) as typeof rules;
      }
    } catch {
      /* base de conhecimento é opcional */
    }

    const dishLower = data.dish.toLowerCase();
    const matched = rules.filter(
      (r) =>
        (r.keywords ?? []).some((k) => k && dishLower.includes(k.toLowerCase())) ||
        r.title.toLowerCase().includes("barrica"),
    );

    const knowledgeBlock = matched.length
      ? `\n\nREGRAS OBRIGATÓRIAS DO MANUAL DO SOMMELIER DA CASA (respeite-as acima de qualquer outra consideração):\n${matched
          .map((r) => `- ${r.title}: ${r.guidance}`)
          .join("\n")}`
      : "";

    const outputContract = `\n\nCONTRATO DE SAÍDA (INVIOLÁVEL): responda APENAS com um objeto JSON contendo EXATAMENTE estas chaves, com estes nomes literais: "name" (string), "intensity", "acidity", "fat", "sweetness", "salt", "spice", "bitterness" (inteiros de 0 a 10), "peixe_gordo" e "sobremesa" (booleanos), "ingredients" (array de strings), "cookingMethod" (string) e "explanation" (string). Nunca renomeie, traduza ou acrescente chaves.
No campo "explanation", os três parágrafos devem ser separados pelo marcador literal <P> em vez de quebras de linha. É proibido usar qualquer caractere de quebra de linha real dentro das strings do JSON.`;

    const gateway = createLovableAiGateway(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    try {
      const { output } = await generateText({
        model,
        system: DISH_DECOMPOSITION_PROMPT + knowledgeBlock + outputContract,
        prompt: `Decomponha o seguinte prato do cardápio: "${data.dish}"`,
        output: Output.object({ schema: ProfileSchema }),
      });
      const explanation = output.explanation
        .replace(/<\/?P>/g, "\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return { ...output, explanation, rules: matched.map((r) => r.title) };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) {
        throw new Error("A IA não conseguiu estruturar a análise. Tente detalhar melhor o prato.");
      }
      throw e;
    }
  });

