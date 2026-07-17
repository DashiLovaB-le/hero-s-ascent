// Utilidades puras do V-Project (nível/XP, capítulos, etc.).

export interface LevelInfo {
  nivel: number;
  titulo: string;
  xp_necessario: number;
}

export const LEVELS: LevelInfo[] = [
  { nivel: 1, titulo: "Homem Comum", xp_necessario: 0 },
  { nivel: 2, titulo: "Aprendiz", xp_necessario: 200 },
  { nivel: 3, titulo: "Iniciado", xp_necessario: 600 },
  { nivel: 4, titulo: "Aspirante", xp_necessario: 1400 },
  { nivel: 5, titulo: "Guerreiro", xp_necessario: 3000 },
  { nivel: 6, titulo: "Sentinela", xp_necessario: 6000 },
  { nivel: 7, titulo: "Cavaleiro", xp_necessario: 10000 },
  { nivel: 8, titulo: "Estrategista", xp_necessario: 16000 },
  { nivel: 9, titulo: "Mestre", xp_necessario: 25000 },
  { nivel: 10, titulo: "Sábio", xp_necessario: 40000 },
  { nivel: 11, titulo: "Rei", xp_necessario: 65000 },
  { nivel: 12, titulo: "Lenda", xp_necessario: 100000 },
];

export interface LevelProgress {
  atual: LevelInfo;
  proximo: LevelInfo | null;
  xp_no_nivel: number;
  xp_para_proximo: number;
  progresso: number; // 0..1
}

export function calcularNivel(xp: number): LevelProgress {
  let atual = LEVELS[0];
  let proximo: LevelInfo | null = LEVELS[1] ?? null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp_necessario) {
      atual = LEVELS[i];
      proximo = LEVELS[i + 1] ?? null;
    }
  }
  if (!proximo) {
    return { atual, proximo: null, xp_no_nivel: xp - atual.xp_necessario, xp_para_proximo: 0, progresso: 1 };
  }
  const xp_no_nivel = xp - atual.xp_necessario;
  const xp_faixa = proximo.xp_necessario - atual.xp_necessario;
  return {
    atual,
    proximo,
    xp_no_nivel,
    xp_para_proximo: proximo.xp_necessario - xp,
    progresso: Math.min(1, Math.max(0, xp_no_nivel / xp_faixa)),
  };
}

export const CATEGORIAS: { id: string; nome: string; descricao: string; emoji: string }[] = [
  { id: "corpo", nome: "Corpo", descricao: "Força, saúde, testosterona", emoji: "💪" },
  { id: "mente", nome: "Mente", descricao: "Foco, disciplina, aprendizado", emoji: "🧠" },
  { id: "espirito", nome: "Espírito", descricao: "Sentido, meditação, gratidão", emoji: "🕊️" },
  { id: "prosperidade", nome: "Prosperidade", descricao: "Carreira, dinheiro, projetos", emoji: "💰" },
  { id: "relacionamentos", nome: "Relacionamentos", descricao: "Família, amizades, amor", emoji: "🤝" },
  { id: "proposito", nome: "Propósito", descricao: "Missão, legado, liderança", emoji: "🏛️" },
];

export const ATRIBUTO_LABELS: Record<string, string> = {
  forca: "Força",
  disciplina: "Disciplina",
  sabedoria: "Sabedoria",
  espirito: "Espírito",
  testosterona: "Testosterona",
  prosperidade: "Prosperidade",
  conhecimento: "Conhecimento",
  lideranca: "Liderança",
};

export const FRASES_MOTIVACIONAIS = [
  "A jornada de mil léguas começa com um passo.",
  "Disciplina é escolher entre o que você quer agora e o que você mais quer.",
  "O homem que você quer ser está do outro lado do desconforto.",
  "Pequenos hábitos, praticados todos os dias, movem montanhas.",
  "Você é forjado pelas escolhas que ninguém vê.",
  "O herói não nasce. O herói se torna.",
];

export function fraseDoDia(seed: number = Date.now()) {
  const dia = Math.floor(seed / (1000 * 60 * 60 * 24));
  return FRASES_MOTIVACIONAIS[dia % FRASES_MOTIVACIONAIS.length];
}
