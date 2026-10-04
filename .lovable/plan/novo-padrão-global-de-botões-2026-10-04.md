# Novo padrão global de botões

Aplicar o estilo “Luminous Gold Pill” aos botões do sistema inteiro, preservando a função e a hierarquia de cada ação.

## Alterações

- Atualizar o botão principal para cápsula dourada luminosa, texto espresso, reflexo interno, brilho e resposta tátil.
- Atualizar botões secundários para cápsula translúcida com contorno suave no modo escuro e superfície clara no modo claro.
- Manter ações destrutivas claramente vermelhas/vinho, sem confundi-las com confirmações douradas.
- Padronizar alturas: 44 px para ações principais e 36–40 px para botões compactos e de ícone.
- Aplicar a geometria e as interações também aos botões antigos ainda escritos diretamente nas telas.
- Atualizar os links de ação da tela inicial para o mesmo padrão visual.
- Conferir contraste, estados desabilitados e telas claras/escuras em computador e celular.

## Detalhes técnicos

- Centralizar o padrão no componente compartilhado de botão e em utilitários globais sem alterar regras de negócio.
- Usar tokens CSS para os degradês, sombras e cores dos dois temas.
- Preservar controles especiais que não funcionam como ações, como navegação lateral e itens de calendário.
