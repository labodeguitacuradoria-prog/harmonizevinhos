// Missões do guia interativo da Carta impressa. Cada passo aponta para um elemento com data-tour.
export type TourStep = { target: string; goal: string; text: string; check?: string };
export type TourMission = { id: string; title: string; goal: string; steps: TourStep[] };

export const MENU_MISSIONS: TourMission[] = [
  {
    id: "first-print",
    title: "Imprimir minha 1ª carta",
    goal: "Da escolha do visual até o papel",
    steps: [
      { target: "template", goal: "Defina a cara do seu restaurante", text: "Abra Modelo e escolha Clássico, Duas colunas, Minimalista, Casual ou Moderno. A folha muda na hora.", check: "a prévia ao lado mudou de visual." },
      { target: "sections", goal: "Organize os vinhos para o cliente achar fácil", text: "Aqui ficam as seções (Espumantes, Brancos, Tintos...). Os rótulos e preços vêm do seu cadastro.", check: "cada vinho está na seção certa." },
      { target: "preview", goal: "Sem surpresas no papel", text: "Esta folha é exatamente o que vai sair na impressora, com as quebras de página reais.", check: "nada cortado no fim das páginas." },
      { target: "save", goal: "Guarde sua carta", text: "Salve para reabrir depois. Na próxima vez, os preços se atualizam sozinhos." },
      { target: "print", goal: "Imprima ou gere o PDF", text: "Toque aqui para imprimir ou salvar em PDF. No Chrome/Edge, marque “Gráficos de segundo plano”.", check: "o PDF saiu com as cores do modelo." },
    ],
  },
  {
    id: "quick-update",
    title: "Mudar preço ou tirar um vinho esgotado",
    goal: "Atualizar a carta em 1 minuto",
    steps: [
      { target: "sections", goal: "Encontre o vinho", text: "Localize o rótulo na seção. Para tirá-lo da carta, use a lixeira ao lado dele. Para mudar o preço, use o lápis.", check: "o vinho sumiu ou o preço mudou na prévia." },
      { target: "preview", goal: "Confira o resultado", text: "Veja na folha se o ajuste apareceu e se as páginas continuam bem divididas." },
      { target: "save", goal: "Salve a nova versão", text: "Salve para que a equipe use sempre a carta mais atual." },
      { target: "print", goal: "Reimprima", text: "Imprima só as páginas que mudaram, ou gere o PDF novo." },
    ],
  },
  {
    id: "fit-pages",
    title: "Fazer caber em menos páginas",
    goal: "Ajustar sem cortar nenhum vinho",
    steps: [
      { target: "template", goal: "Escolha um modelo mais compacto", text: "Duas colunas ou Minimalista ocupam menos espaço. Abaixo de Modelo, ajuste também Papel, espaçamento e fonte.", check: "o número de páginas diminuiu." },
      { target: "preview", goal: "Confira as quebras", text: "Veja se nenhuma seção ficou com um vinho sozinho no topo da página seguinte." },
      { target: "print", goal: "Imprima", text: "Com tudo encaixado, imprima ou gere o PDF." },
    ],
  },
];
