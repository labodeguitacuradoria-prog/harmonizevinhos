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
});

export type ExtractedWine = z.infer<typeof ExtractedSchema>;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!data) throw new Error("Apenas administradores podem usar a extração por IA.");
}

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
    });
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      try {
        const parsed = JSON.parse(error.text ?? "");
        return ExtractedSchema.parse(parsed);
      } catch {
        throw new Error("Não foi possível interpretar a resposta da IA.");
      }
    }
    throw error;
  }
}

const FileInput = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().min(1),
});

export const extractWineFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FileInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
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
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const userContent = [
      {
        type: "text" as const,
        text: `Analise o texto a seguir e extraia todos os dados técnicos:\n\n"""\n${data.text}\n"""`,
      },
    ];
    return callModel(userContent);
  });
