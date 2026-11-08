// Conteúdo único do Manual de Operação — Módulo 1: Impressão de Cartas.
// Usado pela página do aplicativo e pelo gerador do PDF (scripts/build-manual-pdf.py lê o JSON exportado).
// Sempre que a tela da Carta mudar, revise este arquivo e gere o PDF novamente.

export const MANUAL_VERSION = "1.1";
export const MANUAL_REVISION = "08/11/2026";
export const MANUAL_PDF_URL = "/materials/manual-impressao-de-cartas.pdf";

export type ExampleWine = { n: number; name: string; country: string; price: number };
export type ExampleSection = { title: string; wines: ExampleWine[] };

export const EXAMPLE_RESTAURANT = "Restaurante Sabor da Terra";

export const EXAMPLE_MENU: ExampleSection[] = [
  { title: "Espumantes", wines: [
    { n: 1, name: "Cave Geisse Nature", country: "Brasil", price: 268 },
    { n: 2, name: "Don Laurindo Brut Clássico", country: "Brasil", price: 145 },
    { n: 3, name: "Prosecco DOC Treviso Brut", country: "Itália", price: 174 },
    { n: 4, name: "Graham Beck Rosé Extra Brut", country: "África do Sul", price: 245 },
    { n: 5, name: "Terra Nova Moscatel", country: "Brasil", price: 85 },
  ] },
  { title: "Brancos", wines: [
    { n: 6, name: "Don Laurindo Chardonnay D.O", country: "Brasil", price: 135 },
    { n: 7, name: "Busy Bee Chenin Blanc Roussanne", country: "África do Sul", price: 132 },
    { n: 8, name: "Ramón Bilbao Verdejo", country: "Espanha", price: 144 },
    { n: 9, name: "Miguel Torres Cordillera Sauvignon Blanc", country: "Chile", price: 161 },
    { n: 10, name: "Veste Amarela", country: "Brasil", price: 175 },
  ] },
  { title: "Rosés", wines: [
    { n: 11, name: "Cartuxa Colheita Rosé", country: "Portugal", price: 143 },
    { n: 12, name: "Paul Mas Claude Val Rosé", country: "França", price: 154 },
  ] },
  { title: "Tintos", wines: [
    { n: 13, name: "DV Catena Malbec-Malbec", country: "Argentina", price: 322 },
    { n: 14, name: "Rastros do Pampa Tannat", country: "Brasil", price: 138 },
    { n: 15, name: "Paul Mas Claude Val Rouge", country: "França", price: 154 },
    { n: 16, name: "Giulio Straccali Chianti", country: "Itália", price: 220 },
    { n: 17, name: "Cortes de Cima Chaminé", country: "Portugal", price: 188 },
    { n: 18, name: "Feixa Negra Priorat", country: "Espanha", price: 312 },
    { n: 19, name: "C'est La Vie Rouge", country: "França", price: 110 },
  ] },
  { title: "Taças", wines: [
    { n: 20, name: "Taça Vinho Branco", country: "Brasil", price: 38 },
    { n: 21, name: "Taça Vinho Tinto", country: "Brasil", price: 38 },
  ] },
];

export type ManualStep = {
  title: string;
  goal: string;
  where: string;
  actions: string[];
  example: string;
  check: string;
  tip?: string;
};

export const PRINTED_MENU_STEPS: ManualStep[] = [
  {
    title: "Cadastre os vinhos da carta",
    goal: "A carta impressa é montada a partir dos produtos cadastrados. Sem produtos, não há o que imprimir.",
    where: "Menu lateral › Produtos",
    actions: [
      "Confira, no topo da tela, se o restaurante selecionado é o correto.",
      "Clique em Novo produto (ou use Importar carta para trazer todos de uma vez a partir de um PDF ou planilha).",
      "Preencha código, nome do rótulo, país, tipo (espumante, branco, rosé, tinto) e preço de venda.",
      "Marque o produto como ativo na carta e salve.",
    ],
    example: "Cadastre os 21 itens do Sabor da Terra. Exemplo: código 13, DV Catena Malbec-Malbec, Argentina, tinto, R$ 322. As taças (20 e 21) entram como itens do tipo taça, a R$ 38.",
    check: "A lista de Produtos mostra os 21 itens com o preço certo.",
    tip: "Usar o Cadastro Global ao incluir o rótulo já traz uvas, região e foto, que podem aparecer na carta.",
  },
  {
    title: "Abra uma nova carta",
    goal: "Escolher entre montar a carta você mesmo ou pedir um desenho exclusivo.",
    where: "Menu lateral › Carta › Nova carta",
    actions: [
      "Escolha Carta com modelo pronto para montar agora, sozinho.",
      "Ou escolha Carta personalizada ✦ para que nossa equipe desenhe uma carta exclusiva.",
    ],
    example: "Para o Sabor da Terra, escolha Carta com modelo pronto.",
    check: "O editor abre com a Pré-visualização ao lado e os vinhos já distribuídos.",
  },
  {
    title: "Escolha modelo, papel e cabeçalho",
    goal: "Definir o visual da carta e o texto que vai no topo e no rodapé.",
    where: "Painel Modelo e bloco Cabeçalho e rodapé",
    actions: [
      "Em Modelo, escolha um visual (por exemplo Clássico, Duas colunas ou Minimalista).",
      "Escolha o tamanho do papel (A4 é o mais comum).",
      "Em Fundo da carta, escolha uma amostra ou uma cor personalizada. Texto e títulos recebem contraste legível automaticamente.",
      "Em Cabeçalho e rodapé, escreva o título, o subtítulo e os contatos.",
      "No campo Logo (link da imagem), informe o endereço do logotipo do restaurante para aparecer no topo.",
      "Em Nome desta carta (uso interno), dê um nome para achar a versão depois — ele não sai impresso.",
    ],
    example: "Título: Carta de Vinhos. Subtítulo: Restaurante Sabor da Terra. Nome interno: Sabor da Terra — Carta 2026.",
    check: "Título, logotipo e fundo aparecem na Pré-visualização, com texto legível.",
  },
  {
    title: "Organize as seções",
    goal: "Agrupar os vinhos na ordem em que o cliente vai ler.",
    where: "Bloco Seções",
    actions: [
      "Clique em Reagrupar para organizar automaticamente por tipo.",
      "Renomeie, crie ou apague seções conforme a sua carta.",
      "Use as setas para mudar a ordem das seções e dos vinhos.",
      "Para mover um vinho, troque a seção dele na seleção ao lado do nome.",
    ],
    example: "Deixe 5 seções, nesta ordem: Espumantes (1 a 5), Brancos (6 a 10), Rosés (11 e 12), Tintos (13 a 19) e Taças (20 e 21).",
    check: "A Pré-visualização mostra as 5 seções na ordem acima.",
    tip: "É possível criar subseções (até 5 níveis), por exemplo Tintos › Brasil › Serra Gaúcha.",
  },
  {
    title: "Inclua ou retire rótulos",
    goal: "Decidir quais produtos entram nesta carta, sem mexer no cadastro.",
    where: "Bloco Rótulos fora da carta",
    actions: [
      "Pesquise o vinho pelo nome ou produtor.",
      "Em Incluir em, escolha a seção de destino e pressione Incluir.",
      "Para tirar um vinho só desta carta, use Retirar da carta — o produto continua cadastrado.",
    ],
    example: "Faça um teste: retire o Terra Nova Moscatel (5) e depois inclua-o de volta em Espumantes.",
    check: "A mensagem Todos os rótulos já estão na carta aparece quando os 21 itens estão incluídos.",
  },
  {
    title: "Escolha as informações impressas",
    goal: "Definir o que o cliente lê em cada linha da carta.",
    where: "Bloco Informações do rótulo",
    actions: [
      "Marque os campos desejados: código, produtor, safra, país, região, uvas, volume e preço.",
      "Ajuste fontes, espaçamentos e alinhamento se quiser.",
      "Em Definir medidas, ajuste as margens de todas as páginas ou de uma página específica.",
    ],
    example: "Para reproduzir o PDF do Sabor da Terra, marque apenas Código, País e Preço.",
    check: "Cada linha mostra: 13 · DV Catena Malbec-Malbec · Argentina · 322.",
    tip: "Páginas marcadas com • têm margens próprias.",
  },
  {
    title: "Distribua as páginas",
    goal: "Garantir que tudo caiba no papel e na ordem certa.",
    where: "Organização de folhas e Pré-visualização",
    actions: [
      "Confira em qual folha cada seção ficou.",
      "Mova seções entre folhas se alguma ficou cortada.",
      "Acrescente folhas extras para capa, foto ou texto de apresentação, se desejar.",
    ],
    example: "Os 21 itens do Sabor da Terra cabem em uma folha A4. Teste incluir uma folha de capa antes dela.",
    check: "Nenhuma seção aparece cortada na Pré-visualização.",
  },
  {
    title: "Salve a carta",
    goal: "Guardar a carta para editar ou reimprimir depois.",
    where: "Botão Salvar (topo do editor)",
    actions: [
      "Clique em Salvar e confirme o nome.",
      "Para voltar a ela, abra Cartas salvas e escolha a versão.",
      "Para criar uma variação (ex.: carta de verão) sem perder a original, use Duplicar.",
    ],
    example: "Salve como Sabor da Terra — Carta 2026 e depois duplique como Sabor da Terra — Almoço executivo.",
    check: "As duas versões aparecem em Cartas salvas.",
    tip: "Os preços vêm sempre do cadastro atual. Mudou um preço em Produtos? A carta salva já mostra o novo valor.",
  },
  {
    title: "Imprima ou gere o PDF",
    goal: "Ter a carta no papel ou em arquivo para enviar.",
    where: "Botão Imprimir / PDF",
    actions: [
      "Revise preços e páginas na Pré-visualização.",
      "Clique em Imprimir / PDF.",
      "Na janela do navegador, escolha Salvar como PDF ou selecione a impressora.",
      "No Chrome ou Edge, abra Mais configurações e ative Gráficos de segundo plano.",
    ],
    example: "Gere o arquivo Carta_Sabor_da_Terra.pdf e compare com a carta original: devem aparecer os mesmos 21 itens e preços.",
    check: "O PDF tem as 5 seções, os 21 itens e os preços corretos.",
    tip: "Salvar no sistema e salvar em PDF são coisas diferentes: faça os dois.",
  },
];

export const PRINTED_MENU_FAQ: { q: string; a: string }[] = [
  { q: "Retirar da carta apaga o vinho?", a: "Não. Ele sai só desta carta e continua em Produtos." },
  { q: "Mudei um preço. Preciso refazer a carta?", a: "Não. Abra a carta salva e imprima de novo: o preço novo já aparece." },
  { q: "O fundo e as cores não saíram no PDF.", a: "Ative Gráficos de segundo plano na janela de impressão do navegador. Ao escolher fundos escuros ou coloridos, confira a leitura do texto e faça uma impressão de teste." },
  { q: "Um vinho não aparece para incluir.", a: "Confira se ele está cadastrado e ativo no restaurante selecionado." },
];
