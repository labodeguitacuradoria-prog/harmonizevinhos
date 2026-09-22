# Reformular Restaurantes cadastrados

## Resultado
- Substituir os cartões por uma tabela compacta e fácil de comparar.
- Manter o cabeçalho da tabela visível enquanto a lista de restaurantes desliza.
- Adicionar filtros no topo por texto, cidade, rede e pacote/módulo, com opção de limpar.
- Preservar os atalhos atuais para painel, produtos, pedidos e cadastro, reunidos em ações compactas.
- Manter a liberação de módulos diretamente na linha do restaurante.

## Exclusão completa
- Adicionar uma ação de lixeira exclusiva do administrador geral.
- Exigir duas confirmações consecutivas, ambas citando o nome do restaurante e deixando claro que a operação é irreversível.
- Excluir os dados pertencentes ao restaurante, seus vínculos e arquivos próprios; não excluir a conta do usuário que criou o restaurante.
- Atualizar imediatamente a tabela e limpar o restaurante ativo caso ele tenha sido excluído.

## Detalhes técnicos
- Executar a exclusão no servidor, depois de validar novamente que o solicitante é administrador geral.
- Usar as relações em cascata do banco para os registros dependentes e tratar separadamente arquivos armazenados por pasta do restaurante.
- Exibir mensagens claras de sucesso ou erro e bloquear cliques repetidos durante a operação.
- Conferir o resultado na visualização do administrador em tela grande e pequena.
