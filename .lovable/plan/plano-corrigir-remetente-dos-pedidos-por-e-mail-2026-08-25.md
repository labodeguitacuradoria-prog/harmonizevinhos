# Plano: corrigir remetente dos pedidos por e-mail

## Objetivo
Garantir que o pedido de compras não dependa da conta aberta no navegador/Gmail do computador, e sim do e-mail do usuário logado ou de uma conta institucional explicitamente conectada.

## Diagnóstico confirmado
A tela de pedidos hoje usa links `mailto:` (`window.open(mailtoLink(...))`). Esse tipo de envio apenas abre o aplicativo de e-mail do navegador/computador; por isso o remetente real é a conta padrão/ativa nesse aplicativo, como `labodeguita.armazem@gmail.com`, e não necessariamente o e-mail usado para entrar no sistema.

## Solução proposta
1. Trocar o botão **Enviar por e-mail** para um envio controlado pelo sistema.
2. Criar uma opção de conexão/autorização da conta de e-mail do usuário logado, inicialmente para Gmail/Google.
3. Ao enviar o pedido:
   - usar a conta de e-mail conectada pelo próprio usuário como remetente real;
   - manter o fornecedor como destinatário;
   - usar o assunto atual: `Pedido de Vinhos - Restaurante - CNPJ - Data`;
   - manter o corpo atual da mensagem, começando por `Olá! solicito o envio dos seguintes rótulos ao restaurante:` e encerrando com `Saudações`.
4. Se o usuário ainda não tiver autorizado o envio pelo seu e-mail, mostrar uma ação clara: **Conectar meu e-mail para envio**.
5. Manter alternativas para operação do restaurante:
   - **WhatsApp** continua como está;
   - **Copiar texto** continua como está;
   - **Abrir no meu aplicativo de e-mail** pode ficar como opção secundária, com indicação de que o remetente será decidido pelo app de e-mail do dispositivo.
6. Registrar no acompanhamento do pedido que o envio foi feito por e-mail e, quando possível, salvar qual e-mail foi usado como remetente para auditoria.

## Regras importantes
- O sistema não deve “fingir” que envia de um Gmail sem autorização do dono da conta.
- Usar o e-mail de login como remetente só é tecnicamente garantido quando o usuário autoriza o app a enviar mensagens por essa conta.
- Se o restaurante quiser enviar por uma conta institucional, essa conta também precisará ser conectada/autorizada por alguém responsável.

## Detalhes técnicos
- Substituir o envio por `mailto:` por uma chamada segura no backend.
- Adicionar integração de e-mail por usuário, usando autorização OAuth quando disponível.
- Ler o e-mail do usuário autenticado apenas para exibir/validar a identidade; o envio real dependerá da autorização da conta.
- Atualizar a tabela/registro de pedidos para armazenar metadados de envio, como `sent_from_email`, se ainda não existir.
- Preservar as permissões atuais: somente usuários com permissão de gestão do restaurante podem criar/enviar pedidos.

## Validação
- Entrar com `silvamoises1965@gmail.com`, conectar essa conta para envio e criar um pedido por e-mail.
- Confirmar que o fornecedor recebe o pedido com o remetente da conta autorizada, não com a conta padrão do navegador.
- Confirmar que WhatsApp, cópia de texto e acompanhamento dos pedidos continuam funcionando.
