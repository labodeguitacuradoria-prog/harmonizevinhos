import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// Retorna a lista de restaurant_ids ativos para o escopo atual (única unidade
// ou todas as unidades da rede em modo consolidado). Use para trocar
// `.eq('restaurant_id', id)` por `.in('restaurant_id', ids)` nas queries.
export function useScopedRestaurantIds(): {
  ids: string[];
  loading: boolean;
  isGroup: boolean;
  groupId: string | null;
} {
  const { restaurantId, activeGroupId } = useAuth();

  const { data: groupIds, isLoading } = useQuery({
    queryKey: ["group-restaurant-ids", activeGroupId],
    enabled: !!activeGroupId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("group_id", activeGroupId!);
      return (data ?? []).map((r) => r.id as string);
    },
  });

  return useMemo(() => {
    if (activeGroupId) {
      return {
        ids: groupIds ?? [],
        loading: isLoading,
        isGroup: true,
        groupId: activeGroupId,
      };
    }
    return {
      ids: restaurantId ? [restaurantId] : [],
      loading: false,
      isGroup: false,
      groupId: null,
    };
  }, [activeGroupId, groupIds, isLoading, restaurantId]);
}
