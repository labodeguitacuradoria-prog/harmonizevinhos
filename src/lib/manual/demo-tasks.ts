// Tarefas do treinamento interativo (demonstração Sabor da Terra).
export const DEMO_TASKS = [
  { key: "wines", title: "Cadastrar os vinhos da carta", goal: "Trazer os rótulos da planilha para o sistema" },
  { key: "menu", title: "Criar minha primeira carta", goal: "Escolher modelo, papel e cabeçalho" },
  { key: "sections", title: "Organizar as seções", goal: "Espumantes, brancos, tintos, taças…" },
  { key: "fields", title: "Escolher o que aparece impresso", goal: "País, número e preço" },
  { key: "print", title: "Imprimir ou gerar o PDF", goal: "Deixar a carta pronta para a mesa" },
] as const;
export type TaskKey = (typeof DEMO_TASKS)[number]["key"];
