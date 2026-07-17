-- =============================================================================
-- V-Project / Hero's Ascent — SCHEMA COMPLETO (idempotente)
-- -----------------------------------------------------------------------------
-- Este arquivo sozinho provisiona TODO o banco da aplicação:
--   enums · tabelas · índices · seeds · RLS · policies · grants · funções · triggers
--
-- Seguro para reexecução (CREATE IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT).
-- Compatível com projeto Supabase/Lovable onde public.profiles já possa existir.
-- =============================================================================

-- gen_random_uuid() já está disponível no Supabase (pgcrypto / PG13+).
-- Não criamos extensão aqui para evitar conflito de schema (extensions vs public).

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.attribute_type AS ENUM (
    'forca', 'disciplina', 'sabedoria', 'espirito',
    'testosterona', 'prosperidade', 'conhecimento', 'lideranca'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_category AS ENUM (
    'corpo', 'mente', 'espirito', 'prosperidade', 'relacionamentos', 'proposito'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.mission_kind AS ENUM ('principal', 'secundaria');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.mentor_message_role AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.mentor_message_kind AS ENUM (
    'chat', 'morning', 'evening', 'return', 'challenge', 'insight', 'welcome'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.mentor_challenge_status AS ENUM (
    'ativo', 'concluido', 'expirado', 'recusado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- FUNÇÃO: updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- PROFILES
-- Cria se não existir; se já existir (Lovable), só adiciona colunas da jornada.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Herói',
  avatar_url TEXT,
  bio TEXT,
  xp_total INTEGER NOT NULL DEFAULT 0,
  streak_atual INTEGER NOT NULL DEFAULT 0,
  streak_maximo INTEGER NOT NULL DEFAULT 0,
  ultimo_dia_completo DATE,
  capitulo_atual INTEGER NOT NULL DEFAULT 1,
  frase_motivacional TEXT NOT NULL DEFAULT 'A jornada de mil léguas começa com um passo.',
  onboarding_completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT 'Herói',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS xp_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_atual INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_maximo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_dia_completo DATE,
  ADD COLUMN IF NOT EXISTS capitulo_atual INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS frase_motivacional TEXT NOT NULL DEFAULT 'A jornada de mil léguas começa com um passo.',
  ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Atualizar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Inserir próprio perfil" ON public.profiles;

CREATE POLICY "Ver próprio perfil"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Atualizar próprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Inserir próprio perfil"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ATTRIBUTES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attributes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  forca INTEGER NOT NULL DEFAULT 1,
  disciplina INTEGER NOT NULL DEFAULT 1,
  sabedoria INTEGER NOT NULL DEFAULT 1,
  espirito INTEGER NOT NULL DEFAULT 1,
  testosterona INTEGER NOT NULL DEFAULT 1,
  prosperidade INTEGER NOT NULL DEFAULT 1,
  conhecimento INTEGER NOT NULL DEFAULT 1,
  lideranca INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.attributes TO authenticated;
GRANT ALL ON public.attributes TO service_role;

ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprios atributos" ON public.attributes;
DROP POLICY IF EXISTS "Inserir próprios atributos" ON public.attributes;
DROP POLICY IF EXISTS "Atualizar próprios atributos" ON public.attributes;

CREATE POLICY "Ver próprios atributos"
  ON public.attributes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir próprios atributos"
  ON public.attributes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Atualizar próprios atributos"
  ON public.attributes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_attributes_updated ON public.attributes;
CREATE TRIGGER trg_attributes_updated
  BEFORE UPDATE ON public.attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- LEVELS (referência / seed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.levels (
  nivel INTEGER PRIMARY KEY,
  titulo TEXT NOT NULL,
  xp_necessario INTEGER NOT NULL,
  descricao TEXT
);

GRANT SELECT ON public.levels TO authenticated, anon;
GRANT ALL ON public.levels TO service_role;

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos veem níveis" ON public.levels;
CREATE POLICY "Todos veem níveis"
  ON public.levels FOR SELECT
  USING (true);

INSERT INTO public.levels (nivel, titulo, xp_necessario, descricao) VALUES
  (1,  'Homem Comum',  0,      'O ponto de partida da jornada.'),
  (2,  'Aprendiz',     200,    'Deu o primeiro passo.'),
  (3,  'Iniciado',     600,    'Firmou o compromisso.'),
  (4,  'Aspirante',    1400,   'Superou as primeiras provas.'),
  (5,  'Guerreiro',    3000,   'Domina o próprio corpo.'),
  (6,  'Sentinela',    6000,   'A disciplina é sua espada.'),
  (7,  'Cavaleiro',    10000,  'Serve a algo maior que si.'),
  (8,  'Estrategista', 16000,  'Vê além do óbvio.'),
  (9,  'Mestre',       25000,  'Ensina pelo exemplo.'),
  (10, 'Sábio',        40000,  'Encontrou o caminho interior.'),
  (11, 'Rei',          65000,  'Governa a si e ao seu reino.'),
  (12, 'Lenda',        100000, 'Sua história inspira gerações.')
ON CONFLICT (nivel) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  xp_necessario = EXCLUDED.xp_necessario,
  descricao = EXCLUDED.descricao;

-- -----------------------------------------------------------------------------
-- CHAPTERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chapters (
  numero INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  xp_minimo INTEGER NOT NULL DEFAULT 0
);

GRANT SELECT ON public.chapters TO authenticated, anon;
GRANT ALL ON public.chapters TO service_role;

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos veem capítulos" ON public.chapters;
CREATE POLICY "Todos veem capítulos"
  ON public.chapters FOR SELECT
  USING (true);

INSERT INTO public.chapters (numero, nome, descricao, xp_minimo) VALUES
  (1, 'O Chamado',    'Você foi convocado. O mundo comum não basta mais.', 0),
  (2, 'A Travessia',  'Cruzar o limiar exige coragem. Aqui começa o desconhecido.', 500),
  (3, 'As Provas',    'Cada obstáculo forja a alma. Persista.', 2000),
  (4, 'O Abismo',     'O momento mais escuro precede a verdadeira força.', 6000),
  (5, 'A Recompensa', 'Você conquista o que é justo pela luta.', 15000),
  (6, 'O Retorno',    'Traga o que aprendeu de volta ao seu mundo.', 35000),
  (7, 'A Lenda',      'Sua vida agora é o mapa para outros.', 70000)
ON CONFLICT (numero) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  xp_minimo = EXCLUDED.xp_minimo;

-- -----------------------------------------------------------------------------
-- ACHIEVEMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  xp_bonus INTEGER NOT NULL DEFAULT 0,
  icone TEXT
);

GRANT SELECT ON public.achievements TO authenticated, anon;
GRANT ALL ON public.achievements TO service_role;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos veem conquistas" ON public.achievements;
CREATE POLICY "Todos veem conquistas"
  ON public.achievements FOR SELECT
  USING (true);

INSERT INTO public.achievements (codigo, titulo, descricao, xp_bonus, icone) VALUES
  ('primeiro_passo', 'Primeiro Passo',  'Completou seu primeiro hábito.', 50,   'footprints'),
  ('streak_7',       'Semana de Ferro', '7 dias consecutivos.',           150,  'flame'),
  ('streak_30',      'Mês Inabalável',  '30 dias consecutivos.',          500,  'crown'),
  ('streak_100',     'Centenário',      '100 dias consecutivos.',         2000, 'trophy'),
  ('primeiro_nivel', 'Ascensão',        'Alcançou o nível 2.',            100,  'chevron-up'),
  ('cavaleiro',      'Cavaleiro',       'Alcançou o nível 7.',            500,  'shield'),
  ('lenda',          'Lenda Viva',      'Alcançou o nível 12.',           5000, 'star')
ON CONFLICT (codigo) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descricao = EXCLUDED.descricao,
  xp_bonus = EXCLUDED.xp_bonus,
  icone = EXCLUDED.icone;

-- -----------------------------------------------------------------------------
-- USER_ACHIEVEMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  desbloqueado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprias conquistas" ON public.user_achievements;
DROP POLICY IF EXISTS "Registrar próprias conquistas" ON public.user_achievements;

CREATE POLICY "Ver próprias conquistas"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Registrar próprias conquistas"
  ON public.user_achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- GOALS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria public.goal_category NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_ativo
  ON public.goals (user_id, ativo, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerenciar próprias metas" ON public.goals;
CREATE POLICY "Gerenciar próprias metas"
  ON public.goals FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- HABITS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  xp_recompensa INTEGER NOT NULL DEFAULT 10,
  atributo public.attribute_type NOT NULL,
  categoria public.goal_category,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habits_user_ativo
  ON public.habits (user_id, ativo, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerenciar próprios hábitos" ON public.habits;
CREATE POLICY "Gerenciar próprios hábitos"
  ON public.habits FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- HABIT_COMPLETIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  dia DATE NOT NULL DEFAULT CURRENT_DATE,
  xp_ganho INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, habit_id, dia)
);

CREATE INDEX IF NOT EXISTS idx_habit_completions_user_dia
  ON public.habit_completions (user_id, dia);

GRANT SELECT, INSERT, DELETE ON public.habit_completions TO authenticated;
GRANT ALL ON public.habit_completions TO service_role;

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprias conclusões" ON public.habit_completions;
DROP POLICY IF EXISTS "Registrar próprias conclusões" ON public.habit_completions;
DROP POLICY IF EXISTS "Desfazer próprias conclusões" ON public.habit_completions;

CREATE POLICY "Ver próprias conclusões"
  ON public.habit_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Registrar próprias conclusões"
  ON public.habit_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Desfazer próprias conclusões"
  ON public.habit_completions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- ACTIVITY_HISTORY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_history_user_date
  ON public.activity_history (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.activity_history TO authenticated;
GRANT ALL ON public.activity_history TO service_role;

ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprio histórico" ON public.activity_history;
DROP POLICY IF EXISTS "Inserir próprio histórico" ON public.activity_history;

CREATE POLICY "Ver próprio histórico"
  ON public.activity_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir próprio histórico"
  ON public.activity_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- USER_ROLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprios papéis" ON public.user_roles;
CREATE POLICY "Ver próprios papéis"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- -----------------------------------------------------------------------------
-- MENTOR — MESSAGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.mentor_message_role NOT NULL,
  kind public.mentor_message_kind NOT NULL DEFAULT 'chat',
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentor_messages_user_created_idx
  ON public.mentor_messages (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprias mensagens do mentor" ON public.mentor_messages;
DROP POLICY IF EXISTS "Inserir próprias mensagens do mentor" ON public.mentor_messages;

CREATE POLICY "Ver próprias mensagens do mentor"
  ON public.mentor_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir próprias mensagens do mentor"
  ON public.mentor_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- MENTOR — MEMORIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  importance SMALLINT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentor_memories_importance_check CHECK (importance BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS mentor_memories_user_created_idx
  ON public.mentor_memories (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.mentor_memories TO authenticated;
GRANT ALL ON public.mentor_memories TO service_role;

ALTER TABLE public.mentor_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprias memórias do mentor" ON public.mentor_memories;
DROP POLICY IF EXISTS "Inserir próprias memórias do mentor" ON public.mentor_memories;
DROP POLICY IF EXISTS "Apagar próprias memórias do mentor" ON public.mentor_memories;

CREATE POLICY "Ver próprias memórias do mentor"
  ON public.mentor_memories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir próprias memórias do mentor"
  ON public.mentor_memories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Apagar próprias memórias do mentor"
  ON public.mentor_memories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- MENTOR — CHALLENGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL DEFAULT 1,
  xp_recompensa INTEGER NOT NULL DEFAULT 100,
  titulo_recompensa TEXT,
  status public.mentor_challenge_status NOT NULL DEFAULT 'ativo',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentor_challenges_duracao_check CHECK (duracao_dias BETWEEN 1 AND 30),
  CONSTRAINT mentor_challenges_xp_check CHECK (xp_recompensa BETWEEN 10 AND 2000)
);

CREATE INDEX IF NOT EXISTS mentor_challenges_user_status_idx
  ON public.mentor_challenges (user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mentor_challenges TO authenticated;
GRANT ALL ON public.mentor_challenges TO service_role;

ALTER TABLE public.mentor_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprios desafios do mentor" ON public.mentor_challenges;
DROP POLICY IF EXISTS "Inserir próprios desafios do mentor" ON public.mentor_challenges;
DROP POLICY IF EXISTS "Atualizar próprios desafios do mentor" ON public.mentor_challenges;

CREATE POLICY "Ver próprios desafios do mentor"
  ON public.mentor_challenges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir próprios desafios do mentor"
  ON public.mentor_challenges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Atualizar próprios desafios do mentor"
  ON public.mentor_challenges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- TRIGGER: signup → profile + attributes + role
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Herói'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.attributes (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- HARDENING: revogar EXECUTE público de helpers internos
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
