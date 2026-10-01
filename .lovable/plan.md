## Paginação manual das seções da carta

### O que será alterado
- Transformar **Carta com os rótulos** em páginas de rótulos organizáveis dentro da mesma sequência das folhas extras.
- Permitir criar novas páginas de rótulos, renomeá-las apenas para organização e movê-las para cima ou para baixo.
- Em cada página de rótulos, permitir escolher manualmente quais seções e subseções serão impressas nela.
- Permitir que uma subseção fique em uma página diferente de sua seção principal, conforme solicitado.
- Exibir claramente, na sequência, quantas seções e rótulos cada página contém.
- Manter pelo menos uma página de rótulos e impedir que uma mesma seção fique duplicada em duas páginas.
- Disponibilizar o mesmo controle para o administrador e para o usuário do restaurante.

### Pré-visualização e impressão
- Renderizar uma folha física separada para cada página de rótulos, seguindo exatamente a ordem definida junto às folhas extras.
- Aplicar cabeçalho, rodapé, modelo, campos e margens em cada página de rótulos.
- Respeitar margens próprias por página quando configuradas.
- Se o conteúdo escolhido ultrapassar uma folha, permitir a continuação natural na página seguinte sem cortar rótulos.

### Compatibilidade e salvamento
- Salvar a sequência e a distribuição das seções junto com cada carta, sem criar novas tabelas.
- Cartas antigas continuam abrindo com todas as seções na única página de rótulos existente.
- Ao criar uma nova seção, ela será incluída automaticamente na primeira página de rótulos até o usuário reorganizá-la.
- Ao excluir uma página de rótulos, suas seções serão transferidas para outra página, sem perda de conteúdo.

### Detalhes técnicos
- Ampliar a definição de folha para aceitar várias folhas do tipo `wines`, cada uma com seus `sectionIds`.
- Separar a sequência de páginas da configuração visual exclusiva, para que o recurso funcione também no módulo básico.
- Atualizar o editor de sequência, a persistência da carta e o `MenuPreview` com normalização compatível com dados antigos.
- Validar a tela em computador e celular, além da pré-visualização e impressão com várias páginas.
