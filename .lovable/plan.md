# Portal do Fornecedor

Adicionar um novo tipo de usuário — **fornecedor** — que faz login e vê como seus rótulos estão sendo comercializados nos restaurantes que autorizaram o compartilhamento.

## Como vai funcionar

### 1. Papéis e cadastro
- Novo papel `supplier` (fornecedor), além de `admin` e `restaurant`.
- Apenas o **admin** cadastra fornecedores e vincula quais rótulos pertencem a cada fornecedor (um vinho do catálogo → um fornecedor).
- Fornecedor recebe convite por e-mail e faz login normalmente.

### 2. Permissão por restaurante (privacidade)
- Cada restaurante decide, na tela de "Fornecedores", quais fornecedores podem ver seus dados.
- Por padrão: **nenhum** fornecedor vê nada. O restaurante precisa marcar "Compartilhar dados com este fornecedor".
- Se não autorizar, o fornecedor não vê aquele restaurante (nem agregado, nem identificado).

### 3. O que o fornecedor vê
Painel do fornecedor com 3 áreas, sempre filtradas pelos restaurantes que autorizaram:

- **Estoque atual**: lista de restaurantes × rótulos seus, com quantidade em adega hoje.
- **Histórico de vendas / saídas**: gráfico e tabela de garrafas vendidas por período (7d, 30d, 12 meses), por rótulo e por restaurante.
- **Preço e markup praticados**: preço de venda atual por restaurante, com markup sobre o custo de compra.

Resumos no topo: total de restaurantes ativos, garrafas em estoque, garrafas vendidas no mês, preço médio.

### 4. O que o fornecedor NÃO pode fazer
- Não edita catálogo, estoque, preço nem qualquer dado do restaurante.
- Não vê restaurantes que não autorizaram.
- Não vê dados de rótulos de outros fornecedores.

## Mudanças técnicas

### Banco (novas tabelas e campos)
- `app_role`: adicionar valor `supplier`.
- `suppliers`: `id`, `name`, `contact_email`, `created_at`.
- `user_roles`: já existe; usado para ligar `user_id` ao papel `supplier` e ao `supplier_id`.
- `wines`: adicionar coluna `supplier_id` (FK → `suppliers`, nullable).
- `restaurant_supplier_access`: `restaurant_id`, `supplier_id`, `enabled`, `updated_at` (autorização explícita).
- RLS:
  - Fornecedor só lê `wines`, `inventory`, `sales`, `prices` onde `supplier_id` = seu e existe linha em `restaurant_supplier_access` com `enabled = true`.
  - Funções `security definer`: `is_supplier(uid)`, `supplier_id_of(uid)`, `supplier_can_see_restaurant(supplier_id, restaurant_id)`.

### Telas novas
- **Admin → Fornecedores**: lista, cadastrar, convidar por e-mail, vincular rótulos.
- **Restaurante → Configurações → Compartilhamento**: lista de fornecedores dos rótulos que ele carrega, com toggle "Compartilhar dados".
- **Portal do Fornecedor** (`/supplier`): dashboard, estoque por restaurante, vendas, preços.

### Roteamento
- Após login, redirecionar conforme papel: admin → `/admin`, restaurante → `/app`, fornecedor → `/supplier`.
- Rotas do fornecedor sob `_authenticated/supplier/` com guard de papel.

## Fora do escopo (deste passo)
- Mensagens/chat fornecedor ↔ restaurante.
- Pedidos de reposição automáticos.
- Exportação de relatórios em PDF/Excel (pode vir depois).
