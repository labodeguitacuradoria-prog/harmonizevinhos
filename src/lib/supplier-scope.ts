import { useSyncExternalStore } from "react";

// Restaurante ativo no portal do fornecedor, compartilhado entre as telas.
const KEY = "gv.supplierScope.v1";

const listeners = new Set<() => void>();
let current: string | null = load();

function load(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setSupplierRestaurant(id: string | null) {
  current = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {}
  for (const l of listeners) l();
}

export function useSupplierScope(): {
  restaurantId: string | null;
  setRestaurantId: (id: string | null) => void;
} {
  const restaurantId = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return { restaurantId, setRestaurantId: setSupplierRestaurant };
}
