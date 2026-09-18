# Vídeo de treinamento com as fotos reais do vinho

Sim nos dois casos. O vídeo de 30 segundos pode começar e terminar mostrando a garrafa real, e todas as fotos já salvas na galeria do rótulo passam a ser material do vídeo.

## Como o vídeo será montado

Cada vídeo terá 3 cenas de 10 segundos, nesta ordem de preferência para cada cena:

1. Foto principal da garrafa (a mesma já padronizada nas fichas) — sempre a primeira cena, com leve movimento de aproximação.
2. Fotos da galeria do rótulo (vinícola, vinhedo, taça, detalhe do rótulo) — usadas na ordem em que estão salvas.
3. Quando faltarem fotos, a cena restante é gerada por IA a partir da região, do tipo e do estilo do vinho, como no teste do Bouza Tannat.

Assim, um rótulo com 3 ou mais fotos gera um vídeo 100% com imagens reais; um rótulo só com a foto da garrafa ganha 1 cena real e 2 geradas.

## O que o gestor vê

- Na tela de Treinamento, ao pedir o vídeo, aparece a lista de fotos disponíveis do rótulo com opção de marcar/desmarcar e reordenar quais entram no vídeo.
- Prévia do roteiro (narração e legendas) antes de gerar.
- Depois de gerado: assistir, refazer ou publicar para a equipe.

## Detalhes técnicos

- Origem das imagens: `wines.image_url` + `wines.gallery_urls` (e os equivalentes em `wine_catalog` quando o rótulo vem do cadastro global).
- Cada foto escolhida é normalizada (fundo branco uniforme, enquadramento 9:16) pelo mesmo tratamento já usado nas fichas, no servidor, antes de virar cena.
- Cenas com foto real: animação a partir da imagem (`starting_frame`), 9:16, 1080p, ~10s. Cenas sem foto: geração por texto.
- Roteiro, narração e legendas gerados com `openai/gpt-6-astra` pelo gateway de IA.
- Montagem final (concat + legendas queimadas + áudio) e upload para `product-media`; caminhos em `wine_story_cards.video_paths`, estado em `video_status` / `video_script` / `video_error`.
- Reprodução pela equipe continua por `api.public.training-video`, só para fichas com `video_published`.
- Seleção de fotos salva em `video_script` para permitir refazer com as mesmas escolhas.

## Ordem de execução

1. Leitura das fotos do rótulo e da galeria + seletor de fotos na tela do gestor.
2. Normalização das fotos no servidor para 9:16.
3. Geração das cenas (foto animada + IA quando faltar) e do roteiro/legendas.
4. Montagem, upload, prévia para o gestor e publicação.
