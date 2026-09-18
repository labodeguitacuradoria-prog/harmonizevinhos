# Treinamento leve: ficha de venda e vídeo de 30 segundos

## Objetivo

Substituir a ficha longa por uma tela de consulta imediata, inspirada na referência enviada. O staff verá primeiro apenas o essencial para apresentar o vinho durante o atendimento. O conteúdo completo continuará disponível, mas somente quando a pessoa pedir para ver mais.

## 1. Nova ficha principal do staff

- Criar uma ficha vertical que ocupe exatamente a área útil do celular, com fundo branco e moldura fina escura.
- Reservar toda a faixa esquerda para a fotografia da garrafa, grande, inteira e sem recorte.
- Organizar à direita, nesta ordem:
  - código interno, quando existir;
  - nome do rótulo;
  - estilo do vinho, sem substituir pelo tipo — exemplos: Tinto Leve, Tinto Encorpado, Branco Aromático;
  - região e país;
  - volume;
  - preço de venda.
- Abaixo, exibir um único parágrafo curto, em letras maiores e de leitura fácil, reunindo o melhor argumento para a mesa, a curiosidade e, quando relevante, a explicação do nome.
- Limitar esse resumo para que a ficha não tenha rolagem e continue cabendo em uma tela de celular.
- Adicionar o botão **Ver mais informações**, abrindo a ficha completa já existente em uma segunda tela.
- Manter anterior/próximo, fechar e “Estudado” como controles discretos, sem competir com a ficha.
- Usar a imagem enviada apenas como referência visual, não como conteúdo do aplicativo.

## 2. Conteúdo curto gerado pela IA

- Adicionar à ficha um campo próprio de **Resumo para apresentar ao cliente**.
- Ajustar a geração para produzir um único parágrafo natural e comercial, sem lista, jargões ou excesso de detalhes.
- O parágrafo deverá priorizar, nesta ordem: motivo do nome, curiosidade memorável e frase simples de apresentação.
- O gestor poderá revisar e editar esse texto antes de publicar.
- Preservar todos os campos detalhados já levantados; eles alimentarão a tela “Ver mais informações”, o desafio e o vídeo.
- Ao regenerar uma ficha, salvar como rascunho e nunca publicar automaticamente.

## 3. Tela de gestão

- Trocar a prévia atual pela nova ficha compacta no formato de celular.
- Destacar o campo do resumo curto no início da edição.
- Recolher os campos detalhados em **Informações complementares**, deixando a tela de trabalho mais limpa.
- Manter publicação individual e em lote.
- Exibir claramente os estados: sem ficha, rascunho, publicada e vídeo disponível.

## 4. Vídeo híbrido de aproximadamente 30 segundos

Será possível criar uma apresentação curta combinando materiais reais e IA:

- foto da garrafa preservada sem deformação;
- imagens reais da vinícola, vinhedos ou região vindas da galeria do cadastro;
- pequenos trechos visuais gerados por IA para dar movimento e ambientação;
- roteiro factual criado a partir da ficha revisada;
- narração em português;
- legendas sincronizadas e legíveis;
- encerramento com o rótulo e uma frase pronta para a mesa.

Estrutura sugerida:

```text
0–7s    Garrafa, nome, estilo e origem
7–18s   História, significado do nome e imagens da vinícola
18–26s  Como é feito, curiosidade e harmonização essencial
26–30s  Frase curta para apresentar ao cliente
```

### Fluxo seguro e econômico

1. O gestor adiciona no cadastro a foto da garrafa e, opcionalmente, fotos da vinícola, vinhedos e região. O cadastro atual já possui imagem principal e galeria, que serão reaproveitadas.
2. Na tela de treinamento, o gestor clica explicitamente em **Criar vídeo de 30 segundos**.
3. O sistema prepara roteiro, narração, legendas e cenas; a tela mostra o andamento da geração.
4. O vídeo fica em rascunho para revisão.
5. Somente após **Publicar vídeo** ele aparece para o staff.
6. O arquivo e seus elementos são armazenados para reutilização. Abrir o vídeo não gera novamente nem cria novo custo.
7. Se não houver imagens suficientes, o sistema usa a garrafa e movimentos discretos, sem inventar a aparência da vinícola.

O vídeo será exibido como uma sequência contínua de cerca de 30 segundos, combinando trechos gerados, fotos com movimento, narração e legendas sobrepostas. Essa composição preserva a precisão do texto e evita depender da IA para desenhar palavras dentro das cenas.

## 5. Botões na ficha

- **Ver mais informações**: abre todos os dados detalhados do rótulo.
- **Assistir em 30 segundos**: aparece somente quando houver vídeo publicado.
- Durante a reprodução: pausar, reiniciar, ativar/desativar som, fechar e acompanhar legendas.

## 6. Dados e armazenamento

- Acrescentar à ficha de treinamento o resumo curto e os dados do vídeo: estado, roteiro, legendas, mídia armazenada e datas.
- Manter os arquivos em área privada, liberados somente pelo link válido do treinamento.
- Reaproveitar imagem principal, galeria e vídeos existentes no cadastro do rótulo.
- Manter as permissões atuais: gestor cria, revisa e publica; staff apenas consulta conteúdo publicado.

## 7. Validação

- Conferir a ficha em celulares estreitos e largos, garantindo ausência de rolagem na vista principal.
- Testar rótulos com nomes longos, sem código, sem região, sem preço e sem fotografia.
- Confirmar que “estilo” nunca é substituído automaticamente por “tipo”.
- Confirmar que “Ver mais informações” preserva todo o conteúdo atual.
- Gerar e reproduzir um vídeo completo, verificando duração aproximada, áudio, legendas, imagens, armazenamento e acesso pelo link do staff.
- Exibir na tela qualquer erro seguro retornado pela geração; nenhuma tentativa automática será repetida para falhas definitivas.

## Detalhes técnicos

- Atualizar a ficha pública, a prévia do gestor, a leitura pelo link e o gerador de conteúdo.
- Criar uma alteração no banco para os novos campos, mantendo os registros existentes intactos.
- A geração textual continua usando Lovable AI no servidor.
- A geração do vídeo será iniciada somente por ação explícita, processada como tarefa assíncrona e acompanhada pela tela até concluir.
- Os trechos gerados e a narração serão salvos no armazenamento privado; legendas temporizadas serão renderizadas pelo player para garantir fidelidade e legibilidade.
- Nenhum vídeo será criado em lote, na abertura da página ou ao clicar para assistir.
