# Remover usuário de verdade (não apenas o vínculo)

## Situação atual

No Mapa de acessos, a lixeira remove **somente o vínculo** do usuário com o restaurante (a linha de papel/acesso). A conta de login continua existindo: o usuário ainda pode entrar no sistema, e mantém acesso a outros restaurantes onde tenha vínculo.

## O que será adicionado

Uma ação de **excluir usuário definitivamente**, disponível apenas para o Administrador Geral, dentro do diálogo "Gerenciar" de cada linha do Mapa de acessos.

Comportamento:
- Mostra quantos vínculos o usuário tem hoje (em quais restaurantes).
- Exige confirmação digitando o e-mail do usuário, para evitar exclusão acidental.
- Remove todos os vínculos de acesso do usuário e apaga a conta de login.
- Bloqueios de segurança: o admin não pode excluir a própria conta, nem excluir outro Administrador Geral.
- Após excluir, a lista é atualizada e o usuário desaparece do Mapa de acessos.

A lixeira atual continua existindo com o significado de "remover o acesso a este restaurante", e o texto do botão/confirmação será ajustado para deixar isso claro.

## Detalhes técnicos

- Nova server function `adminDeleteUser` em `src/lib/access.functions.ts`:
  - middleware `requireSupabaseAuth` + verificação de admin global (mesma `assertAdmin` já usada);
  - recusa se `target user_id === context.userId` ou se o alvo possui papel `admin`;
  - apaga linhas de `user_roles` do usuário e chama a Auth Admin API (`auth.admin.deleteUser`) via `supabaseAdmin` importado dentro do handler.
  - `profiles` tem FK para `auth.users` com `on delete cascade`, então é removido automaticamente.
- `src/components/AccessManageDialog.tsx`: nova seção "Zona de risco" com o campo de confirmação e o botão de exclusão, visível apenas quando `isGlobalAdmin`.
- `src/routes/_app.admin.access-map.tsx`: invalida `["admin-access-map"]` após a exclusão; ajuste do texto de confirmação da lixeira para "Remover o acesso deste usuário a este restaurante?".
- Nenhuma migração de banco é necessária.
