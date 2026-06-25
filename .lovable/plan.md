
# Papéis, Onboarding Self-Service, Catálogo Global e Cadastro com Busca

## 1. Hierarquia de papéis

| Papel | Quem é | Como entra no sistema | O que faz |
|---|---|---|---|
| **System Owner** (`admin`) | Você | Conta fixa, criada manualmente | Aprova catálogo global; intervém sob demanda em contas de restaurantes |
| **Restaurant Admin** (`rest_admin`) | Profissional operacional | **Self-signup** (email + senha) | Cadastra rótulos, preços, fornecedores; cria contas de Staff e do Owner do restaurante |
| **Restaurant Owner** (`rest_owner`) | Chef / proprietário | Criado pelo Restaurant Admin do seu restaurante | **Padrão: só visualiza** dashboards. Pode ativar "Modo Admin" ou "Modo Staff" sem segunda conta |
| **Staff** (`staff`) | Garçom / sommelier | Criado pelo Restaurant Admin | Contagem de estoque, treinamentos |
| **Fornecedor** (`supplier`) | Externo | Já existente | Portal de fornecedor |

### Fluxo de onboarding (sem intervenção sua)
1. Usuário acessa `/auth` e faz signup com email + senha + nome do restaurante.
2. Trigger `handle_new_user` (já existe) é atualizada para:
   - Criar `profiles`
   - Criar `restaurants` com `owner_id = novo_usuario`
   - Atribuir papel **`rest_admin`** (em vez de `restaurant`) ao novo usuário
3. Esse Restaurant Admin entra no sistema e, dentro de "Equipe", cria:
   - 0 ou 1 conta de **Restaurant Owner** (chef/proprietário) com email e senha
   - N contas de **Staff** com email e senha
4. Em restaurantes pequenos, o próprio Admin acumula os papéis — não precisa criar mais ninguém.

### Sua intervenção (System Owner)
- Painel `/app/admin/accounts` (só visível para `admin`):
  - Listar restaurantes e usuários
  - Resetar senha de qualquer usuário
  - Criar conta de Restaurant Admin manualmente para um restaurante (caso o cliente peça ajuda)
  - Transferir propriedade do restaurante para outro email
- Tudo sob demanda. O fluxo normal não passa por você.

### "Modo Admin / Modo Staff" do Restaurant Owner
- Quando logado como Owner, header mostra: `[ 👁 Visualização ] [ ⚙ Modo Admin ] [ 📋 Modo Staff ]`
- Trava de UX apenas: por padrão Owner vê dashboards limpos; ao ativar um modo, libera os menus correspondentes na sessão.
- Sem segunda conta, sem segunda senha.

### Migração de papéis
- Enum `app_role`: adicionar `rest_admin` e `rest_owner`.
- Usuários atuais com papel `restaurant` → migrados para `rest_admin` (eles eram quem cadastrava as coisas).
- Helper `can_manage_restaurant(user, restaurant)`: true para `admin`, `rest_admin` daquele restaurante, ou `rest_owner` daquele restaurante.

---

## 2. Catálogo Global de Rótulos

### Estrutura

**`wine_catalog` (global, compartilhado)** — só dados intrínsecos do rótulo:
- Identidade: `name`, `producer`, `vintage`, `region`, `country`, `grape`, `wine_type`, `volume_ml`, `barcode`
- Sensorial: `alcohol`, `body`, `tannins`, `acidity`, `sweetness`, `tasting_notes`, `pairing_notes`
- Mídia: `image_url`, `tech_sheet_url`, `video_url`
- Curadoria: `status` (`pending` / `approved` / `rejected`), `submitted_by`, `source_restaurant_id`, `approved_by`, `approved_at`, `rejection_reason`

**RLS:**
- SELECT: qualquer autenticado vê `approved`; submitter vê os próprios `pending`/`rejected`.
- INSERT: qualquer autenticado (entra como `pending`).
- UPDATE/DELETE: apenas System Owner.

**`restaurant_wines` (local, comercial)** — substitui a tabela `wines` atual:
- `restaurant_id`, `catalog_id` (FK opcional)
- `internal_code`, `supplier_id`, `cost_price`, `sale_price`
- Overrides opcionais (`*_override`) para campos do catálogo que o restaurante queira personalizar
- `catalog_id` nulo = rótulo 100% local

Estoque, contagens, vendas mensais e movimentos passam a referenciar `restaurant_wines.id`.

### Painel de Curadoria (System Owner)
Rota `/app/admin/catalog`:
- **Pendentes**: cards com foto, dados, restaurante de origem. Aprovar / Editar e aprovar / Rejeitar (com motivo).
- **Aprovados**: edição posterior.
- **Rejeitados**: histórico.
- Alerta de duplicata: se um `pending` bate nome+produtor+safra de um aprovado, mostra comparação lado a lado.

---

## 3. Cadastro de Rótulos com Busca (estilo Wine-Searcher)

Ao clicar "Novo rótulo":

```text
┌─────────────────────────────────────────────────────┐
│  🔍 Buscar rótulo...                    📷 Scanner  │
│  ─────────────────────────────────────────────────  │
│  Digitando "marg..." →                              │
│  🖼  Chateau Margaux 2019    Bordeaux / FR  ✓       │
│  🖼  Margaux 2018            Bordeaux / FR  ✓       │
│  🖼  Pavillon Rouge 2020     Bordeaux / FR  ✓       │
│  ─────────────────────────────────────────────────  │
│  + Não encontrei — cadastrar novo rótulo            │
└─────────────────────────────────────────────────────┘
```

1. Autocomplete debounced (300ms) em `wine_catalog` por nome + produtor (ILIKE + trigram) e barcode exato. Top 8 com foto, safra, região.
2. **📷 Scanner**: EAN existente vincula direto.
3. Selecionar rótulo: abre o formulário **pré-preenchido**. O usuário só preenche código interno, fornecedor, custo e venda. Aviso "Dados vindos do catálogo global". Botão "Editar dados do rótulo" cria overrides locais.
4. **"Cadastrar novo rótulo"**: formulário em branco. Ao salvar, cria:
   - `wine_catalog` com `status='pending'` (vai para sua fila)
   - `restaurant_wines` vinculado, já operacional para o restaurante imediatamente

### Foto e ficha técnica
Vão junto da submissão. Se você editar/rejeitar na curadoria, o restaurante mantém os arquivos como override local.

---

## 4. Migração dos vinhos existentes

Registros atuais de `wines` viram `restaurant_wines` **sem `catalog_id`** (locais puros). Nada é compartilhado automaticamente; você decide na curadoria, depois, quais promover ao catálogo global.

---

## 5. Detalhes técnicos

- **Enum `app_role`**: adicionar `rest_admin`, `rest_owner`; manter `restaurant` como deprecado por compatibilidade; migrar registros existentes para `rest_admin`.
- **Trigger `handle_new_user`**: atualizar para atribuir `rest_admin` no signup.
- **Funções**: `can_manage_restaurant(user, restaurant)`, `is_system_owner(user)`, manter `has_role` e `owns_restaurant`.
- **Tela "Equipe"** (apenas Restaurant Admin): listar/criar/desativar contas de Owner e Staff do próprio restaurante. Criação usa Supabase Admin API via `createServerFn` autenticado que valida `rest_admin` antes de chamar `supabaseAdmin.auth.admin.createUser`.
- **Painel `/app/admin/accounts`** (System Owner): mesma mecânica, mas global.
- **Busca catálogo**: índice GIN `pg_trgm` em `name`/`producer`; índice único parcial em `barcode WHERE barcode IS NOT NULL`.
- **Modo Owner**: estado em `localStorage` (`owner_active_mode`). RLS continua liberando tudo; controle é só de UX.

---

## 6. Fora de escopo desta fase
- Reputação/uso de rótulos no catálogo
- Notificações quando rótulo submetido é aprovado/rejeitado
- Import em massa de catálogos externos
- Aplicar lógica de catálogo global às outras categorias (Taças, Drinks)
- Sugestões de melhoria de rótulos já aprovados
