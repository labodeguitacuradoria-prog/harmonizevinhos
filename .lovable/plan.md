## Contagem de Estoque — Vinhos

Tela mobile-first para o staff contar garrafas rótulo por rótulo. O sistema garante que nada fica para trás e mostra só o essencial durante a contagem, com apoio visual (foto + moldura) e leitura de código de barras.

### 1. Fluxo

1. Staff abre **Contagem de Estoque** → toca **Iniciar contagem**.
2. Sistema cria sessão `draft` com a **data de hoje** e gera um item pendente para cada rótulo ativo do restaurante.
3. Staff percorre a lista, identifica o rótulo (visualmente ou via código de barras) e digita a quantidade. Campo começa **em branco** — para estoque zero, é obrigatório digitar `0`.
4. Pode pausar; ao voltar, retoma a mesma sessão `draft`.
5. **Fechar contagem** só habilita com 100% contado. Se tentar fechar antes, mostra a lista dos rótulos pendentes e leva direto até eles.
6. Ao fechar: para cada diferença entre contado e estoque atual, grava `inventory_movement` do tipo `adjustment`; sessão vira `closed` (read-only).

### 2. UX da contagem (o que o staff vê)

Card por rótulo, **somente**:

- **Foto/thumbnail do rótulo** (de `wines.image_url`) — toque amplia em modal full-screen para tirar dúvida visual
- Nome do rótulo
- **Volume** destacado ao lado do nome (ex.: 750 ml / 375 ml) — diferencia rótulos de mesmo nome
- Produtor / safra em texto secundário pequeno
- Campo numérico + botões −/+ grandes (≥44px)
- **Botão de scanner de código de barras** no topo da tela (e atalho dentro do card) — abre câmera, lê EAN/UPC, encontra o rótulo correspondente, rola até ele e foca o campo

**Confirmação visual ao contar:** assim que o campo recebe um valor (inclusive `0`), o card ganha uma **moldura iluminada** (borda colorida + leve glow + ícone de check) marcando "contado". Pendentes ficam com borda neutra/apagada. Efeito é o sinal principal de progresso.

**Não mostrar** durante a contagem: estoque atual, contagem anterior, média de vendas, preços. Esses dados aparecem só nos relatórios pós-fechamento.

### 3. Filtros no topo (chips horizontais roláveis)

- **Todos** (padrão) · **Pendentes** · **Tintos** · **Brancos** · **Rosés** · **Espumantes** · **Sobremesa** · **Fortificados**

Contador "X de Y contados" + botão **Fechar contagem** fixos no rodapé.

### 4. Leitura de código de barras

- Biblioteca client-side (ex.: `@zxing/browser`) — sem dependência de servidor.
- Novo campo `wines.barcode` (text, nullable, índice único por `restaurant_id`).
- **No cadastro do rótulo (tela de Vinhos):** botão "Escanear código de barras" que preenche o campo `barcode`. Edição manual também permitida.
- **Na contagem:** botão de scanner persistente. Ao ler:
  - Se achar o rótulo na sessão → rola até o card, abre teclado numérico, destaca a moldura em estado "pronto pra contar".
  - Se não achar → toast "Código não cadastrado neste restaurante" com atalho para abrir o cadastro do rótulo.
- Permissão de câmera tratada com fallback amigável (texto explicando como liberar).

### 5. Modelo de dados

```text
wines  (alteração)
  + barcode (text, nullable)
  índice único parcial (restaurant_id, barcode) where barcode is not null

stock_count_sessions
  id, restaurant_id, reference_date (default CURRENT_DATE),
  status ('draft'|'closed'), started_by, started_at,
  closed_by, closed_at, notes, timestamps
  (índice único parcial: 1 draft por restaurante)

stock_count_items
  id, session_id, wine_id,
  previous_qty (snapshot ao iniciar — usado só no fechamento),
  counted_qty (NULL = pendente),
  counted_at, counted_by, timestamps
```

RLS: staff/restaurant leem e editam drafts do próprio restaurante; owner/admin leem tudo; sessão fechada é read-only (exceto admin).

### 6. Server functions (`src/lib/stock-counts.functions.ts`)

- `getOrStartDraftSession()` — retorna draft existente ou cria nova com snapshot.
- `getSessionItems(sessionId)` — devolve `wine.name`, `wine.volume`, `wine.wine_type`, `wine.producer`, `wine.vintage`, `wine.image_url`, `wine.barcode`, `counted_qty`. **Não retorna** `previous_qty`, média, estoque atual.
- `updateStockCountItem(itemId, counted_qty)`.
- `closeStockCount(sessionId)` — valida 100% contado, grava `inventory_movements` para diferenças, fecha sessão.
- `findWineByBarcode(code)` — usada pelo cadastro (validar duplicidade) e pela contagem (lookup do scanner).

### 7. Rotas e remoções

- **Nova rota**: `src/routes/_app.app.stock-counts.tsx` (componente `StockCountSession`).
- **Atualizar** tela de cadastro de Vinhos: campo `barcode` + botão "Escanear".
- **Remover** aba/links "Movimento" do menu staff/restaurant em `src/routes/_app.tsx` e arquivos relacionados.
- Tela de Vinhos (gestão) continua mostrando estoque, média de vendas e histórico — fora da tela de contagem.

### Fora de escopo nesta etapa

Taças, refinamento de Vendas, contagem parcial por seção/área da adega, foto por garrafa contada, notificações.