import { createServerFn } from "@tanstack/react-start";
import { generateResponse } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  producer: z.string().min(1).max(200),
  url: z.string().url().max(2000).optional(),
  text: z.string().max(40000).optional(),
});

export type WineryExtract = { about: string | null; country: string | null; region: string | null; founded: string | null; website: string | null };

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
        instructions: "Você escreve material de treinamento para garçons. Responda APENAS um objeto JSON com as chaves: about (história da vinícola em português do Brasil, 3 a 6 frases claras, sem markdown: fundação, família, terroir, filosofia, destaques), country, region, founded (ano), website. Use null quando não souber. Ignore menus, rodapés e avisos.",
        input: `Vinícola: ${data.producer}${data.url ? `\nSite: ${data.url}` : ""}\n\n"""\n${content}\n"""`,
      });
      let text = "";
      for (const o of res.output ?? [])
        if (o.type === "message")
          for (const c of o.content) if (c.type === "output_text") text += c.text;
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      const p = JSON.parse(text.slice(s, e + 1));
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : v != null && typeof v === "number" ? String(v) : null);
      return { ok: true, data: { about: str(p.about), country: str(p.country), region: str(p.region), founded: str(p.founded), website: str(p.website) ?? data.url ?? null } };
    } catch (err) {
      console.error("[extractWinery]", err);
      return { ok: false, error: "A IA não conseguiu organizar as informações. Tente novamente." };
    }
  });
