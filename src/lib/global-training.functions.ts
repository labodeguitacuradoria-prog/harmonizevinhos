import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRAINING_SYSTEM_PROMPT, COMPACT_SUMMARY_RULE, buildTrainingUserPrompt } from "./training-prompt";

const FieldsSchema = z.object({
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
const ImageSchema = z.object({ image_url: z.string().max(2000).nullable().optional() });

async function assertAdmin(context: any) {
  const { data: ok } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!ok) throw new Error("Apenas o administrador geral pode alterar conteúdo global.");
}

export const generateGlobalTrainingCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ catalog_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Serviço de IA não configurado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wine, error } = await supabaseAdmin.from("wine_catalog").select("*").eq("id", data.catalog_id).single();
    if (error || !wine) throw new Error("Rótulo global não encontrado.");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system: `${TRAINING_SYSTEM_PROMPT}\n${COMPACT_SUMMARY_RULE}`,
      prompt: buildTrainingUserPrompt({ ...wine, otherLabels: [] }),
      output: Output.object({ schema: FieldsSchema }),
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false } },
    });
    const fields = FieldsSchema.parse(await result.output);
    const { error: saveError } = await supabaseAdmin.from("global_wine_story_cards").upsert({
      catalog_id: data.catalog_id,
      status: "draft",
      ...fields,
      generated_by_ai: true,
      model_notes: "openai/gpt-6-astra",
    }, { onConflict: "catalog_id" });
    if (saveError) throw new Error(saveError.message);
    return fields;
  });

export const saveGlobalTrainingCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ catalog_id: z.string().uuid(), status: z.enum(["draft", "published"]) }).merge(FieldsSchema).merge(ImageSchema).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("global_wine_story_cards").upsert(data, { onConflict: "catalog_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importGlobalTrainingCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurant_id: z.string().uuid(), wine_id: z.string().uuid(), catalog_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: canManage } = await context.supabase.rpc("can_manage_restaurant", { _user_id: context.userId, _restaurant_id: data.restaurant_id });
    if (!canManage) throw new Error("Sem permissão para este restaurante.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wine } = await supabaseAdmin.from("wines").select("id").eq("id", data.wine_id).eq("restaurant_id", data.restaurant_id).maybeSingle();
    if (!wine) throw new Error("Rótulo do restaurante não encontrado.");
    const { data: card } = await supabaseAdmin.from("global_wine_story_cards").select("compact_summary, grapes_line, making_line, origin_story, name_meaning, mouthfeel, pairings, sales_pitch, fun_fact, do_not_confuse, image_url").eq("catalog_id", data.catalog_id).eq("status", "published").maybeSingle();
    if (!card) return { imported: false };
    const { error } = await supabaseAdmin.from("wine_story_cards").upsert({
      wine_id: data.wine_id,
      restaurant_id: data.restaurant_id,
      status: "draft",
      ...card,
      generated_by_ai: false,
      model_notes: "Importada do Catálogo Global",
    }, { onConflict: "wine_id" });
    if (error) throw new Error(error.message);
    return { imported: true };
  });