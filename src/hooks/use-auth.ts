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
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setRole(null);
      setRestaurantId(null);
      setSupplierId(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role, restaurant_id, supplier_id")
        .eq("user_id", session.user.id)
        .order("role", { ascending: true });
      if (!data || data.length === 0) {
        setRole(null);
        return;
      }
      // prioritize: admin > supplier > restaurant
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
    })();
  }, [session]);

  return {
    user: session?.user ?? null,
    session,
    loading,
    role,
    restaurantId,
    supplierId,
  };
}
