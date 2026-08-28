# Novo design do menu lateral (direção "Veludo artesanal")

Aplicar a terceira direção escolhida no menu lateral esquerdo, com dois ajustes pedidos:
sem o tracinho dourado vertical à esquerda do item, mantendo o degradê vinho que sobe
no item ativo.

## O que muda visualmente

- **Marca no topo**: ícone da taça dentro de um círculo com borda dourada suave e leve
  brilho em vinho; abaixo, "Gestão de Vinhos" em dourado, maiúsculas e espaçamento amplo.
- **Item ativo**: fundo em degradê ascendente do vinho (`#800020`, translúcido) para
  transparente, com uma linha superior dourada muito discreta. Ícone e texto em dourado.
  **Sem** a barra/tracinho dourado vertical na borda esquerda.
- **Itens inativos**: ícone e rótulo em cinza neutro, com leve realce de fundo no hover.
- **Tipografia dos rótulos**: maiúsculas, peso médio, espaçamento entre letras aumentado,
  para um ar mais editorial e menos "utilitário".
- **Rodapé**: o seletor de restaurante fica num bloco quadrado com borda dourada que
  inverte para dourado sólido no hover; botão "Sair" discreto, ganhando presença no hover.
- **Detalhe de acabamento**: fio dourado vertical em degradê na borda direita da barra,
  separando o menu do conteúdo.
- **Espaçamento**: um pouco mais de respiro vertical entre os itens, para reduzir a
  sensação de aperto com a quantidade atual de itens.

Nada de navegação muda: os mesmos destinos, o mesmo seletor de restaurante, o mesmo
"Sair" e as mesmas variações por perfil (restaurante, fornecedor, administrador).

## Menu no celular

O menu deslizante do celular recebe o mesmo tratamento de item ativo (degradê de vinho,
texto dourado) e a mesma tipografia, para manter coerência entre telas.

## Detalhes técnicos

- Arquivo: `src/routes/_app.tsx` — apenas o componente `NavLink`, o cabeçalho da `aside`,
  o rodapé e o bloco do menu mobile.
- Tokens novos em `src/styles.css` (dentro de `@theme inline` / `:root`) para o degradê
  do item ativo e o fio dourado, evitando cores fixas nos componentes:
  `--gradient-nav-active` e `--border-gold-hairline`.
- Estados ativos continuam usando `activeProps` do `Link` do TanStack Router; sem
  mudança na lógica de rotas ou permissões.
- Nenhuma alteração de dados, consultas ou regras de acesso.
