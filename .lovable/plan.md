## Mudanças no fluxo de contagem e no cadastro de rótulos

### Parte 1 — Admin pode revisar e corrigir contagens

A tela do staff (`/app/stock-counts`) **não muda**. Continua mobile, minimalista, salva e some.

Nova tela para admin: **`/app/stock-counts-admin`** (ou aba "Gerenciar contagens" dentro da página atual, visível só para rest_admin / rest_owner / admin).

O que ela faz:

- **Lista de sessões** — todas as contagens do restaurante (draft + closed), ordenadas por data, com colunas: data, status, quem fez, nº de itens contados, nº de flags/issues abertas.
- **Abrir uma sessão** — mostra a contagem completa item por item (mesmo formato da tela do staff, mas em layout desktop tabular), com:
  - editar quantidade inline (sobrescreve direto, sem log)
  - remover a flag de um item (resolver "duplicado", "não cadastrado" etc.)
  - excluir item da sessão (caso tenha entrado errado)
  - excluir a sessão inteira
- **Reabrir sessão fechada** — botão "Reabrir" muda status de `closed` para `draft`; admin corrige; fecha de novo. Ao fechar de novo, os movimentos de ajuste em `inventory_movements` são recalculados a partir das quantidades atuais (deleta os movimentos antigos da sessão e recria).
- **Issues** — lista de `stock_count_issues` reportadas pelo staff, com botão "marcar como resolvida".

### Parte 2 — Status do rótulo: dois flags separados

Adicionar duas colunas em `wines`:

- `active_on_menu` (boolean, default true) — aparece como ativo na carta do restaurante.
- `count_in_stock` (boolean, default true) — entra na lista de contagem do staff.

No formulário de cadastro/edição de produto (`/app/wines`), nova seção "Status":

- ☑ Ativo na carta
- ☑ Contar no estoque

Comportamento em cada tela:

| Tela | Filtro |
|---|---|
| **Lista de produtos** | Mostra todos, com chip extra "Apenas ativos na carta" ligado por padrão. Coluna visual indicando inativo/arquivado. |
| **Contagem do staff** | Só `count_in_stock = true` E volume ≠ taça (regra atual continua). |
| **Contagem admin** | Igual ao staff (não faz sentido mostrar item que ninguém vai contar). |
| **Venda mensal** | Mostra todos sempre, conforme decidido. Itens inativos/arquivados ganham marcador visual discreto ("arquivado") para o usuário saber. |
| **Vendas / Dashboards** | Sem filtro — venda histórica de qualquer rótulo continua valendo. |

### Detalhes técnicos

**Migração:**
- `ALTER TABLE public.wines ADD COLUMN active_on_menu boolean NOT NULL DEFAULT true, ADD COLUMN count_in_stock boolean NOT NULL DEFAULT true;`
- Novas policies em `stock_count_sessions` e `stock_count_items` permitindo UPDATE/DELETE para `can_manage_restaurant(auth.uid(), restaurant_id)` (hoje só o autor edita).
- Policy de UPDATE em `stock_count_issues` para admin marcar como resolvida (adicionar coluna `resolved_at timestamptz`).

**Frontend:**
- Nova rota `src/routes/_app.app.stock-counts-admin.tsx` (ou um modo "admin view" dentro da rota existente, com base no role do usuário) — lista de sessões + visão detalhada editável + ação de reabrir/fechar.
- Ao **fechar** uma sessão reaberta: deletar movimentos de ajuste antigos vinculados a essa sessão e gerar novos a partir das quantidades atuais.
- `src/routes/_app.app.wines.tsx`: adicionar checkboxes "Ativo na carta" / "Contar no estoque" no formulário; chip de filtro "Apenas ativos na carta" na lista; badge "arquivado" quando ambos falsos.
- `src/routes/_app.app.sales-monthly.tsx`: badge visual discreto em rótulos com `active_on_menu = false`.
- `src/routes/_app.app.stock-counts.tsx` (staff): adicionar filtro `count_in_stock = true` ao gerar `stock_count_items` na `startSession`.

**Sidebar:** novo link "Gerenciar contagens" visível só para admin/owner.

Confirma para eu implementar?