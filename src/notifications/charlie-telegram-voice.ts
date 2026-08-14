/**
 * Voz do Charlie para notificações (Telegram / push / in-app).
 * Determinístico — sem LLM — alinhado às personalidades.
 */

export type CharlieVoiceTipo =
  | "mentor_challenge"
  | "mentor_challenge_done"
  | "mentor_challenge_expired"
  | "habit_reminder"
  | "streak_risk"
  | "agent_initiative";

export type CharlieVoiceIntensity = "soft" | "normal" | "high";

export type CharlieVoiceInput = {
  tipo: string;
  personalitySlug?: string | null;
  nome?: string | null;
  pending?: number | null;
  streak?: number | null;
  weekdayWeak?: string | null;
  /** Título do desafio / hábito / iniciativa */
  subject?: string | null;
  kind?: string | null;
  xp?: number | null;
  intensity?: CharlieVoiceIntensity | null;
  /** Alter Ego — só em eventos de alto valor (streak / desafio / agent protect). */
  identityCodigo?: string | null;
  identityInimigo?: string | null;
};

export type CharlieVoiceOutput = {
  titulo: string;
  corpo: string;
};

const DEFAULT_SLUG = "classico";

function slugOf(raw?: string | null): string {
  const s = (raw ?? "").trim().toLowerCase();
  return s || DEFAULT_SLUG;
}

function firstName(nome?: string | null): string | null {
  const t = (nome ?? "").trim();
  if (!t) return null;
  return t.split(/\s+/)[0] ?? null;
}

function pendingLabel(n: number): string {
  return n === 1 ? "1 hábito" : `${n} hábitos`;
}

/**
 * Reescreve titulo/corpo no tom do Charlie da personalidade ativa.
 * Se o tipo não for mapeado, devolve o original (via caller).
 */
export function voiceCharlieNotification(
  input: CharlieVoiceInput & { fallbackTitulo: string; fallbackCorpo?: string },
): CharlieVoiceOutput {
  const slug = slugOf(input.personalitySlug);
  const name = firstName(input.nome);
  const pending = input.pending != null && input.pending > 0 ? input.pending : null;
  const streak = input.streak != null && input.streak > 0 ? input.streak : null;
  const subject = (input.subject ?? input.fallbackCorpo ?? "").trim() || null;
  const intensity: CharlieVoiceIntensity =
    input.intensity === "high" || input.intensity === "soft" ? input.intensity : "normal";

  switch (input.tipo) {
    case "habit_reminder":
      // Guardrail: lembrete trivial NÃO usa copy de identidade
      return voiceHabitReminder(slug, name, pending, intensity);
    case "streak_risk":
      return voiceStreakRisk(
        slug,
        name,
        streak,
        input.weekdayWeak,
        intensity,
        input.identityCodigo,
        input.identityInimigo,
      );
    case "mentor_challenge":
      return voiceNewChallenge(slug, name, subject, input.identityCodigo);
    case "mentor_challenge_done":
      return voiceChallengeDone(slug, name, subject, input.xp);
    case "mentor_challenge_expired":
      return voiceChallengeExpired(slug, name, subject);
    case "agent_initiative":
      return voiceAgent(
        slug,
        name,
        input.kind,
        subject,
        input.weekdayWeak,
        input.fallbackTitulo,
        input.fallbackCorpo,
        input.identityCodigo,
        input.identityInimigo,
      );
    default:
      return {
        titulo: input.fallbackTitulo,
        corpo: (input.fallbackCorpo ?? "").trim(),
      };
  }
}

function voiceHabitReminder(
  slug: string,
  name: string | null,
  pending: number | null,
  intensity: CharlieVoiceIntensity,
): CharlieVoiceOutput {
  const n = pending ?? 1;
  const what = pendingLabel(n);
  const addr = name ? `${name}, ` : "";

  const bySlug: Record<string, CharlieVoiceOutput> = {
    militar: {
      titulo: "Ordem do dia",
      corpo:
        intensity === "high"
          ? `${addr}ainda há ${what} em aberto. Execute agora. Sem discurso.`
          : `${addr}faltam ${what}. Complete e reporte no app.`,
    },
    estoico: {
      titulo: "O que depende de você",
      corpo:
        intensity === "high"
          ? `${addr}o dia ainda pede ${what}. Só a ação de agora está sob seu comando.`
          : `${addr}ainda restam ${what} hoje. Um passo certo basta para honrar o dia.`,
    },
    empresarial: {
      titulo: "Pendências do sprint",
      corpo:
        intensity === "high"
          ? `${addr}${what} em aberto — risco de atraso. Feche o ciclo hoje.`
          : `${addr}faltam ${what} no dia. Priorize e execute.`,
    },
    cristao: {
      titulo: "Fidelidade no pequeno",
      corpo:
        intensity === "high"
          ? `${addr}ainda há ${what} por cumprir. Domínio próprio começa no próximo passo.`
          : `${addr}faltam ${what} hoje. Seja fiel no pouco — e vá.`,
    },
    fitness: {
      titulo: "Sessão incompleta",
      corpo:
        intensity === "high"
          ? `${addr}${what} ainda no ar. Corpo e mente pedem o check agora.`
          : `${addr}faltam ${what}. Fecha a sessão do dia.`,
    },
    financeiro: {
      titulo: "Itens em aberto",
      corpo:
        intensity === "high"
          ? `${addr}${what} sem baixa. Disciplina de caixa começa no hábito de hoje.`
          : `${addr}faltam ${what} no dia. Quite a pendência.`,
    },
    classico: {
      titulo: "O dia ainda não fechou",
      corpo:
        intensity === "high"
          ? `${addr}ainda há ${what} em aberto. Volte agora — o ritmo está escorregando.`
          : intensity === "soft"
            ? `${addr}faltam ${what}. Um passo curto segura o caminho.`
            : `${addr}ainda restam ${what} hoje. Mantém a linha.`,
    },
  };

  return bySlug[slug] ?? bySlug.classico;
}

function identityTail(codigo?: string | null, inimigo?: string | null): string {
  const code = codigo?.trim();
  if (code) {
    const enemy = inimigo?.trim();
    return enemy
      ? ` Código: "${code}" — não alimente ${enemy.toLowerCase()}.`
      : ` Código: "${code}"`;
  }
  return "";
}

function voiceStreakRisk(
  slug: string,
  name: string | null,
  streak: number | null,
  weekdayWeak: string | null | undefined,
  intensity: CharlieVoiceIntensity,
  identityCodigo?: string | null,
  identityInimigo?: string | null,
): CharlieVoiceOutput {
  const days = streak ?? 0;
  const seq = days > 0 ? `Sequência de ${days} dias` : "Sua sequência";
  const addr = name ? `${name}. ` : "";
  const weak =
    weekdayWeak && weekdayWeak.trim()
      ? ` Seu padrão fraco costuma ser ${weekdayWeak.trim()} — não repita hoje.`
      : "";
  const id = identityTail(identityCodigo, identityInimigo);

  const bySlug: Record<string, CharlieVoiceOutput> = {
    militar: {
      titulo: "Corrente sob fogo",
      corpo: `${addr}${seq} em risco. Um hábito agora. Sem adiamento.${weak}${id}`,
    },
    estoico: {
      titulo: "A corrente pede virtude",
      corpo: `${addr}${seq} quase cai. O que você controla é o próximo ato.${weak}${id}`,
    },
    empresarial: {
      titulo: "KPI de consistência",
      corpo: `${addr}${seq} sob risco. Proteja o ativo com um hábito hoje.${weak}${id}`,
    },
    cristao: {
      titulo: "Não quebre a fidelidade",
      corpo: `${addr}${seq} está em jogo. Um ato fiel hoje segura o caminho.${weak}${id}`,
    },
    fitness: {
      titulo: "Não quebre o ciclo",
      corpo: `${addr}${seq} em risco. Um check agora mantém o progresso.${weak}${id}`,
    },
    financeiro: {
      titulo: "Não zere a série",
      corpo: `${addr}${seq} em risco. Quite um hábito hoje e preserve o capital de disciplina.${weak}${id}`,
    },
    classico: {
      titulo: "A corrente quase cai",
      corpo:
        intensity === "high"
          ? `${addr}${seq} sob pressão. Um hábito agora segura o dia.${weak}${id}`
          : `${addr}${seq}. Conclua um hábito hoje e a jornada continua.${weak}${id}`,
    },
  };

  return bySlug[slug] ?? bySlug.classico;
}

function voiceNewChallenge(
  slug: string,
  name: string | null,
  subject: string | null,
  identityCodigo?: string | null,
): CharlieVoiceOutput {
  const mission = subject || "um novo desafio";
  const addr = name ? `${name}, ` : "";
  const id = identityCodigo?.trim()
    ? ` Prove o código: "${identityCodigo.trim()}".`
    : "";

  const bySlug: Record<string, CharlieVoiceOutput> = {
    militar: {
      titulo: "Nova ordem",
      corpo: `${addr}missão: ${mission}. Aceite no mentor e execute.${id}`,
    },
    estoico: {
      titulo: "Prova à frente",
      corpo: `${addr}coloquei diante de você: ${mission}. Aja no que depende de você.${id}`,
    },
    empresarial: {
      titulo: "Novo sprint",
      corpo: `${addr}desafio aberto: ${mission}. Critério claro — execute e feche.${id}`,
    },
    cristao: {
      titulo: "Um chamado prático",
      corpo: `${addr}há um desafio para você: ${mission}. Vá com coragem e domínio próprio.${id}`,
    },
    fitness: {
      titulo: "Novo estímulo",
      corpo: `${addr}desafio no ar: ${mission}. Treine o hábito e marque no app.${id}`,
    },
    financeiro: {
      titulo: "Nova meta operacional",
      corpo: `${addr}desafio: ${mission}. Trate como prazo — e entregue.${id}`,
    },
    classico: {
      titulo: "Desafio do Charlie",
      corpo: `${addr}preparei isto para você: ${mission}. Abra o mentor e aceite.${id}`,
    },
  };

  return bySlug[slug] ?? bySlug.classico;
}

function voiceChallengeDone(
  slug: string,
  name: string | null,
  subject: string | null,
  xp: number | null | undefined,
): CharlieVoiceOutput {
  const mission = subject?.replace(/\s*·\s*\+\d+\s*XP/i, "").trim() || "o desafio";
  const xpBit = xp != null && xp > 0 ? ` (+${xp} XP)` : "";
  const addr = name ? `${name}, ` : "";

  const bySlug: Record<string, CharlieVoiceOutput> = {
    militar: {
      titulo: "Missão cumprida",
      corpo: `${addr}${mission} concluído${xpBit}. Próximo.`,
    },
    estoico: {
      titulo: "Feito com virtude",
      corpo: `${addr}você cumpriu: ${mission}${xpBit}. Guarde o aprendizado, não o orgulho.`,
    },
    empresarial: {
      titulo: "Entrega fechada",
      corpo: `${addr}sprint concluído: ${mission}${xpBit}. Bom. Mantenha o padrão.`,
    },
    cristao: {
      titulo: "Fidelidade honrada",
      corpo: `${addr}você concluiu: ${mission}${xpBit}. Continue firme no caminho.`,
    },
    fitness: {
      titulo: "Série fechada",
      corpo: `${addr}${mission} feito${xpBit}. Recuperação e próximo estímulo.`,
    },
    financeiro: {
      titulo: "Meta liquidada",
      corpo: `${addr}${mission} concluído${xpBit}. Capital de disciplina sobe.`,
    },
    classico: {
      titulo: "Desafio concluído",
      corpo: `${addr}você fechou: ${mission}${xpBit}. A jornada continua.`,
    },
  };

  return bySlug[slug] ?? bySlug.classico;
}

function voiceChallengeExpired(
  slug: string,
  name: string | null,
  subject: string | null,
): CharlieVoiceOutput {
  const mission = subject || "o desafio";
  const addr = name ? `${name}. ` : "";

  const bySlug: Record<string, CharlieVoiceOutput> = {
    militar: {
      titulo: "Prazo encerrado",
      corpo: `${addr}${mission} expirou. Sem drama — reabra o mentor e retome.`,
    },
    estoico: {
      titulo: "O prazo passou",
      corpo: `${addr}${mission} encerrou. Aceite o fato. O próximo ato ainda é seu.`,
    },
    empresarial: {
      titulo: "Sprint vencido",
      corpo: `${addr}${mission} expirou. Replaneje e reabra no mentor.`,
    },
    cristao: {
      titulo: "Janela fechou",
      corpo: `${addr}${mission} passou. Levante-se sem vergonha — e volte.`,
    },
    fitness: {
      titulo: "Série perdida",
      corpo: `${addr}${mission} expirou. Volte à base e recomece limpo.`,
    },
    financeiro: {
      titulo: "Prazo estourado",
      corpo: `${addr}${mission} expirou. Ajuste e reabra a operação no mentor.`,
    },
    classico: {
      titulo: "Desafio expirado",
      corpo: `${addr}${mission} passou do prazo. A jornada segue — volte ao mentor.`,
    },
  };

  return bySlug[slug] ?? bySlug.classico;
}

function voiceAgent(
  slug: string,
  name: string | null,
  kind: string | null | undefined,
  subject: string | null,
  weekdayWeak: string | null | undefined,
  fallbackTitulo: string,
  fallbackCorpo?: string,
  identityCodigo?: string | null,
  identityInimigo?: string | null,
): CharlieVoiceOutput {
  const addr = name ? `${name}. ` : "";
  const k = (kind ?? "").trim();
  const id = identityTail(identityCodigo, identityInimigo);

  if (k === "streak_protect") {
    const weak =
      weekdayWeak && weekdayWeak.trim()
        ? ` Padrão fraco: ${weekdayWeak.trim()}.`
        : "";
    const bySlug: Record<string, CharlieVoiceOutput> = {
      militar: {
        titulo: "Proteja a sequência",
        corpo: `${addr}streak sob ameaça.${weak} Um hábito. Agora.${id}`,
      },
      estoico: {
        titulo: "Proteja o que construiu",
        corpo: `${addr}a sequência pede um ato sob seu controle.${weak}${id}`,
      },
      empresarial: {
        titulo: "Proteja o ativo",
        corpo: `${addr}risco alto na sequência.${weak} Feche um hábito hoje.${id}`,
      },
      cristao: {
        titulo: "Guarde a corrente",
        corpo: `${addr}sua sequência precisa de fidelidade hoje.${weak}${id}`,
      },
      fitness: {
        titulo: "Não quebre o ciclo",
        corpo: `${addr}streak em risco.${weak} Um check segura o progresso.${id}`,
      },
      financeiro: {
        titulo: "Preserve a série",
        corpo: `${addr}risco na sequência.${weak} Quite um hábito hoje.${id}`,
      },
      classico: {
        titulo: "Proteja sua sequência",
        corpo: `${addr}a corrente está sob pressão.${weak} Um hábito hoje segura o ritmo.${id}`,
      },
    };
    return bySlug[slug] ?? bySlug.classico;
  }

  if (k === "checkin_nudge") {
    const bySlug: Record<string, CharlieVoiceOutput> = {
      militar: {
        titulo: "Check-in",
        corpo: `${addr}registre o estado do dia. Sem check-in, operamos às cegas.`,
      },
      estoico: {
        titulo: "Olhe para dentro",
        corpo: `${addr}um check-in curto. Nomeie sono, energia e humor — depois aja.`,
      },
      empresarial: {
        titulo: "Status do dia",
        corpo: `${addr}faça o check-in. Sem dado, sem gestão.`,
      },
      cristao: {
        titulo: "Pause e veja",
        corpo: `${addr}um check-in sincero. Clareza também é cuidado.`,
      },
      fitness: {
        titulo: "Leitura do dia",
        corpo: `${addr}check-in: sono, energia, humor. Ajuste o treino do dia com isso.`,
      },
      financeiro: {
        titulo: "Fechamento diário",
        corpo: `${addr}registre o check-in. Número e estado — depois a execução.`,
      },
      classico: {
        titulo: "Check-in do dia",
        corpo: `${addr}como você chegou hoje? Um check-in curto basta.`,
      },
    };
    return bySlug[slug] ?? bySlug.classico;
  }

  if (k === "cf_habit_hint") {
    const hint = "um hábito extra na mesma trilha";
    const bySlug: Record<string, CharlieVoiceOutput> = {
      militar: {
        titulo: "Sugestão tática",
        corpo: `${addr}considere: ${hint}. Avalie e execute se couber.`,
      },
      estoico: {
        titulo: "Uma ideia útil",
        corpo: `${addr}homens no mesmo caminho usam: ${hint}. Tome o que for virtude para você.`,
      },
      empresarial: {
        titulo: "Sinal de peers",
        corpo: `${addr}padrão observado: ${hint}. Teste se elevar o output.`,
      },
      cristao: {
        titulo: "Uma trilha possível",
        corpo: `${addr}outros na jornada praticam: ${hint}. Discernimento e ação.`,
      },
      fitness: {
        titulo: "Ideia de protocolo",
        corpo: `${addr}peers usam: ${hint}. Adapte ao seu corpo.`,
      },
      financeiro: {
        titulo: "Benchmark de hábito",
        corpo: `${addr}padrão comum: ${hint}. Adote se melhorar seu sistema.`,
      },
      classico: {
        titulo: "Ideia da trilha",
        corpo: `${addr}quem caminha parecido costuma usar: ${hint}.`,
      },
    };
    return bySlug[slug] ?? bySlug.classico;
  }

  // fallback agent / unknown kind — still Charlie-ish wrap
  return {
    titulo: fallbackTitulo.replace(/^Iniciativa:\s*/i, "") || "Charlie",
    corpo: (subject || fallbackCorpo || fallbackTitulo).trim(),
  };
}

/** Intensidade a partir de scores ML (0–1). */
export function intensityFromRisks(
  riscoStreak?: number | null,
  riscoAbandono?: number | null,
): CharlieVoiceIntensity {
  const a = riscoAbandono ?? 0;
  const s = riscoStreak ?? 0;
  if (a >= 0.55 || s >= 0.55) return "high";
  if (a >= 0.35 || s >= 0.35) return "normal";
  return "soft";
}

export function isCharlieVoiceTipo(tipo: string): tipo is CharlieVoiceTipo {
  return (
    tipo === "mentor_challenge" ||
    tipo === "mentor_challenge_done" ||
    tipo === "mentor_challenge_expired" ||
    tipo === "habit_reminder" ||
    tipo === "streak_risk" ||
    tipo === "agent_initiative"
  );
}
