## Migração dos 63 rótulos para o Catálogo Global

Copiar os rótulos hoje cadastrados em `wines` para a tabela `wine_catalog`, criando uma base inicial compartilhada entre restaurantes.

### O que será migrado (campos compartilháveis)
- Nome, Produtor, Safra, Região, País, Uvas, Tipo, Volume
- Características sensoriais (notas, harmonização, elaboração e maturação, etc.)
- Mídia (foto do rótulo) e código de barras

### O que NÃO será migrado (dados privados do restaurante)
- Código interno do restaurante
- Fornecedor
- Preço de custo e preço de venda
- Status (ativo na carta / conta no estoque)
- Estoque e vendas

### Regras da migração
- **Deduplicação**: rótulos com mesmo Nome + Produtor + Safra + Volume são considerados o mesmo item — apenas um vai ao catálogo.
- **Atribuição**: cada item ficará marcado como "contribuído por" o restaurante de origem (`contributed_by_restaurant_id`), para histórico.
- **Sem impacto no restaurante**: a tabela `wines` continua intacta. Nenhum preço, código ou vinculação local muda.
- **Operação única**: é um INSERT no `wine_catalog`. Não cria vínculo permanente — se você editar um rótulo no seu restaurante depois, o catálogo global não muda automaticamente (e vice-versa).

### Comportamento futuro (já existente)
Quando outro restaurante cadastrar um novo rótulo, ao digitar o nome o sistema sugere itens do catálogo global e preenche automaticamente as características — restando apenas inserir código interno, fornecedor e preços.

### Confirmação necessária
1. Confirma que posso migrar **todos os 63** rótulos, inclusive os marcados como "inativos na carta"?
2. Posso seguir com a regra de deduplicação acima (Nome + Produtor + Safra + Volume)?