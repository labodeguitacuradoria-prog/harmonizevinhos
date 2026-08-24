# Pedidos a Fornecedores (Compras) + Acompanhamento

Novo módulo para o restaurante solicitar vinhos aos fornecedores, enviar o pedido por e-mail ou WhatsApp, e acompanhar tudo o que foi pedido e o que já foi recebido — com visão própria para o fornecedor.

## Decisões assumidas (posso mudar se preferir)

- Envio por **e-mail** abre seu programa de e-mail já com assunto e o pedido formatado (nenhuma configuração de domínio necessária), e por **WhatsApp** abre a conversa com o texto do pedido pronto. Em ambos os casos o pedido fica registrado no sistema com data e canal de envio.
- Quantidades em **garrafas** (com campo opcional de observação por item, ex.: "2 caixas de 6").
- Ao marcar um item como **recebido**, o sistema gera automaticamente a entrada no estoque com o custo informado — mantendo contagem e CMV corretos.
- O fornecedor tem acesso **somente leitura** aos pedidos dos rótulos dele.

## Telas

### 1. Novo pedido (`/app/orders/new`)
- Escolhe o fornecedor; a lista mostra apenas os rótulos vinculados a esse fornecedor no restaurante ativo (busca por nome/código interno).
- Para cada rótulo: quantidade em garrafas, custo unitário sugerido (preenchido do cadastro, editável) e observação.
- Rodapé com resumo: itens, garrafas e valor total estimado.
- Botões: **Salvar rascunho**, **Enviar por e-mail** e **Enviar por WhatsApp** (o botão de WhatsApp aparece quando o fornecedor tem WhatsApp cadastrado; o de e-mail quando tem e-mail). Enviar grava o pedido como "enviado", registra data e canal, e abre o e-mail/WhatsApp com o texto do pedido.
- Também é possível **copiar o texto do pedido** para colar em qualquer lugar.

### 2. Acompanhamento (`/app/orders`)
- Tabela em nível de item (rótulo), com cabeçalho fixo e **filtros por coluna**: fornecedor, rótulo, status, canal, e período (data do pedido).
- Colunas: data do pedido, fornecedor, rótulo (link para a ficha do vinho), código interno, garrafas solicitadas, garrafas recebidas, pendente, custo unitário, total, status, ações.
- Status do item: `pendente` → `parcial` → `recebido` (ou `cancelado`).
- Ação **Receber**: informa quantidade recebida (padrão = total pendente) e data; o item vira `recebido`/`parcial` e gera a entrada de estoque.
- Ação em lote: marcar vários itens como recebidos de uma vez.
- Indicadores no topo: pedidos abertos, garrafas pendentes, valor pendente, itens atrasados (sem recebimento após X dias).
- Reenviar pedido (e-mail/WhatsApp) e cancelar item/pedido.

### 3. Visão do fornecedor (`/supplier`)
- Nova seção **"Pedidos recebidos"** no portal do fornecedor: tabela com restaurante, data, rótulo, garrafas solicitadas, recebidas, status — apenas dos rótulos dele e apenas de restaurantes que autorizaram compartilhamento.
- Filtros por restaurante, rótulo e status.

### 4. Menu
- Entrada "Pedidos" na barra lateral e no menu mobile, junto de Vinhos/Estoque.

## Detalhes técnicos

Banco (migração):
- `purchase_orders`: `restaurant_id`, `supplier_id`, `status` (`draft|sent|partial|received|cancelled`), `sent_at`, `sent_channel` (`email|whatsapp|manual`), `expected_date`, `notes`, `created_by`, timestamps.
- `purchase_order_items`: `order_id`, `wine_id`, `qty_bottles`, `qty_received`, `unit_cost`, `item_notes`, `status`, `received_at`, timestamps + trigger `set_updated_at`.
- GRANTs para `authenticated` e `service_role`; RLS:
  - restaurante: acesso total via `can_manage_restaurant(auth.uid(), restaurant_id)`; staff lê.
  - fornecedor: `SELECT` quando `supplier_id = supplier_id_of(auth.uid())` **e** `supplier_can_see_restaurant(...)` para o restaurante do pedido.
- Trigger/rotina ao registrar recebimento: insere em `inventory_movements` (`movement_type = 'entry'`, `unit_cost` do item, `source` referenciando o pedido) e recalcula o status do pedido a partir dos itens.

Front-end:
- `src/routes/_app.app.orders.tsx` (acompanhamento + criação em modal), reaproveitando o padrão de tabela com filtros por coluna já usado em Catálogo Global e Preços.
- `src/lib/order-message.ts`: monta o texto do pedido (cabeçalho do restaurante, itens, quantidades, observações) e gera os links `mailto:` e `https://wa.me/...`.
- Queries via cliente Supabase do navegador com escopo do restaurante ativo (`useAuth`/`useScopedRestaurantIds`).
- Estilo seguindo o tema escuro dourado existente (cards `--card`, títulos em dourado, tabelas com cabeçalho fixo).

## Fora do escopo agora
- Envio automático de e-mail pelo servidor (exige configurar domínio de envio) — posso adicionar depois mantendo os mesmos pedidos e histórico.
