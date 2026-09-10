# Corrigir recriação de permissões após excluir uma conta

## Alterações
- Alterar a criação automática de novos usuários para não conceder mais o pacote completo por padrão.
- Criar o restaurante inicial com apenas o pacote escolhido na entrada; na ausência da escolha, usar Carta para impressão como opção segura.
- Remover a criação duplicada do vínculo de administrador do restaurante.
- Manter intactos os restaurantes, usuários e pacotes já existentes.
- Corrigir a conta de teste `moitanomundo@gmail.com`, removendo o pacote completo e mantendo somente Carta para impressão.

## Validação
- Confirmar que a conta de teste possui um único vínculo e somente o módulo Carta para impressão.
- Confirmar que excluir e recriar uma conta não restaura autorizações antigas nem libera todos os módulos.

## Detalhes técnicos
- Atualizar os gatilhos de criação no banco sem alterar dados dos demais clientes.
- Tornar a aplicação do pacote escolhido confiável após login por Google ou e-mail.
