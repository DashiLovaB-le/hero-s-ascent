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
          created_at: string
          descricao: string | null
          id: string
          titulo: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          descricao?: string | null
          id?: string
          titulo: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          descricao?: string | null
          id?: string
          titulo?: string
          user_id?: string
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
          id?: string
          titulo?: string
          user_id?: string
          xp_recompensa?: number
        }
        Relationships: []
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
          streak_atual: number
          streak_maximo: number
          ultimo_dia_completo: string | null
          updated_at: string
          xp_total: number
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
          streak_atual?: number
          streak_maximo?: number
          ultimo_dia_completo?: string | null
          updated_at?: string
          xp_total?: number
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
          streak_atual?: number
          streak_maximo?: number
          ultimo_dia_completo?: string | null
          updated_at?: string
          xp_total?: number
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
      app_role: "admin" | "user"
      attribute_type:
        | "forca"
        | "disciplina"
        | "sabedoria"
        | "espirito"
        | "testosterona"
        | "prosperidade"
        | "conhecimento"
        | "lideranca"
      goal_category:
        | "corpo"
        | "mente"
        | "espirito"
        | "prosperidade"
        | "relacionamentos"
        | "proposito"
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
      app_role: ["admin", "user"],
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
      goal_category: [
        "corpo",
        "mente",
        "espirito",
        "prosperidade",
        "relacionamentos",
        "proposito",
      ],
      mission_kind: ["principal", "secundaria"],
    },
  },
} as const
