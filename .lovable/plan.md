Ajuste rápido incluído: **renomear Cava → "Gestão de Vinhos para Restaurantes"** em todos os pontos do app (logo, títulos, meta tags, footer, tela de login). Essa mudança será feita logo no início da primeira fase de build.

---

## Visão geral

O **Gestão de Vinhos para Restaurantes** será uma plataforma com 4 perfis (Admin, Owner, Staff, Fornecedor) e 7 módulos. Hoje já existem: cadastro de vinhos, vendas avulsas, venda mensal, compartilhamento com fornecedores e papéis admin/restaurant/supplier.

## Perfis e permissões

- **Admin do sistema** — gerencia tudo (papel atual `admin`).
- **Owner (Proprietário)** — dono de 1 ou N restaurantes (grupo). Vê dashboards consolidados e por unidade. *Novo papel `owner` + tabela `restaurant_groups`.*
- **Staff** — funcionário do restaurante. Faz contagem de estoque, registra vendas, consome treinamentos. *Novo papel `staff` vinculado a `restaurant_id`.*
- **Fornecedor** — já existe (`supplier`). Ganha acesso a performance dos próprios rótulos.

## Mapa dos módulos

```text
┌──────────────────────────────────────────────────────────┐
│  GESTÃO DE VINHOS PARA RESTAURANTES                     │
├──────────────────────────────────────────────────────────┤
│ 1. Cadastro (multi-categoria)                             │
│    • Vinhos  • Taças  • Decanters  • Acessórios  • Cartas │
│ 2. Painel de Resultados (por unidade + consolidado)       │
│ 3. Gestão de Estoques (contagem semanal do staff)         │
│ 4. Treinamentos (mídia + quizzes + ranking)               │
│ 5. Fornecedores (portal de performance)                   │
│ 6. Harmonizações                                          │
│ 7. Precificação (baseada em ticket médio)                 │
└──────────────────────────────────────────────────────────┘
                  ↓ Fase 2 (futuro)
       Integração com PDV / ERP do restaurante
```

## Fases de implementação

### Fase 0 — Fundação (papéis e grupos)
- Renomear marca de "Cava" para "Gestão de Vinhos para Restaurantes" em todo o app.
- Adicionar papéis `owner` e `staff` ao enum `app_role`.
- Criar `restaurant_groups` (Owner pode ter N restaurantes).
- Adicionar `group_id` em `restaurants`.
- Ajustar menu por papel e middleware de autorização.

### Fase 1 — Cadastro multi-categoria
- Tabela `product_categories` (vinhos, taças, decanters, saca-rolhas, cartas, acessórios…).
- Tabela genérica `products` com `category_id` + JSONB `attributes` (campos específicos por categoria).
- UI: tela "Cadastro" com abas por categoria; formulário dinâmico.

### Fase 2 — Painel de Resultados
- Seletor: **um restaurante** ou **grupo consolidado**.
- Cards: Vendas, CMV, Lucratividade, Preço médio, Giro do estoque, Custo do estoque, % da meta, Comparativo vs ano anterior.
- Ranking de vinhos mais vendidos; quando consolidado: ranking de restaurantes do grupo.
- Tabela `goals` (meta mensal por restaurante/grupo).

### Fase 3 — Gestão de Estoques
- Tabela `inventory_counts` (cabeçalho: semana, restaurante, staff) + `inventory_count_items`.
- Tela "Contagem semanal" para staff: lista todos produtos com input numérico.
- Divergência automática (esperado vs contado) e alertas de reposição/excesso.

### Fase 4 — Treinamentos
- Tabelas: `trainings`, `training_modules`, `quizzes`, `quiz_attempts`.
- Storage bucket `training-media`.
- Tela staff: catálogo + player + quiz.
- Tela owner/admin: relatório "Quem foi treinado e nível de conhecimento".

### Fase 5 — Portal do Fornecedor
- Dashboard do fornecedor: vendas e estoque dos rótulos dele em cada restaurante liberado.
- Ranking de performance do rótulo entre restaurantes.

### Fase 6 — Harmonizações
- Tabela `pairings` (vinho ↔ prato + notas).
- Tela de consulta rápida para staff.

### Fase 7 — Precificação
- Input do **ticket médio** do restaurante.
- Metodologia para calcular preço sugerido de cada rótulo (baseado em ticket + custo).
- Comparar preço atual vs sugerido, mostrar margem.

### Fase 8 (futuro) — Integração PDV/ERP
- Importação automática de vendas, NF de entrada para custo, sincronização de estoque.

## Banco — novas tabelas previstas

```text
restaurant_groups (id, owner_id, name)
product_categories (id, slug, name, attribute_schema jsonb)
products (id, restaurant_id, category_id, name, attributes jsonb, ...)
goals (id, restaurant_id|group_id, period, target_revenue, target_units)
inventory_counts + inventory_count_items
trainings + training_modules + quizzes + quiz_attempts
pairings (wine_id, dish_name, notes)
pricing_settings (restaurant_id, avg_ticket, methodology_params jsonb)
```

## Ordem sugerida

1. **Fase 0** (renomeação + papéis + grupos) — base para tudo
2. **Fase 1** (cadastro multi-categoria) — desbloqueia estoque e portal
3. **Fase 2** (painel consolidado) — dá valor imediato ao Owner
4. **Fase 3** (estoque semanal) — fecha o loop de gestão
5. **Fases 4–7** conforme prioridade do negócio

## Próximo passo

Se aprovar, começamos pela **Fase 0 + Fase 1** (renomeação, fundação de papéis/grupos e cadastro multi-categoria). Antes de codar a Fase 1 preciso que você defina os campos específicos de cada categoria (ex: Taça = capacidade ml, tipo de vinho indicado; Decanter = material, capacidade…).