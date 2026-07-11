export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      glasses: {
        Row: {
          brand: string | null
          capacity_ml: number | null
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          material: string | null
          name: string
          notes: string | null
          restaurant_id: string
          stock_quantity: number
          updated_at: string
          wine_type_recommended: string | null
        }
        Insert: {
          brand?: string | null
          capacity_ml?: number | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          material?: string | null
          name: string
          notes?: string | null
          restaurant_id: string
          stock_quantity?: number
          updated_at?: string
          wine_type_recommended?: string | null
        }
        Update: {
          brand?: string | null
          capacity_ml?: number | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          material?: string | null
          name?: string
          notes?: string | null
          restaurant_id?: string
          stock_quantity?: number
          updated_at?: string
          wine_type_recommended?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glasses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          occurred_at: string
          quantity: number
          restaurant_id: string
          source_session_id: string | null
          unit_cost: number | null
          unit_price: number | null
          wine_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          occurred_at?: string
          quantity: number
          restaurant_id: string
          source_session_id?: string | null
          unit_cost?: number | null
          unit_price?: number | null
          wine_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          occurred_at?: string
          quantity?: number
          restaurant_id?: string
          source_session_id?: string | null
          unit_cost?: number | null
          unit_price?: number | null
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "stock_count_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          label_pt: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          label_pt: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          label_pt?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          restaurant_id: string
          role: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          restaurant_id: string
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          restaurant_id?: string
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_contacts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_supplier_access: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          restaurant_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          restaurant_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          restaurant_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_supplier_access_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_supplier_access_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_wine_lists: {
        Row: {
          created_at: string
          file_url: string
          id: string
          is_current: boolean | null
          restaurant_id: string
          version_label: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          is_current?: boolean | null
          restaurant_id: string
          version_label?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          is_current?: boolean | null
          restaurant_id?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_wine_lists_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          business_hours: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          delivery_instructions: string | null
          group_id: string | null
          id: string
          instagram: string | null
          legal_name: string | null
          name: string
          owner_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          business_hours?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          delivery_instructions?: string | null
          group_id?: string | null
          id?: string
          instagram?: string | null
          legal_name?: string | null
          name: string
          owner_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          business_hours?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          delivery_instructions?: string | null
          group_id?: string | null
          id?: string
          instagram?: string | null
          legal_name?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_issues: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stock_count_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          counted_at: string | null
          counted_by: string | null
          counted_qty: number | null
          created_at: string
          flag: string | null
          flag_note: string | null
          id: string
          previous_qty: number
          session_id: string
          updated_at: string
          wine_id: string
        }
        Insert: {
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          created_at?: string
          flag?: string | null
          flag_note?: string | null
          id?: string
          previous_qty?: number
          session_id: string
          updated_at?: string
          wine_id: string
        }
        Update: {
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          created_at?: string
          flag?: string | null
          flag_note?: string | null
          id?: string
          previous_qty?: number
          session_id?: string
          updated_at?: string
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stock_count_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          notes: string | null
          reference_date: string
          restaurant_id: string
          started_at: string
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reference_date?: string
          restaurant_id: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reference_date?: string
          restaurant_id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          supplier_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          supplier_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          supplier_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      wine_catalog: {
        Row: {
          acidity: string | null
          acidity_g_l: number | null
          acidity_ph: number | null
          aging: string | null
          alcohol_pct: number | null
          appellation: string | null
          approved_at: string | null
          approved_by: string | null
          awards: string[] | null
          barcode: string | null
          body: string | null
          country: string | null
          created_at: string
          elaboration: string | null
          extracted_by_ai: boolean
          extraction_notes: string | null
          gallery_urls: string[] | null
          grape: string | null
          grapes_detail: Json | null
          id: string
          image_url: string | null
          name: string
          oak_months: number | null
          pairing_notes: string | null
          producer: string | null
          production_method: string | null
          region: string | null
          rejection_reason: string | null
          serving_temp_max: number | null
          serving_temp_min: number | null
          sommelier_weights: Json | null
          source_file_url: string | null
          source_restaurant_id: string | null
          source_text: string | null
          status: Database["public"]["Enums"]["catalog_status"]
          style: string | null
          submitted_by: string | null
          sugar_g_l: number | null
          sugar_level: string | null
          suggested_retail_price: number | null
          suppliers: string[] | null
          tannin: string | null
          tasting_notes: string | null
          tech_sheet_url: string | null
          updated_at: string
          video_url: string | null
          videos: Json | null
          vintage: number | null
          volume: string | null
          volume_ml: number | null
          wine_type: string | null
        }
        Insert: {
          acidity?: string | null
          acidity_g_l?: number | null
          acidity_ph?: number | null
          aging?: string | null
          alcohol_pct?: number | null
          appellation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          awards?: string[] | null
          barcode?: string | null
          body?: string | null
          country?: string | null
          created_at?: string
          elaboration?: string | null
          extracted_by_ai?: boolean
          extraction_notes?: string | null
          gallery_urls?: string[] | null
          grape?: string | null
          grapes_detail?: Json | null
          id?: string
          image_url?: string | null
          name: string
          oak_months?: number | null
          pairing_notes?: string | null
          producer?: string | null
          production_method?: string | null
          region?: string | null
          rejection_reason?: string | null
          serving_temp_max?: number | null
          serving_temp_min?: number | null
          sommelier_weights?: Json | null
          source_file_url?: string | null
          source_restaurant_id?: string | null
          source_text?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          style?: string | null
          submitted_by?: string | null
          sugar_g_l?: number | null
          sugar_level?: string | null
          suggested_retail_price?: number | null
          suppliers?: string[] | null
          tannin?: string | null
          tasting_notes?: string | null
          tech_sheet_url?: string | null
          updated_at?: string
          video_url?: string | null
          videos?: Json | null
          vintage?: number | null
          volume?: string | null
          volume_ml?: number | null
          wine_type?: string | null
        }
        Update: {
          acidity?: string | null
          acidity_g_l?: number | null
          acidity_ph?: number | null
          aging?: string | null
          alcohol_pct?: number | null
          appellation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          awards?: string[] | null
          barcode?: string | null
          body?: string | null
          country?: string | null
          created_at?: string
          elaboration?: string | null
          extracted_by_ai?: boolean
          extraction_notes?: string | null
          gallery_urls?: string[] | null
          grape?: string | null
          grapes_detail?: Json | null
          id?: string
          image_url?: string | null
          name?: string
          oak_months?: number | null
          pairing_notes?: string | null
          producer?: string | null
          production_method?: string | null
          region?: string | null
          rejection_reason?: string | null
          serving_temp_max?: number | null
          serving_temp_min?: number | null
          sommelier_weights?: Json | null
          source_file_url?: string | null
          source_restaurant_id?: string | null
          source_text?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          style?: string | null
          submitted_by?: string | null
          sugar_g_l?: number | null
          sugar_level?: string | null
          suggested_retail_price?: number | null
          suppliers?: string[] | null
          tannin?: string | null
          tasting_notes?: string | null
          tech_sheet_url?: string | null
          updated_at?: string
          video_url?: string | null
          videos?: Json | null
          vintage?: number | null
          volume?: string | null
          volume_ml?: number | null
          wine_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wine_catalog_source_restaurant_id_fkey"
            columns: ["source_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      wines: {
        Row: {
          acidity: string | null
          acidity_g_l: number | null
          acidity_ph: number | null
          active_on_menu: boolean
          aging: string | null
          alcohol_pct: number | null
          appellation: string | null
          awards: string[] | null
          barcode: string | null
          body: string | null
          catalog_id: string | null
          cost_price: number
          count_in_stock: boolean
          country: string | null
          created_at: string
          elaboration: string | null
          gallery_urls: string[] | null
          grape: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          name: string
          pairing_notes: string | null
          producer: string | null
          region: string | null
          restaurant_id: string
          sale_price: number
          serving_temp_max: number | null
          serving_temp_min: number | null
          style: string | null
          sugar_g_l: number | null
          sugar_level: string | null
          supplier_id: string | null
          suppliers: string[] | null
          tannin: string | null
          tasting_notes: string | null
          tech_sheet_url: string | null
          updated_at: string
          video_url: string | null
          videos: Json | null
          vintage: number | null
          volume: string | null
          wine_type: string | null
        }
        Insert: {
          acidity?: string | null
          acidity_g_l?: number | null
          acidity_ph?: number | null
          active_on_menu?: boolean
          aging?: string | null
          alcohol_pct?: number | null
          appellation?: string | null
          awards?: string[] | null
          barcode?: string | null
          body?: string | null
          catalog_id?: string | null
          cost_price?: number
          count_in_stock?: boolean
          country?: string | null
          created_at?: string
          elaboration?: string | null
          gallery_urls?: string[] | null
          grape?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          name: string
          pairing_notes?: string | null
          producer?: string | null
          region?: string | null
          restaurant_id: string
          sale_price?: number
          serving_temp_max?: number | null
          serving_temp_min?: number | null
          style?: string | null
          sugar_g_l?: number | null
          sugar_level?: string | null
          supplier_id?: string | null
          suppliers?: string[] | null
          tannin?: string | null
          tasting_notes?: string | null
          tech_sheet_url?: string | null
          updated_at?: string
          video_url?: string | null
          videos?: Json | null
          vintage?: number | null
          volume?: string | null
          wine_type?: string | null
        }
        Update: {
          acidity?: string | null
          acidity_g_l?: number | null
          acidity_ph?: number | null
          active_on_menu?: boolean
          aging?: string | null
          alcohol_pct?: number | null
          appellation?: string | null
          awards?: string[] | null
          barcode?: string | null
          body?: string | null
          catalog_id?: string | null
          cost_price?: number
          count_in_stock?: boolean
          country?: string | null
          created_at?: string
          elaboration?: string | null
          gallery_urls?: string[] | null
          grape?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          name?: string
          pairing_notes?: string | null
          producer?: string | null
          region?: string | null
          restaurant_id?: string
          sale_price?: number
          serving_temp_max?: number | null
          serving_temp_min?: number | null
          style?: string | null
          sugar_g_l?: number | null
          sugar_level?: string | null
          supplier_id?: string | null
          suppliers?: string[] | null
          tannin?: string | null
          tasting_notes?: string | null
          tech_sheet_url?: string | null
          updated_at?: string
          video_url?: string | null
          videos?: Json | null
          vintage?: number | null
          volume?: string | null
          wine_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wines_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "wine_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wines_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      belongs_to_group: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      get_last_closed_stock: {
        Args: { p_restaurant_id: string }
        Returns: {
          last_qty: number
          wine_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      owns_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      supplier_can_see_restaurant: {
        Args: { _restaurant_id: string; _supplier_id: string }
        Returns: boolean
      }
      supplier_id_of: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "restaurant"
        | "supplier"
        | "owner"
        | "staff"
        | "rest_admin"
        | "rest_owner"
      catalog_status: "pending" | "approved" | "rejected"
      movement_type: "entry" | "sale" | "adjustment"
      wine_type:
        | "red"
        | "white"
        | "rose"
        | "sparkling"
        | "dessert"
        | "fortified"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "restaurant",
        "supplier",
        "owner",
        "staff",
        "rest_admin",
        "rest_owner",
      ],
      catalog_status: ["pending", "approved", "rejected"],
      movement_type: ["entry", "sale", "adjustment"],
      wine_type: ["red", "white", "rose", "sparkling", "dessert", "fortified"],
    },
  },
} as const
