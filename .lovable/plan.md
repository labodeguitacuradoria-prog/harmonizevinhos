# Links de acesso rápido (Chef e Staff)

Criar links nomeados que dão acesso direto a uma tela específica do restaurante, sem e-mail nem senha, e que só funcionam no equipamento autorizado.

## Como vai funcionar

Nova tela **Links de acesso** (dentro de Cadastros / Compartilhamento), visível para Administrador e Chef/Owner do restaurante.

Ao criar um link, o gestor define:

- **Nome do link** — ex. "Chef Ricardo — celular"
- **O que o link abre** — "Painel de controle (somente leitura)" ou "Contagem de estoque"
- **Onde vai ser usado** — "Celular" ou "Desktop"
- **Tipo de uso** — "Somente 1 aparelho" (padrão para o chef) ou "Vários aparelhos" (padrão para o staff que faz a contagem)
- **Validade** — sem prazo, 30, 90 ou 180 dias

O sistema gera um endereço próprio para cada link, com o uso já indicado no texto, por exemplo:

```text
Link do Chef — uso exclusivo no CELULAR
https://harmonizevinhos.lovable.app/acesso/celular/<código>

Este link fica travado no primeiro celular que abri-lo.
Em outro aparelho ele não vai funcionar.
```

Botão para copiar o link já com esse texto de instrução pronto para enviar por WhatsApp.

## Trava no primeiro aparelho

1. Na primeira abertura, o sistema registra uma marca do aparelho (cookie assinado no navegador + registro no banco) e libera o acesso.
2. Nas próximas aberturas, só passa se a marca do aparelho coincidir.
3. Em qualquer outro aparelho aparece "Este link já está em uso em outro aparelho" — sem mostrar nenhum dado.
4. Se o link é de celular e é aberto num desktop (ou o contrário), o acesso é recusado com a mensagem correta.
5. Links "Vários aparelhos" (staff) não travam — cada aparelho registra um acesso, e o gestor vê quantos aparelhos usaram.

Na tela de gestão: lista dos links com nome, tipo, último acesso, aparelhos registrados, botões **Desvincular aparelho** (se o chef trocou de celular) e **Revogar**.

## O que o link mostra

- **Chef (painel)**: só o painel de controle em leitura — faturamento, garrafas vendidas, estoque, preço médio e CMV. Sem cadastros, pedidos, custos por rótulo, nem barra lateral. Um aviso no topo: "Modo visualização. Para acessar tudo, entre com seu e-mail."
- **Staff (contagem)**: só a tela de contagem de estoque do restaurante, permitindo registrar as quantidades da sessão aberta.
- Nenhum link permite alterar preços, cadastros, pedidos ou acessos.

## Detalhes técnicos

- Migração: tabela `access_links` (`id`, `restaurant_id`, `label`, `scope` enum `dashboard|stock_count`, `device_kind` enum `mobile|desktop`, `single_device` bool, `token_hash`, `expires_at`, `revoked_at`, `created_by`) e `access_link_devices` (`link_id`, `device_hash`, `user_agent`, `first_seen`, `last_seen`). GRANTs + RLS: leitura/escrita apenas para membros `rest_admin`/`rest_owner` do restaurante e `service_role`; o token nunca é lido pelo cliente anônimo.
- O token vai na URL apenas como valor aleatório (32 bytes base64url); no banco guardamos só o hash SHA-256.
- Rota pública `src/routes/acesso.$kind.$token.tsx` (top-level, não em `api/public`): server fn valida token, `device_kind` contra o User-Agent, expiração/revogação e a trava de aparelho; grava cookie httpOnly assinado com o `device_hash`. Só após validar, carrega os dados via `supabaseAdmin` importado dentro do handler.
- Os dados do painel são calculados numa server fn dedicada, que devolve apenas os agregados exibidos (sem linhas de custo por rótulo), reaproveitando os mesmos cálculos do dashboard atual.
- Gestão dos links: server fns autenticadas com `requireSupabaseAuth`, checando que o usuário é `rest_admin`/`rest_owner` do restaurante antes de criar/revogar.
- `SESSION_SECRET` (gerado) assina o cookie de aparelho.
- Nova tela `src/routes/_app.app.access-links.tsx` + item no menu junto de Compartilhamento.
