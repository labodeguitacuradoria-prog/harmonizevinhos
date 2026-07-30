## Importar Carta de Vinhos (PDF ou Foto) com IA

Novo botão **Importar carta** ao lado de **+ Novo vinho**, na aba Vinhos. O usuário envia o PDF ou a foto da carta, a IA lê todos os rótulos, o sistema compara com o que já existe no restaurante e apresenta uma tela de validação antes de gravar.

### Fluxo do usuário

```text
[Importar carta] → upload PDF/fotos → IA lê a carta
        ↓
Tela de conferência (3 grupos)
  • NOVOS      → criar rótulo
  • ALTERADOS  → preço/safra/volume mudou (mostra antes → depois)
  • IGUAIS     → nada a fazer
        ↓
Usuário marca/desmarca linha por linha e edita valores
        ↓
[Aplicar seleção] → insere novos + atualiza existentes
```

### O que a IA extrai de cada linha da carta

Nome do rótulo, produtor, safra, país, região, uvas, tipo (Tinto/Branco/Espumante/Rosé/Fortificado), volume (750 ml, taça, etc.), preço de venda, código interno quando a carta traz, e a seção da carta onde apareceu. Cada item vem com um nível de confiança para destacar em amarelo o que ficou duvidoso.

### Como o sistema decide "novo" x "alterado"

Comparação contra os vinhos do restaurante ativo, nesta ordem:
1. Código interno igual.
2. Nome + produtor + safra + volume iguais (ignorando acentos e maiúsculas).
3. Similaridade textual alta de nome + produtor (usando `pg_trgm`, já instalado), com safra/volume compatíveis.

Sem correspondência = **novo**. Com correspondência e algum campo diferente = **alterado**, listando somente os campos que mudaram.

### Decisões adotadas (padrões escolhidos)

- **Preço de custo**: cartas trazem apenas preço de venda, então rótulos novos entram com custo `0` e ficam sinalizados na lista de conferência como "custo pendente". Preço de custo de rótulos já cadastrados nunca é sobrescrito pela carta.
- **Enriquecimento**: ao aplicar, se o rótulo bate com um registro aprovado do Catálogo Global, os campos técnicos (região, uvas, notas, imagem, temperatura etc.) são preenchidos automaticamente; a carta continua sendo a fonte para nome, safra, volume e preço.
- **Rótulos que sumiram da carta**: aparecem em um bloco "Não encontrados nesta carta" com a opção de desmarcar `active_on_menu` — nunca são apagados.
- **Histórico protegido**: a atualização só altera `wines.sale_price`; movimentos, contagens e faturamento passados permanecem intactos (já usam `unit_cost`/`unit_price` gravados no momento do lançamento).

### Detalhes técnicos

**Arquivos novos**
- `src/lib/winelist-import.functions.ts` — server function `extractWineListFromFile` (autenticada), envia o PDF/imagem ao Lovable AI Gateway com um prompt de sommelier especializado em carta de vinhos e `Output.object` de um array de itens. Suporta várias páginas/fotos (uma chamada por arquivo, resultados concatenados e deduplicados).
- `src/components/WineListImportDialog.tsx` — modal em três passos: upload → processando → conferência com as abas Novos / Alterados / Iguais / Fora da carta. Cada linha tem checkbox e campos editáveis (nome, safra, volume, preço, tipo, código).

**Arquivos alterados**
- `src/routes/_app.app.wines.tsx` — botão **Importar carta** ao lado de **+ Novo vinho**, estado do modal e `invalidateQueries(["wines"])` ao concluir.

**Banco**
- Nenhuma tabela nova é obrigatória. O arquivo enviado é guardado no bucket `product-media` e registrado em `restaurant_wine_lists` (tabela já existente) como versão da carta, para rastreabilidade de "de onde veio esse preço".

**Aplicação das mudanças**
- Inserções e updates são feitos pelo cliente Supabase já autenticado, respeitando as RLS atuais de `wines`; o trigger `auto_submit_to_catalog` continua alimentando o Catálogo Global normalmente.
- Processamento em lotes com barra de progresso e resumo final ("12 novos, 34 preços atualizados, 5 sem alteração").

### Limites conhecidos

- Fotos de carta com baixa resolução ou fontes decorativas reduzem a precisão; por isso toda linha passa pela tela de validação antes de gravar.
- Cartas muito longas são processadas em blocos de páginas para não estourar o limite de tokens do modelo.