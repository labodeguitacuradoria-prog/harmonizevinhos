## Objetivo

Reformular `/app` (Início) em hub multi-restaurante, permitir criar restaurantes vinculados a redes, gerenciar mapa de acessos (chef/owner, staff) por unidade, e habilitar visão consolidada de rede no painel para `rest_admin` e `rest_owner`.

Decisões já confirmadas:
- Papéis convidáveis por restaurante: **rest_owner (chef/owner)** e **staff**. Fornecedor continua em `/app/sharing` (gerido pelo rest_admin).
- Visão consolidada da rede: apenas **rest_admin** e **rest_owner**.

## 1. Banco (migração única)

**Schema**
- Reusar `restaurant_groups` como rede e `restaurants.group_id`.
- `user_roles` já suporta múltiplas linhas por usuário — sem alteração estrutural.
- Índices em `user_roles(user_id)` e `user_roles(restaurant_id)`.

**Funções `SECURITY DEFINER`**
- `my_restaurants(_user_id uuid)` → `TABLE(restaurant_id, name, city, group_id, role)` unindo:
  - `restaurants` onde `owner_id = _user_id`
  - `restaurants` acessíveis via `user_roles(restaurant_id, role)`
  - Retornando o "melhor" papel por unidade (rest_admin > rest_owner > staff > supplier).
- `my_groups(_user_id uuid)` → `TABLE(group_id, name)` para redes onde o usuário é `rest_admin` **ou** `rest_owner` em ao menos uma unidade da rede (owner do `restaurant_groups` também entra).
- `can_view_group(_user_id, _group_id)` → boolean: true se admin global, dono do grupo, ou tem papel `rest_admin`/`rest_owner` em qualquer unidade da rede.

**RLS**
- `restaurants` SELECT: adicionar policy permitindo ler unidade quando o usuário tem qualquer linha em `user_roles` para aquele `restaurant_id` (além das policies atuais). Isso libera staff/rest_owner a listar seu(s) restaurante(s) na tela Início.
- `restaurant_groups` SELECT: dono do grupo OU `can_view_group(auth.uid(), id)`.

## 2. Server functions (`src/lib/access.functions.ts`)

Todas `.middleware([requireSupabaseAuth])`, autorização checada dentro do handler:

- `createRestaurantWithAccess({ name, city?, group_id?, new_group_name? })`
  - Cria o `restaurant_groups` se `new_group_name` fornecido (owner = caller).
  - Cria `restaurants` (owner_id = caller, group_id opcional).
  - Insere `user_roles(rest_admin)` para o caller.
- `inviteRestaurantUser({ restaurant_id, email, role: 'rest_owner' | 'staff' })`
  - Autoriza: `can_manage_restaurant(caller, restaurant_id)`.
  - `supabaseAdmin.auth.admin.inviteUserByEmail`, upsert em `profiles`, insert em `user_roles`.
- `removeRestaurantAccess({ user_role_id })`
  - Carrega row, autoriza pelo `restaurant_id`, deleta. Bloqueia auto-remoção do último `rest_admin` da unidade.
- `listRestaurantAccess({ restaurant_id })`
  - Retorna `[{ user_role_id, user_id, email, full_name, role, created_at }]` via join com `profiles`.
- `listAllAccessMap()` — só admin global; retorna mapa completo para tela admin.
- `adminRemoveAccess({ user_role_id })` e `adminInviteAccess({ restaurant_id, email, role })` — só admin global.

## 3. `useAuth` — multi-restaurante

Substituir `restaurantId` único (mantendo compat) por:
- `memberships: { restaurantId, name, groupId, role }[]`
- `groups: { id, name }[]` (redes visíveis)
- `activeRestaurantId` (persistido em `localStorage`)
- `activeGroupId | null` (quando setado ≠ null, dashboard entra em modo consolidado)
- `setActiveRestaurant(id)` e `setActiveGroup(id | null)`

Campo `restaurantId` continua exposto = `activeRestaurantId` para não quebrar código existente. Campo `role` refletirá o papel na unidade ativa.

## 4. Tela Início `/app` reformulada

Substitui o dashboard atual da rota. Continua redirecionando `supplier` → `/supplier` e `admin` → `/admin`.

Seções:
- **Meus restaurantes** — grid de cards (nome, cidade, rede, papel, badge dourado se ativo). Clique define ativo e leva a `/app/dashboard`.
- **Minhas redes** — cards das redes visíveis com botão "Ver consolidado" (ativa `activeGroupId` e navega para `/app/dashboard`).
- **+ Novo restaurante** — modal com: nome, cidade, seletor de rede (existente / criar nova / nenhuma). Usa `createRestaurantWithAccess`.
- Cada card tem menu "Gerenciar acessos" → abre `AccessMapDialog` daquela unidade (visível para `rest_admin`).

## 5. Mapa de acessos por unidade (`AccessMapDialog`)

Componente novo em `src/components/AccessMapDialog.tsx`, seguindo o padrão visual dourado.

- Header: nome do restaurante + rede.
- Tabela: e-mail · nome · papel · desde · ações (remover).
- Rodapé: form "Convidar usuário" → e-mail + papel (chef/owner ou staff) → `inviteRestaurantUser`.
- Nota: "Fornecedores são gerenciados em Compartilhamento."
- Só abre para quem passa em `can_manage_restaurant`.

## 6. Seletor de contexto no sidebar (`_app.tsx`)

Bloco no topo da sidebar:
- Dropdown com todos os `memberships` (agrupados por rede) + opção "Consolidado — Rede X" para cada rede visível ao papel elegível.
- Ao trocar, chama `setActiveRestaurant` / `setActiveGroup` e `router.invalidate()` + `queryClient.invalidateQueries()`.

## 7. Painel consolidado de rede

Em `/app/dashboard`:
- Quando `activeGroupId` estiver setado, buscar `restaurantIds` de todos os restaurantes daquele grupo e agregar as queries existentes por `.in('restaurant_id', ids)`.
- Header do painel mostra "Rede X — consolidado (N unidades)" com botão "Voltar para uma unidade".
- KPIs, gráficos, metas: agregação nativa por soma; métricas de média (preço médio, CMV) recalculadas a partir dos totais consolidados.
- Metas: no modo consolidado, ocultar edição de metas (metas continuam por unidade). Exibir soma das metas mensais das unidades como referência dourada.

## 8. Mapa de acessos global (admin)

Nova rota `/admin/access-map` (link já existente no menu admin apenas para admin):
- Filtros: rede, restaurante, papel, busca por e-mail.
- Tabela full: usuário × restaurante × papel × ações (convidar / remover / alterar papel).
- Usa `listAllAccessMap` + `adminInviteAccess` + `adminRemoveAccess`.

## Arquivos afetados

- `supabase/migrations/*` — nova migração
- `src/hooks/use-auth.ts` — multi-restaurante
- `src/lib/access.functions.ts` — novo
- `src/routes/_app.tsx` — seletor de contexto
- `src/routes/_app.app.index.tsx` — reescrita da tela Início
- `src/routes/_app.app.dashboard.tsx` — modo consolidado
- `src/routes/_app.admin.access-map.tsx` — novo
- `src/routes/_app.admin.index.tsx` — link para o mapa
- `src/components/AccessMapDialog.tsx` — novo
- `src/components/RestaurantContextSwitcher.tsx` — novo

## Fora deste escopo

- Alterar tela `/app/sharing` (fornecedores continuam lá).
- Convite/gestão de outros papéis além de chef/owner e staff no mapa.
- Comparativo entre unidades dentro do painel consolidado (só soma agora; comparativo unidade-a-unidade fica para próxima iteração se desejar).

Confirma que posso executar nesta ordem (migração → auth → server fns → tela Início → sidebar → dashboard consolidado → admin map)?