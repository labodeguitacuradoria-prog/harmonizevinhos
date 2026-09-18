# Vídeo de treinamento com as fotos reais do vinho

Sim nos dois casos. O vídeo pode começar mostrando a garrafa real, e todas as fotos já salvas na galeria do rótulo passam a ser material do vídeo.

## Ritmo do vídeo

Cerca de 30 segundos divididos em 7 cenas de 4 segundos, para dar dinamismo:

- Cena 1: garrafa (foto principal já padronizada), aproximação lenta.
- Cenas 2 a 7: fotos da galeria (vinícola, vinhedo, taça, detalhe do rótulo), na ordem em que estão salvas.
- Quando faltarem fotos, as cenas restantes são geradas por IA a partir da região, tipo e estilo do vinho, como no teste do Bouza Tannat.

Um rótulo com muitas fotos gera um vídeo praticamente todo com imagens reais; um rótulo só com a foto da garrafa ganha 1 cena real e as demais geradas.

## O que o gestor vê

- Na tela de Treinamento, ao pedir o vídeo, aparece a lista de fotos disponíveis do rótulo para marcar/desmarcar e reordenar quais entram.
- Prévia do roteiro (narração e legendas) antes de gerar.
- Depois de gerado: assistir, refazer ou publicar para a equipe.

## Detalhes técnicos

- Origem das imagens: `wines.image_url` + `wines.gallery_urls` (e equivalentes em `wine_catalog` quando o rótulo vem do cadastro global).
- Cada foto escolhida é normalizada (fundo branco uniforme, enquadramento 9:16) pelo mesmo tratamento já usado nas fichas, no servidor, antes de virar cena.
- Cenas com foto real: animação a partir da imagem (`starting_frame` / image-to-video), 9:16, 1080p, 4s, um único movimento de câmera por cena. Cenas sem foto: geração por texto, também 4s.
- Roteiro, narração e legendas gerados com `openai/gpt-6-astra` pelo gateway de IA; legendas curtas, uma por cena.
- Montagem final (concat das 7 cenas + legendas queimadas + trilha) e upload para `product-media`; caminhos em `wine_story_cards.video_paths`, estado em `video_status` / `video_script` / `video_error`.
- Geração sequencial das cenas (limite de jobs simultâneos), iniciada só por ação explícita do gestor.
- Reprodução pela equipe continua por `api.public.training-video`, apenas para fichas com `video_published`.
- Seleção de fotos e roteiro salvos em `video_script` para permitir refazer com as mesmas escolhas.

## Ordem de execução

1. Leitura das fotos do rótulo e da galeria + seletor de fotos na tela do gestor.
2. Normalização das fotos no servidor para 9:16.
3. Geração das cenas de 4s (foto animada + IA quando faltar) e do roteiro/legendas.
4. Montagem, upload, prévia para o gestor e publicação.
