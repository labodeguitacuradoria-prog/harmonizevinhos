import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGateway } from "./ai-gateway.server";

const SYSTEM_PROMPT = `Você é um Sommelier de nível Master of Wine e Analista Químico especialista em leitura de fichas técnicas de vinícolas e notas de degustação.
Sua missão é ler o material fornecido (ficha técnica em PDF/imagem ou texto colado), extrair rigorosamente todas as informações sensoriais, físicas e químicas, e retornar uma resposta estritamente estruturada em JSON.

Instruções específicas:
1. Extraia o nome exato do vinho ("rotulo").
2. Identifique o produtor ("produtor"), país ("pais"), região ("regiao") e safra ("safra", número inteiro do ano) quando presentes.
2b. Para vinhos EUROPEUS, extraia também a Denominação de Origem Protegida em "denominacao" — usando exatamente a nomenclatura oficial do país: França "AOP/AOC ..." (ex: "AOC Saint-Émilion Grand Cru"), Itália "DOC/DOCG ..." (ex: "DOCG Barolo"), Espanha "DO/DOCa ..." (ex: "DOCa Rioja"), Portugal "DOP/DOC ..." (ex: "DOC Douro"), Alemanha "Prädikatswein/g.U. ...". Para vinhos NÃO europeus, retorne null.
3. Identifique o tipo de vinho ("tipo"). Escolha apenas um entre: "Tinto", "Branco", "Espumante", "Rosé", "Doce", "Fortificado".
4. Identifique o estilo regulamentado ("estilo"). Escolha OBRIGATORIAMENTE um dos valores exatos em maiúsculas: "ESPUMANTE", "BRANCO LEVE", "BRANCO AROMÁTICO", "BRANCO ENCORPADO", "ROSÉ", "TINTO LEVE", "TINTO MÉDIO", "TINTO ENCORPADO", "FORTIFICADO".
5. Extraia detalhadamente o blend de uvas ("grapes"): para cada uva, nome ("grape") e porcentagem ("pct", 0-100). Se varietal, 100. Se blend sem percentuais explícitos, divida igualmente ou estime.
6. Para cada uva, se passou por barrica de carvalho por tempo específico, informe em "mesesBarrica" (0 se não). Informe também o tempo médio geral em "mesesBarrica" (nível raiz).
7. Extraia parâmetros físico-químicos:
   - Teor Alcoólico ("alcool") em % vol
   - Açúcar Residual ("acucar") em g/l
   - Acidez Total ("acidezVal") em g/l
   - pH ("ph")
8. Para espumantes, identifique o método de produção ("metodoProducao"): "Tradicional", "Charmat" ou "Asti". Se não for espumante, deixe null.
9. Na propriedade "informacoes_tecnicas", redija um texto altamente didático em português, estruturado nas 5 seções abaixo, cada uma separada por quebras de linha duplas:

**COMENTÁRIOS DO PRODUTOR E MÉTODOS DE PRODUÇÃO/MATURAÇÃO**
[introdução sobre história, produtor, terroir e técnicas de vinificação/barrica]

**ANÁLISE VISUAL**
[cor, intensidade, halo de evolução, brilho, limpidez]

**ANÁLISE OLFATIVA**
[frutas, flores, especiarias, tostados, evolução aromática]

**ANÁLISE GUSTATIVA (PALADAR)**
[corpo, acidez, taninos, equilíbrio alcoólico, final de boca]

**HARMONIZAÇÃO**
[sugestões práticas de pratos e ingredientes, com justificativa]

10. **BLEND DE UVAS (CASTA)** — extraia TODAS as uvas listadas, cada uma como item separado em "grapes", com "grape" (nome), "pct" (0-100) e "mesesBarrica" (tempo em barrica específico daquela casta, quando informado; 0 caso não passe). Se a soma dos percentuais não fechar 100, ajuste proporcionalmente. Para varietais, use pct=100.
11. **LAUDO QUÍMICO & ANALÍTICO** — extraia rigorosamente do laudo/ficha: "alcool" (% vol), "acucar" (açúcar residual em g/L), "acidezVal" (acidez total em g/L) e "ph" (pH do vinho). Se estiver disponível, priorize sempre o valor do laudo em vez da descrição textual.
12. **PASSAGEM POR BARRICA** — sempre que houver informação sobre carvalho/barrica, preencha "mesesBarrica" (nível raiz = média geral do vinho) e o "mesesBarrica" de CADA uva individualmente. Se apenas parte do blend passa por madeira, informe 0 para as outras.
13. **PESOS & INTENSIDADES SOMMELIER (obrigatório)** — dentro do objeto "pesos", preencha SEMPRE (nunca null) valores inteiros de 1 a 10 como sommelier profissional:
   - "corpo" (1=Leve, 10=Encorpado)
   - "acidez" (1=Plana, 10=Vibrante)
   - "taninos" (1=Nulo, 10=Forte — brancos/espumantes/rosés normalmente 1-2)
   - "docura" (1=Seco, 10=Doce — coerente com açúcar residual)
   - "estagioBarrica" (1=Sem madeira, 10=Muito amadeirado — coerente com meses em barrica)
   - "intensidadeAromatica" (1=Delicado, 10=Exuberante)
14. Na propriedade "informacoes_tecnicas", redija texto didático estruturado em 5 blocos separados por \\n\\n: **COMENTÁRIOS DO PRODUTOR E MÉTODOS**, **ANÁLISE VISUAL**, **ANÁLISE OLFATIVA**, **ANÁLISE GUSTATIVA**, **HARMONIZAÇÃO**.
15. Na propriedade "texto_original", transcreva textualmente o conteúdo relevante do material original.
16. **PREMIAÇÕES** — extraia em "premiacoes" (array de strings, até 10 itens) todos os prêmios/pontuações citados no material. Ex: "92 pts Wine Spectator 2022", "Medalha de Ouro Decanter 2021". Se nenhum, retorne [].
17. **IMAGEM DO RÓTULO** — se o material contiver uma URL absoluta (http/https) apontando para uma imagem/foto do rótulo/garrafa, retorne-a em "imagemUrl"; caso contrário null. Não invente URL.
18. **ELABORAÇÃO** — em "elaboracao", descreva vinificação (fermentação, leveduras, tanques, temperatura). Null se ausente.
19. **MATURAÇÃO** — em "maturacao", descreva envelhecimento (barrica, tempo, tipo de carvalho, guarda em garrafa). Null se ausente.
20. **TEMPERATURA DE SERVIÇO** — extraia em "tempServicoMin" e "tempServicoMax" (°C) quando informado.
21. **HARMONIZAÇÃO** — em "harmonizacao", texto objetivo com sugestões práticas de pratos.
22. **CONCEITOS QUALITATIVOS** — preencha "nivelAcucar" (um de: "Seco", "Meio-seco", "Suave", "Doce"), "conceitoCorpo" (um de: "Leve", "Médio", "Encorpado"), "conceitoTaninos" e "conceitoAcidez" (um de: "Baixo", "Médio", "Alto"). Para brancos/espumantes/rosés, "conceitoTaninos" geralmente é "Baixo".
23. **MÉTODO DO ESPUMANTE** — se for espumante, "metodoProducao" DEVE ser "Tradicional", "Charmat" ou "Asti" (ou "Outro: <descrição>" se explicitamente citado outro método). Null quando não for espumante.
24. **PREÇO DE VENDA AO CONSUMIDOR** — se o material citar preço sugerido/recomendado de venda ao consumidor (PDV, "preço sugerido", "sugestão de venda", "MSRP", "PVP", "preço ao consumidor"), extraia em "precoVendaSugerido" o valor numérico em reais (R$). Aceite formatos brasileiros ("R$ 189,90" → 189.90). Se o preço aparecer em outra moeda ou for preço de custo/importador (não ao consumidor final), retorne null.

ATENÇÃO CRÍTICA:
- Use aspas simples (') para citações dentro de strings; nunca aspas duplas não escapadas.
- Use '\\n' em vez de quebras de linha reais dentro de strings JSON.
- Dados numéricos ausentes = null (exceto o objeto "pesos", que é sempre preenchido).`;

const GrapeSchema = z.object({
  grape: z.string(),
  pct: z.number().nullable(),
  mesesBarrica: z.number().nullable(),
});

const PesosSchema = z.object({
  corpo: z.number().nullable(),
  acidez: z.number().nullable(),
  taninos: z.number().nullable(),
  docura: z.number().nullable(),
  estagioBarrica: z.number().nullable(),
  intensidadeAromatica: z.number().nullable(),
});

const ExtractedSchema = z.object({
  rotulo: z.string().nullable(),
  produtor: z.string().nullable(),
  pais: z.string().nullable(),
  regiao: z.string().nullable(),
  denominacao: z.string().nullable(),
  safra: z.number().nullable(),
  tipo: z.string().nullable(),
  estilo: z.string().nullable(),
  grapes: z.array(GrapeSchema),
  mesesBarrica: z.number().nullable(),
  alcool: z.number().nullable(),
  acucar: z.number().nullable(),
  acidezVal: z.number().nullable(),
  ph: z.number().nullable(),
  metodoProducao: z.string().nullable(),
  pesos: PesosSchema.nullable(),
  informacoes_tecnicas: z.string().nullable(),
  texto_original: z.string().nullable(),
  premiacoes: z.array(z.string()).nullable(),
  imagemUrl: z.string().nullable(),
  elaboracao: z.string().nullable(),
  maturacao: z.string().nullable(),
  tempServicoMin: z.number().nullable(),
  tempServicoMax: z.number().nullable(),
  harmonizacao: z.string().nullable(),
  nivelAcucar: z.string().nullable(),
  conceitoCorpo: z.string().nullable(),
  conceitoTaninos: z.string().nullable(),
  conceitoAcidez: z.string().nullable(),
  precoVendaSugerido: z.number().nullable(),
});

export type ExtractedWine = z.infer<typeof ExtractedSchema>;

async function callModel(userContent: unknown): Promise<ExtractedWine> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const gateway = createLovableAiGateway(apiKey);
  const model = gateway("google/gemini-3-flash-preview");

  try {
    const { output } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent as any }],
      output: Output.object({ schema: ExtractedSchema }),
      maxOutputTokens: 16384,
      temperature: 0.2,
    });
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const raw = error.text ?? "";
      const tryParse = (s: string) => {
        try { return JSON.parse(s); } catch { return null; }
      };
      let parsed: any = tryParse(raw);
      if (!parsed) {
        const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fence?.[1] ?? raw;
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");
        if (start !== -1 && end > start) {
          parsed = tryParse(candidate.substring(start, end + 1));
        }
      }
      if (parsed && typeof parsed === "object") {
        // Coerção tolerante: preenche campos ausentes/errados em vez de rejeitar tudo
        const safe = ExtractedSchema.safeParse(parsed);
        if (safe.success) return safe.data;
        return coerceExtracted(parsed);
      }
      console.error("[wine-extraction] Falha ao parsear resposta da IA. Prévia:", raw.slice(0, 400));
      throw new Error(
        "A IA retornou uma resposta incompleta ou fora do formato esperado. Tente novamente — se persistir, cole o texto da ficha na aba 'Texto colado'."
      );
    }
    console.error("[wine-extraction] Erro na chamada da IA:", error);
    throw error;
  }
}

/** Extração em modo texto puro: pede JSON no prompt e parseia com tolerância.
 *  Mais robusto que o modo estruturado para conteúdo ruidoso (páginas web). */
async function callModelJsonMode(userText: string): Promise<ExtractedWine> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const gateway = createLovableAiGateway(apiKey);
  const { text: raw } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    system: `${SYSTEM_PROMPT}

FORMATO DA RESPOSTA: responda APENAS com um único objeto JSON (sem texto antes/depois, sem array externo), contendo exatamente as chaves: rotulo, produtor, pais, regiao, denominacao, safra, tipo, estilo, grapes (array de {grape, pct, mesesBarrica}), mesesBarrica, alcool, acucar, acidezVal, ph, metodoProducao, pesos {corpo, acidez, taninos, docura, estagioBarrica, intensidadeAromatica}, informacoes_tecnicas, texto_original, premiacoes (array de strings), imagemUrl, elaboracao, maturacao, tempServicoMin, tempServicoMax, harmonizacao, nivelAcucar, conceitoCorpo, conceitoTaninos, conceitoAcidez, precoVendaSugerido.`,
    prompt: userText,
    maxOutputTokens: 16384,
    temperature: 0.2,
  });

  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  let parsed: any = tryParse(raw.trim());
  if (!parsed) {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence?.[1] ?? raw;
    const s = candidate.indexOf("{");
    const e = candidate.lastIndexOf("}");
    if (s !== -1 && e > s) parsed = tryParse(candidate.substring(s, e + 1));
  }
  if (Array.isArray(parsed)) parsed = parsed.find((x) => x && typeof x === "object") ?? null;
  if (!parsed || typeof parsed !== "object") {
    console.error("[wine-extraction] JSON inválido. Prévia:", raw.slice(0, 400));
    throw new Error(
      "A IA não conseguiu estruturar as informações desta página. Tente novamente ou cole o texto na aba 'Texto colado'."
    );
  }
  const safe = ExtractedSchema.safeParse(parsed);
  return safe.success ? safe.data : coerceExtracted(parsed);
}


function coerceExtracted(p: any): ExtractedWine {
  const num = (v: any) => (typeof v === "number" && !isNaN(v) ? v : v != null && !isNaN(Number(v)) ? Number(v) : null);
  const str = (v: any) => (typeof v === "string" ? v : v == null ? null : String(v));
  const grapes = Array.isArray(p.grapes)
    ? p.grapes.filter((g: any) => g && typeof g === "object").map((g: any) => ({
        grape: str(g.grape) ?? "",
        pct: num(g.pct),
        mesesBarrica: num(g.mesesBarrica),
      }))
    : [];
  const pesosIn = p.pesos && typeof p.pesos === "object" ? p.pesos : null;
  const pesos = pesosIn
    ? {
        corpo: num(pesosIn.corpo),
        acidez: num(pesosIn.acidez),
        taninos: num(pesosIn.taninos),
        docura: num(pesosIn.docura),
        estagioBarrica: num(pesosIn.estagioBarrica),
        intensidadeAromatica: num(pesosIn.intensidadeAromatica),
      }
    : null;
  return {
    rotulo: str(p.rotulo),
    produtor: str(p.produtor),
    pais: str(p.pais),
    regiao: str(p.regiao),
    denominacao: str(p.denominacao),
    safra: num(p.safra),
    tipo: str(p.tipo),
    estilo: str(p.estilo),
    grapes,
    mesesBarrica: num(p.mesesBarrica),
    alcool: num(p.alcool),
    acucar: num(p.acucar),
    acidezVal: num(p.acidezVal),
    ph: num(p.ph),
    metodoProducao: str(p.metodoProducao),
    pesos,
    informacoes_tecnicas: str(p.informacoes_tecnicas),
    texto_original: str(p.texto_original),
    premiacoes: Array.isArray(p.premiacoes) ? p.premiacoes.map(str).filter(Boolean) as string[] : null,
    imagemUrl: str(p.imagemUrl),
    elaboracao: str(p.elaboracao),
    maturacao: str(p.maturacao),
    tempServicoMin: num(p.tempServicoMin),
    tempServicoMax: num(p.tempServicoMax),
    harmonizacao: str(p.harmonizacao),
    nivelAcucar: str(p.nivelAcucar),
    conceitoCorpo: str(p.conceitoCorpo),
    conceitoTaninos: str(p.conceitoTaninos),
    conceitoAcidez: str(p.conceitoAcidez),
    precoVendaSugerido: num(p.precoVendaSugerido),
  };
}

const FileInput = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().min(1),
});

export const extractWineFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FileInput.parse(d))
  .handler(async ({ data }) => {
    let base64 = data.fileBase64;
    const c = base64.indexOf(",");
    if (c !== -1) base64 = base64.substring(c + 1);

    const isImage = data.mimeType.startsWith("image/");
    const userContent = isImage
      ? [
          { type: "text" as const, text: "Extraia todas as informações técnicas desta ficha de vinho conforme o esquema JSON solicitado." },
          { type: "image" as const, image: `data:${data.mimeType};base64,${base64}` },
        ]
      : [
          { type: "text" as const, text: "Extraia todas as informações técnicas desta ficha de vinho conforme o esquema JSON solicitado." },
          { type: "file" as const, data: base64, mediaType: data.mimeType },
        ];

    return callModel(userContent);
  });

const TextInput = z.object({ text: z.string().min(10) });

export const extractWineFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TextInput.parse(d))
  .handler(async ({ data }) => {
    const userContent = [
      {
        type: "text" as const,
        text: `Analise o texto a seguir e extraia todos os dados técnicos:\n\n"""\n${data.text}\n"""`,
      },
    ];
    return callModel(userContent);
  });

const UrlInput = z.object({ url: z.string().url() });

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const extractWineFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UrlInput.parse(d))
  .handler(async ({ data }) => {
    let res: Response;
    try {
      res = await fetch(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
        },
      });
    } catch {
      throw new Error("Não foi possível acessar o link. Verifique o endereço.");
    }
    if (!res.ok) throw new Error(`O site respondeu com erro ${res.status}. Tente outro link.`);

    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("pdf")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
      const base64 = btoa(bin);
      return callModel([
        {
          type: "text" as const,
          text: `Extraia todas as informações técnicas desta ficha de vinho (origem: ${data.url}).`,
        },
        { type: "file" as const, data: base64, mediaType: "application/pdf" },
      ]);
    }

    const html = await res.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const text = htmlToText(html).slice(0, 24000);
    console.log(`[extractWineFromUrl] ${data.url} -> ${text.length} chars, title="${title}"`);
    if (text.length < 80)
      throw new Error("A página não retornou conteúdo legível. Copie o texto e use a aba 'Texto colado'.");

    const prompt = `Conteúdo extraído da página do produtor (URL: ${data.url}${title ? `, título: ${title}` : ""}).
O texto abaixo vem de HTML e pode conter menus, rodapés e avisos legais misturados — ignore essas partes e use apenas o que descreve o vinho (descrição, harmonização, aromas, análise sensorial, teor alcoólico, açúcar, premiações, safra, vinificação, região).
Se o texto não trouxer algum dado técnico, complete com seu conhecimento sobre este rótulo específico; use null apenas quando realmente não souber.

"""
${text}
"""`;

    const first = await callModel([{ type: "text" as const, text: prompt }]);
    if (first.rotulo || first.informacoes_tecnicas || (first.premiacoes?.length ?? 0) > 0) return first;

    console.warn("[extractWineFromUrl] primeira tentativa vazia, refazendo com foco no rótulo");
    return callModel([
      {
        type: "text" as const,
        text: `O rótulo é "${title || data.url}". Preencha a ficha técnica completa deste vinho usando seu conhecimento e o resumo de página a seguir:\n\n"""\n${text.slice(0, 12000)}\n"""`,
      },
    ]);
  });

