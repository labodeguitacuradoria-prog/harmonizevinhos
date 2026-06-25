## Correções na Contagem de Estoque

### a) Excluir produtos servidos por taça
- Itens cujo `volume` contém "Taça" / "Taca" são consumo aberto, não rótulo fechado.
- Em `startSession()` filtrar `wines` excluindo esses volumes antes de gerar `stock_count_items`.
- Em "Cadastro de Produtos" também esconder a coluna estoque para esses itens (apenas visual).

### b) Código do restaurante visível no card de contagem
- Mostrar `internal_code` (se houver) como pílula compacta no canto esquerdo do nome do rótulo: `[A12] Nome do vinho`.
- Mesma pílula no topo do scanner-jump e quando contado.

### c) Histórico das últimas 8 contagens lado a lado
- Buscar as 8 sessões `closed` mais recentes do restaurante + a sessão atual em draft.
- Para cada item exibir minicolunas à direita com a quantidade contada em cada data (cabeçalho = `dd/MM`), permitindo o staff já enxergar variações estranhas durante a contagem.
- Layout horizontal com scroll-x apenas nessa faixa de números (não afeta o scroll vertical da página).

### d) Rolagem + ordem/comportamento dos filtros
- Causa do "não rola até o fim": footer `fixed` cobre os últimos itens. Trocar por `sticky bottom-0` dentro do container scrollável e o container raiz vira `h-full overflow-y-auto` (sem scroll preso em `flex-1` aninhado). Garante que todos os itens fiquem acessíveis.
- Nova ordem dos chips: **Todos / Pendentes / Espumantes / Brancos / Rosés / Tintos / Fortificados / Outros**.
- Adicionar "Outros" = qualquer `wine_type` que não seja um dos 5 tipos canônicos.
- Em "Pendentes": ao apertar +/− pela primeira vez o item é marcado como contado mas **permanece visível na lista filtrada** até o staff trocar de filtro ou recarregar. Implementação: manter um `Set<string>` local de "ids tocados nesta visão" que sobrepõe o filtro `pending`. Assim apertar 0 não faz o card sumir.

### e) Reportar problemas durante a contagem
Sem precisar abortar a contagem, o staff marca o item com um motivo e segue:
- Adicionar coluna `flag` (`null | 'not_registered' | 'duplicate' | 'should_not_count' | 'other'`) e `flag_note` (texto) em `stock_count_items`.
- Adicionar tabela `stock_count_issues` para problemas avulsos sem item correspondente (ex.: "achei rótulo X sem cadastro"), com `session_id`, `description`, `created_by`.
- No card: ícone de bandeira (⚑) abre um popover pequeno com as opções acima + campo livre. Item sinalizado conta como "resolvido" para fins de fechamento (não bloqueia encerrar) e fica destacado em amarelo.
- Botão "Reportar item não cadastrado" no header abre modal que grava em `stock_count_issues`.
- Ao encerrar contagem: resumo mostrando todas as flags + issues para o gestor revisar; itens marcados como `should_not_count` ou `duplicate` **não geram movimento de ajuste** em `inventory_movements`.

### Resumo técnico
- **Migração**: `ALTER TABLE stock_count_items ADD COLUMN flag text, ADD COLUMN flag_note text;` + nova tabela `stock_count_issues` com RLS espelhando `stock_count_sessions` + GRANTs.
- **`startSession`**: filtra wines com volume tipo taça.
- **`CountSessionView`**: novo layout de scroll (sem `fixed` footer), filtros reordenados + "Outros", pendente com sticky-visible, colunas de histórico, pílula de código, popover de flag, modal de issue.
- **Página "Produtos"**: ocultar coluna estoque / venda mensal? Não — manter, apenas excluir da contagem (item a).

Confirma para eu implementar?