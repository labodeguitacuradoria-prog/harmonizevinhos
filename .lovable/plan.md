## Módulo: Carta de Vinhos para Impressão

Nova aba **Carta impressa** que monta, organiza e imprime a carta de vinhos do restaurante ativo, a partir dos rótulos já cadastrados.

### Fluxo do usuário

```text
[Carta impressa]
   ↓
1. Escolher template (3 modelos)
2. Selecionar rótulos (padrão: ativos na carta)
3. Organizar em seções e ordenar (arrastar / setas)
4. Cabeçalho: nome do restaurante, subtítulo, rodapé, data
   ↓
[Pré-visualização A4]  →  [Imprimir / Salvar PDF]
```

### Templates iniciais

- **Clássico** — serifado, seções em caixa alta com fio dourado, uma coluna, preço alinhado à direita com pontilhado.
- **Duas colunas** — compacto, ideal para cartas longas; duas colunas por página A4.
- **Minimalista** — sem molduras, muito espaço em branco, tipografia leve.

Todos em preto sobre branco (tinta econômica e legível impresso), mantendo o estilo tipográfico do app.

### Conteúdo de cada rótulo na carta

Nome (obrigatório) e, opcionalmente ligáveis por checkbox: produtor, safra, país/região, uvas, volume e preço. O usuário escolhe quais campos aparecem, para toda a carta.

### Organização

- Agrupamento automático por tipo (Espumante, Branco, Rosé, Tinto, Fortificado, Taças) ou por seção livre criada pelo usuário.
- Renomear seções, reordenar seções e rótulos, remover rótulo da carta impressa sem afetar o cadastro.
- Preços vêm sempre do cadastro (`sale_price`), então alterar preço no cadastro e reimprimir já reflete o novo valor.

### Salvar e reutilizar

A configuração da carta (template, seções, ordem, campos visíveis, textos do cabeçalho) é salva por restaurante, com nome e data, para reimprimir depois. Também é possível duplicar uma carta salva para criar uma variação (ex.: carta de almoço).

### Detalhes técnicos

**Banco (uma migração)**
- `printed_wine_lists`: `restaurant_id`, `name`, `template`, `header_title`, `header_subtitle`, `footer_text`, `visible_fields` (jsonb), `sections` (jsonb com seções, ordem e ids dos vinhos), timestamps.
- GRANTs para `authenticated` e `service_role`; RLS com `can_manage_restaurant(auth.uid(), restaurant_id)` para leitura e escrita.

**Arquivos novos**
- `src/routes/_app.app.wine-menu.tsx` — página do módulo: barra de ações (template, salvar, imprimir), painel de seleção/organização à esquerda e pré-visualização A4 à direita.
- `src/components/printed-menu/MenuPreview.tsx` — renderiza a carta em folhas A4.
- `src/components/printed-menu/templates.ts` — definição dos três templates (classes/tipografia por template).

**Arquivos alterados**
- `src/routes/_app.tsx` — item de menu **Carta** (ícone `ScrollText`) para o papel `restaurant`.
- `src/routes/_app.app.cadastros.tsx` — atalho para o novo módulo.
- `src/styles.css` — bloco `@media print` que oculta menu/painéis e imprime somente a área da carta, com `@page { size: A4; margin: 14mm }` e quebras de página controladas.

**Impressão**
Usa a impressão nativa do navegador (`window.print()`), que também permite "Salvar como PDF" — sem dependência nova.
