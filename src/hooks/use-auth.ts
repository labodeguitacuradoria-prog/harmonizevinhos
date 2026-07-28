import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { ensureActiveRestaurant, useActiveScope } from "@/lib/active-scope";

export type AppRole = "admin" | "restaurant" | "supplier";

export type Membership = {
  restaurantId: string;
  name: string;
  city: string | null;
  groupId: string | null;
  role: string; // rest_admin | rest_owner | staff | supplier | restaurant | owner
};

export type GroupInfo = { id: string; name: string };

export interface UserContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  restaurantId: string | null;
  supplierId: string | null;
  // multi-restaurante
  memberships: Membership[];
  groups: GroupInfo[];
  activeGroupId: string | null;
  activeRole: string | null; // papel específico no restaurante ativo
  canManageActive: boolean;
}

export function useAuth(): UserContext {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
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

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setSupplierId(null);
      setMemberships([]);
      setGroups([]);
      setRoleLoading(sessionLoading);
      return;
    }
    setRoleLoading(true);
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, restaurant_id, supplier_id")
        .eq("user_id", userId);

      const admin = roles?.find((r) => r.role === "admin");
      const supplier = roles?.find((r) => r.role === "supplier");
      const anyRest = roles?.find((r) =>
        ["rest_admin", "rest_owner", "restaurant", "owner", "staff"].includes(r.role as string),
      );

      if (admin) setRole("admin");
      else if (supplier) {
        setRole("supplier");
        setSupplierId(supplier.supplier_id ?? null);
      } else if (anyRest) setRole("restaurant");
      else setRole(null);

      // memberships & groups
      const { data: rs } = await supabase.rpc("my_restaurants", { _user_id: userId });
      const list: Membership[] = (rs ?? []).map((r: any) => ({
        restaurantId: r.restaurant_id,
        name: r.name,
        city: r.city,
        groupId: r.group_id,
        role: r.role,
      }));
      setMemberships(list);

      const { data: gs } = await supabase.rpc("my_groups", { _user_id: userId });
      setGroups((gs ?? []).map((g: any) => ({ id: g.group_id, name: g.name })));

      // garantir um restaurante ativo se houver memberships
      const first = list[0]?.restaurantId ?? null;
      ensureActiveRestaurant(first);

      setRoleLoading(false);
    })();
  }, [userId, sessionLoading]);

  const active = memberships.find((m) => m.restaurantId === scope.activeRestaurantId) ?? null;
  const activeRole = active?.role ?? null;
  const canManageActive =
    role === "admin" || activeRole === "rest_admin" || activeRole === "rest_owner";

  return {
    user: session?.user ?? null,
    session,
    loading: sessionLoading || roleLoading,
    role,
    restaurantId: scope.activeGroupId ? null : scope.activeRestaurantId ?? active?.restaurantId ?? null,
    supplierId,
    memberships,
    groups,
    activeGroupId: scope.activeGroupId,
    activeRole,
    canManageActive,
  };
}
