# Links de acesso com endereço curto e personalizado

Hoje o link gerado é enorme (um código aleatório de 43 caracteres) e por isso parece suspeito ao ser enviado por WhatsApp. A ideia é permitir dar um nome curto ao link, mantendo a mesma segurança.

## Como vai ficar

Ao criar o link, além do nome interno ("Chef Ricardo — celular"), o gestor informa um **apelido do endereço** (ex. `chef-ricardo`). O sistema monta um endereço curto:

```text
https://harmonizevinhos.lovable.app/a/chef-ricardo-7q4m2x
```

- A parte legível é escolhida pelo gestor (letras, números e hífen; acentos e espaços são convertidos automaticamente).
- O sistema acrescenta 6 caracteres aleatórios, invisíveis na prática, que garantem que o endereço não possa ser adivinhado por quem não recebeu o link.
- Se o apelido já existir no restaurante, o sistema avisa e sugere outro.

Na tela **Links de acesso**:

- Novo campo "Apelido do endereço" no formulário, já preenchido automaticamente a partir do nome do link (editável).
- O endereço completo passa a ficar visível na lista de links (não é mais segredo de exibição única), com botão de copiar e o texto de instrução pronto para WhatsApp.
- Botão **Renomear endereço** em cada link existente: gera um novo endereço curto com o novo apelido; o antigo deixa de funcionar imediatamente. O aparelho já vinculado continua vinculado (o chef não precisa nada além de abrir o novo link).

Os links antigos e longos continuam funcionando, então nada que já foi enviado quebra.

## Segurança

Nada é afrouxado:

- A trava por aparelho, a validade e a revogação continuam iguais.
- O segredo aleatório de 6 caracteres é combinado com a verificação de aparelho: mesmo que alguém tente adivinhar apelidos, sem o sufixo correto e sem o aparelho autorizado não há acesso.
- Tentativas repetidas com endereço inválido são recusadas sem revelar se o apelido existe.

## Detalhes técnicos

- Migração em `access_links`: colunas `slug text` e `slug_secret text` (o segredo continua guardado apenas como hash SHA-256 em `token_hash`; a validação passa a localizar a linha por `slug` e comparar o hash do sufixo recebido). Índice único parcial em `(restaurant_id, slug)` ignorando links revogados. Sem alteração de GRANTs/RLS além de permitir a leitura do `slug` pelos mesmos papéis que já leem os links.
- Nova rota pública `src/routes/a.$code.tsx`: separa `slug` e sufixo, valida via server fn (mesma lógica de `acesso.$kind.$token.tsx`, extraída para helper compartilhado em `src/lib/access-links.server.ts`), e renderiza o painel convidado ou a contagem conforme o `scope` gravado no link — o tipo de aparelho vem do registro, não mais da URL. A rota antiga `acesso.$kind.$token.tsx` permanece para compatibilidade.
- Server fns em `src/lib/access-links.functions.ts`: `createAccessLink` passa a aceitar `slug` (normalizado no servidor) e devolver a URL curta; nova `renameAccessLink` valida permissão (`can_manage_restaurant`), gera novo sufixo e atualiza `slug`/`token_hash` preservando `access_link_devices`.
- `src/routes/_app.app.access-links.tsx`: campo de apelido com sugestão automática, exibição do endereço curto por link, botão Renomear e texto de instrução atualizado.
