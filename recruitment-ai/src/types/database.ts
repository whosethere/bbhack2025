export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
      }
      applications: {
        Row: {
          ai_analysis: Json | null
          applied_at: string | null
          candidate_id: string | null
          current_stage_id: string | null
          cv_file_url: string | null
          cv_parsed_data: Json | null
          id: string
          job_position_id: string | null
          status: string | null
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          applied_at?: string | null
          candidate_id?: string | null
          current_stage_id?: string | null
          cv_file_url?: string | null
          cv_parsed_data?: Json | null
          id?: string
          job_position_id?: string | null
          status?: string | null
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          applied_at?: string | null
          candidate_id?: string | null
          current_stage_id?: string | null
          cv_file_url?: string | null
          cv_parsed_data?: Json | null
          id?: string
          job_position_id?: string | null
          status?: string | null
          total_score?: number | null
          updated_at?: string | null
        }
      }
      candidates: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
        }
      }
      job_positions: {
        Row: {
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          id: string
          organization_id: string | null
          requirements_must_have: Json | null
          requirements_nice_to_have: Json | null
          scoring_formula: Json | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          requirements_must_have?: Json | null
          requirements_nice_to_have?: Json | null
          scoring_formula?: Json | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          requirements_must_have?: Json | null
          requirements_nice_to_have?: Json | null
          scoring_formula?: Json | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
      }
      organizations: {
        Row: {
          created_at: string | null
          culture_values: Json | null
          domain: string | null
          id: string
          name: string
          settings: Json | null
        }
        Insert: {
          created_at?: string | null
          culture_values?: Json | null
          domain?: string | null
          id?: string
          name: string
          settings?: Json | null
        }
        Update: {
          created_at?: string | null
          culture_values?: Json | null
          domain?: string | null
          id?: string
          name?: string
          settings?: Json | null
        }
      }
      recruitment_stages: {
        Row: {
          auto_actions: Json | null
          created_at: string | null
          description: string | null
          id: string
          job_position_id: string | null
          name: string
          order_index: number
          type: string | null
        }
        Insert: {
          auto_actions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          job_position_id?: string | null
          name: string
          order_index: number
          type?: string | null
        }
        Update: {
          auto_actions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          job_position_id?: string | null
          name?: string
          order_index?: number
          type?: string | null
        }
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          permissions: Json | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          permissions?: Json | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          permissions?: Json | null
          role?: string | null
        }
      }
    }
    Views: {
      kanban_view: {
        Row: {
          application_count: number | null
          applications: Json | null
          job_position_id: string | null
          job_title: string | null
          order_index: number | null
          stage_id: string | null
          stage_name: string | null
          stage_type: string | null
        }
      }
    }
    Functions: {
      calculate_application_score: {
        Args: { p_application_id: string }
        Returns: number
      }
      move_to_stage: {
        Args: {
          p_application_id: string
          p_moved_by: string
          p_new_stage_id: string
          p_notes?: string
        }
        Returns: boolean
      }
    }
  }
}