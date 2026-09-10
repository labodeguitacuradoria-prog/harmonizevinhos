import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { ensureActiveRestaurant, useActiveScope } from "@/lib/active-scope";
import { useEntitlements } from "@/hooks/use-entitlements";
import type { AppModule } from "@/lib/modules";

export type AppRole = "admin" | "restaurant" | "supplier";

export type Membership = {
  restaurantId: string;
  name: string;
  city: string | null;
  groupId: string | null;
  role: string;
};

export type GroupInfo = { id: string; name: string };

export interface UserContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  restaurantId: string | null;
  supplierId: string | null;
  memberships: Membership[];
  groups: GroupInfo[];
  activeGroupId: string | null;
  activeRole: string | null;
  canManageActive: boolean;
  /** Módulos liberados no escopo ativo (restaurante ou rede). */
  modules: AppModule[];
  modulesLoading: boolean;
}

export function useAuth(): UserContext {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const scope = useActiveScope();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession((prev) => {
        if (prev?.user?.id === s?.user?.id) return prev;
        return s;
      });
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ["auth-context", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: roles }, { data: rs }, { data: gs }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role, restaurant_id, supplier_id")
          .eq("user_id", userId!),
        supabase.rpc("my_restaurants", { _user_id: userId! }),
        supabase.rpc("my_groups", { _user_id: userId! }),
      ]);

      const admin = roles?.find((r) => r.role === "admin");
      const supplier = roles?.find((r) => r.role === "supplier");
      const anyRest = roles?.find((r) =>
        ["rest_admin", "rest_owner", "restaurant", "owner", "staff"].includes(r.role as string),
      );

      let role: AppRole | null = null;
      let supplierId: string | null = null;
      if (admin) role = "admin";
      else if (supplier) {
        role = "supplier";
        supplierId = supplier.supplier_id ?? null;
      } else if (anyRest) role = "restaurant";

      const memberships: Membership[] = (rs ?? []).map((r: any) => ({
        restaurantId: r.restaurant_id,
        name: r.name,
        city: r.city,
        groupId: r.group_id,
        role: r.role,
      }));
      const groups: GroupInfo[] = (gs ?? []).map((g: any) => ({ id: g.group_id, name: g.name }));

      return { role, supplierId, memberships, groups };
    },
  });

  useEffect(() => {
    if (data?.memberships?.length) {
      ensureActiveRestaurant(data.memberships[0].restaurantId);
    }
  }, [data?.memberships]);

  const memberships = data?.memberships ?? [];
  const groups = data?.groups ?? [];
  const role = data?.role ?? null;
  const supplierId = data?.supplierId ?? null;

  const active = memberships.find((m) => m.restaurantId === scope.activeRestaurantId) ?? null;
  const activeRole = active?.role ?? null;
  const canManageActive =
    role === "admin" || activeRole === "rest_admin" || activeRole === "rest_owner";

  return {
    user: session?.user ?? null,
    session,
    loading: sessionLoading || (!!userId && dataLoading),
    role,
    restaurantId: scope.activeGroupId
      ? null
      : scope.activeRestaurantId ?? active?.restaurantId ?? null,
    supplierId,
    memberships,
    groups,
    activeGroupId: scope.activeGroupId,
    activeRole,
    canManageActive,
  };
}
