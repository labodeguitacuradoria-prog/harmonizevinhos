## Objetivo

Trazer para o nosso Cadastro Global de Vinhos a mesma lógica desenvolvida no Gemini AI Studio: em vez de digitar campo a campo, o Admin carrega uma **ficha técnica** (PDF/imagem) ou **cola um texto** e a IA preenche automaticamente todos os dados do vinho — que ficam editáveis antes de salvar. As fichas e textos originais são arquivados para consulta ("de onde veio cada número").

## Como vai funcionar (visão do usuário)

Na tela `/app/catalog-admin`, botão "Novo Vinho" abrirá o formulário atual acrescido de um **bloco "Extração por IA"** no topo, com duas abas:

1. **Ficha técnica (PDF/Imagem)** — upload de arquivo (drag & drop). A IA lê e devolve JSON estruturado.
2. **Texto colado** — textarea grande. O admin cola texto de site/catálogo. A IA extrai.

Após a extração:
- Todos os campos do formulário são pré-preenchidos (rótulo, tipo, estilo, uvas, álcool, açúcar, acidez, pH, meses em barrica, método de produção para espumantes, notas de degustação, harmonização).
- É exibida uma nota "Extraído por IA — revise antes de salvar".
- O admin edita/corrige o que precisar e clica em Salvar.
- A ficha original (PDF/imagem) fica salva no Storage e linkada no registro; o texto original fica salvo em coluna dedicada — ambos consultáveis depois na tela de edição.

Para imagens do vinho: mantemos o `MediaUploader` atual (upload) e adicionamos **"Colar da URL"** (campo que aceita link direto e salva como `image_url`).

## O que muda no banco

Novas colunas em `wine_catalog` (nenhuma quebra o que já existe):

- `grapes_detail jsonb` — array `[{grape, pct, mesesBarrica}]` extraído (mantemos `grape text` como resumo legível).
- `oak_months numeric` — meses médios em barrica.
- `production_method text` — só para espumantes: `Tradicional | Charmat | Asti`.
- `source_text text` — texto colado original (auditoria).
- `source_file_url text` — link do PDF/imagem da ficha (o `tech_sheet_url` já existe, será reutilizado).
- `extracted_by_ai boolean` — flag "veio de extração".
- `extraction_notes text` — notas de degustação estruturadas (as 5 seções: Comentários / Visual / Olfativa / Gustativa / Harmonização).

## Como vai funcionar (visão técnica)

- **`src/lib/wine-extraction.functions.ts`** (`createServerFn` + `requireSupabaseAuth` + verificação de admin):
  - `extractFromFile({ fileBase64, mimeType })` → chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com o arquivo em `image_url`/`file` block e o mesmo system prompt do Gemini Studio, exigindo JSON estruturado.
  - `extractFromText({ text })` → mesma coisa via texto puro.
  - Ambos retornam o DTO `ExtractedWine` (rótulo, tipo, estilo, grapes[], álcool, açúcar, acidezVal, ph, mesesBarrica, metodoProducao, informacoes_tecnicas, texto_original_ficha).
  - Prompts vêm do `server.ts` do Gemini Studio (linhas 864–896 e 1010–1045).

- **Frontend**: novo componente `<WineAiExtractor onExtracted={fill} />` colocado no topo do modal "Novo Vinho" e "Editar Vinho". Faz o upload/leitura, chama a server fn, mostra loader, popula o form.

- **Fichas armazenadas**: uso do bucket existente `product-media` numa pasta `wine-catalog-tech-sheets/`.

## O que NÃO é objetivo desta fase

- Nada muda no módulo de Harmonização (já existente) ou nas cartas de restaurante — este esforço é 100% no Cadastro Global.
- Não trocamos o schema atual: apenas ADICIONAMOS colunas. O que já foi cadastrado continua funcionando.
- Não subimos módulo de "leitura de códigos de barras" — separado.

## Passos de implementação (ordem)

1. **Migração** — adicionar as colunas novas em `wine_catalog` (todas nullable).
2. **Server functions** de extração (`wine-extraction.functions.ts`) usando Lovable AI Gateway com structured output.
3. **Componente `WineAiExtractor`** — bloco de UI com duas abas (arquivo/texto), loader dourado, mensagem de sucesso.
4. **Integração no `catalog-admin.tsx`** — adicionar o extractor no topo do modal Novo/Editar; mapear campos extraídos → estado do form; salvar `source_text`/`source_file_url`/`extracted_by_ai`.
5. **Campo "Colar URL da imagem"** ao lado do `MediaUploader` (imagem principal e ficha técnica).
6. **Ver origem dos dados** — no modal de edição, se `extracted_by_ai=true`, botão "Ver ficha original" e "Ver texto original".

## Confirmações antes de começar

1. **Bloco de IA** aparece só no cadastro Global (admin) — ok? Ou também no cadastro de vinhos do restaurante (`/app/wines`)?
2. **Modelo**: uso `google/gemini-3-flash-preview` via Lovable AI (mesma família do Gemini Studio, sem precisar da sua chave). Ok?
3. **Aprovar** este plano para eu executar? Como você mesmo disse na conversa anterior, isto substitui a estrutura antiga do Cadastro Global — vou manter os campos existentes e apenas ampliar.
