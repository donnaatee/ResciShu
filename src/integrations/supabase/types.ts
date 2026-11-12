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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      grocery_list_items: {
        Row: {
          added_manually: boolean
          created_at: string
          custom_name: string | null
          estimated_price: number | null
          grocery_list_id: string
          id: string
          ingredient_id: string | null
          is_purchased: boolean
          quantity: number | null
          unit: string | null
        }
        Insert: {
          added_manually?: boolean
          created_at?: string
          custom_name?: string | null
          estimated_price?: number | null
          grocery_list_id: string
          id?: string
          ingredient_id?: string | null
          is_purchased?: boolean
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          added_manually?: boolean
          created_at?: string
          custom_name?: string | null
          estimated_price?: number | null
          grocery_list_id?: string
          id?: string
          ingredient_id?: string | null
          is_purchased?: boolean
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grocery_list_items_grocery_list_id_fkey"
            columns: ["grocery_list_id"]
            isOneToOne: false
            referencedRelation: "grocery_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      grocery_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          category: string
          created_at: string
          default_unit: string
          est_price: number | null
          est_price_unit: string | null
          id: string
          is_staple: boolean
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_unit?: string
          est_price?: number | null
          est_price_unit?: string | null
          id?: string
          is_staple?: boolean
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          default_unit?: string
          est_price?: number | null
          est_price_unit?: string | null
          id?: string
          is_staple?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_default_unit_fkey"
            columns: ["default_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "ingredients_est_price_unit_fkey"
            columns: ["est_price_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string
          expiration_date: string | null
          id: string
          ingredient_id: string
          location: string
          low_stock_threshold: number | null
          notes: string | null
          purchased_date: string | null
          quantity: number
          unit: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          ingredient_id: string
          location: string
          low_stock_threshold?: number | null
          notes?: string | null
          purchased_date?: string | null
          quantity?: number
          unit: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          ingredient_id?: string
          location?: string
          low_stock_threshold?: number | null
          notes?: string | null
          purchased_date?: string | null
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          meal_type: string
          plan_date: string
          recipe_id: string
          servings: number
        }
        Insert: {
          created_at?: string
          id?: string
          meal_type: string
          plan_date: string
          recipe_id: string
          servings?: number
        }
        Update: {
          created_at?: string
          id?: string
          meal_type?: string
          plan_date?: string
          recipe_id?: string
          servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_history: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          product_name: string
          purchase_date: string
          quantity: number | null
          receipt_id: string
          store: string
          total_price: number
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          product_name: string
          purchase_date: string
          quantity?: number | null
          receipt_id: string
          store: string
          total_price: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          product_name?: string
          purchase_date?: string
          quantity?: number | null
          receipt_id?: string
          store?: string
          total_price?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_history_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_history_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          prep_note: string | null
          quantity: number | null
          recipe_id: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          prep_note?: string | null
          quantity?: number | null
          recipe_id: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          prep_note?: string | null
          quantity?: number | null
          recipe_id?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string
          cook_minutes: number | null
          created_at: string
          description: string | null
          id: string
          instructions: string[]
          name: string
          photo_path: string | null
          prep_minutes: number | null
          servings: number
        }
        Insert: {
          category?: string
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string[]
          name: string
          photo_path?: string | null
          prep_minutes?: number | null
          servings?: number
        }
        Update: {
          category?: string
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string[]
          name?: string
          photo_path?: string | null
          prep_minutes?: number | null
          servings?: number
        }
        Relationships: []
      }
      units: {
        Row: {
          code: string
          dimension: string
          label: string
          system: string
          to_base: number
        }
        Insert: {
          code: string
          dimension: string
          label: string
          system?: string
          to_base: number
        }
        Update: {
          code?: string
          dimension?: string
          label?: string
          system?: string
          to_base?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
