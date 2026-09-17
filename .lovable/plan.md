# Módulo Treinamento: Fichas Rápidas do Staff

Um novo módulo que transforma a carta de vinhos em fichas de bolso, uma tela por rótulo, feitas para quem não entende de vinho vender melhor. Nada de notas técnicas: história da vinícola, o significado do nome do rótulo, com o que combina e a frase pronta para dizer na mesa. O staff recebe um link, abre no celular e usa.

## Como funciona para o restaurante

1. No menu do restaurante aparece **Treinamento**.
2. Lista dos rótulos ativos da carta com o estado da ficha: sem ficha / rascunho / publicada.
3. Botão **Gerar fichas com IA** (um rótulo ou vários de uma vez). A IA escreve a ficha a partir dos dados já cadastrados do rótulo.
4. O gestor lê, edita qualquer campo e clica em **Publicar**. Só ficha publicada aparece para o staff.
5. Botão **Criar link do staff**, igual ao link do painel: rótulo do link, celular, trava de aparelho, validade e revogação.

## Como é a ficha (uma tela de celular)

- Foto do rótulo, nome, tipo, país e safra.
- **De onde vem**: 2 a 3 frases sobre a vinícola / região, em linguagem simples.
- **Por que esse nome**: explicação do nome do rótulo, incluindo nuances de tradução (ex.: por que "Solitude" não é "solidão").
- **Como é na boca**: uma frase sem jargão (leve/encorpado, seco/adocicado).
- **Combina com**: 3 pratos curtos.
- **Fale assim na mesa**: uma frase pronta para o cliente.
- **Curiosidade**: um detalhe memorável.
- **Não confunda**: com qual rótulo da casa costuma ser confundido.

Tudo cabe numa tela, com rolagem curta; cartões grandes, alto contraste, dourado sobre fundo escuro, com botão claro/escuro.

## Tela do staff (pelo link)

- Lista com foto, nome e tipo; busca e filtro por tipo (Todos, Espumantes, Brancos, Rosés, Tintos, Sobremesa/Fortificados).
- Tocar no rótulo abre a ficha; setas para ir ao próximo/anterior sem voltar à lista.
- Marcar rótulo como **estudado** (fica salvo no celular do staff).
- Botão **Desafio** (opcional, nunca obrigatório): 10 perguntas rápidas montadas a partir das fichas publicadas — "de que país é este rótulo?", "com o que combina?", "qual o significado do nome?" — com pontuação no final e opção de repetir. O gestor vê o placar dos desafios feitos por aquele link.
- Botão fechar e botão claro/escuro, como já existe na tela de contagem.

## Detalhes técnicos

- Novo valor `training` no enum `app_module` e nova rota `/app/training`, liberada por `module_entitlements`; regras em `src/lib/modules.ts` (`ROUTE_MODULE`, botão no menu de `src/routes/_app.tsx`, `ModuleGate`).
- Novo valor `training` no enum `access_link_scope`; criação/gestão do link reutiliza `src/lib/access-links.functions.ts` e `_app.app.access-links.tsx`; a rota pública `acesso.$kind.$token.tsx` ganha o caso `training` (cookie assinado + trava de aparelho já existentes).
- Nova tabela `wine_story_cards` (1:1 com `wines`): campos de texto da ficha, `status` (draft/published), `generated_by_ai`, `model_notes`, timestamps. RLS: gestores do restaurante via `can_manage_restaurant`, leitura pública apenas por server function do link; GRANTs para `authenticated` e `service_role`.
- Nova tabela `training_quiz_attempts`: `link_id`, `restaurant_id`, `score`, `total`, `finished_at` — gravada por server function do link, sem PII.
- Geração de conteúdo em `src/lib/training-cards.functions.ts` com `createServerFn` + Lovable AI (`openai/gpt-6-astra` na Responses API, saída estruturada, streaming consumido no handler), reaproveitando `src/lib/ai-gateway.server.ts`. Prompt em `src/lib/training-prompt.ts` proibindo notas organolépticas técnicas e exigindo linguagem de garçom. Erros do gateway (402/403/429) são mostrados na tela.
- Leitura pelo link em `src/lib/guest-access.functions.ts` (padrão dos escopos atuais): retorna só fichas publicadas do restaurante do link.
- Estilo segue os tokens existentes (dourado/vinho/cards), sem cores fixas.
