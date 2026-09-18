import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRAINING_SYSTEM_PROMPT, COMPACT_SUMMARY_RULE, buildTrainingUserPrompt } from "./training-prompt";

const CardSchema = z.object({
  compact_summary: z.string(),
  grapes_line: z.string(),
  making_line: z.string(),
  origin_story: z.string(),
  name_meaning: z.string(),
  mouthfeel: z.string(),
  pairings: z.array(z.string()),
  sales_pitch: z.string(),
  fun_fact: z.string(),
  do_not_confuse: z.string(),
});

export type TrainingCardFields = z.infer<typeof CardSchema>;

async function assertCanManage(context: any, restaurantId: string) {
  const { data: ok } = await context.supabase.rpc("can_manage_restaurant", {
    _user_id: context.userId,
    _restaurant_id: restaurantId,
  });
  if (!ok) throw new Error("Sem permissão para gerenciar este restaurante.");
}

const GenerateSchema = z.object({
  restaurant_id: z.string().uuid(),
  wine_ids: z.array(z.string().uuid()).min(1).max(12),
});

/** Gera (ou regera) as fichas de treinamento com IA e salva como rascunho. */
export const generateTrainingCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Serviço de IA não configurado.");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wines, error } = await supabaseAdmin
      .from("wines")
      .select(
        "id, name, producer, country, region, appellation, vintage, wine_type, style, grape, grapes_detail, volume, alcohol_pct, sugar_level, body, production_method, aging, oak_months, elaboration, tasting_notes, pairing_notes, sale_price",
      )
      .eq("restaurant_id", data.restaurant_id)
      .in("id", data.wine_ids);
    if (error) throw new Error(error.message);
    if (!wines?.length) throw new Error("Rótulo não encontrado.");

    const { data: others } = await supabaseAdmin
      .from("wines")
      .select("name, wine_type")
      .eq("restaurant_id", data.restaurant_id)
      .eq("active_on_menu", true)
      .limit(40);

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    let saved = 0;
    const failures: string[] = [];

    for (const w of wines) {
      try {
        const otherLabels = (others ?? [])
          .filter((o) => o.name !== w.name)
          .slice(0, 12)
          .map((o) => `${o.name} (${o.wine_type ?? "tipo não informado"})`);

        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system: `${TRAINING_SYSTEM_PROMPT}\n${COMPACT_SUMMARY_RULE}`,
          prompt: buildTrainingUserPrompt({ ...w, otherLabels }),
          output: Output.object({ schema: CardSchema }),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const fields = (await result.output) as TrainingCardFields;

        const { error: upErr } = await supabaseAdmin
          .from("wine_story_cards")
          .upsert(
            {
              wine_id: w.id,
              restaurant_id: data.restaurant_id,
              status: "draft",
              compact_summary: fields.compact_summary,
              grapes_line: fields.grapes_line,
              making_line: fields.making_line,
              origin_story: fields.origin_story,
              name_meaning: fields.name_meaning,
              mouthfeel: fields.mouthfeel,
              pairings: fields.pairings.slice(0, 5),
              sales_pitch: fields.sales_pitch,
              fun_fact: fields.fun_fact,
              do_not_confuse: fields.do_not_confuse,
              generated_by_ai: true,
              model_notes: "openai/gpt-6-astra",
            },
            { onConflict: "wine_id" },
          );
        if (upErr) throw new Error(upErr.message);
        saved += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha na geração.";
        failures.push(`${w.name}: ${msg}`);
      }
    }

    return { saved, failures };
  });

const SaveSchema = z.object({
  restaurant_id: z.string().uuid(),
  wine_id: z.string().uuid(),
  status: z.enum(["draft", "published"]),
  compact_summary: z.string().max(900),
  grapes_line: z.string().max(400),
  making_line: z.string().max(600),
  origin_story: z.string().max(2000),
  name_meaning: z.string().max(2000),
  mouthfeel: z.string().max(400),
  pairings: z.array(z.string().max(120)).max(5),
  sales_pitch: z.string().max(600),
  fun_fact: z.string().max(800),
  do_not_confuse: z.string().max(800),
});

/** Salva as edições do gestor e define rascunho ou publicada. */
export const saveTrainingCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wine_story_cards")
      .upsert({ ...data }, { onConflict: "wine_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Publica ou volta para rascunho vários rótulos de uma vez. */
export const setTrainingCardsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        restaurant_id: z.string().uuid(),
        wine_ids: z.array(z.string().uuid()).min(1),
        status: z.enum(["draft", "published"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wine_story_cards")
      .update({ status: data.status })
      .eq("restaurant_id", data.restaurant_id)
      .in("wine_id", data.wine_ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
