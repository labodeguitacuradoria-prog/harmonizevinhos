import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppModule } from "@/lib/modules";

/**
 * Módulos liberados para um conjunto de restaurantes.
 * Em visão consolidada (rede), a união dos módulos das unidades é usada.
 */
export function useEntitlements(restaurantIds: string[]) {
  const ids = [...restaurantIds].filter(Boolean).sort();
  const key = ids.join(",");

  const { data, isLoading } = useQuery({
    queryKey: ["module-entitlements", key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("module_entitlements")
        .select("restaurant_id, module, enabled, expires_at")
        .in("restaurant_id", ids);

      const now = Date.now();
      const byRestaurant = new Map<string, AppModule[]>();
      for (const row of data ?? []) {
        if (!row.enabled) continue;
        if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
        const list = byRestaurant.get(row.restaurant_id) ?? [];
        list.push(row.module as AppModule);
        byRestaurant.set(row.restaurant_id, list);
      }
      return byRestaurant;
    },
  });

  return { byRestaurant: data ?? new Map<string, AppModule[]>(), loading: isLoading };
}
