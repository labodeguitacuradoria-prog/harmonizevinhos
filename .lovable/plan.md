## Correções

### 1. Inputs dos contatos não respondem
**Causa:** cada tecla digitada dispara um `UPDATE` no banco e o estado local só muda depois que a resposta volta. Isso bloqueia a digitação e perde caracteres.

**Correção em `src/routes/_app.app.restaurant-profile.tsx`:**
- Separar atualização local (instantânea, a cada tecla) do salvamento (no `onBlur` do campo).
- Aplicar o mesmo padrão também aos campos do restaurante (Nome Fantasia, CNPJ, Endereço, etc.) — hoje só salvam ao clicar em "Salvar Alterações", o que funciona, mas vou padronizar para salvar no `onBlur` para evitar perda de dados.

### 2. Acesso ao Catálogo Global no menu lateral
Hoje o link "Catálogo Global" só aparece para `role === "admin"`. Adicionar também para `role === "restaurant"` em `src/routes/_app.tsx`, com o ícone `Database`, posicionado logo acima de "Perfil do Restaurante".

O restaurante já tem permissão de leitura no `wine_catalog` (RLS atual), então pode navegar e consultar. A tela `/app/catalog-admin` permite edição — vou ajustar para que restaurantes vejam em modo somente-leitura (sem botões "Novo", "Editar", "Excluir") e admins continuem com CRUD completo.
