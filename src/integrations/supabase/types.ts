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
      achievements: {
        Row: {
          codigo: string
          descricao: string
          icone: string | null
          id: string
          titulo: string
          xp_bonus: number
        }
        Insert: {
          codigo: string
          descricao: string
          icone?: string | null
          id?: string
          titulo: string
          xp_bonus?: number
        }
        Update: {
          codigo?: string
          descricao?: string
          icone?: string | null
          id?: string
          titulo?: string
          xp_bonus?: number
        }
        Relationships: []
      }
      affiliate_applications: {
        Row: {
          admin_notes: string | null
          audiencia_aprox: string | null
          canal_principal: string
          created_at: string
          email: string
          handle_ou_url: string
          id: string
          mensagem: string | null
          nome: string
          outros_canais: string | null
          status: Database["public"]["Enums"]["affiliate_application_status"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          audiencia_aprox?: string | null
          canal_principal: string
          created_at?: string
          email: string
          handle_ou_url: string
          id?: string
          mensagem?: string | null
          nome: string
          outros_canais?: string | null
          status?: Database["public"]["Enums"]["affiliate_application_status"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          audiencia_aprox?: string | null
          canal_principal?: string
          created_at?: string
          email?: string
          handle_ou_url?: string
          id?: string
          mensagem?: string | null
          nome?: string
          outros_canais?: string | null
          status?: Database["public"]["Enums"]["affiliate_application_status"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_history: {
        Row: {
          created_at: string
          descricao: string
          id: string
          metadata: Json | null
          tipo: string
          user_id: string
          xp_delta: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          metadata?: Json | null
          tipo: string
          user_id: string
          xp_delta?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          metadata?: Json | null
          tipo?: string
          user_id?: string
          xp_delta?: number
        }
        Relationships: []
      }
      app_popups: {
        Row: {
          ativo: boolean
          body_link_ativo: boolean
          body_link_label: string | null
          body_link_url: string | null
          button_label: string
          corpo: string
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          priority: number
          starts_at: string
          subtitulo: string | null
          target_path: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          body_link_ativo?: boolean
          body_link_label?: string | null
          body_link_url?: string | null
          button_label?: string
          corpo: string
          created_at?: string
          expires_at: string
          id?: string
          image_url?: string | null
          priority?: number
          starts_at?: string
          subtitulo?: string | null
          target_path: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          body_link_ativo?: boolean
          body_link_label?: string | null
          body_link_url?: string | null
          button_label?: string
          corpo?: string
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          priority?: number
          starts_at?: string
          subtitulo?: string | null
          target_path?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      charlie_wisdom_cards: {
        Row: {
          ativo: boolean
          blocked_personalities: string[]
          created_at: string
          id: string
          keywords: string[]
          priority: number
          principio: string
          quando_evitar: string
          quando_usar: string
          slug: string
          source: string
          tags: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          blocked_personalities?: string[]
          created_at?: string
          id?: string
          keywords?: string[]
          priority?: number
          principio: string
          quando_evitar?: string
          quando_usar?: string
          slug: string
          source: string
          tags?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          blocked_personalities?: string[]
          created_at?: string
          id?: string
          keywords?: string[]
          priority?: number
          principio?: string
          quando_evitar?: string
          quando_usar?: string
          slug?: string
          source?: string
          tags?: string[]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      attributes: {
        Row: {
          conhecimento: number
          disciplina: number
          espirito: number
          forca: number
          lideranca: number
          prosperidade: number
          sabedoria: number
          testosterona: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conhecimento?: number
          disciplina?: number
          espirito?: number
          forca?: number
          lideranca?: number
          prosperidade?: number
          sabedoria?: number
          testosterona?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conhecimento?: number
          disciplina?: number
          espirito?: number
          forca?: number
          lideranca?: number
          prosperidade?: number
          sabedoria?: number
          testosterona?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          descricao: string
          nome: string
          numero: number
          xp_minimo: number
        }
        Insert: {
          descricao: string
          nome: string
          numero: number
          xp_minimo?: number
        }
        Update: {
          descricao?: string
          nome?: string
          numero?: number
          xp_minimo?: number
        }
        Relationships: []
      }
      goals: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["goal_category"]
          completed_at: string | null
          created_at: string
          descricao: string | null
          id: string
          is_norte: boolean
          motivo: string | null
          prazo: string | null
          status: Database["public"]["Enums"]["goal_status"]
          titulo: string
          user_id: string
          xp_recompensa: number
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["goal_category"]
          completed_at?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_norte?: boolean
          motivo?: string | null
          prazo?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          titulo: string
          user_id: string
          xp_recompensa?: number
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["goal_category"]
          completed_at?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_norte?: boolean
          motivo?: string | null
          prazo?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          titulo?: string
          user_id?: string
          xp_recompensa?: number
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          created_at: string
          dia: string
          habit_id: string
          id: string
          user_id: string
          xp_ganho: number
        }
        Insert: {
          created_at?: string
          dia?: string
          habit_id: string
          id?: string
          user_id: string
          xp_ganho?: number
        }
        Update: {
          created_at?: string
          dia?: string
          habit_id?: string
          id?: string
          user_id?: string
          xp_ganho?: number
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          ativo: boolean
          atributo: Database["public"]["Enums"]["attribute_type"]
          categoria: Database["public"]["Enums"]["goal_category"] | null
          created_at: string
          descricao: string | null
          exercise_type_id: string | null
          goal_id: string | null
          id: string
          titulo: string
          user_id: string
          xp_recompensa: number
        }
        Insert: {
          ativo?: boolean
          atributo: Database["public"]["Enums"]["attribute_type"]
          categoria?: Database["public"]["Enums"]["goal_category"] | null
          created_at?: string
          descricao?: string | null
          exercise_type_id?: string | null
          goal_id?: string | null
          id?: string
          titulo: string
          user_id: string
          xp_recompensa?: number
        }
        Update: {
          ativo?: boolean
          atributo?: Database["public"]["Enums"]["attribute_type"]
          categoria?: Database["public"]["Enums"]["goal_category"] | null
          created_at?: string
          descricao?: string | null
          exercise_type_id?: string | null
          goal_id?: string | null
          id?: string
          titulo?: string
          user_id?: string
          xp_recompensa?: number
        }
        Relationships: [
          {
            foreignKeyName: "habits_exercise_type_id_fkey"
            columns: ["exercise_type_id"]
            isOneToOne: false
            referencedRelation: "exercise_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habits_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_types: {
        Row: {
          id: string
          slug: string
          nome: string
          descricao: string | null
          atributo_padrao: Database["public"]["Enums"]["attribute_type"]
          categoria_padrao: Database["public"]["Enums"]["goal_category"]
          xp_base: number
          xp_por_rep_valida: number
          xp_sessao_max: number
          sessoes_por_dia_max: number
          ativo: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          nome: string
          descricao?: string | null
          atributo_padrao?: Database["public"]["Enums"]["attribute_type"]
          categoria_padrao?: Database["public"]["Enums"]["goal_category"]
          xp_base?: number
          xp_por_rep_valida?: number
          xp_sessao_max?: number
          sessoes_por_dia_max?: number
          ativo?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          nome?: string
          descricao?: string | null
          atributo_padrao?: Database["public"]["Enums"]["attribute_type"]
          categoria_padrao?: Database["public"]["Enums"]["goal_category"]
          xp_base?: number
          xp_por_rep_valida?: number
          xp_sessao_max?: number
          sessoes_por_dia_max?: number
          ativo?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      exercise_sessions: {
        Row: {
          id: string
          user_id: string
          exercise_type_id: string
          habit_id: string | null
          status: Database["public"]["Enums"]["exercise_session_status"]
          started_at: string
          ended_at: string | null
          consent_version: string
          client_meta: Json
          xp_ganho: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_type_id: string
          habit_id?: string | null
          status?: Database["public"]["Enums"]["exercise_session_status"]
          started_at?: string
          ended_at?: string | null
          consent_version?: string
          client_meta?: Json
          xp_ganho?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise_type_id?: string
          habit_id?: string | null
          status?: Database["public"]["Enums"]["exercise_session_status"]
          started_at?: string
          ended_at?: string | null
          consent_version?: string
          client_meta?: Json
          xp_ganho?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_sessions_exercise_type_id_fkey"
            columns: ["exercise_type_id"]
            isOneToOne: false
            referencedRelation: "exercise_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_sessions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_session_metrics: {
        Row: {
          session_id: string
          reps_validas: number
          reps_invalidas: number
          duracao_ms: number
          amplitude_media: number | null
          forma_pct: number | null
          cadencia_rpm: number | null
          fatigue_rep_index: number | null
          created_at: string
        }
        Insert: {
          session_id: string
          reps_validas?: number
          reps_invalidas?: number
          duracao_ms?: number
          amplitude_media?: number | null
          forma_pct?: number | null
          cadencia_rpm?: number | null
          fatigue_rep_index?: number | null
          created_at?: string
        }
        Update: {
          session_id?: string
          reps_validas?: number
          reps_invalidas?: number
          duracao_ms?: number
          amplitude_media?: number | null
          forma_pct?: number | null
          cadencia_rpm?: number | null
          fatigue_rep_index?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_session_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "exercise_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          descricao: string | null
          nivel: number
          titulo: string
          xp_necessario: number
        }
        Insert: {
          descricao?: string | null
          nivel: number
          titulo: string
          xp_necessario: number
        }
        Update: {
          descricao?: string | null
          nivel?: number
          titulo?: string
          xp_necessario?: number
        }
        Relationships: []
      }
      mentor_challenges: {
        Row: {
          completed_at: string | null
          completions_required: number
          created_at: string
          descricao: string
          duracao_dias: number
          ends_at: string | null
          habit_id: string | null
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["mentor_challenge_status"]
          titulo: string
          titulo_recompensa: string | null
          user_id: string
          xp_recompensa: number
        }
        Insert: {
          completed_at?: string | null
          completions_required?: number
          created_at?: string
          descricao: string
          duracao_dias?: number
          ends_at?: string | null
          habit_id?: string | null
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["mentor_challenge_status"]
          titulo: string
          titulo_recompensa?: string | null
          user_id: string
          xp_recompensa?: number
        }
        Update: {
          completed_at?: string | null
          completions_required?: number
          created_at?: string
          descricao?: string
          duracao_dias?: number
          ends_at?: string | null
          habit_id?: string | null
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["mentor_challenge_status"]
          titulo?: string
          titulo_recompensa?: string | null
          user_id?: string
          xp_recompensa?: number
        }
        Relationships: []
      }
      mentor_objectives: {
        Row: {
          ativo: boolean
          created_at: string
          motivo: string | null
          source: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          motivo?: string | null
          source?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          motivo?: string | null
          source?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          importance: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          importance?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          importance?: number
          user_id?: string
        }
        Relationships: []
      }
      mentor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["mentor_message_kind"]
          metadata: Json
          role: Database["public"]["Enums"]["mentor_message_role"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["mentor_message_kind"]
          metadata?: Json
          role: Database["public"]["Enums"]["mentor_message_role"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["mentor_message_kind"]
          metadata?: Json
          role?: Database["public"]["Enums"]["mentor_message_role"]
          user_id?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          id: string
          user_id: string
          kind: Database["public"]["Enums"]["mission_kind"]
          capitulo: number
          titulo: string
          descricao: string
          xp_recompensa: number
          status: string
          progresso_atual: number
          progresso_alvo: number
          habit_id: string | null
          track: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          kind?: Database["public"]["Enums"]["mission_kind"]
          capitulo?: number
          titulo: string
          descricao?: string
          xp_recompensa?: number
          status?: string
          progresso_atual?: number
          progresso_alvo?: number
          habit_id?: string | null
          track?: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          kind?: Database["public"]["Enums"]["mission_kind"]
          capitulo?: number
          titulo?: string
          descricao?: string
          xp_recompensa?: number
          status?: string
          progresso_atual?: number
          progresso_alvo?: number
          habit_id?: string | null
          track?: string
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          tipo: string
          titulo: string
          corpo: string
          metadata: Json
          lido_em: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tipo: string
          titulo: string
          corpo?: string
          metadata?: Json
          lido_em?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tipo?: string
          titulo?: string
          corpo?: string
          metadata?: Json
          lido_em?: string | null
          created_at?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          user_id: string
          push_enabled: boolean
          notify_habit_reminder: boolean
          notify_streak_risk: boolean
          notify_mentor: boolean
          notify_achievement: boolean
          notify_agent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          push_enabled?: boolean
          notify_habit_reminder?: boolean
          notify_streak_risk?: boolean
          notify_mentor?: boolean
          notify_achievement?: boolean
          notify_agent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          push_enabled?: boolean
          notify_habit_reminder?: boolean
          notify_streak_risk?: boolean
          notify_mentor?: boolean
          notify_achievement?: boolean
          notify_agent?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          capitulo_atual: number
          created_at: string
          frase_motivacional: string
          id: string
          nome: string
          onboarding_completo: boolean
          tour_visto: boolean
          streak_atual: number
          streak_maximo: number
          ultimo_dia_completo: string | null
          updated_at: string
          wallpaper_id?: string | null
          xp_total: number
          telegram_chat_id: string | null
          telegram_opt_in: boolean
          telegram_linked_at: string | null
          location_label: string | null
          location_lat: number | null
          location_lon: number | null
          location_timezone: string | null
          charlie_personality: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          capitulo_atual?: number
          created_at?: string
          frase_motivacional?: string
          id: string
          nome?: string
          onboarding_completo?: boolean
          tour_visto?: boolean
          streak_atual?: number
          streak_maximo?: number
          ultimo_dia_completo?: string | null
          updated_at?: string
          wallpaper_id?: string | null
          xp_total?: number
          telegram_chat_id?: string | null
          telegram_opt_in?: boolean
          telegram_linked_at?: string | null
          location_label?: string | null
          location_lat?: number | null
          location_lon?: number | null
          location_timezone?: string | null
          charlie_personality?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          capitulo_atual?: number
          created_at?: string
          frase_motivacional?: string
          id?: string
          nome?: string
          onboarding_completo?: boolean
          tour_visto?: boolean
          streak_atual?: number
          streak_maximo?: number
          ultimo_dia_completo?: string | null
          updated_at?: string
          wallpaper_id?: string | null
          xp_total?: number
          telegram_chat_id?: string | null
          telegram_opt_in?: boolean
          telegram_linked_at?: string | null
          location_label?: string | null
          location_lat?: number | null
          location_lon?: number | null
          location_timezone?: string | null
          charlie_personality?: string
        }
        Relationships: []
      }
      user_features: {
        Row: {
          user_id: string
          computed_at: string
          features_version: string
          dias_ativos_7: number
          dias_ativos_21: number
          dias_sem_habito: number
          media_habitos_dia_7: number
          media_habitos_dia_21: number
          taxa_conclusao_7: number
          taxa_conclusao_21: number
          weekday_rates: Json
          streak_atual: number
          streak_maximo: number
          xp_total: number
          nivel: number
          desafios_ativos: number
          desafios_concluidos_21: number
          desafios_expirados_21: number
          ultimo_dia_completo: string | null
          dias_desde_ultima_atividade: number | null
          media_xp_dia_21: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          computed_at?: string
          features_version?: string
          dias_ativos_7?: number
          dias_ativos_21?: number
          dias_sem_habito?: number
          media_habitos_dia_7?: number
          media_habitos_dia_21?: number
          taxa_conclusao_7?: number
          taxa_conclusao_21?: number
          weekday_rates?: Json
          streak_atual?: number
          streak_maximo?: number
          xp_total?: number
          nivel?: number
          desafios_ativos?: number
          desafios_concluidos_21?: number
          desafios_expirados_21?: number
          ultimo_dia_completo?: string | null
          dias_desde_ultima_atividade?: number | null
          media_xp_dia_21?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          computed_at?: string
          features_version?: string
          dias_ativos_7?: number
          dias_ativos_21?: number
          dias_sem_habito?: number
          media_habitos_dia_7?: number
          media_habitos_dia_21?: number
          taxa_conclusao_7?: number
          taxa_conclusao_21?: number
          weekday_rates?: Json
          streak_atual?: number
          streak_maximo?: number
          xp_total?: number
          nivel?: number
          desafios_ativos?: number
          desafios_concluidos_21?: number
          desafios_expirados_21?: number
          ultimo_dia_completo?: string | null
          dias_desde_ultima_atividade?: number | null
          media_xp_dia_21?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_ml_scores: {
        Row: {
          user_id: string
          computed_at: string
          model_version: string
          risco_streak: number
          risco_abandono: number
          projecao_dias_proximo_nivel: number | null
          weekday_weakest: number | null
          explicacao: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          computed_at?: string
          model_version?: string
          risco_streak?: number
          risco_abandono?: number
          projecao_dias_proximo_nivel?: number | null
          weekday_weakest?: number | null
          explicacao?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          computed_at?: string
          model_version?: string
          risco_streak?: number
          risco_abandono?: number
          projecao_dias_proximo_nivel?: number | null
          weekday_weakest?: number | null
          explicacao?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_ml_scores_shadow: {
        Row: {
          user_id: string
          model_version: string
          computed_at: string
          risco_streak: number
          risco_abandono: number
          explicacao: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          model_version?: string
          computed_at?: string
          risco_streak?: number
          risco_abandono?: number
          explicacao?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          model_version?: string
          computed_at?: string
          risco_streak?: number
          risco_abandono?: number
          explicacao?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ml_model_runs: {
        Row: {
          id: string
          model_version: string
          trained_at: string
          auc_streak: number | null
          auc_abandono: number | null
          n_train: number
          n_test: number
          metrics: Json
          artifact_path: string | null
          promoted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          model_version?: string
          trained_at?: string
          auc_streak?: number | null
          auc_abandono?: number | null
          n_train?: number
          n_test?: number
          metrics?: Json
          artifact_path?: string | null
          promoted?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          model_version?: string
          trained_at?: string
          auc_streak?: number | null
          auc_abandono?: number | null
          n_train?: number
          n_test?: number
          metrics?: Json
          artifact_path?: string | null
          promoted?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_checkins: {
        Row: {
          id: string
          user_id: string
          dia: string
          sono_horas: number | null
          sono_qualidade: number | null
          energia: number | null
          humor: number | null
          nota: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          dia: string
          sono_horas?: number | null
          sono_qualidade?: number | null
          energia?: number | null
          humor?: number | null
          nota?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          dia?: string
          sono_horas?: number | null
          sono_qualidade?: number | null
          energia?: number | null
          humor?: number | null
          nota?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_initiatives: {
        Row: {
          id: string
          user_id: string
          kind: string
          titulo: string
          corpo: string
          status: string
          href: string
          metadata: Json
          created_at: string
          expires_at: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          titulo: string
          corpo?: string
          status?: string
          href?: string
          metadata?: Json
          created_at?: string
          expires_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          kind?: string
          titulo?: string
          corpo?: string
          status?: string
          href?: string
          metadata?: Json
          created_at?: string
          expires_at?: string | null
          resolved_at?: string | null
        }
        Relationships: []
      }
      user_cf_recommendations: {
        Row: {
          user_id: string
          computed_at: string
          model_version: string
          peer_count: number
          suggestions: Json
          explicacao: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          computed_at?: string
          model_version?: string
          peer_count?: number
          suggestions?: Json
          explicacao?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          computed_at?: string
          model_version?: string
          peer_count?: number
          suggestions?: Json
          explicacao?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          code: string
          user_id: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          code: string
          user_id: string
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          code?: string
          user_id?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          desbloqueado_em: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          desbloqueado_em?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          desbloqueado_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      wallpaper_catalog: {
        Row: {
          id: string
          titulo: string
          descricao: string
          file_name: string | null
          image_url: string | null
          unlock_kind: string
          unlock_min: number
          sort_order: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          titulo: string
          descricao?: string
          file_name?: string | null
          image_url?: string | null
          unlock_kind?: string
          unlock_min?: number
          sort_order?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          titulo?: string
          descricao?: string
          file_name?: string | null
          image_url?: string | null
          unlock_kind?: string
          unlock_min?: number
          sort_order?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_cost_rates: {
        Row: {
          model: string
          input_usd_per_1m: number
          output_usd_per_1m: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          model: string
          input_usd_per_1m?: number
          output_usd_per_1m?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          model?: string
          input_usd_per_1m?: number
          output_usd_per_1m?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          id: string
          user_id: string | null
          source: string
          model: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          estimated_cost_usd: number
          finish_reason: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          source?: string
          model: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          estimated_cost_usd?: number
          finish_reason?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          source?: string
          model?: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          estimated_cost_usd?: number
          finish_reason?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mentor_settings: {
        Row: {
          key: string
          value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mentor_personalities: {
        Row: {
          slug: string
          name: string
          tagline: string
          description: string
          system_prompt: string
          is_active: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          slug: string
          name: string
          tagline?: string
          description?: string
          system_prompt: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          slug?: string
          name?: string
          tagline?: string
          description?: string
          system_prompt?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
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
      affiliate_application_status: "pending" | "contacted" | "approved" | "rejected"
      app_role: "admin" | "dashi" | "user"
      attribute_type:
        | "forca"
        | "disciplina"
        | "sabedoria"
        | "espirito"
        | "testosterona"
        | "prosperidade"
        | "conhecimento"
        | "lideranca"
      exercise_session_status: "active" | "completed" | "cancelled" | "rejected"
      goal_category:
        | "corpo"
        | "mente"
        | "espirito"
        | "prosperidade"
        | "relacionamentos"
        | "proposito"
      goal_status: "ativa" | "pausada" | "concluida"
      mentor_challenge_status: "ativo" | "concluido" | "expirado" | "recusado"
      mentor_message_kind:
        | "chat"
        | "morning"
        | "evening"
        | "return"
        | "challenge"
        | "insight"
        | "welcome"
      mentor_message_role: "user" | "assistant"
      mission_kind: "principal" | "secundaria"
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
      affiliate_application_status: [
        "pending",
        "contacted",
        "approved",
        "rejected",
      ],
      app_role: ["admin", "dashi", "user"],
      attribute_type: [
        "forca",
        "disciplina",
        "sabedoria",
        "espirito",
        "testosterona",
        "prosperidade",
        "conhecimento",
        "lideranca",
      ],
      exercise_session_status: ["active", "completed", "cancelled", "rejected"],
      goal_category: [
        "corpo",
        "mente",
        "espirito",
        "prosperidade",
        "relacionamentos",
        "proposito",
      ],
      goal_status: ["ativa", "pausada", "concluida"],
      mentor_challenge_status: ["ativo", "concluido", "expirado", "recusado"],
      mentor_message_kind: [
        "chat",
        "morning",
        "evening",
        "return",
        "challenge",
        "insight",
        "welcome",
      ],
      mentor_message_role: ["user", "assistant"],
      mission_kind: ["principal", "secundaria"],
    },
  },
} as const
