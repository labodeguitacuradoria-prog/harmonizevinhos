# Plataforma em módulos: cada cliente usa só o que precisa

Hoje o sistema é um pacote único. A ideia é transformá-lo em cinco produtos que partem do mesmo ponto: o upload da carta de vinhos.

## Os módulos

| Módulo | O que entrega |
| --- | --- |
| Completo | Tudo o que existe hoje |
| Painel de controle | Faturamento, garrafas, taças, estoque, preço médio, CMV, rolha, rótulos ativos, diagnóstico |
| Análise de preços | Faixas de preço, margens, simulações, sugestões |
| Carta para impressão | Modelos, seções, logotipo, PDF pronto |
| Harmonização | Estúdio de harmonização com base na carta do restaurante |

Novos módulos podem ser somados depois sem refazer nada.

## Nada do que já existe se perde

- Todos os restaurantes, rótulos, vendas, estoques, pedidos e contagens já cadastrados permanecem intactos: nenhuma tabela é apagada ou alterada de forma destrutiva.
- Todos os restaurantes existentes hoje recebem automaticamente o **módulo Completo**, então o app continua exatamente como você usa hoje.
- Sua conta `silvamoises1965@gmail.com` segue como administrador geral, com acesso ao pacote completo de todos os restaurantes e ao controle de módulos.
- A separação por módulos só afeta clientes novos que entrarem por um módulo isolado.

## Ponto de partida único: a carta

Quem contrata um módulo isolado não precisa passar pelo cadastro completo. O caminho é:

1. Cria a conta (e-mail e senha, ou Google).
2. Informa apenas o nome do restaurante.
3. Faz o upload da carta (PDF, foto ou planilha) — a leitura por IA já existente preenche os rótulos.
4. Cai direto na tela do módulo contratado.

O restaurante é criado por trás dos panos, então quem começar só com a carta pode virar cliente do pacote completo depois sem perder nada.

## Como o app muda

- **Menu enxuto**: a barra lateral mostra somente os módulos liberados. Quem tem só "Carta para impressão" vê Início, Produtos e Carta.
- **Início como vitrine**: os módulos não contratados aparecem como cartões com "Conhecer", levando a uma página de apresentação e ao pedido de liberação/assinatura.
- **Endereços diretos**: quem entra num endereço de módulo não liberado vê a página de apresentação, não uma tela quebrada.
- **Administrador geral** liga e desliga módulos por restaurante na tela de Restaurantes, com opção de liberar tudo por cortesia.
- **Perfis**: sommelier autônomo pode ter vários restaurantes/clientes e trocar entre eles com o seletor já existente. Importador continua no portal do fornecedor. Pessoa física usa a harmonização pública, sem carta.
- Visual, cores e tipografia atuais permanecem.

## Ordem de entrega

1. Base de módulos + menu e telas respeitando o que está liberado + controle do administrador.
2. Entrada rápida "só a carta" e módulo **Carta para impressão** como primeiro produto vendido isolado.
3. Análise de preços isolada.
4. Painel de controle isolado.
5. Harmonização isolada.
6. Ligar os módulos à cobrança (planos por módulo), reaproveitando o plano de assinatura já definido.

## Detalhes técnicos

- Migração: `public.module_entitlements` (`restaurant_id`, `module` enum `full|dashboard|pricing|printed_menu|pairing`, `enabled`, `source` `admin|subscription|trial`, `expires_at`, `granted_by`) + `GRANT` para `authenticated`/`service_role`; RLS de leitura por `can_manage_restaurant`/`belongs_to_group`, escrita só por `service_role`. Restaurantes existentes recebem `full` na própria migração.
- `src/lib/modules.ts`: lista dos módulos, rotas de cada um e helper `hasModule()`; hook `use-entitlements` com React Query, integrado ao `useActiveScope`.
- `src/hooks/use-auth.ts`: expõe `modules` do restaurante ativo (união dos módulos em visão consolidada de rede).
- `src/routes/_app.tsx`: `renderNav` filtra os itens de `restaurantNav` por módulo; admin global continua vendo tudo.
- Guarda por rota: componente `ModuleGate` nas telas de `dashboard`, `price-analysis`, `wine-menu`, `pairings` — sem `beforeLoad` (entitlement é dado do cliente), renderizando a página de apresentação quando faltar acesso.
- `src/routes/_app.app.index.tsx`: grade de módulos com estado liberado/bloqueado.
- Onboarding: nova rota pública `src/routes/comecar.tsx` com escolha do módulo → cadastro → criação do restaurante e do entitlement via `createServerFn` com `requireSupabaseAuth` → import da carta reutilizando `winelist-import.functions.ts` → redireciona para a rota do módulo.
- `setModuleEntitlement` (server fn, `requireSupabaseAuth` + `has_role(userId,'admin')`, escreve com `supabaseAdmin`), usada na tela de Restaurantes do admin.
- `/harmonizar` e `/acesso/*` continuam fora de qualquer bloqueio.
- Cobrança futura: cada preço do Paddle mapeia para um `module`; o webhook grava o entitlement com `source = 'subscription'`. O plano de assinatura anterior (tabela `subscriptions`, 90 dias de teste, cortesia do administrador, bloqueio suave) segue válido e será retomado nesta etapa.
