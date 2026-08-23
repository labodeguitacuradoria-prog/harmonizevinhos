# Manual de Instruções e Manual de Treinamento

Dois documentos completos em português, cobrindo todos os perfis do sistema (Administrador Geral, Administrador do Restaurante, Owner, Staff e Fornecedor).

## O que será entregue

**1. Manual de Instruções (referência)**
- Visão geral do aplicativo e conceitos-chave (Catálogo Global, produtos do restaurante, fornecedores, contagem, vendas mensais, metas)
- Acesso e perfis: quem cria quem, o que cada perfil vê e pode fazer
- Capítulo por módulo, seguindo o menu real do app:
  - Início e troca de restaurante / rede
  - Painel de controle: indicadores, metas e velocímetros, seleção de período, CMV, Top 5 rótulos, CMV por tipo
  - Preços: metodologia Harrington, preço do prato principal, faixas, simulador (salvar/editar simulação, preço de mercado)
  - Harmonizações: Sommelier IA e link público
  - Cadastros: Produtos (todos os campos e o significado de cada um), Carta impressa, Fornecedores, Restaurante
  - Importações com IA: carta de vinhos (PDF/foto), ficha técnica do rótulo, vendas
  - Contagem de estoque (celular) e Revisão da contagem (reabrir, corrigir, sincronizar novos rótulos)
  - Vendas e Venda mensal (garrafas e taças, média dos meses lançados)
  - Rolha, Compartilhamento, Catálogo Global (aprovar, rejeitar, ação em lote, enriquecer com IA, indicador de imagem)
- Boas práticas, erros comuns e o que fazer, glossário

**2. Manual de Treinamento (prático)**
- Trilhas separadas por perfil, com duração sugerida
- Roteiro de 4 sessões: (1) fundamentos e cadastro, (2) contagem e revisão, (3) vendas, metas e painel, (4) preços, harmonização e carta impressa
- Passo a passo numerado de cada tarefa ("como fazer"), exercícios práticos e checklist de conclusão
- Rotina recomendada: diária, semanal, mensal e de fechamento de mês
- Avaliação final com perguntas e gabarito
- Guia rápido de 1 página para o Staff (contagem no celular)

## Formato

Arquivos DOCX prontos para imprimir e distribuir, no padrão visual do projeto (títulos em dourado, tipografia limpa, tabelas com bordas discretas), entregues para download:
- `Manual_de_Instrucoes_Gestao_de_Vinhos.docx`
- `Manual_de_Treinamento_Gestao_de_Vinhos.docx`

Serão gerados apenas com texto, tabelas e listas (sem capturas de tela), para que continuem válidos conforme o app evolui. Se preferir com prints das telas ou como páginas de Ajuda dentro do aplicativo, é só dizer.

## Detalhes técnicos

- Leitura das rotas em `src/routes/` e componentes principais (`PairingStudio`, `WineListImportDialog`, `SalesImportDialog`, `WineFieldsEditor`, `printed-menu/*`) para que o conteúdo descreva exatamente os botões e campos existentes.
- Geração via script Node com a biblioteca `docx` (US Letter, Arial, estilos de heading próprios, sumário, listas com numeração nativa e tabelas com larguras em DXA).
- Validação: conversão de cada página para imagem e revisão visual antes da entrega.
- Nenhuma alteração no código do aplicativo nem no banco de dados.
