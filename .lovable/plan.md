# Links de acesso com endereço totalmente personalizado

O link deixa de ter código aleatório. O gestor escolhe o endereço inteiro, curto e limpo:

```text
https://harmonizevinhos.lovable.app/chef-ricardo
https://harmonizevinhos.lovable.app/contagem-quintana
```

## Como a segurança é mantida sem o código aleatório

Um endereço adivinhável precisa de uma segunda camada. Na primeira abertura o link pede um **código de 4 dígitos** definido pelo gestor (ex. 4712), que é enviado junto com o link ("seu código: 4712"). Depois disso:

- O aparelho é registrado e não pede mais o código nas próximas aberturas.
- Se o link é "somente 1 aparelho", qualquer outro aparelho é recusado mesmo com o código correto.
- O código só pode ser tentado poucas vezes; após 5 erros o link se bloqueia por 15 minutos.
- Validade, revogação e o botão "Desvincular aparelho" continuam funcionando como hoje.

Assim o chef recebe um endereço curto e confiável, e quem esbarrar no endereço por acaso não vê nada.

## Tela de Links de acesso

- Campo **Endereço personalizado**: o gestor digita `chef-ricardo` e o sistema mostra o endereço final em tempo real, avisando se já está em uso.
- Campo **Código de 4 dígitos** (com botão "gerar").
- Cada link na lista mostra o endereço completo, com botão de copiar e o texto pronto para WhatsApp:

```text
Painel de controle do restaurante — uso no CELULAR
https://harmonizevinhos.lovable.app/chef-ricardo
Código de acesso: 4712

Este link fica travado no primeiro celular que abri-lo.
```

- Botão **Editar endereço** (troca o apelido; o antigo para de funcionar) e **Trocar código**.
- Aviso claro na tela: endereços curtos são fáceis de digitar, por isso o código de 4 dígitos é obrigatório.

Os links longos já enviados continuam válidos.

## Detalhes técnicos

- Migração em `access_links`: `slug text` (único global, minúsculo, `[a-z0-9-]{3,40}`, validado contra uma lista de caminhos reservados: `app`, `admin`, `auth`, `api`, `acesso`, `harmonizar`, `landing`, `signup`, `reset-password`, `assets`, `_`), `pin_hash text`, `failed_attempts int`, `locked_until timestamptz`. `token_hash` fica opcional para compatibilidade com links antigos.
- Nova rota curta `src/routes/$accessSlug.tsx` — rota de segmento único no topo, avaliada depois das rotas estáticas existentes; se o slug não corresponder a nenhum link ativo, renderiza o 404 padrão. Ela chama uma server fn pública que: procura o link pelo slug, verifica revogação/validade/bloqueio, checa o cookie de aparelho assinado (`ACCESS_LINK_SECRET`) e, na ausência dele, exige o PIN; em caso de sucesso grava `access_link_devices` e o cookie httpOnly, e então renderiza o painel convidado ou a contagem conforme o `scope` do link.
- PIN guardado apenas como hash (HMAC-SHA256 com `ACCESS_LINK_SECRET`); comparação em tempo constante; `failed_attempts`/`locked_until` atualizados via `supabaseAdmin` dentro do handler.
- Server fns em `src/lib/access-links.functions.ts`: `createAccessLink` passa a receber `slug` + `pin`; novas `updateAccessLinkSlug` e `updateAccessLinkPin`, todas validando `can_manage_restaurant`. Normalização e checagem de reservados no servidor, não só no cliente.
- A lógica de validação vira helper compartilhado em `src/lib/access-links.server.ts`, reaproveitado pela rota antiga `acesso.$kind.$token.tsx`.
- `src/routes/_app.app.access-links.tsx`: campos de slug e PIN, verificação de disponibilidade, exibição do endereço final e botões de edição.
