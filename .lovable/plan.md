# Tabela e lixeira de restaurantes

## Tela Restaurantes cadastrados
- Substituir os cartões por uma tabela compacta, mantendo os principais dados, indicadores, módulos e atalhos de cada restaurante.
- Criar um cabeçalho de filtros por nome/dados cadastrais, cidade, rede e pacote/módulo, com ação para limpar filtros.
- Manter os títulos das colunas visíveis enquanto a lista desliza.
- Oferecer ações compactas para abrir painel, produtos, pedidos e cadastro.

## Mover para a lixeira
- A lixeira será uma área própria dentro da tela do administrador geral.
- O botão de excluir da tabela terá duas confirmações consecutivas e moverá o restaurante para a lixeira, sem apagar dados nesse momento.
- Restaurantes na lixeira deixarão de aparecer para seus usuários e não poderão ser usados até serem recuperados.
- A conta do usuário que criou o restaurante será preservada.

## Recuperar ou excluir definitivamente
- Na lixeira, o administrador poderá recuperar um restaurante e escolher qual usuário será o novo administrador responsável.
- A recuperação reativa o restaurante e cria/ajusta o vínculo administrativo do usuário escolhido, sem excluir outros usuários existentes.
- A exclusão definitiva também terá duas confirmações e removerá o restaurante, seus dados dependentes e arquivos próprios.
- Mesmo na exclusão definitiva, nenhuma conta de usuário será apagada; contas continuam sendo gerenciadas somente na tela de acessos.

## Segurança e funcionamento
- Todas as ações serão executadas no servidor e validarão novamente o papel de administrador geral.
- A base receberá o estado de lixeira e impedirá que usuários comuns acessem restaurantes arquivados.
- A tabela será atualizada imediatamente após mover, recuperar ou excluir.
- O resultado será conferido nas versões de computador e celular.
