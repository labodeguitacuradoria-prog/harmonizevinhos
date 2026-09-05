# Cobrança por assinatura do sistema

Objetivo: cada restaurante assina o sistema, com 90 dias de teste grátis, plano mensal ou anual (anual com desconto), em reais, para clientes no Brasil.

## Provedor recomendado: Paddle (pagamentos integrados da Lovable)

O produto é um software de gestão (SaaS), o que se encaixa no modelo do Paddle. Vantagens para o seu caso:

- Não precisa abrir conta em nenhum provedor de pagamento; a Lovable já cuida disso.
- O Paddle atua como vendedor oficial: calcula, cobra e recolhe impostos, emite recibos, trata reembolsos e contestações.
- Aceita cartões e métodos locais, com preços em reais.
- Custo: 5% + US$ 0,50 por transação, sem taxas extras.
- Começa em ambiente de teste, para você testar sem dinheiro real. Para receber de verdade, há uma verificação da sua empresa.

Observação: cobrança por assinatura exige o plano Pro (ou superior) da Lovable.

## Passos

1. **Ativar os pagamentos** — abro o formulário de ativação do Paddle (e-mail, nome, empresa). Cria automaticamente o ambiente de teste.
2. **Criar os planos** — cadastro dois preços do mesmo produto: "La Bodeguita — Mensal" e "La Bodeguita — Anual" (com desconto). Você me diz os valores; sugestão a confirmar: R$ 249/mês e R$ 2.490/ano (2 meses grátis).
3. **Guardar a assinatura no banco** — tabela de assinaturas ligada a cada restaurante, com plano, situação (teste, ativa, atrasada, cancelada), fim do teste e fim do período pago.
4. **Iniciar os 90 dias de teste** — quando um restaurante é criado, a data de fim do teste é gravada. Nenhum cartão é pedido nesse momento.
5. **Tela de assinatura** — nova página dentro do app: mostra a situação atual, dias restantes do teste, comparação mensal x anual, botão para assinar e botão para gerenciar/cancelar.
6. **Aviso de fim de teste** — faixa no topo do painel a partir de 15 dias antes do fim, com link para assinar.
7. **Bloqueio suave após o vencimento** — sem assinatura ativa, o restaurante continua vendo o painel em leitura, mas cadastros, pedidos, contagens e importações ficam bloqueados com convite para assinar. Links de acesso do Chef e a página pública de harmonização continuam livres.
8. **Confirmação automática do pagamento** — o Paddle avisa o sistema a cada pagamento, renovação, falha ou cancelamento, e a situação da assinatura é atualizada sozinha.
9. **Cortesia liberada pelo administrador** — na tela de restaurantes do administrador, um controle "Acesso gratuito" com data de validade opcional e campo de motivo. Restaurante em cortesia usa o sistema inteiro sem cobrança e sem aviso de teste; a tela de assinatura mostra "Cortesia concedida". Só o administrador geral pode ligar ou desligar.
10. **Testar de ponta a ponta** — assinar no ambiente de teste, conferir liberação do acesso, renovação, falha de pagamento, cancelamento e cortesia.

## Detalhes técnicos

- `payments--enable_paddle_payments`, depois `batch_create_product` para os dois preços (mensal/anual) do mesmo produto.
- Migração nova: `public.subscriptions` (`restaurant_id`, `provider`, `customer_id`, `subscription_id`, `price_id`, `plan` `monthly|yearly`, `status` enum `trialing|active|past_due|canceled|complimentary`, `trial_ends_at`, `current_period_end`, `comp_until`, `comp_reason`, `comp_granted_by`) + `GRANT` para `authenticated`/`service_role`, RLS por `can_manage_restaurant`, escrita apenas via `service_role`.
- `trial_ends_at` default `now() + interval '90 days'`; trigger em `handle_new_user`/criação de restaurante insere a linha de teste.
- Cortesia: server fn `setComplimentaryAccess` com `requireSupabaseAuth` que confere `has_role(userId,'admin')` antes de gravar via `supabaseAdmin`; o gate considera acesso liberado quando `status = 'complimentary'` e `comp_until` é nulo ou futuro.
- Checkout: `createServerFn` com `requireSupabaseAuth`, valida que o usuário administra o restaurante, cria a sessão de checkout do Paddle e retorna a URL.
- Webhook: rota `src/routes/api/public/paddle-webhook.ts`, valida a assinatura do Paddle antes de processar, grava com `supabaseAdmin`.
- Guarda de acesso: helper `useSubscriptionGate` a partir de `subscriptions` + hook existente `use-auth`; aplicado nas telas de escrita, sem tocar em `/acesso/*` nem `/harmonizar`.
- Visual mantido no tema escuro dourado/vinho já existente.

## O que preciso de você

- Valores do plano mensal e do plano anual.
- Nome comercial/empresa e e-mail para o cadastro no Paddle (preenchidos no formulário de ativação).
