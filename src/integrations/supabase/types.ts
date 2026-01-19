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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      defect_codes: {
        Row: {
          category: Database["public"]["Enums"]["defect_category"] | null
          code: string
          created_at: string
          description: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["defect_category"] | null
          code: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          category?: Database["public"]["Enums"]["defect_category"] | null
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body: string | null
          cc: string[] | null
          id: string
          mrb_id: string
          mrb_number: string
          recipients: string[]
          sent_at: string
          sent_by: string
          status: string | null
          subject: string
          template: string
        }
        Insert: {
          body?: string | null
          cc?: string[] | null
          id?: string
          mrb_id: string
          mrb_number: string
          recipients: string[]
          sent_at?: string
          sent_by: string
          status?: string | null
          subject: string
          template: string
        }
        Update: {
          body?: string | null
          cc?: string[] | null
          id?: string
          mrb_id?: string
          mrb_number?: string
          recipients?: string[]
          sent_at?: string
          sent_by?: string
          status?: string | null
          subject?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_mrb_id_fkey"
            columns: ["mrb_id"]
            isOneToOne: false
            referencedRelation: "mrb_records"
            referencedColumns: ["id"]
          },
        ]
      }
      inward_inspection_lots: {
        Row: {
          batch: string | null
          block_reason: string | null
          blocked_quantity: number
          created_at: string
          grn_number: string | null
          id: string
          inspection_date: string | null
          inspection_lot: string
          material_code: string
          material_description: string | null
          plant: string
          po_number: string | null
          posting_date: string | null
          status: string
          storage_location: string | null
          transaction_quantity: number
          uom: string | null
          updated_at: string
          upload_batch_id: string | null
          uploaded_by: string | null
          vendor_code: string | null
          vendor_name: string | null
        }
        Insert: {
          batch?: string | null
          block_reason?: string | null
          blocked_quantity?: number
          created_at?: string
          grn_number?: string | null
          id?: string
          inspection_date?: string | null
          inspection_lot: string
          material_code: string
          material_description?: string | null
          plant: string
          po_number?: string | null
          posting_date?: string | null
          status?: string
          storage_location?: string | null
          transaction_quantity?: number
          uom?: string | null
          updated_at?: string
          upload_batch_id?: string | null
          uploaded_by?: string | null
          vendor_code?: string | null
          vendor_name?: string | null
        }
        Update: {
          batch?: string | null
          block_reason?: string | null
          blocked_quantity?: number
          created_at?: string
          grn_number?: string | null
          id?: string
          inspection_date?: string | null
          inspection_lot?: string
          material_code?: string
          material_description?: string | null
          plant?: string
          po_number?: string | null
          posting_date?: string | null
          status?: string
          storage_location?: string | null
          transaction_quantity?: number
          uom?: string | null
          updated_at?: string
          upload_batch_id?: string | null
          uploaded_by?: string | null
          vendor_code?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          category: string | null
          created_at: string
          description: string
          id: string
          material_number: string
          uom: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          id?: string
          material_number: string
          uom?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          material_number?: string
          uom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mrb_approval_history: {
        Row: {
          action: string
          id: string
          mrb_id: string
          performed_at: string
          performed_by: string
          performed_by_role: Database["public"]["Enums"]["app_role"]
          remarks: string | null
          stage: string
        }
        Insert: {
          action: string
          id?: string
          mrb_id: string
          performed_at?: string
          performed_by: string
          performed_by_role: Database["public"]["Enums"]["app_role"]
          remarks?: string | null
          stage: string
        }
        Update: {
          action?: string
          id?: string
          mrb_id?: string
          performed_at?: string
          performed_by?: string
          performed_by_role?: Database["public"]["Enums"]["app_role"]
          remarks?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "mrb_approval_history_mrb_id_fkey"
            columns: ["mrb_id"]
            isOneToOne: false
            referencedRelation: "mrb_records"
            referencedColumns: ["id"]
          },
        ]
      }
      mrb_attachments: {
        Row: {
          category: string
          file_size: number | null
          file_type: string | null
          id: string
          mrb_id: string
          name: string
          uploaded_at: string
          uploaded_by: string
          url: string
        }
        Insert: {
          category: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mrb_id: string
          name: string
          uploaded_at?: string
          uploaded_by: string
          url: string
        }
        Update: {
          category?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mrb_id?: string
          name?: string
          uploaded_at?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mrb_attachments_mrb_id_fkey"
            columns: ["mrb_id"]
            isOneToOne: false
            referencedRelation: "mrb_records"
            referencedColumns: ["id"]
          },
        ]
      }
      mrb_records: {
        Row: {
          accepted_quantity: number | null
          blocked_quantity: number | null
          closed_at: string | null
          closed_by: string | null
          closure_status: string | null
          created_at: string
          created_by: string
          defect_category: Database["public"]["Enums"]["defect_category"] | null
          defect_code: string | null
          defect_description: string | null
          deviation_approval_number: string | null
          deviation_requested: boolean | null
          deviation_validity_date: string | null
          engineering_approved_at: string | null
          engineering_approved_by: string | null
          engineering_decision:
            | Database["public"]["Enums"]["engineering_decision"]
            | null
          engineering_remarks: string | null
          escalation_level:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          expected_replacement_date: string | null
          final_approved_at: string | null
          final_approved_by: string | null
          final_approved_quantity: number | null
          final_decision: string | null
          final_rejected_quantity: number | null
          final_remarks: string | null
          grn_number: string | null
          id: string
          immediate_block_required: boolean | null
          impact_on_production: string | null
          inspection_lot: string | null
          issue_description: string | null
          issue_identified_by: string | null
          issue_identified_date: string | null
          issued_quantity: number | null
          material_description: string
          material_id: string | null
          material_number: string
          mrb_number: string
          pending_days: number | null
          pending_with: Database["public"]["Enums"]["app_role"] | null
          plant: string
          plant_id: string | null
          po_number: string | null
          production_order_number: string | null
          purchase_action: string | null
          purchase_approved_at: string | null
          purchase_approved_by: string | null
          purchase_remarks: string | null
          quality_approved_at: string | null
          quality_approved_by: string | null
          quality_decision:
            | Database["public"]["Enums"]["quality_decision"]
            | null
          quality_remarks: string | null
          rejected_quantity: number | null
          return_delivery_number: string | null
          rework_order_number: string | null
          sap_stock_update_status: string | null
          scrap_document_number: string | null
          sla_status: Database["public"]["Enums"]["sla_status"] | null
          source: Database["public"]["Enums"]["mrb_source"]
          status: Database["public"]["Enums"]["mrb_status"]
          technical_reference_number: string | null
          total_quantity: number
          uom: string | null
          updated_at: string
          vendor_code: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_replacement_required: boolean | null
          vendor_responsibility: string | null
        }
        Insert: {
          accepted_quantity?: number | null
          blocked_quantity?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closure_status?: string | null
          created_at?: string
          created_by: string
          defect_category?:
            | Database["public"]["Enums"]["defect_category"]
            | null
          defect_code?: string | null
          defect_description?: string | null
          deviation_approval_number?: string | null
          deviation_requested?: boolean | null
          deviation_validity_date?: string | null
          engineering_approved_at?: string | null
          engineering_approved_by?: string | null
          engineering_decision?:
            | Database["public"]["Enums"]["engineering_decision"]
            | null
          engineering_remarks?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          expected_replacement_date?: string | null
          final_approved_at?: string | null
          final_approved_by?: string | null
          final_approved_quantity?: number | null
          final_decision?: string | null
          final_rejected_quantity?: number | null
          final_remarks?: string | null
          grn_number?: string | null
          id?: string
          immediate_block_required?: boolean | null
          impact_on_production?: string | null
          inspection_lot?: string | null
          issue_description?: string | null
          issue_identified_by?: string | null
          issue_identified_date?: string | null
          issued_quantity?: number | null
          material_description: string
          material_id?: string | null
          material_number: string
          mrb_number: string
          pending_days?: number | null
          pending_with?: Database["public"]["Enums"]["app_role"] | null
          plant: string
          plant_id?: string | null
          po_number?: string | null
          production_order_number?: string | null
          purchase_action?: string | null
          purchase_approved_at?: string | null
          purchase_approved_by?: string | null
          purchase_remarks?: string | null
          quality_approved_at?: string | null
          quality_approved_by?: string | null
          quality_decision?:
            | Database["public"]["Enums"]["quality_decision"]
            | null
          quality_remarks?: string | null
          rejected_quantity?: number | null
          return_delivery_number?: string | null
          rework_order_number?: string | null
          sap_stock_update_status?: string | null
          scrap_document_number?: string | null
          sla_status?: Database["public"]["Enums"]["sla_status"] | null
          source: Database["public"]["Enums"]["mrb_source"]
          status?: Database["public"]["Enums"]["mrb_status"]
          technical_reference_number?: string | null
          total_quantity?: number
          uom?: string | null
          updated_at?: string
          vendor_code?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
          vendor_replacement_required?: boolean | null
          vendor_responsibility?: string | null
        }
        Update: {
          accepted_quantity?: number | null
          blocked_quantity?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closure_status?: string | null
          created_at?: string
          created_by?: string
          defect_category?:
            | Database["public"]["Enums"]["defect_category"]
            | null
          defect_code?: string | null
          defect_description?: string | null
          deviation_approval_number?: string | null
          deviation_requested?: boolean | null
          deviation_validity_date?: string | null
          engineering_approved_at?: string | null
          engineering_approved_by?: string | null
          engineering_decision?:
            | Database["public"]["Enums"]["engineering_decision"]
            | null
          engineering_remarks?: string | null
          escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          expected_replacement_date?: string | null
          final_approved_at?: string | null
          final_approved_by?: string | null
          final_approved_quantity?: number | null
          final_decision?: string | null
          final_rejected_quantity?: number | null
          final_remarks?: string | null
          grn_number?: string | null
          id?: string
          immediate_block_required?: boolean | null
          impact_on_production?: string | null
          inspection_lot?: string | null
          issue_description?: string | null
          issue_identified_by?: string | null
          issue_identified_date?: string | null
          issued_quantity?: number | null
          material_description?: string
          material_id?: string | null
          material_number?: string
          mrb_number?: string
          pending_days?: number | null
          pending_with?: Database["public"]["Enums"]["app_role"] | null
          plant?: string
          plant_id?: string | null
          po_number?: string | null
          production_order_number?: string | null
          purchase_action?: string | null
          purchase_approved_at?: string | null
          purchase_approved_by?: string | null
          purchase_remarks?: string | null
          quality_approved_at?: string | null
          quality_approved_by?: string | null
          quality_decision?:
            | Database["public"]["Enums"]["quality_decision"]
            | null
          quality_remarks?: string | null
          rejected_quantity?: number | null
          return_delivery_number?: string | null
          rework_order_number?: string | null
          sap_stock_update_status?: string | null
          scrap_document_number?: string | null
          sla_status?: Database["public"]["Enums"]["sla_status"] | null
          source?: Database["public"]["Enums"]["mrb_source"]
          status?: Database["public"]["Enums"]["mrb_status"]
          technical_reference_number?: string | null
          total_quantity?: number
          uom?: string | null
          updated_at?: string
          vendor_code?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
          vendor_replacement_required?: boolean | null
          vendor_responsibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrb_records_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrb_records_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrb_records_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          code: string
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          phone: string | null
          plant: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_id?: string | null
          full_name: string
          id?: string
          phone?: string | null
          plant?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          plant?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sap_sync_history: {
        Row: {
          batch_id: string | null
          created_at: string
          error_message: string | null
          id: string
          mrb_id: string
          mrb_number: string
          sap_response: Json | null
          status: string
          sync_type: string
          synced_at: string
          synced_by: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mrb_id: string
          mrb_number: string
          sap_response?: Json | null
          status?: string
          sync_type?: string
          synced_at?: string
          synced_by: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mrb_id?: string
          mrb_number?: string
          sap_response?: Json | null
          status?: string
          sync_type?: string
          synced_at?: string
          synced_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sap_sync_history_mrb_id_fkey"
            columns: ["mrb_id"]
            isOneToOne: false
            referencedRelation: "mrb_records"
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
          role: Database["public"]["Enums"]["app_role"]
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
      vendors: {
        Row: {
          address: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "quality"
        | "quality_head"
        | "purchase"
        | "purchase_head"
        | "engineering"
        | "engineering_head"
        | "shop_floor"
        | "executive"
        | "admin"
      defect_category:
        | "dimensional"
        | "surface"
        | "material"
        | "functional"
        | "documentation"
        | "packaging"
        | "other"
      engineering_decision:
        | "use_as_is"
        | "use_with_deviation"
        | "rework_required"
        | "return_to_vendor"
        | "scrap_material"
      escalation_level: "none" | "L1" | "L2" | "L3"
      mrb_source: "quality_inspection" | "shop_floor"
      mrb_status:
        | "draft"
        | "quality_review"
        | "purchase_review"
        | "engineering_review"
        | "final_approval"
        | "approved"
        | "rejected"
        | "closed"
      quality_decision: "accept" | "reject" | "partial_accept" | "blocked"
      sla_status: "green" | "yellow" | "red"
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
        "quality",
        "quality_head",
        "purchase",
        "purchase_head",
        "engineering",
        "engineering_head",
        "shop_floor",
        "executive",
        "admin",
      ],
      defect_category: [
        "dimensional",
        "surface",
        "material",
        "functional",
        "documentation",
        "packaging",
        "other",
      ],
      engineering_decision: [
        "use_as_is",
        "use_with_deviation",
        "rework_required",
        "return_to_vendor",
        "scrap_material",
      ],
      escalation_level: ["none", "L1", "L2", "L3"],
      mrb_source: ["quality_inspection", "shop_floor"],
      mrb_status: [
        "draft",
        "quality_review",
        "purchase_review",
        "engineering_review",
        "final_approval",
        "approved",
        "rejected",
        "closed",
      ],
      quality_decision: ["accept", "reject", "partial_accept", "blocked"],
      sla_status: ["green", "yellow", "red"],
    },
  },
} as const
