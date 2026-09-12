## Ajustes de posicionamento e margens da carta

### O que será alterado
- Adicionar um controle recolhível **Alinhamento e preço** na área “Informações do rótulo”.
- Permitir alinhar o tipo de vinho e o nome do rótulo à esquerda ou ao centro.
- Permitir manter o preço próximo do nome ou afastado na extremidade da linha.
- Adicionar um controle recolhível **Margens da página**, com recuos independentes acima, abaixo, à esquerda e à direita, em milímetros.
- Mostrar imediatamente as escolhas na pré-visualização e aplicá-las também na impressão/PDF.
- Salvar essas escolhas em cada carta e manter compatibilidade com cartas já salvas.

### Detalhes técnicos
- Ampliar a configuração persistida da carta com alinhamento, posição do preço e quatro margens.
- Atualizar o componente de pré-visualização para aplicar alinhamentos e recuos sem alterar os dados dos rótulos.
- Usar os valores das quatro margens na regra de impressão da página.
- Manter os novos ajustes em menus compactos com seta, seguindo o padrão já usado em “Espaçamento das linhas” e “Fontes e tamanhos”.
