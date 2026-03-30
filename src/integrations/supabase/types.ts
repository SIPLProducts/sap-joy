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
      dashboard_config: {
        Row: {
          created_at: string
          dashboard_key: string
          id: string
          is_enabled: boolean
          plant: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          dashboard_key: string
          id?: string
          is_enabled?: boolean
          plant: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          dashboard_key?: string
          id?: string
          is_enabled?: boolean
          plant?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
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
      email_templates: {
        Row: {
          body_template: string
          created_at: string
          id: string
          is_active: boolean
          plant: string | null
          subject_template: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          id?: string
          is_active?: boolean
          plant?: string | null
          subject_template: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          id?: string
          is_active?: boolean
          plant?: string | null
          subject_template?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
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
          po_item_number: string | null
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
          po_item_number?: string | null
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
          po_item_number?: string | null
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
          mrb_committee_approved_at: string | null
          mrb_committee_approved_by: string | null
          mrb_committee_decision: string | null
          mrb_committee_remarks: string | null
          mrb_committee_required: boolean | null
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
          mrb_committee_approved_at?: string | null
          mrb_committee_approved_by?: string | null
          mrb_committee_decision?: string | null
          mrb_committee_remarks?: string | null
          mrb_committee_required?: boolean | null
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
          mrb_committee_approved_at?: string | null
          mrb_committee_approved_by?: string | null
          mrb_committee_decision?: string | null
          mrb_committee_remarks?: string | null
          mrb_committee_required?: boolean | null
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
      password_history: {
        Row: {
          changed_at: string
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      plant_print_config: {
        Row: {
          company_name: string
          created_at: string
          division_name: string
          id: string
          logo_url: string | null
          mrb_doc_number: string | null
          mrb_effective_date: string | null
          mrb_revision: string | null
          ncr_doc_number: string | null
          ncr_effective_date: string | null
          ncr_revision: string | null
          plant: string
          updated_at: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          division_name?: string
          id?: string
          logo_url?: string | null
          mrb_doc_number?: string | null
          mrb_effective_date?: string | null
          mrb_revision?: string | null
          ncr_doc_number?: string | null
          ncr_effective_date?: string | null
          ncr_revision?: string | null
          plant: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          division_name?: string
          id?: string
          logo_url?: string | null
          mrb_doc_number?: string | null
          mrb_effective_date?: string | null
          mrb_revision?: string | null
          ncr_doc_number?: string | null
          ncr_effective_date?: string | null
          ncr_revision?: string | null
          plant?: string
          updated_at?: string
        }
        Relationships: []
      }
      plant_workflow_config: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["app_role"]
          id: string
          is_active: boolean
          is_required: boolean
          plant: string
          step_label: string
          workflow_step: number
        }
        Insert: {
          created_at?: string
          department: Database["public"]["Enums"]["app_role"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          plant: string
          step_label: string
          workflow_step: number
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["app_role"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          plant?: string
          step_label?: string
          workflow_step?: number
        }
        Relationships: []
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
      role_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          module_label: string
          plant: string
          role: string
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          module_label: string
          plant?: string
          role: string
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          module_label?: string
          plant?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      sap_api_config: {
        Row: {
          api_endpoint: string
          api_key: string | null
          auth_type: string | null
          base_url: string | null
          client_id: string | null
          client_secret: string | null
          config_name: string
          connection_mode: string | null
          created_at: string
          cron_expression: string | null
          custom_headers: Json | null
          description: string | null
          enable_logging: boolean | null
          encrypted_password: string | null
          endpoint_path: string | null
          http_method: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          max_records: number | null
          proxy_secret: string | null
          proxy_tunnel_url: string | null
          retry_count: number | null
          retry_delay_ms: number | null
          sap_client: string | null
          scheduler_enabled: boolean | null
          sync_frequency: string | null
          timeout_ms: number | null
          token_url: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          api_endpoint: string
          api_key?: string | null
          auth_type?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          config_name: string
          connection_mode?: string | null
          created_at?: string
          cron_expression?: string | null
          custom_headers?: Json | null
          description?: string | null
          enable_logging?: boolean | null
          encrypted_password?: string | null
          endpoint_path?: string | null
          http_method?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          max_records?: number | null
          proxy_secret?: string | null
          proxy_tunnel_url?: string | null
          retry_count?: number | null
          retry_delay_ms?: number | null
          sap_client?: string | null
          scheduler_enabled?: boolean | null
          sync_frequency?: string | null
          timeout_ms?: number | null
          token_url?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          api_endpoint?: string
          api_key?: string | null
          auth_type?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          config_name?: string
          connection_mode?: string | null
          created_at?: string
          cron_expression?: string | null
          custom_headers?: Json | null
          description?: string | null
          enable_logging?: boolean | null
          encrypted_password?: string | null
          endpoint_path?: string | null
          http_method?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          max_records?: number | null
          proxy_secret?: string | null
          proxy_tunnel_url?: string | null
          retry_count?: number | null
          retry_delay_ms?: number | null
          sap_client?: string | null
          scheduler_enabled?: boolean | null
          sync_frequency?: string | null
          timeout_ms?: number | null
          token_url?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      sap_api_request_fields: {
        Row: {
          config_id: string
          created_at: string
          default_value: string | null
          description: string | null
          field_name: string
          field_type: string
          id: string
          is_required: boolean | null
          sap_field_name: string | null
          sort_order: number | null
        }
        Insert: {
          config_id: string
          created_at?: string
          default_value?: string | null
          description?: string | null
          field_name: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          sap_field_name?: string | null
          sort_order?: number | null
        }
        Update: {
          config_id?: string
          created_at?: string
          default_value?: string | null
          description?: string | null
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          sap_field_name?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_api_request_fields_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "sap_api_config"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_api_response_fields: {
        Row: {
          config_id: string
          created_at: string
          description: string | null
          field_name: string
          field_type: string
          id: string
          json_path: string | null
          map_to_column: string | null
          map_to_table: string | null
          sap_field_name: string | null
          sort_order: number | null
        }
        Insert: {
          config_id: string
          created_at?: string
          description?: string | null
          field_name: string
          field_type?: string
          id?: string
          json_path?: string | null
          map_to_column?: string | null
          map_to_table?: string | null
          sap_field_name?: string | null
          sort_order?: number | null
        }
        Update: {
          config_id?: string
          created_at?: string
          description?: string | null
          field_name?: string
          field_type?: string
          id?: string
          json_path?: string | null
          map_to_column?: string | null
          map_to_table?: string | null
          sap_field_name?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_api_response_fields_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "sap_api_config"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_stock_sync_history: {
        Row: {
          completed_at: string | null
          config_id: string | null
          error_message: string | null
          id: string
          records_fetched: number | null
          records_inserted: number | null
          records_updated: number | null
          started_at: string
          status: string | null
          sync_type: string | null
          synced_by: string | null
        }
        Insert: {
          completed_at?: string | null
          config_id?: string | null
          error_message?: string | null
          id?: string
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string | null
          sync_type?: string | null
          synced_by?: string | null
        }
        Update: {
          completed_at?: string | null
          config_id?: string | null
          error_message?: string | null
          id?: string
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string | null
          sync_type?: string | null
          synced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_stock_sync_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "sap_api_config"
            referencedColumns: ["id"]
          },
        ]
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
      shop_floor_stock: {
        Row: {
          available_quantity: number
          batch: string | null
          bin_number: string | null
          blocked_quantity: number | null
          blocked_value: number | null
          created_at: string
          id: string
          material_code: string
          material_description: string | null
          plant: string
          production_order: string | null
          quality_inspection_qty: number | null
          quality_inspection_value: number | null
          rack_number: string | null
          reservation_number: string | null
          row_number_custom: string | null
          sap_sync_id: string | null
          shelf_number: string | null
          source: string | null
          status: string | null
          stock_key: string | null
          storage_location: string | null
          storage_location_desc: string | null
          transfer_qty: number | null
          transfer_value: number | null
          unrestricted_value: number | null
          uom: string | null
          updated_at: string
          upload_batch_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          available_quantity?: number
          batch?: string | null
          bin_number?: string | null
          blocked_quantity?: number | null
          blocked_value?: number | null
          created_at?: string
          id?: string
          material_code: string
          material_description?: string | null
          plant: string
          production_order?: string | null
          quality_inspection_qty?: number | null
          quality_inspection_value?: number | null
          rack_number?: string | null
          reservation_number?: string | null
          row_number_custom?: string | null
          sap_sync_id?: string | null
          shelf_number?: string | null
          source?: string | null
          status?: string | null
          stock_key?: string | null
          storage_location?: string | null
          storage_location_desc?: string | null
          transfer_qty?: number | null
          transfer_value?: number | null
          unrestricted_value?: number | null
          uom?: string | null
          updated_at?: string
          upload_batch_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          available_quantity?: number
          batch?: string | null
          bin_number?: string | null
          blocked_quantity?: number | null
          blocked_value?: number | null
          created_at?: string
          id?: string
          material_code?: string
          material_description?: string | null
          plant?: string
          production_order?: string | null
          quality_inspection_qty?: number | null
          quality_inspection_value?: number | null
          rack_number?: string | null
          reservation_number?: string | null
          row_number_custom?: string | null
          sap_sync_id?: string | null
          shelf_number?: string | null
          source?: string | null
          status?: string | null
          stock_key?: string | null
          storage_location?: string | null
          storage_location_desc?: string | null
          transfer_qty?: number | null
          transfer_value?: number | null
          unrestricted_value?: number | null
          uom?: string | null
          updated_at?: string
          upload_batch_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
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
      user_security: {
        Row: {
          created_at: string
          failed_login_attempts: number
          id: string
          last_password_change: string | null
          locked_until: string | null
          max_failed_attempts: number
          password_expiry_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_login_attempts?: number
          id?: string
          last_password_change?: string | null
          locked_until?: string | null
          max_failed_attempts?: number
          password_expiry_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_login_attempts?: number
          id?: string
          last_password_change?: string | null
          locked_until?: string | null
          max_failed_attempts?: number
          password_expiry_days?: number
          updated_at?: string
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
      admin_update_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: undefined
      }
      check_login_security: { Args: { _user_id: string }; Returns: Json }
      check_password_reuse: {
        Args: { _new_password_hash: string; _user_id: string }
        Returns: boolean
      }
      get_user_plant: { Args: { _user_id: string }; Returns: string }
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
      record_failed_login: { Args: { _user_id: string }; Returns: Json }
      record_password_change: {
        Args: { _password_hash: string; _user_id: string }
        Returns: undefined
      }
      reset_failed_login: { Args: { _user_id: string }; Returns: undefined }
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
        | "mrb_committee"
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
        "mrb_committee",
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
