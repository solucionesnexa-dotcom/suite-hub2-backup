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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      casos_exito: {
        Row: {
          client_id: string | null
          cliente_anonimo: boolean
          creado_por: string | null
          created_at: string
          fecha: string
          herramientas_usadas: string[]
          id: string
          pdf_contenido: string | null
          pdf_url: string | null
          post_linkedin: string | null
          problema: string
          resultado_cuantificable: string | null
          sector: string | null
          solucion: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          cliente_anonimo?: boolean
          creado_por?: string | null
          created_at?: string
          fecha?: string
          herramientas_usadas?: string[]
          id?: string
          pdf_contenido?: string | null
          pdf_url?: string | null
          post_linkedin?: string | null
          problema: string
          resultado_cuantificable?: string | null
          sector?: string | null
          solucion: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          cliente_anonimo?: boolean
          creado_por?: string | null
          created_at?: string
          fecha?: string
          herramientas_usadas?: string[]
          id?: string
          pdf_contenido?: string | null
          pdf_url?: string | null
          post_linkedin?: string | null
          problema?: string
          resultado_cuantificable?: string | null
          sector?: string | null
          solucion?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casos_exito_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_exito_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
          last_contact_at: string | null
          name: string
          nombre_comercial: string | null
          notes: string | null
          origen: string | null
          pais: string | null
          phone: string | null
          provincia: string | null
          sector: string | null
          size: string | null
          status: Database["public"]["Enums"]["pipeline_status"]
          tamano: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
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
          last_contact_at?: string | null
          name: string
          nombre_comercial?: string | null
          notes?: string | null
          origen?: string | null
          pais?: string | null
          phone?: string | null
          provincia?: string | null
          sector?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          tamano?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
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
          last_contact_at?: string | null
          name?: string
          nombre_comercial?: string | null
          notes?: string | null
          origen?: string | null
          pais?: string | null
          phone?: string | null
          provincia?: string | null
          sector?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          tamano?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
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
          action: string
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          delta: number
          id: string
          module: string
          reason: string
          reference: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          module: string
          reason: string
          reference?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          module?: string
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
      diagnostico_respuestas: {
        Row: {
          diagnostico_id: string
          id: string
          peso: number
          pregunta: string
          respuesta: string
        }
        Insert: {
          diagnostico_id: string
          id?: string
          peso?: number
          pregunta: string
          respuesta: string
        }
        Update: {
          diagnostico_id?: string
          id?: string
          peso?: number
          pregunta?: string
          respuesta?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_respuestas_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "diagnosticos"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosticos: {
        Row: {
          client_id: string | null
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["simple_doc_status"]
          fecha: string
          id: string
          pdf_url: string | null
          puntuacion: number
          quick_wins: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["simple_doc_status"]
          fecha?: string
          id?: string
          pdf_url?: string | null
          puntuacion?: number
          quick_wins?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["simple_doc_status"]
          fecha?: string
          id?: string
          pdf_url?: string | null
          puntuacion?: number
          quick_wins?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_workspace_id_fkey"
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
      pipeline_notas: {
        Row: {
          client_id: string
          fecha: string
          id: string
          nota: string
          tipo: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          client_id: string
          fecha?: string
          id?: string
          nota: string
          tipo?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          client_id?: string
          fecha?: string
          id?: string
          nota?: string
          tipo?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_notas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_lineas: {
        Row: {
          cantidad: number
          descripcion: string
          id: string
          importe: number
          presupuesto_id: string
          tipo: string
          total_linea: number
        }
        Insert: {
          cantidad?: number
          descripcion: string
          id?: string
          importe?: number
          presupuesto_id: string
          tipo?: string
          total_linea?: number
        }
        Update: {
          cantidad?: number
          descripcion?: string
          id?: string
          importe?: number
          presupuesto_id?: string
          tipo?: string
          total_linea?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_lineas_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          client_id: string | null
          creado_por: string | null
          created_at: string
          descuento_pct: number
          diagnostico_id: string | null
          estado: Database["public"]["Enums"]["presupuesto_status"]
          fecha: string
          fecha_validez: string
          id: string
          notas_cliente: string | null
          notas_internas: string | null
          numero: string
          pdf_url: string | null
          subtotal: number
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          descuento_pct?: number
          diagnostico_id?: string | null
          estado?: Database["public"]["Enums"]["presupuesto_status"]
          fecha?: string
          fecha_validez?: string
          id?: string
          notas_cliente?: string | null
          notas_internas?: string | null
          numero: string
          pdf_url?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          descuento_pct?: number
          diagnostico_id?: string | null
          estado?: Database["public"]["Enums"]["presupuesto_status"]
          fecha?: string
          fecha_validez?: string
          id?: string
          notas_cliente?: string | null
          notas_internas?: string | null
          numero?: string
          pdf_url?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "diagnosticos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_workspace_id_fkey"
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
      prospector_leads: {
        Row: {
          client_id: string | null
          creado_por: string | null
          created_at: string
          direccion: string | null
          email: string | null
          estado: string
          fuente: string
          google_maps_url: string | null
          google_place_id: string | null
          id: string
          localidad: string | null
          necesidad_detectada: string | null
          nombre_comercial: string
          notas: string | null
          oportunidad_analisis: Json
          oportunidad_score: number
          propuesta_comercial: string | null
          rating: number | null
          reviews_count: number | null
          score: number
          sector: string | null
          telefono: string | null
          updated_at: string
          web: string | null
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string
          fuente?: string
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          localidad?: string | null
          necesidad_detectada?: string | null
          nombre_comercial: string
          notas?: string | null
          oportunidad_analisis?: Json
          oportunidad_score?: number
          propuesta_comercial?: string | null
          rating?: number | null
          reviews_count?: number | null
          score?: number
          sector?: string | null
          telefono?: string | null
          updated_at?: string
          web?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string
          fuente?: string
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          localidad?: string | null
          necesidad_detectada?: string | null
          nombre_comercial?: string
          notas?: string | null
          oportunidad_analisis?: Json
          oportunidad_score?: number
          propuesta_comercial?: string | null
          rating?: number | null
          reviews_count?: number | null
          score?: number
          sector?: string | null
          telefono?: string | null
          updated_at?: string
          web?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospector_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospector_leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      retainer_tareas: {
        Row: {
          descripcion: string
          estado: Database["public"]["Enums"]["task_status"]
          fecha_completada: string | null
          horas_estimadas: number
          horas_reales: number
          id: string
          mes_ano: string
          retainer_id: string
        }
        Insert: {
          descripcion: string
          estado?: Database["public"]["Enums"]["task_status"]
          fecha_completada?: string | null
          horas_estimadas?: number
          horas_reales?: number
          id?: string
          mes_ano: string
          retainer_id: string
        }
        Update: {
          descripcion?: string
          estado?: Database["public"]["Enums"]["task_status"]
          fecha_completada?: string | null
          horas_estimadas?: number
          horas_reales?: number
          id?: string
          mes_ano?: string
          retainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retainer_tareas_retainer_id_fkey"
            columns: ["retainer_id"]
            isOneToOne: false
            referencedRelation: "retainers"
            referencedColumns: ["id"]
          },
        ]
      }
      retainers: {
        Row: {
          client_id: string
          dia_facturacion: number
          estado: Database["public"]["Enums"]["retainer_status"]
          fecha_fin: string | null
          fecha_inicio: string
          horas_contratadas_mes: number
          id: string
          importe_mes: number
          nombre: string
          notas: string | null
          workspace_id: string
        }
        Insert: {
          client_id: string
          dia_facturacion?: number
          estado?: Database["public"]["Enums"]["retainer_status"]
          fecha_fin?: string | null
          fecha_inicio?: string
          horas_contratadas_mes?: number
          id?: string
          importe_mes?: number
          nombre: string
          notas?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string
          dia_facturacion?: number
          estado?: Database["public"]["Enums"]["retainer_status"]
          fecha_fin?: string | null
          fecha_inicio?: string
          horas_contratadas_mes?: number
          id?: string
          importe_mes?: number
          nombre?: string
          notas?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retainers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      roi_calculos: {
        Row: {
          ahorro_anual_calculado: number
          client_id: string | null
          coste_hora: number
          coste_implantacion: number
          creado_por: string | null
          created_at: string
          fecha: string
          horas_semana: number
          id: string
          nombre_calculo: string
          pdf_url: string | null
          proceso_descripcion: string
          roi_meses_calculado: number
          semanas_por_ano: number
          workspace_id: string
        }
        Insert: {
          ahorro_anual_calculado?: number
          client_id?: string | null
          coste_hora?: number
          coste_implantacion?: number
          creado_por?: string | null
          created_at?: string
          fecha?: string
          horas_semana?: number
          id?: string
          nombre_calculo: string
          pdf_url?: string | null
          proceso_descripcion: string
          roi_meses_calculado?: number
          semanas_por_ano?: number
          workspace_id: string
        }
        Update: {
          ahorro_anual_calculado?: number
          client_id?: string | null
          coste_hora?: number
          coste_implantacion?: number
          creado_por?: string | null
          created_at?: string
          fecha?: string
          horas_semana?: number
          id?: string
          nombre_calculo?: string
          pdf_url?: string | null
          proceso_descripcion?: string
          roi_meses_calculado?: number
          semanas_por_ano?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roi_calculos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_calculos_workspace_id_fkey"
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
          sequence_type: string
          signature_date: string
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
          sequence_type?: string
          signature_date: string
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
          sequence_type?: string
          signature_date?: string
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
      sops: {
        Row: {
          client_id: string | null
          creado_por: string | null
          created_at: string
          entregable: string | null
          estado: Database["public"]["Enums"]["simple_doc_status"]
          fecha: string
          id: string
          objetivo: string | null
          pasos: Json
          pdf_url: string | null
          proceso_descripcion_raw: string
          responsable: string | null
          titulo: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          entregable?: string | null
          estado?: Database["public"]["Enums"]["simple_doc_status"]
          fecha?: string
          id?: string
          objetivo?: string | null
          pasos?: Json
          pdf_url?: string | null
          proceso_descripcion_raw: string
          responsable?: string | null
          titulo: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          creado_por?: string | null
          created_at?: string
          entregable?: string | null
          estado?: Database["public"]["Enums"]["simple_doc_status"]
          fecha?: string
          id?: string
          objetivo?: string | null
          pasos?: Json
          pdf_url?: string | null
          proceso_descripcion_raw?: string
          responsable?: string | null
          titulo?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sops_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sops_workspace_id_fkey"
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
      current_user_can_write: { Args: never; Returns: boolean }
      ensure_current_user_setup: { Args: never; Returns: undefined }
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
      pipeline_status:
        | "prospecto"
        | "diagnostico"
        | "propuesta_enviada"
        | "negociacion"
        | "cerrado"
        | "retainer_activo"
        | "pausado"
        | "perdido"
      presupuesto_status:
        | "borrador"
        | "enviado"
        | "aceptado"
        | "rechazado"
        | "expirado"
      remittance_status:
        | "draft"
        | "generated"
        | "submitted"
        | "processed"
        | "con_devoluciones"
      retainer_status: "activo" | "pausado" | "cancelado"
      simple_doc_status: "borrador" | "completado" | "finalizado"
      task_status: "pendiente" | "en_curso" | "completada"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "member"],
      global_role: ["admin", "consultor", "viewer"],
      invoice_status: ["pending", "included", "paid", "cancelled"],
      pipeline_status: [
        "prospecto",
        "diagnostico",
        "propuesta_enviada",
        "negociacion",
        "cerrado",
        "retainer_activo",
        "pausado",
        "perdido",
      ],
      presupuesto_status: [
        "borrador",
        "enviado",
        "aceptado",
        "rechazado",
        "expirado",
      ],
      remittance_status: [
        "draft",
        "generated",
        "submitted",
        "processed",
        "con_devoluciones",
      ],
      retainer_status: ["activo", "pausado", "cancelado"],
      simple_doc_status: ["borrador", "completado", "finalizado"],
      task_status: ["pendiente", "en_curso", "completada"],
    },
  },
} as const
