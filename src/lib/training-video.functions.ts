import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const VIDEO_MODEL = "google/gemini-omni-1.1-flash";
const SCENE_SECONDS = 4;
const MAX_SCENES = 7;

async function assertCanManage(context: any, restaurantId: string) {
  const { data: ok } = await context.supabase.rpc("can_manage_restaurant", {
    _user_id: context.userId,
    _restaurant_id: restaurantId,
  });
  if (!ok) throw new Error("Sem permissão para gerenciar este restaurante.");
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Serviço de vídeo não configurado.");
  return key;
}

type SceneScript = { caption: string; prompt: string; image_url: string | null };
type VideoScript = { scenes: SceneScript[] };

const IdSchema = z.object({
  restaurant_id: z.string().uuid(),
  wine_id: z.string().uuid(),
});

async function loadWine(restaurantId: string, wineId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("wines")
    .select(
      "id, name, producer, country, region, appellation, vintage, wine_type, style, grape, production_method, aging, oak_months, tasting_notes, image_url, gallery_urls, catalog_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", wineId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rótulo não encontrado.");

  let images = [data.image_url, ...((data.gallery_urls ?? []) as string[])].filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );

  if (data.catalog_id) {
    const { data: cat } = await supabaseAdmin
      .from("wine_catalog")
      .select("image_url, gallery_urls")
      .eq("id", data.catalog_id)
      .maybeSingle();
    if (cat) {
      images = images.concat(
        [cat.image_url, ...((cat.gallery_urls ?? []) as string[])].filter(
          (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
        ),
      );
    }
  }

  return { wine: data, images: Array.from(new Set(images)).slice(0, MAX_SCENES) };
}

/** Lista as fotos disponíveis do rótulo (principal + galeria + cadastro global). */
export const getWineVideoImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const { images } = await loadWine(data.restaurant_id, data.wine_id);
    return { images };
  });

const ScriptSchema = z.object({
  scenes: z
    .array(
      z.object({
        caption: z.string(),
        prompt: z.string(),
      }),
    )
    .min(1),
});

const StartSchema = IdSchema.extend({
  image_urls: z.array(z.string().url()).max(MAX_SCENES),
  scene_count: z.number().int().min(3).max(MAX_SCENES),
});

/** Monta o roteiro das cenas de 4 segundos e coloca o vídeo na fila. */
export const startTrainingVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const key = apiKey();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { wine } = await loadWine(data.restaurant_id, data.wine_id);

    const photos = data.image_urls.slice(0, data.scene_count);
    const generated = Math.max(0, data.scene_count - photos.length);

    const lovable = createOpenAI({
      baseURL: GATEWAY,
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const wineInfo = [
      `Nome: ${wine.name}`,
      wine.producer ? `Produtor: ${wine.producer}` : null,
      [wine.appellation, wine.region, wine.country].filter(Boolean).join(", "),
      wine.vintage ? `Safra: ${wine.vintage}` : null,
      wine.style || wine.wine_type ? `Estilo: ${wine.style ?? wine.wine_type}` : null,
      wine.grape ? `Uvas: ${wine.grape}` : null,
      wine.production_method ? `Método: ${wine.production_method}` : null,
      wine.oak_months ? `Madeira: ${wine.oak_months} meses` : null,
      wine.tasting_notes ? `Notas: ${String(wine.tasting_notes).slice(0, 400)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system:
        "Você cria roteiros curtos e dinâmicos de vídeo vertical para treinar equipes de restaurante sobre vinhos. " +
        `São ${data.scene_count} cenas de ${SCENE_SECONDS} segundos cada. ` +
        "Para cada cena devolva: caption (legenda em português, no máximo 9 palavras, que a equipe lê na tela) e prompt (direção de vídeo em inglês). " +
        `As primeiras ${photos.length} cenas partem de fotos reais do vinho: o prompt descreve APENAS o movimento de câmera e o ambiente, um único movimento lento por cena, sem redescrever o que a foto mostra, e inclui a frase "keep the label, shape, colors and proportions unchanged". ` +
        `As últimas ${generated} cenas não têm foto: o prompt descreve uma cena real da origem do vinho (vinhedo, cantina, serviço à mesa) em plano único, 4 segundos. ` +
        "Em todos os prompts termine com direção de áudio simples, por exemplo: Audio: soft acoustic guitar, no dialogue, no on-screen text.",
      prompt: `Vinho:\n${wineInfo}\n\nCenas com foto real: ${photos.length}. Cenas geradas: ${generated}.`,
      output: Output.object({ schema: ScriptSchema }),
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

    const script = (await result.output) as z.infer<typeof ScriptSchema>;
    const scenes: SceneScript[] = script.scenes.slice(0, data.scene_count).map((s, i) => ({
      caption: s.caption.slice(0, 120),
      prompt: s.prompt.slice(0, 900),
      image_url: photos[i] ?? null,
    }));
    if (!scenes.length) throw new Error("Não foi possível montar o roteiro do vídeo.");

    const { error } = await supabaseAdmin
      .from("wine_story_cards")
      .upsert(
        {
          wine_id: data.wine_id,
          restaurant_id: data.restaurant_id,
          video_script: { scenes } satisfies VideoScript,
          video_status: "queued",
          video_job_ids: [],
          video_paths: [],
          video_error: null,
          video_published: false,
          video_updated_at: new Date().toISOString(),
        },
        { onConflict: "wine_id" },
      );
    if (error) throw new Error(error.message);

    return { scenes: scenes.map((s) => ({ caption: s.caption, has_photo: !!s.image_url })) };
  });

async function fetchImagePart(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(png|jpeg|jpg|webp)/i.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 6_000_000) return null;
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return { type: "image" as const, data: btoa(binary), mime_type: type.split(";")[0] };
  } catch {
    return null;
  }
}

/** Executa um passo do vídeo: cria a cena, acompanha e guarda o trecho pronto. */
export const advanceTrainingVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const key = apiKey();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: card, error } = await supabaseAdmin
      .from("wine_story_cards")
      .select("video_script, video_status, video_job_ids, video_paths, video_error")
      .eq("restaurant_id", data.restaurant_id)
      .eq("wine_id", data.wine_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!card) throw new Error("Ficha não encontrada.");

    const scenes = ((card.video_script as VideoScript | null)?.scenes ?? []) as SceneScript[];
    const jobIds = ((card.video_job_ids ?? []) as string[]).slice();
    const paths = ((card.video_paths ?? []) as string[]).slice();

    if (!scenes.length) throw new Error("Nenhum roteiro de vídeo para este rótulo.");

    const index = paths.length;
    if (index >= scenes.length) {
      await supabaseAdmin
        .from("wine_story_cards")
        .update({ video_status: "ready", video_updated_at: new Date().toISOString() })
        .eq("wine_id", data.wine_id);
      return { status: "ready" as const, total: scenes.length, done: scenes.length };
    }

    const scene = scenes[index]!;
    const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

    async function fail(message: string) {
      await supabaseAdmin
        .from("wine_story_cards")
        .update({
          video_status: "error",
          video_error: message.slice(0, 500),
          video_updated_at: new Date().toISOString(),
        })
        .eq("wine_id", data.wine_id);
      return { status: "error" as const, message, total: scenes.length, done: paths.length };
    }

    let jobId = jobIds[index];

    if (!jobId) {
      const parts: unknown[] = [{ type: "text", text: scene.prompt }];
      if (scene.image_url) {
        const image = await fetchImagePart(scene.image_url);
        if (image) parts.unshift(image);
      }
      const body = {
        model: VIDEO_MODEL,
        input: parts,
        response_format: {
          type: "video",
          resolution: "720p",
          duration: `${SCENE_SECONDS}s`,
          aspect_ratio: "9:16",
        },
      };
      const res = await fetch(`${GATEWAY}/videos`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        if (res.status === 429) {
          return { status: "waiting" as const, total: scenes.length, done: paths.length };
        }
        return await fail(err?.message ?? `Falha ao criar a cena ${index + 1}.`);
      }
      const job = (await res.json()) as { id: string };
      jobIds[index] = job.id;
      await supabaseAdmin
        .from("wine_story_cards")
        .update({
          video_job_ids: jobIds,
          video_status: "generating",
          video_updated_at: new Date().toISOString(),
        })
        .eq("wine_id", data.wine_id);
      return { status: "generating" as const, total: scenes.length, done: paths.length };
    }

    const jobRes = await fetch(`${GATEWAY}/videos/${jobId}`, { headers });
    if (!jobRes.ok) {
      if (jobRes.status === 429) {
        return { status: "waiting" as const, total: scenes.length, done: paths.length };
      }
      return await fail(`Falha ao consultar a cena ${index + 1}.`);
    }
    const job = (await jobRes.json()) as {
      status: string;
      progress?: number;
      error?: { message?: string };
    };

    if (job.status === "failed") {
      return await fail(job.error?.message ?? `A cena ${index + 1} foi recusada.`);
    }
    if (job.status !== "completed") {
      return {
        status: "generating" as const,
        total: scenes.length,
        done: paths.length,
        progress: job.progress ?? 0,
      };
    }

    const contentRes = await fetch(`${GATEWAY}/videos/${jobId}/content`, { headers });
    if (!contentRes.ok) return await fail(`Não foi possível baixar a cena ${index + 1}.`);
    const mp4 = await contentRes.arrayBuffer();
    const path = `training-videos/${data.restaurant_id}/${data.wine_id}/${index + 1}-${jobId}.mp4`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("product-media")
      .upload(path, mp4, { contentType: "video/mp4", upsert: true });
    if (upErr) return await fail(upErr.message);

    paths.push(path);
    const finished = paths.length >= scenes.length;
    await supabaseAdmin
      .from("wine_story_cards")
      .update({
        video_paths: paths,
        video_status: finished ? "ready" : "generating",
        video_updated_at: new Date().toISOString(),
      })
      .eq("wine_id", data.wine_id);

    return {
      status: finished ? ("ready" as const) : ("generating" as const),
      total: scenes.length,
      done: paths.length,
    };
  });

/** Publica ou recolhe o vídeo para a equipe. */
export const setTrainingVideoPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.extend({ published: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wine_story_cards")
      .update({ video_published: data.published, video_updated_at: new Date().toISOString() })
      .eq("restaurant_id", data.restaurant_id)
      .eq("wine_id", data.wine_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Link temporário para o gestor assistir os trechos antes de publicar. */
export const getTrainingVideoPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: card } = await supabaseAdmin
      .from("wine_story_cards")
      .select("video_paths, video_script")
      .eq("restaurant_id", data.restaurant_id)
      .eq("wine_id", data.wine_id)
      .maybeSingle();
    const paths = ((card?.video_paths ?? []) as string[]) ?? [];
    const captions = (((card?.video_script as VideoScript | null)?.scenes ?? []) as SceneScript[]).map(
      (s) => s.caption,
    );
    const urls: string[] = [];
    for (const p of paths) {
      const { data: signed } = await supabaseAdmin.storage
        .from("product-media")
        .createSignedUrl(p, 3600);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
    return { urls, captions };
  });
