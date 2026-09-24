/**
 * Prompt do módulo de treinamento: fichas rápidas para o staff.
 * Linguagem de salão, nada de nota técnica de degustação.
 */
export const TRAINING_SYSTEM_PROMPT = `Você escreve fichas de bolso para garçons e garçonetes de restaurante que NÃO entendem de vinho.
O objetivo é ajudar a VENDER o rótulo em poucos segundos de conversa com o cliente.

Regras obrigatórias:
- Português do Brasil, frases curtas e diretas, tom simpático e confiante.
- PROIBIDO usar linguagem técnica de degustação (taninos, acidez volátil, retrogosto, notas terciárias, final longo, etc.).
- Nunca invente prêmios, notas de crítico, safras ou fatos que não estejam nos dados fornecidos. Quando não souber, escreva algo verdadeiro e genérico sobre a região/estilo.
- "Por que esse nome": explique o significado do nome do rótulo e, quando o nome vier de outro idioma, explique a nuance de tradução (por exemplo, "Solitude" é a solidão escolhida, tranquila, diferente de "solidão" no sentido de abandono). Se o nome for apenas o sobrenome da família produtora, diga isso.
- "Como é na boca": UMA frase simples, do tipo "leve e refrescante", "encorpado e macio", "levemente adocicado".
- "Combina com": 3 pratos curtos, do dia a dia de restaurante.
- "Fale assim na mesa": uma frase pronta, natural, que o garçom pode dizer ao cliente.
- "Curiosidade": um detalhe memorável e fácil de contar.
- "Não confunda": diga com qual outro rótulo ou estilo parecido esse costuma ser confundido e como diferenciar em uma frase.
- Quando houver duas ou mais informações independentes no mesmo campo, você pode separá-las em linhas iniciadas por "• ". Não transforme textos curtos em listas sem necessidade.
- Uvas: escreva as castas de forma legível. Se não houver informação, escreva "Não informado".
- Como é feito: se for espumante, diga o método (Tradicional/Champenoise, Charmat, Ancestral, Asti) em linguagem simples. Se for vinho tranquilo, diga se passou por madeira e, quando passou, o tipo de barrica e o tempo de estágio; se não passou, escreva "Sem passagem por madeira".`;

export const COMPACT_SUMMARY_RULE = `- "Resumo para apresentar ao cliente": escreva de 45 a 70 palavras, sem jargão. Pode ser um parágrafo ou até 3 frases em linhas separadas iniciadas por "• " quando isso facilitar a leitura. Priorize o motivo do nome, uma curiosidade memorável e uma frase natural que o staff possa dizer à mesa. Não repita preço, volume, país ou região, pois estes dados já aparecem no cabeçalho.`;

export function buildTrainingUserPrompt(w: {
  name: string;
  producer?: string | null;
  country?: string | null;
  region?: string | null;
  appellation?: string | null;
  vintage?: number | null;
  wine_type?: string | null;
  style?: string | null;
  grape?: string | null;
  grapes_detail?: unknown;
  volume?: string | null;
  alcohol_pct?: number | null;
  sugar_level?: string | null;
  body?: string | null;
  production_method?: string | null;
  aging?: string | null;
  oak_months?: number | null;
  elaboration?: string | null;
  tasting_notes?: string | null;
  pairing_notes?: string | null;
  sale_price?: number | null;
  otherLabels?: string[];
}) {
  const lines = [
    `Rótulo: ${w.name}`,
    `Produtor/vinícola: ${w.producer ?? "não informado"}`,
    `País: ${w.country ?? "não informado"} | Região: ${w.region ?? "não informada"} | Denominação: ${w.appellation ?? "não informada"}`,
    `Safra: ${w.vintage ?? "não informada"} | Tipo: ${w.wine_type ?? "não informado"} | Estilo: ${w.style ?? "não informado"}`,
    `Uvas: ${w.grape ?? "não informadas"}`,
    `Detalhe das uvas: ${w.grapes_detail ? JSON.stringify(w.grapes_detail) : "não informado"}`,
    `Volume: ${w.volume ?? "não informado"} | Álcool: ${w.alcohol_pct ?? "não informado"}% | Açúcar: ${w.sugar_level ?? "não informado"} | Corpo: ${w.body ?? "não informado"}`,
    `Método de elaboração: ${w.production_method ?? "não informado"}`,
    `Estágio/madeira: ${w.aging ?? "não informado"} | Meses de madeira: ${w.oak_months ?? "não informado"}`,
    `Elaboração (texto do cadastro): ${w.elaboration ?? "não informado"}`,
    `Notas do cadastro: ${w.tasting_notes ?? "não informadas"}`,
    `Harmonizações do cadastro: ${w.pairing_notes ?? "não informadas"}`,
    `Preço de venda na casa: ${w.sale_price ?? "não informado"}`,
  ];
  if (w.otherLabels?.length) {
    lines.push(`Outros rótulos da mesma casa (para o campo "Não confunda"): ${w.otherLabels.join("; ")}`);
  }
  return lines.join("\n");
}
