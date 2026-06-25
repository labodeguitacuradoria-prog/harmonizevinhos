## Mudança

Na página `/app/wines`, a coluna "Venda mensal" (e o card mobile "Mês") passa a mostrar a **média mensal de vendas dos últimos 12 meses** em vez do total do mês corrente.

## Regra de cálculo

Para cada rótulo:

1. Buscar em `inventory_movements` todos os registros com `movement_type = 'sale'` dos últimos 12 meses (a partir do 1º dia do mês 11 meses atrás até hoje).
2. Agrupar as quantidades por mês (`YYYY-MM` de `occurred_at`).
3. `média = soma das quantidades ÷ número de meses distintos com lançamento`.
   - 1 mês lançado → mostra esse mês.
   - 2 meses lançados → soma ÷ 2.
   - 24 meses no banco → considera só os últimos 12 e divide por 12.
   - Nenhum lançamento → mostra 0.
4. Exibir arredondado (sem casas decimais) para manter visual limpo da tabela.

## Arquivo afetado

- `src/routes/_app.app.wines.tsx` — substituir a `useQuery` de `monthlySalesMap` pela nova lógica (janela de 12 meses + agrupamento por mês + média sobre meses distintos com dados).

Sem mudanças de banco, sem mudanças em outras telas.
