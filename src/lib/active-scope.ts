import { useSyncExternalStore } from "react";

// Scope global de "restaurante ativo" / "rede ativa" persistido em localStorage
// e compartilhado entre todos os componentes via useSyncExternalStore.

const KEY = "gv.activeScope.v1";

type Scope = {
  activeRestaurantId: string | null;
  activeGroupId: string | null; // se setado, o painel entra em modo consolidado
};

const listeners = new Set<() => void>();
let state: Scope = load();

function load(): Scope {
  if (typeof window === "undefined") return { activeRestaurantId: null, activeGroupId: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { activeRestaurantId: null, activeGroupId: null };
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function emit() {
  for (const l of listeners) l();
}

export function getActiveScope(): Scope {
  return state;
}

export function setActiveRestaurant(id: string | null) {
  state = { activeRestaurantId: id, activeGroupId: null };
  persist();
  emit();
}

export function setActiveGroup(id: string | null) {
  state = { activeRestaurantId: null, activeGroupId: id };
  persist();
  emit();
}

export function clearActiveScope() {
  state = { activeRestaurantId: null, activeGroupId: null };
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignora indisponibilidade do armazenamento */
    }
  }
  emit();
}

export function ensureActiveRestaurant(fallbackId: string | null) {
  if (state.activeGroupId) return;
  if (!state.activeRestaurantId && fallbackId) {
    state = { activeRestaurantId: fallbackId, activeGroupId: null };
    persist();
    emit();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useActiveScope(): Scope {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => ({ activeRestaurantId: null, activeGroupId: null }),
  );
}
