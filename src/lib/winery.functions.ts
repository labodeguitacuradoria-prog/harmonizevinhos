import { createServerFn } from "@tanstack/react-start";
import { generateResponse } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  producer: z.string().min(1).max(200),
  url: z.string().url().max(2000).optional(),
  text: z.string().max(40000).optional(),
});

export type WineryExtract = { about: string | null; country: string | null; region: string | null; city: string | null; founded: string | null; website: string | null };

function htmlToText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Lê o site (ou texto colado) da vinícola e devolve a história institucional estruturada. */
export const extractWinery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; data: WineryExtract } | { ok: false; error: string }> => {
    let content = data.text?.trim() ?? "";
    if (data.url) {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
      let txt = "";
      try {
        const r = await fetch(data.url, { headers: { "User-Agent": ua, Accept: "text/html,*/*" }, redirect: "follow" });
        if (r.ok) txt = htmlToText(await r.text());
      } catch { /* tenta proxy */ }
      if (txt.length < 200) {
        try {
          const r = await fetch(`https://r.jina.ai/${data.url}`, { headers: { "User-Agent": ua, Accept: "text/plain" } });
          if (r.ok) txt = htmlToText(await r.text());
        } catch { /* sem conteúdo */ }
      }
      if (txt.length < 80) return { ok: false, error: "Não foi possível ler este site. Copie o texto da página “Sobre/História” e cole no campo de texto." };
      content = `${content}\n\n${txt}`.slice(0, 24000);
    }
    if (content.length < 40) return { ok: false, error: "Informe o site da vinícola ou cole um texto sobre ela." };
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: "Você escreve material de treinamento para garçons. Responda APENAS um objeto JSON com as chaves: about (história da vinícola em português do Brasil, 3 a 6 frases claras, sem markdown: fundação, família, terroir, filosofia, destaques), country, region, city (cidade/município onde fica a vinícola), founded (ano), website. Use null quando não souber. Ignore menus, rodapés e avisos.",
        input: `Vinícola: ${data.producer}${data.url ? `\nSite: ${data.url}` : ""}\n\n"""\n${content}\n"""`,
      });
      let text = "";
      for (const o of res.output ?? [])
        if (o.type === "message")
          for (const c of o.content) if (c.type === "output_text") text += c.text;
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      const p = JSON.parse(text.slice(s, e + 1));
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : v != null && typeof v === "number" ? String(v) : null);
      return { ok: true, data: { about: str(p.about), country: str(p.country), region: str(p.region), city: str(p.city), founded: str(p.founded), website: str(p.website) ?? data.url ?? null } };
    } catch (err) {
      console.error("[extractWinery]", err);
      return { ok: false, error: "A IA não conseguiu organizar as informações. Tente novamente." };
    }
  });

const GeoInput = z.object({
  name: z.string().min(1).max(200),
  city: z.string().max(200).optional(),
  region: z.string().max(200).optional(),
  country: z.string().min(1).max(120),
  iso2: z.string().length(2).optional(),
  bbox: z.object({ minLat: z.number(), maxLat: z.number(), minLng: z.number(), maxLng: z.number() }).optional(),
});

export type WineryGeo = { lat: number; lng: number; precision: "vinícola" | "cidade" | "região" | "país"; label: string };

/** Localiza a vinícola (OpenStreetMap): primeiro pelo nome, depois cidade, região e país. */
export const geocodeWinery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GeoInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; data: WineryGeo } | { ok: false; error: string }> => {
    const ua = "LaBodeguita/1.0 (labodeguitavinhos.lovable.app)";
    const inBox = (lat: number, lng: number) => {
      const b = data.bbox;
      if (!b) return true;
      const mx = (b.maxLng - b.minLng) * 0.08 + 0.3, my = (b.maxLat - b.minLat) * 0.08 + 0.3;
      return lat >= b.minLat - my && lat <= b.maxLat + my && lng >= b.minLng - mx && lng <= b.maxLng + mx;
    };
    type Hit = { lat: string; lon: string; category?: string; type?: string; display_name?: string };
    const search = async (q: string): Promise<Hit[]> => {
      const u = new URL("https://nominatim.openstreetmap.org/search");
      u.searchParams.set("q", q);
      u.searchParams.set("format", "jsonv2");
      u.searchParams.set("limit", "5");
      u.searchParams.set("accept-language", "pt-BR");
      if (data.iso2) u.searchParams.set("countrycodes", data.iso2.toLowerCase());
      try {
        const r = await fetch(u.toString(), { headers: { "User-Agent": ua, Accept: "application/json" } });
        return r.ok ? ((await r.json()) as Hit[]) : [];
      } catch { return []; }
    };
    const wait = () => new Promise((res) => setTimeout(res, 1100)); // limite de 1 consulta/s do serviço
    const steps: { q: string; precision: WineryGeo["precision"]; label: string; accept?: (h: Hit) => boolean }[] = [];
    steps.push({ q: data.name, precision: "vinícola", label: data.name, accept: (h) => /winery|vineyard|wine|vinic|bodega|vin[ií]cola/i.test(`${h.type} ${h.category} ${h.display_name}`) && (h.category === "craft" || h.type === "winery" || h.type === "vineyard" || h.category === "tourism" || h.category === "shop" || /vin[ií]cola|winery|bodega/i.test(h.display_name ?? "")) });
    if (data.city) steps.push({ q: [data.city, data.region, data.country].filter(Boolean).join(", "), precision: "cidade", label: data.city });
    if (data.region) steps.push({ q: [data.region, data.country].join(", "), precision: "região", label: data.region });
    steps.push({ q: data.country, precision: "país", label: data.country });
    for (let i = 0; i < steps.length; i++) {
      if (i > 0) await wait();
      const st = steps[i];
      const hits = await search(st.q);
      const hit = hits.find((h) => (!st.accept || st.accept(h)) && inBox(+h.lat, +h.lon));
      if (hit) return { ok: true, data: { lat: +hit.lat, lng: +hit.lon, precision: st.precision, label: st.label } };
    }
    return { ok: false, error: "Não encontramos a localização. Clique no mapa para marcar o ponto." };
  });
