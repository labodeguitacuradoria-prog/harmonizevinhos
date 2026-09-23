# Catálogo Global com ficha integrada e biblioteca básica de vídeos

## Objetivo

Transformar o Catálogo Global em uma fonte completa de conteúdo para os restaurantes: dados técnicos do rótulo, imagens, vídeos e ficha de treinamento padrão. Quando o restaurante usar um rótulo do catálogo, poderá importar esse pacote pronto e depois personalizar localmente sem alterar o conteúdo global.

## 1. Desenho da tela do Catálogo Global

A tela de edição do rótulo no Catálogo Global passa a ter quatro áreas principais:

```text
┌──────────────────────────────────────────────────────────────┐
│ CATÁLOGO GLOBAL                                               │
│ Buscar rótulo...  Tipo ▾  País ▾  Status ▾  + Novo rótulo     │
├──────────────────────────────────────────────────────────────┤
│ Lista de rótulos                                              │
│ Código | Rótulo | Produtor | País | Mídia | Ficha | Status    │
└──────────────────────────────────────────────────────────────┘

Ao abrir um rótulo:

┌──────────────────────────────────────────────────────────────┐
│ FOTO DO RÓTULO     Nome do vinho                              │
│                    Produtor | País | Região | Estilo          │
│                    Status: Aprovado / Pendente / Rejeitado    │
├──────────────────────────────────────────────────────────────┤
│ Geral | Características | Mídia | Ficha de Treinamento        │
└──────────────────────────────────────────────────────────────┘
```

## 2. Nova aba: Ficha de Treinamento

Dentro do rótulo do Catálogo Global, criar a aba **Ficha de Treinamento** com:

- Prévia da ficha rápida no mesmo formato que o staff verá no celular.
- Campos editáveis:
  - resumo curto para apresentar ao cliente;
  - uvas;
  - como é feito;
  - de onde vem;
  - significado do nome;
  - como é na boca;
  - combina com;
  - frase pronta para a mesa;
  - curiosidade;
  - não confunda.
- Botões:
  - **Gerar com IA**;
  - **Salvar rascunho global**;
  - **Publicar ficha global**;
  - **Ver como staff**.

A ficha global deve ser revisada pelo administrador antes de ficar disponível para importação pelos restaurantes.

## 3. Como o restaurante usa o conteúdo global

Quando o restaurante selecionar um rótulo do Catálogo Global no cadastro local, exibir uma escolha simples:

```text
Importar conteúdo do Catálogo Global?
[✓] Dados técnicos do vinho
[✓] Imagem principal e galeria
[✓] Vídeos do rótulo
[✓] Ficha de treinamento

Cancelar | Importar para este restaurante
```

Regras importantes:

- A importação cria uma cópia local para o restaurante.
- O restaurante pode editar sua própria ficha sem alterar o Catálogo Global.
- Atualizações futuras do Catálogo Global não sobrescrevem automaticamente as edições locais.
- Se o restaurante não quiser usar o catálogo, pode preencher tudo manualmente como hoje.

## 4. Biblioteca básica de vídeos

Criar uma área administrativa chamada **Biblioteca de Treinamento** dentro do Catálogo Global.

Ela armazenará vídeos gerais, não ligados a um rótulo específico, por exemplo:

- como abrir espumante;
- temperatura ideal de serviço;
- diferença entre tinto leve, médio e encorpado;
- como explicar tanino e acidez para o cliente;
- serviço correto do vinho à mesa;
- cuidados com taças;
- harmonização básica;
- como sugerir vinho sem parecer técnico demais.

Cada vídeo terá:

- título;
- categoria;
- descrição curta;
- URL externa ou arquivo enviado;
- status: rascunho / publicado;
- ordem de exibição;
- indicação se é recomendado para todos os restaurantes.

## 5. Como o gestor do restaurante escolhe vídeos básicos

Na tela de Treinamento do restaurante, adicionar uma seção compacta:

```text
Fundamentos para a equipe
[✓] Abertura correta de espumante
[✓] Temperatura de serviço
[ ] Como falar de taninos
[✓] Serviço à mesa
```

O gestor poderá ativar ou desativar os vídeos básicos que aparecerão no link da equipe.

Na tela do staff, esses vídeos entram em uma área separada:

```text
Rótulos da carta | Fundamentos
```

## 6. Ordem recomendada de implementação

1. Criar a ficha de treinamento global vinculada ao rótulo do Catálogo Global.
2. Mostrar essa ficha dentro da edição do rótulo global.
3. Permitir importar a ficha global ao vincular um rótulo global ao restaurante.
4. Importar também imagem principal, galeria e vídeos do rótulo.
5. Criar a Biblioteca de Treinamento com vídeos básicos.
6. Permitir que o gestor escolha quais vídeos básicos aparecem para a equipe.
7. Mostrar a aba **Fundamentos** no link do staff.

## 7. Detalhes técnicos

- A ficha global deve ficar separada da ficha local do restaurante, para preservar personalizações.
- A cópia para o restaurante deve ser feita apenas quando o usuário escolher importar.
- Os vídeos do rótulo podem continuar usando o campo de vídeos já existente no cadastro.
- A biblioteca básica precisa de uma nova estrutura própria, pois seus vídeos não pertencem a um único vinho.
- O acesso do staff deve continuar somente por link válido de treinamento.
- Apenas o administrador geral cria e publica conteúdo global.
- O gestor do restaurante apenas escolhe o que deseja usar na sua equipe.
