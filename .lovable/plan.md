## Convite de usuário Fornecedor no Mapa de Acessos

Hoje o Mapa de Acessos (do Rest Admin/Owner) só convida `staff` e `rest_owner`. Fornecedores só aparecem em `/app/sharing`, que apenas **habilita/desabilita** um fornecedor já existente para ver dados do restaurante — não convida a pessoa que representa o fornecedor. Vamos preencher essa lacuna.

### O que passa a existir

No `AccessMapDialog` (aberto pelo Rest Admin em um restaurante), além de "Staff" e "Chef/Owner", adicionar a opção **Fornecedor**:

- Ao selecionar "Fornecedor", aparece um segundo campo: **selecionar o fornecedor** (dropdown com todos os fornecedores já cadastrados naquele restaurante — `suppliers` filtrados por `restaurant_id`).
- Se o restaurante ainda não tem fornecedores cadastrados, mostrar mensagem: "Cadastre o fornecedor em Cadastros → Fornecedores antes de convidar o usuário."
- Campo de email + botão "Convidar".
- Ao enviar: cria o usuário auth (se não existir), cria linha em `public.user_roles` com `role='supplier'`, `supplier_id=<escolhido>`, `restaurant_id=<atual>`. Também garante linha em `public.restaurant_supplier_access` com `enabled=true` para o par (restaurante, fornecedor).

Na lista de usuários do restaurante, exibir também os fornecedores vinculados, com badge "Fornecedor — Nome do fornecedor" e botão de remover (que apaga só a linha de `user_roles`; a habilitação em `restaurant_supplier_access` continua até o Rest Admin desmarcar em `/app/sharing`).

### Detalhes técnicos

**`src/lib/access.functions.ts`**
- Ampliar `roleValues` no `inviteUnitUser` de `["rest_owner","staff"]` para `["rest_owner","staff","supplier"]`.
- Adicionar campo opcional `supplier_id: z.string().uuid().optional()` no schema; validar que é obrigatório quando `role === 'supplier'` e opcional/ignorado nos demais.
- Validar que o `supplier_id` recebido pertence ao `restaurant_id` do convite (SELECT em `suppliers` com ambos os filtros) antes de inserir em `user_roles`.
- Após inserir `user_roles`, fazer `upsert` em `restaurant_supplier_access` (restaurant_id, supplier_id, enabled=true) — idempotente.
- Em `listUnitUsers`, já retorna `supplier_id`; enriquecer com `supplier_name` fazendo join simples em memória (SELECT `id,name` de `suppliers` para os IDs presentes) para exibir o nome sem alterar RLS.

**`src/components/AccessMapDialog.tsx`**
- Adicionar `supplier` ao seletor de papel; quando escolhido, renderizar `<select>` populado por `useQuery` em `suppliers` filtrando `restaurant_id`.
- Estado local `supplierId`; enviar no payload quando papel = supplier; limpar ao trocar de papel.
- Na tabela, mostrar `Fornecedor — {supplier_name}` quando `role === 'supplier'`.

### Fora de escopo (para deixar claro)

- Não muda o fluxo de `/app/sharing` (habilitar/desabilitar visibilidade do fornecedor continua lá).
- Não muda RLS existente do papel `supplier` — as políticas já filtram por `supplier_id_of(auth.uid())` combinado com `restaurant_supplier_access`.
- Não muda o Mapa de Acessos global do Admin (`/admin/access-map`), que já lista `supplier_id`; só ganha o `supplier_name` no display por consequência.
