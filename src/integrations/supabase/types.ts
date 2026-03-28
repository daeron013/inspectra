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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      capas: {
        Row: {
          action_plan: string | null
          assigned_to: string | null
          capa_number: string
          completed_date: string | null
          created_at: string
          description: string | null
          due_date: string | null
          effectiveness_check: string | null
          id: string
          ncr_id: string | null
          priority: string
          root_cause: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_plan?: string | null
          assigned_to?: string | null
          capa_number: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          effectiveness_check?: string | null
          id?: string
          ncr_id?: string | null
          priority?: string
          root_cause?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_plan?: string | null
          assigned_to?: string | null
          capa_number?: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          effectiveness_check?: string | null
          id?: string
          ncr_id?: string | null
          priority?: string
          root_cause?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capas_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncrs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_lots: {
        Row: {
          created_at: string
          device_id: string
          id: string
          lot_id: string
          quantity_used: number | null
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          lot_id: string
          quantity_used?: number | null
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          lot_id?: string
          quantity_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "device_lots_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          id: string
          model: string | null
          name: string
          notes: string | null
          production_date: string | null
          release_date: string | null
          serial_number: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          production_date?: string | null
          release_date?: string | null
          serial_number: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          production_date?: string | null
          release_date?: string | null
          serial_number?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          extracted_data: Json | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          linked_lot_id: string | null
          linked_ncr_id: string | null
          linked_supplier_id: string | null
          notes: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          version: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          extracted_data?: Json | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          linked_lot_id?: string | null
          linked_ncr_id?: string | null
          linked_supplier_id?: string | null
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          version?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          extracted_data?: Json | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          linked_lot_id?: string | null
          linked_ncr_id?: string | null
          linked_supplier_id?: string | null
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_linked_lot_id_fkey"
            columns: ["linked_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_linked_ncr_id_fkey"
            columns: ["linked_ncr_id"]
            isOneToOne: false
            referencedRelation: "ncrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_linked_supplier_id_fkey"
            columns: ["linked_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          created_at: string
          defects_found: number | null
          id: string
          inspection_date: string
          inspection_type: string
          inspector_name: string | null
          lot_id: string | null
          measurements: Json | null
          notes: string | null
          sample_size: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          defects_found?: number | null
          id?: string
          inspection_date?: string
          inspection_type?: string
          inspector_name?: string | null
          lot_id?: string | null
          measurements?: Json | null
          notes?: string | null
          sample_size?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          defects_found?: number | null
          id?: string
          inspection_date?: string
          inspection_type?: string
          inspector_name?: string | null
          lot_id?: string | null
          measurements?: Json | null
          notes?: string | null
          sample_size?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          certificate_of_conformance: string | null
          created_at: string
          expiration_date: string | null
          id: string
          inspection_status: string | null
          lot_number: string
          notes: string | null
          part_id: string
          quantity: number
          received_date: string
          status: string
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_of_conformance?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          inspection_status?: string | null
          lot_number: string
          notes?: string | null
          part_id: string
          quantity?: number
          received_date?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_of_conformance?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          inspection_status?: string | null
          lot_number?: string
          notes?: string | null
          part_id?: string
          quantity?: number
          received_date?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ncrs: {
        Row: {
          corrective_action: string | null
          created_at: string
          description: string | null
          disposition: string | null
          id: string
          lot_id: string | null
          ncr_number: string
          part_id: string | null
          root_cause: string | null
          severity: string
          status: string
          supplier_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string
          description?: string | null
          disposition?: string | null
          id?: string
          lot_id?: string | null
          ncr_number: string
          part_id?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          corrective_action?: string | null
          created_at?: string
          description?: string | null
          disposition?: string | null
          id?: string
          lot_id?: string | null
          ncr_number?: string
          part_id?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ncrs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncrs_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncrs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          created_at: string
          description: string | null
          fda_clearance: string | null
          id: string
          name: string
          part_number: string
          risk_class: string | null
          specifications: Json | null
          supplier_id: string | null
          unit_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fda_clearance?: string | null
          id?: string
          name: string
          part_number: string
          risk_class?: string | null
          specifications?: Json | null
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fda_clearance?: string | null
          id?: string
          name?: string
          part_number?: string
          risk_class?: string | null
          specifications?: Json | null
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          certification_expiry: string | null
          certification_type: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          defect_rate: number | null
          id: string
          last_audit_date: string | null
          name: string
          next_audit_date: string | null
          notes: string | null
          on_time_delivery: number | null
          risk_level: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          certification_expiry?: string | null
          certification_type?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          defect_rate?: number | null
          id?: string
          last_audit_date?: string | null
          name: string
          next_audit_date?: string | null
          notes?: string | null
          on_time_delivery?: number | null
          risk_level?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          certification_expiry?: string | null
          certification_type?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          defect_rate?: number | null
          id?: string
          last_audit_date?: string | null
          name?: string
          next_audit_date?: string | null
          notes?: string | null
          on_time_delivery?: number | null
          risk_level?: string
          status?: string
          updated_at?: string
          user_id?: string
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
    Enums: {},
  },
} as const
