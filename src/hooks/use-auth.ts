import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "restaurant" | "supplier";

export interface UserContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  restaurantId: string | null;
  supplierId: string | null;
}

export function useAuth(): UserContext {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Only update session state if the user actually changed. Token refreshes
      // (TOKEN_REFRESHED) or window-focus re-emits with the same user would
      // otherwise re-trigger the role effect and unmount the app tree.
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
      setRestaurantId(null);
      setSupplierId(null);
      setRoleLoading(sessionLoading);
      return;
    }
    setRoleLoading(true);
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role, restaurant_id, supplier_id")
        .eq("user_id", userId)
        .order("role", { ascending: true });
      if (!data || data.length === 0) {
        setRole(null);
        setRoleLoading(false);
        return;
      }
      const admin = data.find((r) => r.role === "admin");
      const supplier = data.find((r) => r.role === "supplier");
      const restaurant = data.find((r) => r.role === "restaurant");
      if (admin) {
        setRole("admin");
      } else if (supplier) {
        setRole("supplier");
        setSupplierId(supplier.supplier_id);
      } else if (restaurant) {
        setRole("restaurant");
        setRestaurantId(restaurant.restaurant_id);
      }
      setRoleLoading(false);
    })();
  }, [userId, sessionLoading]);

  return {
    user: session?.user ?? null,
    session,
    loading: sessionLoading || roleLoading,
    role,
    restaurantId,
    supplierId,
  };
}

