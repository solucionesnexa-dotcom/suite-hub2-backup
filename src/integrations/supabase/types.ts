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
      clients: {
        Row: {
          address: string | null
          bic: string | null
          ciudad: string | null
          created_at: string
          direccion: string | null
          email: string | null
          email_general: string | null
          estado: string
          iban: string | null
          id: string
          name: string
          nombre_comercial: string | null
          notes: string | null
          origen: string | null
          pais: string | null
          phone: string | null
          provincia: string | null
          sector: string | null
          tamano: string | null
          tax_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          bic?: string | null
          ciudad?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          email_general?: string | null
          estado?: string
          iban?: string | null
          id?: string
          name: string
          nombre_comercial?: string | null
          notes?: string | null
          origen?: string | null
          pais?: string | null
          phone?: string | null
          provincia?: string | null
          sector?: string | null
          tamano?: string | null
          tax_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          bic?: string | null
          ciudad?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          email_general?: string | null
          estado?: string
          iban?: string | null
          id?: string
          name?: string
          nombre_comercial?: string | null
          notes?: string | null
          origen?: string | null
          pais?: string | null
          phone?: string | null
          provincia?: string | null
          sector?: string | null
          tamano?: string | null
          tax_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_bank_accounts: {
        Row: {
          alias: string
          bic: string | null
          created_at: string
          iban: string
          id: string
          is_default: boolean
          sepa_creditor_id: string
          sepa_creditor_name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          alias: string
          bic?: string | null
          created_at?: string
          iban: string
          id?: string
          is_default?: boolean
          sepa_creditor_id: string
          sepa_creditor_name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          alias?: string
          bic?: string | null
          created_at?: string
          iban?: string
          id?: string
          is_default?: boolean
          sepa_creditor_id?: string
          sepa_creditor_name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_bank_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          cif: string | null
          ciudad: string | null
          codigo_postal: string | null
          color_marca: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          logo_url: string | null
          pais: string | null
          provincia: string | null
          razon_social: string
          telefono: string | null
          updated_at: string
          web: string | null
          workspace_id: string
        }
        Insert: {
          cif?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          color_marca?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          pais?: string | null
          provincia?: string | null
          razon_social: string
          telefono?: string | null
          updated_at?: string
          web?: string | null
          workspace_id: string
        }
        Update: {
          cif?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          color_marca?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          pais?: string | null
          provincia?: string | null
          razon_social?: string
          telefono?: string | null
          updated_at?: string
          web?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos: {
        Row: {
          cargo: string | null
          client_id: string
          created_at: string
          email: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cargo?: string | null
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cargo?: string | null
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contactos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_movements: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          reference: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          reference?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          reference?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          concept: string | null
          created_at: string
          currency: string
          due_date: string
          estado_cobro: string
          fecha_vencimiento: string | null
          id: string
          invoice_number: string
          issue_date: string
          mandate_id: string | null
          paid_at: string | null
          payment_method: string
          payment_notes: string | null
          payment_status: string
          pdf_path: string | null
          saas_origen: string | null
          source: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          client_id: string
          concept?: string | null
          created_at?: string
          currency?: string
          due_date?: string
          estado_cobro?: string
          fecha_vencimiento?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          mandate_id?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_notes?: string | null
          payment_status?: string
          pdf_path?: string | null
          saas_origen?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          concept?: string | null
          created_at?: string
          currency?: string
          due_date?: string
          estado_cobro?: string
          fecha_vencimiento?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          mandate_id?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_notes?: string | null
          payment_status?: string
          pdf_path?: string | null
          saas_origen?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "sepa_mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          apellidos: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          rol_global: Database["public"]["Enums"]["global_role"]
          ultimo_acceso: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellidos?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          rol_global?: Database["public"]["Enums"]["global_role"]
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellidos?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          rol_global?: Database["public"]["Enums"]["global_role"]
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      remittance_invoices: {
        Row: {
          amount: number
          id: string
          invoice_id: string
          remittance_id: string
        }
        Insert: {
          amount: number
          id?: string
          invoice_id: string
          remittance_id: string
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string
          remittance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remittance_invoices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_invoices_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: false
            referencedRelation: "remittances"
            referencedColumns: ["id"]
          },
        ]
      }
      remittances: {
        Row: {
          collection_date: string
          company_bank_account_id: string | null
          created_at: string
          created_by: string | null
          creditor_bic: string | null
          creditor_iban: string
          creditor_id: string
          creditor_name: string
          id: string
          message_id: string
          status: Database["public"]["Enums"]["remittance_status"]
          total_amount: number
          transaction_count: number
          workspace_id: string
          xml_content: string
          xml_path: string | null
        }
        Insert: {
          collection_date: string
          company_bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          creditor_bic?: string | null
          creditor_iban: string
          creditor_id: string
          creditor_name: string
          id?: string
          message_id: string
          status?: Database["public"]["Enums"]["remittance_status"]
          total_amount: number
          transaction_count: number
          workspace_id: string
          xml_content: string
          xml_path?: string | null
        }
        Update: {
          collection_date?: string
          company_bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          creditor_bic?: string | null
          creditor_iban?: string
          creditor_id?: string
          creditor_name?: string
          id?: string
          message_id?: string
          status?: Database["public"]["Enums"]["remittance_status"]
          total_amount?: number
          transaction_count?: number
          workspace_id?: string
          xml_content?: string
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remittances_company_bank_account_id_fkey"
            columns: ["company_bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sepa_mandates: {
        Row: {
          bic: string | null
          client_id: string
          created_at: string
          debtor_name: string
          iban: string
          id: string
          is_active: boolean
          mandate_reference: string
          pdf_path: string | null
          sequence_type: string
          signature_date: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bic?: string | null
          client_id: string
          created_at?: string
          debtor_name: string
          iban: string
          id?: string
          is_active?: boolean
          mandate_reference: string
          pdf_path?: string | null
          sequence_type?: string
          signature_date: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bic?: string | null
          client_id?: string
          created_at?: string
          debtor_name?: string
          iban?: string
          id?: string
          is_active?: boolean
          mandate_reference?: string
          pdf_path?: string | null
          sequence_type?: string
          signature_date?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sepa_mandates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepa_mandates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_global_role: {
        Args: { _role: Database["public"]["Enums"]["global_role"] }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      global_role: "admin" | "consultor" | "viewer"
      invoice_status: "pending" | "included" | "paid" | "cancelled"
      remittance_status: "draft" | "generated" | "submitted" | "processed"
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
      app_role: ["admin", "member"],
      global_role: ["admin", "consultor", "viewer"],
      invoice_status: ["pending", "included", "paid", "cancelled"],
      remittance_status: ["draft", "generated", "submitted", "processed"],
    },
  },
} as const
