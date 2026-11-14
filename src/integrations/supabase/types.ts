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
      access_link_devices: {
        Row: {
          created_at: string
          device_hash: string
          first_seen_at: string
          id: string
          last_seen_at: string
          link_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_hash: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          link_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_hash?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          link_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_link_devices_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "access_links"
            referencedColumns: ["id"]
          },
        ]
      }
      access_links: {
        Row: {
          created_at: string
          created_by: string | null
          device_kind: Database["public"]["Enums"]["access_link_device_kind"]
          expires_at: string | null
          id: string
          label: string
          last_access_at: string | null
          restaurant_id: string
          revoked_at: string | null
          scope: Database["public"]["Enums"]["access_link_scope"]
          single_device: boolean
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_kind?: Database["public"]["Enums"]["access_link_device_kind"]
          expires_at?: string | null
          id?: string
          label: string
          last_access_at?: string | null
          restaurant_id: string
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["access_link_scope"]
          single_device?: boolean
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_kind?: Database["public"]["Enums"]["access_link_device_kind"]
          expires_at?: string | null
          id?: string
          label?: string
          last_access_at?: string | null
          restaurant_id?: string
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["access_link_scope"]
          single_device?: boolean
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_links_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      corkage_fees: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quantity: number
          reference_month: number
          reference_year: number
          restaurant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          reference_month: number
          reference_year: number
          restaurant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          reference_month?: number
          reference_year?: number
          restaurant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corkage_fees_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_menu_requests: {
        Row: {
          admin_notes: string | null
          attachments: Json
          brief_text: string | null
          created_at: string
          created_by: string | null
          delivered_list_id: string | null
          id: string
          restaurant_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          attachments?: Json
          brief_text?: string | null
          created_at?: string
          created_by?: string | null
          delivered_list_id?: string | null
          id?: string
          restaurant_id: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          attachments?: Json
          brief_text?: string | null
          created_at?: string
          created_by?: string | null
          delivered_list_id?: string | null
          id?: string
          restaurant_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_menu_requests_delivered_list_id_fkey"
            columns: ["delivered_list_id"]
            isOneToOne: false
            referencedRelation: "printed_wine_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_menu_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_targets: {
        Row: {
          created_at: string
          id: string
          indicator: string
          notes: string | null
          reference_month: number | null
          reference_year: number
          restaurant_id: string
          target_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicator: string
          notes?: string | null
          reference_month?: number | null
          reference_year: number
          restaurant_id: string
          target_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          indicator?: string
          notes?: string | null
          reference_month?: number | null
          reference_year?: number
          restaurant_id?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_targets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      global_wine_story_cards: {
        Row: {
          catalog_id: string
          compact_summary: string | null
          created_at: string
          do_not_confuse: string | null
          fun_fact: string | null
          generated_by_ai: boolean
          grapes_line: string | null
          id: string
          image_url: string | null
          making_line: string | null
          model_notes: string | null
          mouthfeel: string | null
          name_meaning: string | null
          origin_story: string | null
          pairings: string[]
          sales_pitch: string | null
          status: string
          updated_at: string
        }
        Insert: {
          catalog_id: string
          compact_summary?: string | null
          created_at?: string
          do_not_confuse?: string | null
          fun_fact?: string | null
          generated_by_ai?: boolean
          grapes_line?: string | null
          id?: string
          image_url?: string | null
          making_line?: string | null
          model_notes?: string | null
          mouthfeel?: string | null
          name_meaning?: string | null
          origin_story?: string | null
          pairings?: string[]
          sales_pitch?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          compact_summary?: string | null
          created_at?: string
          do_not_confuse?: string | null
          fun_fact?: string | null
          generated_by_ai?: boolean
          grapes_line?: string | null
          id?: string
          image_url?: string | null
          making_line?: string | null
          model_notes?: string | null
          mouthfeel?: string | null
          name_meaning?: string | null
          origin_story?: string | null
          pairings?: string[]
          sales_pitch?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_wine_story_cards_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: true
            referencedRelation: "wine_catalog"
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
      module_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          expires_at: string | null
          granted_by: string | null
          id: string
          module: Database["public"]["Enums"]["app_module"]
          notes: string | null
          restaurant_id: string
          source: Database["public"]["Enums"]["entitlement_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          notes?: string | null
          restaurant_id: string
          source?: Database["public"]["Enums"]["entitlement_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          notes?: string | null
          restaurant_id?: string
          source?: Database["public"]["Enums"]["entitlement_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_entitlements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pairing_knowledge: {
        Row: {
          active: boolean
          created_at: string
          guidance: string
          id: string
          keywords: string[]
          kind: string
          notes: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          guidance: string
          id?: string
          keywords?: string[]
          kind?: string
          notes?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          guidance?: string
          id?: string
          keywords?: string[]
          kind?: string
          notes?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_analysis_settings: {
        Row: {
          created_at: string
          entree_price: number
          id: string
          restaurant_id: string
          updated_at: string
          used_at: string
        }
        Insert: {
          created_at?: string
          entree_price: number
          id?: string
          restaurant_id: string
          updated_at?: string
          used_at?: string
        }
        Update: {
          created_at?: string
          entree_price?: number
          id?: string
          restaurant_id?: string
          updated_at?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_analysis_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_simulations: {
        Row: {
          created_at: string
          created_by: string | null
          entree_price: number
          id: string
          name: string
          notes: string | null
          prices: Json
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entree_price?: number
          id?: string
          name: string
          notes?: string | null
          prices?: Json
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entree_price?: number
          id?: string
          name?: string
          notes?: string | null
          prices?: Json
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_simulations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      printed_wine_lists: {
        Row: {
          address_text: string | null
          created_at: string
          created_by: string | null
          footer_text: string | null
          header_subtitle: string | null
          header_title: string | null
          id: string
          logo_url: string | null
          name: string
          paper_size: string
          restaurant_id: string
          sections: Json
          template: string
          updated_at: string
          visible_fields: Json
        }
        Insert: {
          address_text?: string | null
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_subtitle?: string | null
          header_title?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          paper_size?: string
          restaurant_id: string
          sections?: Json
          template?: string
          updated_at?: string
          visible_fields?: Json
        }
        Update: {
          address_text?: string | null
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_subtitle?: string | null
          header_title?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          paper_size?: string
          restaurant_id?: string
          sections?: Json
          template?: string
          updated_at?: string
          visible_fields?: Json
        }
        Relationships: [
          {
            foreignKeyName: "printed_wine_lists_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
      purchase_order_documents: {
        Row: {
          amount: number | null
          created_at: string
          doc_number: string | null
          doc_type: Database["public"]["Enums"]["purchase_doc_type"]
          due_date: string | null
          file_name: string
          id: string
          mime_type: string | null
          notes: string | null
          order_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          doc_number?: string | null
          doc_type?: Database["public"]["Enums"]["purchase_doc_type"]
          due_date?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          order_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          doc_number?: string | null
          doc_type?: Database["public"]["Enums"]["purchase_doc_type"]
          due_date?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          order_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          item_notes: string | null
          order_id: string
          qty_bottles: number
          qty_received: number
          received_at: string | null
          status: string
          unit_cost: number | null
          updated_at: string
          wine_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_notes?: string | null
          order_id: string
          qty_bottles?: number
          qty_received?: number
          received_at?: string | null
          status?: string
          unit_cost?: number | null
          updated_at?: string
          wine_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_notes?: string | null
          order_id?: string
          qty_bottles?: number
          qty_received?: number
          received_at?: string | null
          status?: string
          unit_cost?: number | null
          updated_at?: string
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          restaurant_id: string
          sent_at: string | null
          sent_channel:
            | Database["public"]["Enums"]["purchase_send_channel"]
            | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          restaurant_id: string
          sent_at?: string | null
          sent_channel?:
            | Database["public"]["Enums"]["purchase_send_channel"]
            | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string
          sent_at?: string | null
          sent_channel?:
            | Database["public"]["Enums"]["purchase_send_channel"]
            | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      restaurant_menu_pairing_guides: {
        Row: {
          created_at: string
          dishes: Json
          id: string
          published_at: string | null
          restaurant_id: string
          results: Json
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          dishes?: Json
          id?: string
          published_at?: string | null
          restaurant_id: string
          results?: Json
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          dishes?: Json
          id?: string
          published_at?: string | null
          restaurant_id?: string
          results?: Json
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_pairing_guides_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      restaurant_training_videos: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          restaurant_id: string
          updated_at: string
          video_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          restaurant_id: string
          updated_at?: string
          video_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          restaurant_id?: string
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_training_videos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_training_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_library_videos"
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      supplier_access_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_access_at: string | null
          restaurant_id: string
          revoked_at: string | null
          supplier_id: string
          token: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          last_access_at?: string | null
          restaurant_id: string
          revoked_at?: string | null
          supplier_id: string
          token?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_access_at?: string | null
          restaurant_id?: string
          revoked_at?: string | null
          supplier_id?: string
          token?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_access_links_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_access_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_catalog: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          approved_at: string | null
          approved_by: string | null
          cnpj: string | null
          commercial_email: string | null
          contact_email: string | null
          created_at: string
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_role: string | null
          regions: string | null
          source_restaurant_id: string | null
          specialties: string | null
          state_registration: string | null
          status: Database["public"]["Enums"]["catalog_status"]
          submitted_by: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cnpj?: string | null
          commercial_email?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_role?: string | null
          regions?: string | null
          source_restaurant_id?: string | null
          specialties?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          submitted_by?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cnpj?: string | null
          commercial_email?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_role?: string | null
          regions?: string | null
          source_restaurant_id?: string | null
          specialties?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          submitted_by?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_source_restaurant_id_fkey"
            columns: ["source_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_materials: {
        Row: {
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          material_type: string
          supplier_id: string
          title: string
          updated_at: string
          uploaded_by: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          material_type?: string
          supplier_id: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          material_type?: string
          supplier_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          catalog_id: string | null
          cnpj: string | null
          commercial_email: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          delivery_lead_time: string | null
          id: string
          legal_name: string | null
          minimum_order: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_role: string | null
          state_registration: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          catalog_id?: string | null
          cnpj?: string | null
          commercial_email?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          delivery_lead_time?: string | null
          id?: string
          legal_name?: string | null
          minimum_order?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_role?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          catalog_id?: string | null
          cnpj?: string | null
          commercial_email?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          delivery_lead_time?: string | null
          id?: string
          legal_name?: string | null
          minimum_order?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_role?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "supplier_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      training_books: {
        Row: {
          book_index: Json
          created_at: string
          id: string
          pages: Json
          pdf_path: string | null
          published_at: string | null
          restaurant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          book_index?: Json
          created_at?: string
          id?: string
          pages?: Json
          pdf_path?: string | null
          published_at?: string | null
          restaurant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          book_index?: Json
          created_at?: string
          id?: string
          pages?: Json
          pdf_path?: string | null
          published_at?: string | null
          restaurant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_books_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_library_videos: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          recommended_for_all: boolean
          sort_order: number
          status: string
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          recommended_for_all?: boolean
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          recommended_for_all?: boolean
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      training_quiz_attempts: {
        Row: {
          created_at: string
          finished_at: string
          id: string
          link_id: string | null
          restaurant_id: string
          score: number
          total: number
        }
        Insert: {
          created_at?: string
          finished_at?: string
          id?: string
          link_id?: string | null
          restaurant_id: string
          score?: number
          total?: number
        }
        Update: {
          created_at?: string
          finished_at?: string
          id?: string
          link_id?: string | null
          restaurant_id?: string
          score?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_attempts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "access_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_quiz_attempts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      wine_story_cards: {
        Row: {
          compact_summary: string | null
          created_at: string
          do_not_confuse: string | null
          fun_fact: string | null
          generated_by_ai: boolean
          grapes_line: string | null
          id: string
          image_url: string | null
          making_line: string | null
          model_notes: string | null
          mouthfeel: string | null
          name_meaning: string | null
          origin_story: string | null
          pairings: string[]
          restaurant_id: string
          sales_pitch: string | null
          status: string
          updated_at: string
          video_error: string | null
          video_job_ids: string[]
          video_paths: string[]
          video_published: boolean
          video_script: Json | null
          video_status: string
          video_updated_at: string | null
          wine_id: string
        }
        Insert: {
          compact_summary?: string | null
          created_at?: string
          do_not_confuse?: string | null
          fun_fact?: string | null
          generated_by_ai?: boolean
          grapes_line?: string | null
          id?: string
          image_url?: string | null
          making_line?: string | null
          model_notes?: string | null
          mouthfeel?: string | null
          name_meaning?: string | null
          origin_story?: string | null
          pairings?: string[]
          restaurant_id: string
          sales_pitch?: string | null
          status?: string
          updated_at?: string
          video_error?: string | null
          video_job_ids?: string[]
          video_paths?: string[]
          video_published?: boolean
          video_script?: Json | null
          video_status?: string
          video_updated_at?: string | null
          wine_id: string
        }
        Update: {
          compact_summary?: string | null
          created_at?: string
          do_not_confuse?: string | null
          fun_fact?: string | null
          generated_by_ai?: boolean
          grapes_line?: string | null
          id?: string
          image_url?: string | null
          making_line?: string | null
          model_notes?: string | null
          mouthfeel?: string | null
          name_meaning?: string | null
          origin_story?: string | null
          pairings?: string[]
          restaurant_id?: string
          sales_pitch?: string | null
          status?: string
          updated_at?: string
          video_error?: string | null
          video_job_ids?: string[]
          video_paths?: string[]
          video_published?: boolean
          video_script?: Json | null
          video_status?: string
          video_updated_at?: string | null
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wine_story_cards_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wine_story_cards_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: true
            referencedRelation: "wines"
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
          extracted_by_ai: boolean
          extraction_notes: string | null
          gallery_urls: string[] | null
          grape: string | null
          grapes_detail: Json | null
          id: string
          image_url: string | null
          internal_code: string | null
          min_stock_override: number | null
          name: string
          oak_months: number | null
          pairing_notes: string | null
          producer: string | null
          production_method: string | null
          region: string | null
          restaurant_id: string
          sale_price: number
          serving_temp_max: number | null
          serving_temp_min: number | null
          sommelier_weights: Json | null
          source_file_url: string | null
          source_text: string | null
          style: string | null
          sugar_g_l: number | null
          sugar_level: string | null
          suggested_retail_price: number | null
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
          extracted_by_ai?: boolean
          extraction_notes?: string | null
          gallery_urls?: string[] | null
          grape?: string | null
          grapes_detail?: Json | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          min_stock_override?: number | null
          name: string
          oak_months?: number | null
          pairing_notes?: string | null
          producer?: string | null
          production_method?: string | null
          region?: string | null
          restaurant_id: string
          sale_price?: number
          serving_temp_max?: number | null
          serving_temp_min?: number | null
          sommelier_weights?: Json | null
          source_file_url?: string | null
          source_text?: string | null
          style?: string | null
          sugar_g_l?: number | null
          sugar_level?: string | null
          suggested_retail_price?: number | null
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
          extracted_by_ai?: boolean
          extraction_notes?: string | null
          gallery_urls?: string[] | null
          grape?: string | null
          grapes_detail?: Json | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          min_stock_override?: number | null
          name?: string
          oak_months?: number | null
          pairing_notes?: string | null
          producer?: string | null
          production_method?: string | null
          region?: string | null
          restaurant_id?: string
          sale_price?: number
          serving_temp_max?: number | null
          serving_temp_min?: number | null
          sommelier_weights?: Json | null
          source_file_url?: string | null
          source_text?: string | null
          style?: string | null
          sugar_g_l?: number | null
          sugar_level?: string | null
          suggested_retail_price?: number | null
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
      can_access_order_documents: { Args: { _path: string }; Returns: boolean }
      can_access_product_media: { Args: { _path: string }; Returns: boolean }
      can_manage_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_group: {
        Args: { _group_id: string; _user_id: string }
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
      my_groups: {
        Args: { _user_id: string }
        Returns: {
          group_id: string
          name: string
        }[]
      }
      my_restaurants: {
        Args: { _user_id: string }
        Returns: {
          city: string
          group_id: string
          name: string
          restaurant_id: string
          role: string
        }[]
      }
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
      access_link_device_kind: "mobile" | "desktop"
      access_link_scope: "dashboard" | "stock_count" | "training" | "pairings"
      app_module:
        | "full"
        | "dashboard"
        | "pricing"
        | "printed_menu"
        | "pairing"
        | "training"
      app_role:
        | "admin"
        | "restaurant"
        | "supplier"
        | "owner"
        | "staff"
        | "rest_admin"
        | "rest_owner"
      catalog_status: "pending" | "approved" | "rejected"
      entitlement_source: "admin" | "subscription" | "trial"
      movement_type: "entry" | "sale" | "adjustment"
      purchase_doc_type:
        | "invoice"
        | "boleto"
        | "payment_proof"
        | "supplier_confirmation"
        | "other"
      purchase_order_status:
        | "draft"
        | "sent"
        | "partial"
        | "received"
        | "cancelled"
      purchase_send_channel: "email" | "whatsapp" | "manual"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      access_link_device_kind: ["mobile", "desktop"],
      access_link_scope: ["dashboard", "stock_count", "training", "pairings"],
      app_module: [
        "full",
        "dashboard",
        "pricing",
        "printed_menu",
        "pairing",
        "training",
      ],
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
      entitlement_source: ["admin", "subscription", "trial"],
      movement_type: ["entry", "sale", "adjustment"],
      purchase_doc_type: [
        "invoice",
        "boleto",
        "payment_proof",
        "supplier_confirmation",
        "other",
      ],
      purchase_order_status: [
        "draft",
        "sent",
        "partial",
        "received",
        "cancelled",
      ],
      purchase_send_channel: ["email", "whatsapp", "manual"],
      wine_type: ["red", "white", "rose", "sparkling", "dessert", "fortified"],
    },
  },
} as const
