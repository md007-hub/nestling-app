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
      ai_usage: {
        Row: {
          bonus: number
          count: number
          day: string
          user_id: string
        }
        Insert: {
          bonus?: number
          count?: number
          day: string
          user_id: string
        }
        Update: {
          bonus?: number
          count?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      babies: {
        Row: {
          birth_date: string | null
          birth_weight_kg: number | null
          created_at: string
          created_by: string
          date_kind: string
          gender: string | null
          id: string
          invite_code: string
          milestones_enabled: boolean
          name: string
          photo_url: string | null
          solids_enabled: boolean
        }
        Insert: {
          birth_date?: string | null
          birth_weight_kg?: number | null
          created_at?: string
          created_by: string
          date_kind?: string
          gender?: string | null
          id?: string
          invite_code: string
          milestones_enabled?: boolean
          name: string
          photo_url?: string | null
          solids_enabled?: boolean
        }
        Update: {
          birth_date?: string | null
          birth_weight_kg?: number | null
          created_at?: string
          created_by?: string
          date_kind?: string
          gender?: string | null
          id?: string
          invite_code?: string
          milestones_enabled?: boolean
          name?: string
          photo_url?: string | null
          solids_enabled?: boolean
        }
        Relationships: []
      }
      baby_growth: {
        Row: {
          baby_id: string
          created_at: string
          created_by: string
          head_cm: number | null
          id: string
          length_cm: number | null
          measured_on: string
          weight_kg: number | null
        }
        Insert: {
          baby_id: string
          created_at?: string
          created_by?: string
          head_cm?: number | null
          id?: string
          length_cm?: number | null
          measured_on: string
          weight_kg?: number | null
        }
        Update: {
          baby_id?: string
          created_at?: string
          created_by?: string
          head_cm?: number | null
          id?: string
          length_cm?: number | null
          measured_on?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "baby_growth_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
      baby_logs: {
        Row: {
          baby_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          ts: number
          type: string
          value: string
        }
        Insert: {
          baby_id: string
          created_at?: string
          created_by?: string
          id: string
          notes?: string | null
          ts: number
          type: string
          value: string
        }
        Update: {
          baby_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          ts?: number
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "baby_logs_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
      baby_members: {
        Row: {
          baby_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          baby_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          baby_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "baby_members_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
      baby_milestones: {
        Row: {
          achieved_at: string
          baby_id: string
          created_by: string
          milestone_key: string
          note: string | null
        }
        Insert: {
          achieved_at?: string
          baby_id: string
          created_by?: string
          milestone_key: string
          note?: string | null
        }
        Update: {
          achieved_at?: string
          baby_id?: string
          created_by?: string
          milestone_key?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "baby_milestones_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_question: {
        Args: { _day: string; check_env: string }
        Returns: Json
      }
      create_baby: {
        Args: { _name: string }
        Returns: {
          birth_date: string | null
          birth_weight_kg: number | null
          created_at: string
          created_by: string
          date_kind: string
          gender: string | null
          id: string
          invite_code: string
          milestones_enabled: boolean
          name: string
          photo_url: string | null
          solids_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "babies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      grant_ai_bonus: { Args: { _day: string }; Returns: undefined }
      has_family_pro: { Args: { check_env: string }; Returns: boolean }
      is_baby_member: { Args: { _baby: string }; Returns: boolean }
      join_baby: {
        Args: { _code: string }
        Returns: {
          birth_date: string | null
          birth_weight_kg: number | null
          created_at: string
          created_by: string
          date_kind: string
          gender: string | null
          id: string
          invite_code: string
          milestones_enabled: boolean
          name: string
          photo_url: string | null
          solids_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "babies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
