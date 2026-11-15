import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { houseDishesByWine } from "@/lib/quick-guide";
import { BOOK_WINE_COLUMNS, type BookWine } from "@/lib/training-book";

/** Rótulos ativos na carta com a ficha da vinícola (nome, história, foto e mapa). Compartilhado pelo Livro e pelo Guia. */
export const bookWinesQuery = (restaurantId: string) =>
  queryOptions({
    queryKey: ["book-wines", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select(BOOK_WINE_COLUMNS).eq("restaurant_id", restaurantId).eq("active_on_menu", true).order("name");
      if (error) throw new Error(error.message);
      const list = (data ?? []) as unknown as BookWine[];
      const keys = [...new Set(list.map((w) => (w.producer ?? "").trim().toLowerCase()).filter(Boolean))];
      if (keys.length) {
        const { data: ws } = await supabase.from("wineries").select("name, name_key, about, photos, latitude, longitude, map_country, map_label_side, map_svg").in("name_key", keys);
        const map = new Map((ws ?? []).map((x) => [x.name_key, x]));
        for (const w of list) {
          const x = map.get((w.producer ?? "").trim().toLowerCase());
          if (x) {
            w.winery_about = x.about;
            w.winery_photo = x.photos?.[0] ?? null;
            w.winery_name = x.name;
            w.winery_map = x.latitude != null && x.longitude != null && x.map_country
              ? { iso3: x.map_country, lat: x.latitude, lng: x.longitude, side: (x.map_label_side as "auto" | "left" | "right") ?? "auto", svg: x.map_svg }
              : null;
          }
        }
      }
      // Pratos da casa vindos da Harmonização do cardápio (usados no "Combina com" do Livro).
      const { data: guides } = await supabase.from("restaurant_menu_pairing_guides").select("results").eq("restaurant_id", restaurantId);
      const house = houseDishesByWine((guides ?? []) as { results: unknown }[]);
      for (const w of list) w.house_dishes = house.get(w.id) ?? null;
      return list;
    },
  });

/** Pratos da casa já harmonizados (Harmonização do cardápio). */
export const pairingGuidesQuery = (restaurantId: string) =>
  queryOptions({
    queryKey: ["menu-pairing-guides-results", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurant_menu_pairing_guides").select("results").eq("restaurant_id", restaurantId);
      if (error) throw new Error(error.message);
      return (data ?? []) as { results: unknown }[];
    },
  });
