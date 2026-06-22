# Fase 1 — Cadastro de Produtos: Vinhos e Taças

Vamos introduzir o conceito de **categorias de produto** e começar com duas: **Vinhos** (expandindo a tabela atual com novos campos) e **Taças** (categoria nova).

## 1. Estrutura de dados

### Tabela `product_categories` (catálogo fixo)
Lista de categorias disponíveis no sistema. Começa com `wine` e `glass`; novas categorias entram aqui sem mudar código.

| Campo | Tipo |
|---|---|
| `slug` | text PK (`wine`, `glass`, …) |
| `label_pt` | text |
| `icon` | text |
| `sort_order` | int |

### Tabela `wines` (expandida)
Mantemos a tabela existente e adicionamos:

**Características**
- `alcohol_pct` (numeric) — teor alcoólico %
- `sugar_level` (text) — seco / meio-seco / suave / doce
- `body` (text) — leve / médio / encorpado
- `tannin` (text) — baixo / médio / alto
- `acidity` (text) — baixa / média / alta
- `aging` (text) — descrição do envelhecimento (ex.: "12 meses em carvalho francês")
- `serving_temp_min` / `serving_temp_max` (int) — °C
- `pairing_notes` (text) — harmonização sugerida
- `tasting_notes` (text) — notas de degustação
- `awards` (text[]) — premiações

**Mídia**
- `image_url` (text) — foto principal do rótulo
- `gallery_urls` (text[]) — fotos adicionais
- `tech_sheet_url` (text) — PDF da ficha técnica
- `video_url` (text) — vídeo do produtor / apresentação

Bucket de Storage `product-media` (público para leitura, escrita restrita por RLS ao restaurante dono).

### Tabela `glasses` (nova)
| Campo | Tipo |
|---|---|
| `restaurant_id` | uuid FK |
| `name` | text |
| `brand` | text |
| `capacity_ml` | int |
| `wine_type_recommended` | text (tinto / branco / espumante / universal / …) |
| `material` | text (cristal / vidro) |
| `cost_price` | numeric |
| `stock_quantity` | int |
| `image_url` | text |
| `notes` | text |

RLS: admin total; owner vê seu grupo (`belongs_to_group`); restaurant vê o próprio (`owns_restaurant`).

## 2. UI

### Tela "Cadastro de Produtos"
- **Seletor de categoria no topo** (cards/tabs: Vinhos · Taças). As demais categorias aparecem como "em breve".
- Cada categoria tem sua própria listagem, formulário e filtros.

### Formulário de Vinho — abas
1. **Geral** — campos atuais (nome, tipo, país, região, uva, produtor, safra, volume, preços, código)
2. **Características** — novos campos sensoriais e técnicos
3. **Mídia** — upload da foto principal, galeria, ficha técnica PDF, link de vídeo
4. **Estoque** — quantidade atual, mínimo

### Formulário de Taça
Formulário simples com os campos da tabela `glasses` + upload de imagem.

## 3. Fora do escopo desta fase
- Demais categorias (Decanters, Saca-rolhas, Cartas, Acessórios) — entram nas próximas fases reutilizando o mesmo padrão.
- Indicadores, treinamentos, precificação, harmonização — fases seguintes do roadmap.

## Detalhes técnicos
- Migrations criam `product_categories` (com seed `wine`/`glass`), adicionam colunas a `wines`, criam `glasses` + RLS + GRANTs, e criam bucket `product-media` com policies.
- Tipos do Supabase serão regenerados após aprovação.
- Componentes novos: `ProductCategoryPicker`, `WineFormTabs` (refatora o form atual), `GlassForm`, `GlassList`, `MediaUploader` (reutilizável).

## Pergunta antes de implementar
Confirma os campos de **Características** do vinho acima, ou quer ajustar/remover algum? E para **Taças**, quer que eu inclua também controle de **quebra/perda** (registro de taças quebradas) já nesta fase ou deixamos para depois?
