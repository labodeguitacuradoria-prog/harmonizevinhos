# Simplificar o envio do pedido + arquivo de documentos

## O que muda

1. **Sem conexão de e-mail**: o aplicativo deixa de tentar conectar contas Gmail. O pedido é criado no sistema e o usuário escolhe como enviar:
   - **Copiar texto** do pedido (botão principal) para colar em qualquer e-mail ou WhatsApp;
   - **Abrir WhatsApp** com o texto já preenchido;
   - **Abrir e-mail** no programa do próprio usuário (opcional, texto já preenchido).
   Ao usar qualquer uma dessas opções, o pedido é marcado como enviado, com data e canal registrados — o controle de pedido/recebimento continua igual.

2. **Documentos do pedido**: cada pedido passa a ter uma área "Documentos" onde é possível anexar e guardar:
   - Nota Fiscal, boleto, comprovante de pagamento, e-mail/confirmação do fornecedor, outros.
   O usuário informa o tipo do documento, um número/referência opcional (ex.: nº da NF), valor e vencimento opcionais, e o arquivo (PDF ou imagem). Os arquivos ficam guardados de forma privada, visíveis apenas para quem tem acesso ao restaurante (e ao fornecedor daquele pedido, quando for o caso). Também é possível baixar e excluir um documento.

3. Na tabela de acompanhamento aparece um indicador de quantos documentos o pedido possui, para o usuário identificar rapidamente pedidos sem NF.

## Detalhes técnicos

- Remover: `src/lib/order-email.server.ts`, `order-email.functions.ts`, `order-email.schemas.ts`, `app-user-connections.server.ts`, `app-user-connector-client.ts`, `connection-key-crypto.server.ts`, `src/integrations/lovable/appUserConnector.ts`, `src/routes/oauth.google-mail.return.tsx`.
- Limpar `src/routes/_app.app.orders.tsx`: retirar botão/estado "Conectar Gmail" e envio direto; manter `src/lib/order-message.ts` (assunto e corpo já aprovados) para copiar/WhatsApp/mailto; gravar `sent_at` + `sent_channel` via update simples no pedido.
- Migração:
  - `drop table public.app_user_connections`;
  - manter colunas `sent_from_email`/`sent_provider_message_id` (sem uso) ou removê-las — serão removidas por já não terem função;
  - nova tabela `public.purchase_order_documents` (order_id, doc_type enum: `invoice|boleto|payment_proof|supplier_confirmation|other`, doc_number, amount, due_date, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at/updated_at) com GRANTs para `authenticated`/`service_role`, RLS reusando `can_manage_restaurant` pelo pedido e leitura para o fornecedor do pedido, além de trigger `set_updated_at`.
- Novo bucket privado `order-documents` com policies em `storage.objects` no padrão `order-documents/<restaurant_id>/<order_id>/<arquivo>`, validadas por função auxiliar semelhante a `can_access_product_media`.
- Upload/download/remoção pelo cliente Supabase autenticado (signed URLs para visualizar).
