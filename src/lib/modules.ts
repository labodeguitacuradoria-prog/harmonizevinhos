export type AppModule = "full" | "dashboard" | "pricing" | "printed_menu" | "pairing";

export const MODULES: {
  key: AppModule;
  label: string;
  description: string;
  route: string;
}[] = [
  {
    key: "full",
    label: "Pacote completo",
    description:
      "Todos os módulos: painel de controle, preços, carta impressa, harmonização, estoque, vendas, pedidos e fornecedores.",
    route: "/app/dashboard",
  },
  {
    key: "dashboard",
    label: "Painel de controle",
    description:
      "Faturamento, garrafas e taças vendidas, estoque, preço médio, CMV, taxa de rolha e diagnóstico de vendas.",
    route: "/app/dashboard",
  },
  {
    key: "pricing",
    label: "Análise de preços",
    description: "Faixas de preço, margens, simulações e sugestões de posicionamento da carta.",
    route: "/app/price-analysis",
  },
  {
    key: "printed_menu",
    label: "Carta para impressão",
    description: "Modelos, seções, logotipo e geração da carta pronta para imprimir.",
    route: "/app/wine-menu",
  },
  {
    key: "pairing",
    label: "Harmonização",
    description: "Estúdio de harmonização usando os rótulos da carta do restaurante.",
    route: "/app/pairings",
  },
];

export const MODULE_LABEL: Record<AppModule, string> = MODULES.reduce(
  (acc, m) => {
    acc[m.key] = m.label;
    return acc;
  },
  {} as Record<AppModule, string>,
);

/** Módulos vendáveis isoladamente (sem o pacote completo). */
export const SINGLE_MODULES = MODULES.filter((m) => m.key !== "full");

/** Rotas liberadas para qualquer restaurante, independente do módulo contratado. */
export const ALWAYS_ALLOWED_ROUTES = ["/app", "/app/cadastros", "/app/wines"];

/** Rotas que exigem o pacote completo. */
const FULL_ONLY_ROUTES = [
  "/app/orders",
  "/app/estoque",
  "/app/sales",
  "/app/corkage-fees",
  "/app/sharing",
  "/app/access-links",
];

const ROUTE_MODULE: Record<string, AppModule> = {
  "/app/dashboard": "dashboard",
  "/app/price-analysis": "pricing",
  "/app/wine-menu": "printed_menu",
  "/app/pairings": "pairing",
};

export function hasModule(modules: AppModule[], module: AppModule) {
  return modules.includes("full") || modules.includes(module);
}

/** Regra única de acesso por rota do app do restaurante. */
export function canAccessRoute(modules: AppModule[], route: string) {
  if (ALWAYS_ALLOWED_ROUTES.includes(route)) return true;
  if (modules.includes("full")) return true;
  if (FULL_ONLY_ROUTES.includes(route)) return false;
  const needed = ROUTE_MODULE[route];
  if (!needed) return true;
  return modules.includes(needed);
}

export function moduleForRoute(route: string): AppModule | null {
  return ROUTE_MODULE[route] ?? null;
}
