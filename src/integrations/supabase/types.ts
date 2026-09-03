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
      analysis_batches: {
        Row: {
          audio_seconds: number
          completed_files: number
          created_at: string
          error_message: string | null
          estimated_cost_usd: number
          failed_files: number
          id: string
          name: string
          owner_id: string
          processing_ms: number
          status: Database["public"]["Enums"]["batch_status"]
          total_files: number
          updated_at: string
        }
        Insert: {
          audio_seconds?: number
          completed_files?: number
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number
          failed_files?: number
          id?: string
          name: string
          owner_id: string
          processing_ms?: number
          status?: Database["public"]["Enums"]["batch_status"]
          total_files?: number
          updated_at?: string
        }
        Update: {
          audio_seconds?: number
          completed_files?: number
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number
          failed_files?: number
          id?: string
          name?: string
          owner_id?: string
          processing_ms?: number
          status?: Database["public"]["Enums"]["batch_status"]
          total_files?: number
          updated_at?: string
        }
        Relationships: []
      }
      analysis_items: {
        Row: {
          audio_quality: string | null
          background_noise_present: boolean | null
          background_noise_severity: string | null
          background_noise_type: string | null
          batch_id: string
          confidence: number | null
          created_at: string
          diagnostics: Json
          duration_seconds: number | null
          emotional_intensity: string | null
          emotional_tone: string | null
          error_message: string | null
          expected_result: Json | null
          field_confidence: Json
          file_name: string
          id: string
          long_silence_present: boolean | null
          processing_ms: number | null
          speaker_overlap_present: boolean | null
          stage_used: string | null
          status: Database["public"]["Enums"]["item_status"]
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          audio_quality?: string | null
          background_noise_present?: boolean | null
          background_noise_severity?: string | null
          background_noise_type?: string | null
          batch_id: string
          confidence?: number | null
          created_at?: string
          diagnostics?: Json
          duration_seconds?: number | null
          emotional_intensity?: string | null
          emotional_tone?: string | null
          error_message?: string | null
          expected_result?: Json | null
          field_confidence?: Json
          file_name: string
          id?: string
          long_silence_present?: boolean | null
          processing_ms?: number | null
          speaker_overlap_present?: boolean | null
          stage_used?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          audio_quality?: string | null
          background_noise_present?: boolean | null
          background_noise_severity?: string | null
          background_noise_type?: string | null
          batch_id?: string
          confidence?: number | null
          created_at?: string
          diagnostics?: Json
          duration_seconds?: number | null
          emotional_intensity?: string | null
          emotional_tone?: string | null
          error_message?: string | null
          expected_result?: Json | null
          field_confidence?: Json
          file_name?: string
          id?: string
          long_silence_present?: boolean | null
          processing_ms?: number | null
          speaker_overlap_present?: boolean | null
          stage_used?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "analysis_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analyst"
      batch_status:
        | "validating"
        | "queued"
        | "processing"
        | "completed"
        | "partial"
        | "failed"
      item_status: "queued" | "processing" | "completed" | "failed"
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
      app_role: ["admin", "analyst"],
      batch_status: [
        "validating",
        "queued",
        "processing",
        "completed",
        "partial",
        "failed",
      ],
      item_status: ["queued", "processing", "completed", "failed"],
    },
  },
} as const
