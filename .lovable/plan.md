# Link de acesso como texto clicável (sem mostrar o endereço)

O objetivo: o chef/patissier recebe algo assim, clicável, sem ver endereço nenhum:

```text
Painel de Controle para Mobile do Patissier
```

Isso é possível — um link com texto próprio (hiperlink). Só depende de onde ele é colado:

- **Funciona (mostra apenas o texto):** e-mail (Gmail, Outlook), WhatsApp Web colando em conversa? não; mas funciona em Word, Google Docs, Notas, Slack, Teams, Telegram e qualquer mensagem em HTML.
- **Não funciona:** WhatsApp no celular, SMS e Telegram em texto puro — esses aplicativos só aceitam texto simples e sempre mostram o endereço. Para esses casos o plano também gera um endereço curto e limpo, do tipo `harmonizevinhos.lovable.app/patissier`, que não parece suspeito.

## O que o gestor vai ver na tela Links de acesso

Ao criar o link, além das opções atuais, ele define o **texto do link** — por exemplo "Painel de Controle para Mobile do Patissier" — e um **apelido do endereço** (sugerido automaticamente a partir do texto, editável).

Três botões de compartilhamento por link:

1. **Copiar link clicável** — copia o hiperlink formatado. Ao colar no e-mail ou no Slack/Teams/Docs aparece só "Painel de Controle para Mobile do Patissier", clicável.
2. **Copiar para WhatsApp** — copia o texto simples com o endereço curto e a instrução de uso ("uso exclusivo no celular", código de acesso).
3. **Abrir e-mail pronto** — abre o cliente de e-mail com assunto e corpo já contendo o link clicável.

Também fica disponível **Baixar atalho**: um arquivo de atalho cujo nome é exatamente o texto do link, para o gestor anexar; o chef abre e cai direto no painel.

## Segurança

Continua igual ao que já existe, com uma camada extra por o endereço ser curto:

- Trava no primeiro aparelho (para links "somente 1 aparelho").
- Código de 4 dígitos pedido só na primeira abertura em cada aparelho, definido/gerado pelo gestor e incluído na mensagem.
- Bloqueio temporário após 5 tentativas erradas; validade, revogação e "Desvincular aparelho" seguem funcionando.
- Endereços reservados do sistema não podem ser usados como apelido.

Os links longos já enviados continuam válidos.

## Detalhes técnicos

- Migração em `access_links`: `slug text` (único, `[a-z0-9-]{3,40}`, bloqueando caminhos reservados: `app`, `admin`, `auth`, `api`, `acesso`, `harmonizar`, `landing`, `signup`, `reset-password`, `assets`), `link_text text` (rótulo exibido), `pin_hash text`, `failed_attempts int`, `locked_until timestamptz`. `token_hash` passa a ser opcional (links legados).
- Rota curta `src/routes/$accessSlug.tsx`: segmento único no topo, resolvida após as rotas estáticas; chama uma server fn pública que valida slug, revogação, validade, bloqueio, cookie de aparelho assinado (`ACCESS_LINK_SECRET`) e, na falta dele, o PIN; grava `access_link_devices` + cookie httpOnly e renderiza o painel convidado ou a contagem conforme o `scope`. Slug inexistente cai no 404 padrão.
- PIN guardado só como HMAC-SHA256 com `ACCESS_LINK_SECRET`, comparação em tempo constante; contadores atualizados via `supabaseAdmin` dentro do handler.
- Cópia do hiperlink: `navigator.clipboard.write` com `ClipboardItem` contendo `text/html` (`<a href="...">texto</a>`) e `text/plain` (endereço curto) — o destino escolhe o formato; fallback para `document.execCommand("copy")` em navegadores sem suporte.
- Atalho: gerado no cliente como Blob `.url` (`[InternetShortcut]\nURL=...`) nomeado com o texto do link sanitizado.
- Server fns em `src/lib/access-links.functions.ts`: `createAccessLink` recebe `slug`, `link_text` e `pin`; novas `updateAccessLinkSlug`, `updateAccessLinkPin` e `updateAccessLinkText`, todas checando `can_manage_restaurant`; normalização e reservados validados no servidor.
- Validação compartilhada extraída para `src/lib/access-links.server.ts`, reaproveitada pela rota legada `acesso.$kind.$token.tsx`.
- `src/routes/_app.app.access-links.tsx`: campos de texto do link, apelido com verificação de disponibilidade, PIN, e os três botões de compartilhamento + baixar atalho.
