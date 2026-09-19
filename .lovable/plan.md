# Mover criação de vídeo para a aba Mídia do rótulo

## Contexto
Atualmente a geração de vídeo de ~30s vive no módulo Treinamento (`_app.app.training.tsx` + `VideoStudio.tsx`), usa fotos do rótulo (principal + galeria + catálogo global) e salva o resultado em `wine_story_cards.video_*`. O usuário quer mudar o conceito: a criação de vídeo sai do Treinamento e passa para a aba **Mídia** dentro da ficha do vinho, aproveitando a galeria de imagens. Os vídeos gerados ou colados devem ficar no campo `videos` do próprio rótulo (`wines.videos`, array JSON de `{title, url}`), junto com vídeos externos (YouTube/Vimeo).

## O que será feito

1. **Retirar o VideoStudio da tela de Treinamento**
   - Remover import e uso de `<VideoStudio ... />` de `src/routes/_app.app.training.tsx`.
   - Manter `wine_story_cards` como está (fichas de bolso, sem vídeo publicado); o vídeo deixará de ser vinculado à ficha de treinamento.

2. **Criar componente de geração de vídeo na aba Mídia**
   - Novo componente `src/components/wine/VideoGenerator.tsx` (ou reaproveitar lógica do `VideoStudio` adaptada).
   - Local: dentro da aba Mídia de `WineFieldsEditor.tsx`, logo abaixo da "Galeria de imagens" e acima da seção "Vídeos".
   - O componente mostra as imagens disponíveis do rótulo (`image_url` + `gallery_urls` + catálogo global, quando houver `catalog_id`) e permite marcar/desmarcar/reordenar até 7 fotos.
   - Botão "Criar vídeo de ~30s" inicia a fila de cenas de 4s.
   - Durante o processamento mostra progresso (cena X de 7) e botão cancelar/desistir.
   - Quando termina, oferece: título do vídeo, "Salvar no rótulo" (adiciona em `videos`), "Refazer" ou "Descartar".

3. **Adaptar as server functions de vídeo**
   - Manter `src/lib/training-video.functions.ts` como motor de geração, mas renomear/clonar para `src/lib/wine-media-video.functions.ts` com funções mais genéricas:
     - `getWineVideoImages` → já existe, lista fotos do vinho.
     - `startWineVideo` (ou similar) → cria roteiro e fila; não grava em `wine_story_cards`, retorna `{jobId, status, scenes}`.
     - `advanceWineVideo` → polls um job e baixa a cena; retorna `{status, paths[]}`.
     - `finalizeWineVideo` → concatena as cenas em um único MP4 (~28s) e faz upload para `product-media` no path `videos/{restaurant_id}/{wine_id}/{uuid}.mp4`; retorna URL assinada.
   - Remover dependência de `wine_story_cards` do pipeline de vídeo (não salvar `video_status`/`video_paths` na tabela de treinamento).

4. **Atualizar a seção "Vídeos" da aba Mídia**
   - Além dos campos de título/URL externos, permitir anexar arquivo de vídeo (MP4) gerado ou enviado.
   - Quando o vídeo vier da geração interna, preencher título automaticamente (ex: "Vídeo de apresentação") e URL do arquivo em `product-media`.
   - Ícone/play para preview inline de arquivos MP4 (sem sair da tela).

5. **Ajustes de storage e políticas**
   - Usar bucket `product-media` já existente.
   - Path sugerido: `videos/{restaurant_id}/{wine_id}/{uuid}.mp4`.
   - O upload usa `supabase.storage.from("product-media").upload(...)` e devolve `createSignedUrl` de longa duração (1 ano) para salvar no `videos`.

6. **Persistência no rótulo**
   - Ao salvar a ficha do vinho, `videos` passa a conter tanto links externos quanto vídeos gerados/uploadados.
   - Nenhuma alteração no schema do banco é necessária; o campo `wines.videos` já é `jsonb` no formato `{title, url}`.

## Fora do escopo deste plano
- Reprodução do vídeo na ficha de treinamento da equipe (será redesenhado depois).
- Montagem de vídeo com legendas queimadas/trilha: nesta primeira versão, se o pipeline de concatenação for complexo demais para o runtime do Worker, entrega as cenas individuais ou usa o vídeo final devolvido pelo gateway quando o modelo o permitir. O objetivo é mover o conceito e deixar a geração funcional na Mídia.

## Arquivos envolvidos
- `src/routes/_app.app.training.tsx` — remover `VideoStudio`.
- `src/components/WineFieldsEditor.tsx` — adicionar gerador na aba Mídia e enriquecer lista de vídeos.
- `src/lib/wine-media-video.functions.ts` — novo (ou adaptação de `training-video.functions.ts`).
- `src/components/training/VideoStudio.tsx` — pode ser movido para `src/components/wine/VideoGenerator.tsx` e simplificado.
- `src/components/MediaUploader.tsx` — opcional: melhorar suporte a vídeos na seção Vídeos.

## Critério de aceite
- Abrir um rótulo → aba Mídia → gerar vídeo com imagens da galeria → o vídeo gerado aparece na lista "Vídeos" do rótulo com título e URL.
- Vídeos externos (YouTube/Vimeo) continuam funcionando lado a lado com os gerados.
- Módulo Treinamento não mostra mais o painel de vídeo.
