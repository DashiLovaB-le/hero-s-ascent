/**
 * Fichas de sabedoria do Charlie — princípios reescritos (não texto de livro).
 * Fontes inspiradoras: Clear, Duhigg, Brown, Marco Aurélio, Holiday.
 */
export type WisdomSource =
  | "habitos_atomicos"
  | "poder_do_habito"
  | "coragem_imperfeito"
  | "meditacoes"
  | "obstaculo_caminho";

export type WisdomCardSeed = {
  slug: string;
  source: WisdomSource;
  titulo: string;
  principio: string;
  quando_usar: string;
  quando_evitar: string;
  tags: string[];
  keywords: string[];
  blocked_personalities: string[];
  priority: number;
};

export const WISDOM_SOURCE_LABEL: Record<WisdomSource, string> = {
  habitos_atomicos: "Hábitos Atômicos (inspirado)",
  poder_do_habito: "O Poder do Hábito (inspirado)",
  coragem_imperfeito: "A Coragem de Ser Imperfeito (inspirado)",
  meditacoes: "Meditações (Marco Aurélio)",
  obstaculo_caminho: "O Obstáculo é o Caminho (inspirado)",
};

export const CHARLIE_WISDOM_SEED: WisdomCardSeed[] = [
  // —— Hábitos Atômicos ——
  {
    slug: "ha-1-porcento",
    source: "habitos_atomicos",
    titulo: "1% por dia",
    principio:
      "Melhoria pequena e repetida supera motivação intensa. O herói não precisa de um dia perfeito — precisa do próximo passo mínimo.",
    quando_usar: "Quando o herói quer mudar tudo de uma vez ou se cobra demais.",
    quando_evitar: "Não use para justificar acomodação sem ação concreta.",
    tags: ["habito", "identidade", "foco"],
    keywords: ["melhorar", "começar", "motivação", "perfeccionismo", "pequeno", "passo"],
    blocked_personalities: [],
    priority: 10,
  },
  {
    slug: "ha-identidade",
    source: "habitos_atomicos",
    titulo: "Vire o tipo de homem que faz",
    principio:
      "O hábito dura mais quando reforça identidade: não 'quero correr', e sim 'sou alguém que não pula o treino'. Cada check-in é um voto nessa identidade.",
    quando_usar: "Metas vagas, falta de consistência, herói falando só de resultado.",
    quando_evitar: "Não force identidade se o herói ainda está ferido ou em crise.",
    tags: ["identidade", "habito"],
    keywords: ["quem sou", "identidade", "consistência", "virar", "homem"],
    blocked_personalities: [],
    priority: 12,
  },
  {
    slug: "ha-ambiente",
    source: "habitos_atomicos",
    titulo: "Ambiente vence força de vontade",
    principio:
      "Facilite o bem e dificulte o mal: deixe o gatilho à vista, remova a tentação do caminho. Força de vontade é recurso escasso.",
    quando_usar: "Relapsos noturnos, celular, comida, preguiça de começar.",
    quando_evitar: "Não culpe só o ambiente se o herói precisa de compromisso moral claro.",
    tags: ["ambiente", "habito", "sinal"],
    keywords: ["ambiente", "tentação", "celular", "vontade", "fácil", "difícil"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ha-dois-minutos",
    source: "habitos_atomicos",
    titulo: "Regra dos dois minutos",
    principio:
      "A porta de entrada do hábito deve caber em dois minutos. Vestir o tênis já conta. Depois a sessão cresce sozinha.",
    quando_usar: "Herói travado para começar; hábito novo pesado demais.",
    quando_evitar: "Não reduza um compromisso sério já em andamento a desculpa de 'só 2 min' eternamente.",
    tags: ["habito", "foco"],
    keywords: ["começar", "travado", "procrastinar", "difícil", "iniciar", "preguiça"],
    blocked_personalities: [],
    priority: 11,
  },
  {
    slug: "ha-nao-quebre",
    source: "habitos_atomicos",
    titulo: "Não quebre a corrente duas vezes",
    principio:
      "Errar um dia é humano. Errar dois seguidos vira identidade nova. O objetivo após a queda é voltar amanhã — não se punir.",
    quando_usar: "Streak quebrado, culpa, 'já era o mês'.",
    quando_evitar: "Não normalize falhar todos os dias sem plano de retorno.",
    tags: ["queda", "habito", "streak"],
    keywords: ["streak", "falhei", "quebrei", "perdi", "culpa", "voltar", "amanhã"],
    blocked_personalities: [],
    priority: 13,
  },
  {
    slug: "ha-habito- fortaleza",
    source: "habitos_atomicos",
    titulo: "Empilhe no que já funciona",
    principio:
      "Anexe o hábito novo a um ritual que já existe: depois do café, abro o app; depois do banho, treino. A rotina antiga carrega a nova.",
    quando_usar: "Criar hábito novo; habit_suggestion; manhãs bagunçadas.",
    quando_evitar: "Não empilhe em rotina instável que o herói quase nunca faz.",
    tags: ["habito", "sinal"],
    keywords: ["depois de", "rotina", "manhã", "empilhar", "novo hábito", "anexar"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "ha-atrativo",
    source: "habitos_atomicos",
    titulo: "Torne o bem atrativo",
    principio:
      "Pareie o hábito difícil com algo que o herói gosta (música, podcast, local). Atratividade aumenta adesão sem mentir sobre o esforço.",
    quando_usar: "Treino chato, estudo pesado, resistência emocional ao hábito.",
    quando_evitar: "Não transforme recompensa em fuga (ex.: scroll infinito 'como prêmio').",
    tags: ["recompensa", "habito"],
    keywords: ["chato", "ódio", "não gosto", "treino", "estudar", "motivação"],
    blocked_personalities: [],
    priority: 7,
  },
  {
    slug: "ha-satisfacao",
    source: "habitos_atomicos",
    titulo: "Feche o ciclo com satisfação",
    principio:
      "O cérebro repete o que se sente recompensado. Marcar no app, sentir o XP, anotar 'feito' — satisfação imediata ancora o hábito.",
    quando_usar: "Herói faz mas não registra; hábitos sem feedback.",
    quando_evitar: "Não empurre dopamina vazia sem o ato real.",
    tags: ["recompensa", "habito"],
    keywords: ["marquei", "xp", "não registrei", "esquecí marcar", "satisfação"],
    blocked_personalities: [],
    priority: 7,
  },
  {
    slug: "ha-sistema",
    source: "habitos_atomicos",
    titulo: "Sistemas > metas soltas",
    principio:
      "Meta aponta o destino; sistema é o que você faz segunda a sexta. Sem sistema, a meta vira cobrança sem método.",
    quando_usar: "Só fala de meta grande; sem hábitos ligados; frustração com resultado.",
    quando_evitar: "Não despreze a meta — ela ainda orienta o norte.",
    tags: ["habito", "foco", "identidade"],
    keywords: ["meta", "sistema", "plano", "resultado", "objetivo", "norte"],
    blocked_personalities: [],
    priority: 10,
  },
  {
    slug: "ha-padrao",
    source: "habitos_atomicos",
    titulo: "Você é a média do que repete",
    principio:
      "O padrão diário revela o homem real mais que a intenção. Observe a semana, não o discurso de domingo.",
    quando_usar: "Herói se descreve diferente do que os hábitos mostram.",
    quando_evitar: "Não use para humilhar; use para espelhar com respeito.",
    tags: ["identidade", "habito", "carater"],
    keywords: ["padrão", "semana", "realmente", "discurso", "ação"],
    blocked_personalities: [],
    priority: 8,
  },

  // —— O Poder do Hábito ——
  {
    slug: "ph-loop",
    source: "poder_do_habito",
    titulo: "Sinal → rotina → recompensa",
    principio:
      "Todo hábito tem um gatilho, uma rotina e uma recompensa. Para mudar, mantenha o sinal e a recompensa quando puder — troque a rotina.",
    quando_usar: "Vício leve, compulsão, 'não consigo parar', troca de comportamento.",
    quando_evitar: "Não simplifique vícios clínicos graves — oriente buscar ajuda humana se for o caso.",
    tags: ["loop", "habito", "sinal", "recompensa"],
    keywords: ["vício", "compulsão", "não consigo", "parar", "gatilho", "loop", "automático"],
    blocked_personalities: [],
    priority: 12,
  },
  {
    slug: "ph-chave",
    source: "poder_do_habito",
    titulo: "Ache o hábito-chave",
    principio:
      "Um hábito âncora (sono, treino, oração, ordem matinal) puxa outros. Prefira fortalecer um pilar a espalhar dez fracos.",
    quando_usar: "Muitos hábitos, pouco progresso; herói sobrecarregado.",
    quando_evitar: "Não ignore hábitos secundários que o herói já domina bem.",
    tags: ["habito", "foco"],
    keywords: ["muitos hábitos", "sobrecarga", "prioridade", "pilar", "âncora", "chave"],
    blocked_personalities: [],
    priority: 10,
  },
  {
    slug: "ph-desejo",
    source: "poder_do_habito",
    titulo: "O desejo alimenta o loop",
    principio:
      "A recompensa cria expectativa. Nomeie o que o herói realmente busca (alívio, status, paz) para desenhar uma rotina limpa que entregue isso.",
    quando_usar: "Herói sabe o que faz de errado mas não por quê.",
    quando_evitar: "Não psicologize demais sem ação.",
    tags: ["loop", "recompensa"],
    keywords: ["por que", "alívio", "ansiedade", "quero", "necessidade", "fome"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "ph-troca-rotina",
    source: "poder_do_habito",
    titulo: "Troque a rotina, não o desejo",
    principio:
      "Se o sinal é estresse e a recompensa é alívio, a rotina pode ser caminhada ou respiração em vez de scroll. O desejo permanece; o caminho muda.",
    quando_usar: "Substituição de mau hábito; noites ruins; estresse.",
    quando_evitar: "Não proponha substituto impossível no contexto dele.",
    tags: ["loop", "queda", "habito"],
    keywords: ["substituir", "em vez de", "estresse", "scroll", "ansioso", "parar de"],
    blocked_personalities: [],
    priority: 11,
  },
  {
    slug: "ph-craving",
    source: "poder_do_habito",
    titulo: "Antecipe o craving",
    principio:
      "O impulso avisa antes do ato. Ter um plano 'quando X, faço Y' corta o piloto automático.",
    quando_usar: "Recaídas previsíveis (sexta, noite, após trabalho).",
    quando_evitar: "Não invente gatilhos que não estão no contexto.",
    tags: ["sinal", "loop", "foco"],
    keywords: ["vontade", "impulso", "sexta", "à noite", "depois do", "sempre que"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ph-grupo",
    source: "poder_do_habito",
    titulo: "Comunidade reforça hábito",
    principio:
      "Quem vê o herói (conta, mentor, parceiro) aumenta a chance de manter. Responsabilidade externa é aliada, não fraqueza.",
    quando_usar: "Solidão na jornada; pedido de accountability.",
    quando_evitar: "Não pressione exposição pública se o herói pediu privacidade.",
    tags: ["habito", "carater"],
    keywords: ["sozinho", "ninguém", "cobrar", "parceiro", "accountability", "grupo"],
    blocked_personalities: [],
    priority: 6,
  },
  {
    slug: "ph-crise",
    source: "poder_do_habito",
    titulo: "Crise revela o hábito real",
    principio:
      "Sob pressão, aparece o padrão automático. Use a crise como diagnóstico do loop — depois treine a resposta nova em calma.",
    quando_usar: "Queda após stress, briga, trabalho pesado.",
    quando_evitar: "Não explore a dor; foque no próximo treino do padrão.",
    tags: ["queda", "loop", "obstaculo"],
    keywords: ["crise", "pressão", "estresse", "explodiu", "perdi o controle"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "ph-pequenas-vitorias",
    source: "poder_do_habito",
    titulo: "Pequenas vitórias mudam a narrativa",
    principio:
      "Uma sequência curta de acertos reconstrói a crença de que mudança é possível. Comece onde a vitória é quase certa.",
    quando_usar: "Desânimo, 'não adianta', risco de abandono.",
    quando_evitar: "Não celebre vitória falsa sem evidência no app.",
    tags: ["habito", "identidade", "queda"],
    keywords: ["desânimo", "não adianta", "impossível", "desisti", "vontade zero"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ph-sonho-vs-rotina",
    source: "poder_do_habito",
    titulo: "Rotina protege o sonho",
    principio:
      "Sonho sem rotina vira fantasia. A rotina chata é o preço do homem que ele quer ser.",
    quando_usar: "Muito discurso, pouca execução.",
    quando_evitar: "Não mate a visão — ancore-a em ação.",
    tags: ["habito", "foco", "carater"],
    keywords: ["sonho", "um dia", "quero ser", "falar", "fazer", "rotina"],
    blocked_personalities: [],
    priority: 7,
  },
  {
    slug: "ph-automático",
    source: "poder_do_habito",
    titulo: "Piloto automático se treina",
    principio:
      "No início exige atenção; depois o corpo executa. Aceite a fase difícil como instalação do hábito, não como sinal de que 'não é pra você'.",
    quando_usar: "Herói desiste na 2ª semana porque 'ainda custa'.",
    quando_evitar: "Não minimize dor real ou lesão.",
    tags: ["habito", "disciplina"],
    keywords: ["difícil", "ainda custa", "não natural", "semana", "cansado de forçar"],
    blocked_personalities: [],
    priority: 8,
  },

  // —— A Coragem de Ser Imperfeito ——
  {
    slug: "ci-vulneravel",
    source: "coragem_imperfeito",
    titulo: "Vulnerabilidade com responsabilidade",
    principio:
      "Admitir fraqueza não é drama — é honestidade que permite corrigir a rota. Coragem é aparecer incompleto e ainda assim agir.",
    quando_usar: "Vergonha, 'não posso falhar', perfeccionismo paralisante.",
    quando_evitar: "Não incentive vitimismo ou desabafo sem próximo passo.",
    tags: ["vulnerabilidade", "carater", "queda"],
    keywords: ["vergonha", "fraco", "medo", "não posso", "perfeito", "expor"],
    blocked_personalities: [],
    priority: 11,
  },
  {
    slug: "ci-vergonha",
    source: "coragem_imperfeito",
    titulo: "Vergonha trava; responsabilidade libera",
    principio:
      "Vergonha diz 'eu sou o erro'. Responsabilidade diz 'eu fiz algo e posso reparar'. Separe o homem do episódio.",
    quando_usar: "Culpa destrutiva após falha de hábito ou meta.",
    quando_evitar: "Não absolva escolha consciente repetida sem cobrança.",
    tags: ["queda", "vulnerabilidade", "carater"],
    keywords: ["culpa", "vergonha", "sou um lixo", "inútil", "fracassei"],
    blocked_personalities: [],
    priority: 12,
  },
  {
    slug: "ci-bastante",
    source: "coragem_imperfeito",
    titulo: "Suficiente para começar",
    principio:
      "Esperar se sentir 'pronto' eterniza a espera. O herói age com o suficiente de hoje e refina no caminho.",
    quando_usar: "Procrastinação por medo de não estar pronto.",
    quando_evitar: "Não incentive imprudência em decisões irreversíveis graves.",
    tags: ["foco", "vulnerabilidade"],
    keywords: ["pronto", "ainda não", "quando eu", "esperar", "inseguro"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ci-comparacao",
    source: "coragem_imperfeito",
    titulo: "Comparação rouba a jornada",
    principio:
      "A jornada do outro não é o mapa dele. Compare-se com o homem de ontem, não com o highlight alheio.",
    quando_usar: "Inveja, redes, 'todo mundo consegue menos eu'.",
    quando_evitar: "Não isole o herói — comunidade saudável ainda importa.",
    tags: ["carater", "identidade"],
    keywords: ["comparar", "redes", "todo mundo", "inveja", "melhor que eu"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "ci-limites",
    source: "coragem_imperfeito",
    titulo: "Limite é força",
    principio:
      "Dizer não protege o sim que importa. Sem limite, o herói se espalha e não honra o compromisso central.",
    quando_usar: "Sobrecarga, agradar demais, muitos hábitos/metas.",
    quando_evitar: "Não use para justificar fuga de dever real.",
    tags: ["foco", "carater"],
    keywords: ["não consigo dizer não", "sobrecarregado", "demais", "limite", "cansado de gente"],
    blocked_personalities: [],
    priority: 7,
  },
  {
    slug: "ci-compaixao",
    source: "coragem_imperfeito",
    titulo: "Firmeza com bondade",
    principio:
      "Cobrar sem desprezar. O mentor (e o herói consigo) pode ser rigoroso e humano no mesmo gesto.",
    quando_usar: "Autocrítica agressiva; tom de ódio interno.",
    quando_evitar: "Não transforme bondade em permissividade mole.",
    tags: ["vulnerabilidade", "carater", "queda"],
    keywords: ["me odeio", "sou fraco", "não mereço", "duro comigo", "autocrítica"],
    blocked_personalities: [],
    priority: 10,
  },
  {
    slug: "ci-pertencer",
    source: "coragem_imperfeito",
    titulo: "Pertencer sem se anular",
    principio:
      "Encaixar-se traindo os valores custa caro. Melhor poucos vínculos verdadeiros do que plateia que exige máscara.",
    quando_usar: "Pressão social, medo de julgamento, autenticidade.",
    quando_evitar: "Não incentive isolamento hostil.",
    tags: ["carater", "vulnerabilidade"],
    keywords: ["julgamento", "máscara", "agradar", "aceitação", "falso"],
    blocked_personalities: [],
    priority: 6,
  },
  {
    slug: "ci-coragem-diaria",
    source: "coragem_imperfeito",
    titulo: "Coragem é prática diária",
    principio:
      "Coragem não é um dia épico — é marcar o hábito mesmo com medo, enviar a mensagem difícil, voltar depois da queda.",
    quando_usar: "Medo de agir; evitar conversas/hábitos por ansiedade.",
    quando_evitar: "Não romantize sofrimento desnecessário.",
    tags: ["vulnerabilidade", "disciplina", "habito"],
    keywords: ["medo", "ansiedade", "evitar", "coragem", "travado"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ci-inteireza",
    source: "coragem_imperfeito",
    titulo: "Inteireza > imagem",
    principio:
      "Alinhar o que sente, fala e faz. Imagem perfeita sem coerência interna acaba em colapso.",
    quando_usar: "Herói performa progresso sem viver o processo.",
    quando_evitar: "Não acuse sem evidência no contexto.",
    tags: ["carater", "identidade"],
    keywords: ["aparência", "imagem", "mentindo pra mim", "coerência", "falso progresso"],
    blocked_personalities: [],
    priority: 7,
  },
  {
    slug: "ci-pedir-ajuda",
    source: "coragem_imperfeito",
    titulo: "Pedir ajuda é estratégia",
    principio:
      "Herói solo até onde dá. Pedir apoio (mentor, amigo, profissional) é inteligência, não derrota.",
    quando_usar: "Isolamento, sobrecarga emocional, pedido implícito de suporte.",
    quando_evitar: "Não substitua cuidado clínico quando o caso exigir.",
    tags: ["vulnerabilidade", "carater"],
    keywords: ["sozinho", "ajuda", "não aguento", "suporte", "ninguém"],
    blocked_personalities: [],
    priority: 8,
  },

  // —— Meditações ——
  {
    slug: "ma-controle",
    source: "meditacoes",
    titulo: "Separe o que controla",
    principio:
      "Ação, atitude e esforço estão sob comando. Resultado alheio, clima e passado não. Gaste força só no primeiro grupo.",
    quando_usar: "Ansiedade com resultado, controle externo, ruminação.",
    quando_evitar: "Não use para omitir responsabilidade onde ele tem agência.",
    tags: ["foco", "disciplina", "carater"],
    keywords: ["ansiedade", "controle", "não depende", "resultado", "preocupado"],
    blocked_personalities: [],
    priority: 12,
  },
  {
    slug: "ma-amanhecer",
    source: "meditacoes",
    titulo: "Levante para a obra",
    principio:
      "O amanhecer pede o trabalho do homem, não o conforto eterno. Disciplina matinal honra a jornada.",
    quando_usar: "Preguiça matinal, adiamento, presença morning.",
    quando_evitar: "Não ignore exaustão real ou noites sem sono no check-in.",
    tags: ["disciplina", "habito"],
    keywords: ["manhã", "acordar", "preguiça", "cama", "adiar"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ma-obstaculo-interno",
    source: "meditacoes",
    titulo: "O obstáculo pede virtude",
    principio:
      "O que impede a ação direta vira matéria para paciência, coragem ou justiça. O bloqueio treina o caráter.",
    quando_usar: "Travamento, frustração com obstáculo externo.",
    quando_evitar: "Não romantize injustiça grave; oriente ação possível.",
    tags: ["obstaculo", "carater"],
    keywords: ["impede", "bloqueio", "frustrado", "não consigo por causa"],
    blocked_personalities: [],
    priority: 10,
  },
  {
    slug: "ma-breve",
    source: "meditacoes",
    titulo: "A vida é breve — aja",
    principio:
      "O tempo passa. Adiar o essencial é gastar a vida em ensaio. Faça hoje o que o homem futuro agradecerá.",
    quando_usar: "Procrastinação crônica, 'depois eu vejo'.",
    quando_evitar: "Não pressione em luto ou crise aguda sem cuidado.",
    tags: ["foco", "disciplina"],
    keywords: ["depois", "adiar", "tempo", "procrastinar", "um dia"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "ma-opiniao",
    source: "meditacoes",
    titulo: "Opinião alheia não governa",
    principio:
      "O julgamento externo é ruído se a consciência está limpa. Faça o certo; deixe a plateia com a plateia.",
    quando_usar: "Medo do que vão pensar; vergonha social.",
    quando_evitar: "Não ignore feedback legítimo de quem o herói escolheu ouvir.",
    tags: ["carater", "foco"],
    keywords: ["vão pensar", "julgam", "opinião", "vergonha social", "plateia"],
    blocked_personalities: [],
    priority: 7,
  },
  {
    slug: "ma-presente",
    source: "meditacoes",
    titulo: "Só o presente é seu",
    principio:
      "Passado não se reedita; futuro não se controla. A virtude cabe no ato de agora — neste hábito, nesta escolha.",
    quando_usar: "Ruminação, ansiedade futura, arrependimento.",
    quando_evitar: "Não impeça planejamento saudável de metas.",
    tags: ["foco", "disciplina"],
    keywords: ["passado", "futuro", "arrependido", "ansioso", "agora"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ma-irritacao",
    source: "meditacoes",
    titulo: "A raiva custa mais que o dano",
    principio:
      "Irritação prolongada rouba clareza. Nomeie o fato, escolha a resposta útil, solte o resto.",
    quando_usar: "Raiva, briga, humor baixo no check-in.",
    quando_evitar: "Não invalide limites saudáveis diante de abuso.",
    tags: ["carater", "disciplina"],
    keywords: ["raiva", "irritado", "ódio", "explodir", "bravo"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "ma-dever",
    source: "meditacoes",
    titulo: "Faça a parte que cabe",
    principio:
      "Cada homem tem uma obra diante de si. Cumprir a parte — hábito, palavra, cuidado — é suficiente e nobre.",
    quando_usar: "Comparação de papel, 'meu esforço é pequeno'.",
    quando_evitar: "Não use para justificar mediocridade escolhida.",
    tags: ["carater", "disciplina", "identidade"],
    keywords: ["dever", "minha parte", "obrigação", "missão", "papel"],
    blocked_personalities: [],
    priority: 7,
  },
  {
    slug: "ma-aceitacao",
    source: "meditacoes",
    titulo: "Aceite o fato, escolha a postura",
    principio:
      "Aceitar o que é não é desistir — é parar de guerrear contra a realidade para guerrear pelo próximo passo.",
    quando_usar: "Negação, luta inútil contra fato consumado.",
    quando_evitar: "Não confunda aceitação com passividade covarde.",
    tags: ["obstaculo", "carater"],
    keywords: ["aceitar", "aconteceu", "não tem jeito", "realidade", "fato"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "ma-serenidade",
    source: "meditacoes",
    titulo: "Serenidade é força quieta",
    principio:
      "Calma não é fraqueza. É domínio. O herói estável decide melhor sob fogo.",
    quando_usar: "Agitação, pânico, decisão impulsiva.",
    quando_evitar: "Não peça serenidade falsa — peça respiração e ação.",
    tags: ["disciplina", "carater"],
    keywords: ["calma", "pânico", "ansioso", "impulsivo", "sereno"],
    blocked_personalities: [],
    priority: 8,
  },

  // —— O Obstáculo é o Caminho ——
  {
    slug: "oc-caminho",
    source: "obstaculo_caminho",
    titulo: "O obstáculo é o caminho",
    principio:
      "O que bloqueia pode virar o treino. Em vez de esperar condições ideais, use a dificuldade como método.",
    quando_usar: "Meta travada, reclamação de circunstâncias.",
    quando_evitar: "Não force positividade tóxica em trauma recente.",
    tags: ["obstaculo", "foco"],
    keywords: ["obstáculo", "travado", "não consigo", "barreira", "impedimento"],
    blocked_personalities: [],
    priority: 13,
  },
  {
    slug: "oc-percepcao",
    source: "obstaculo_caminho",
    titulo: "Mude a percepção primeiro",
    principio:
      "Antes de mudar o mundo, mude a leitura do evento. O mesmo fato pode ser insulto ou combustível.",
    quando_usar: "Interpretação catastrófica; vitimismo leve.",
    quando_evitar: "Não gaslight — valide fato, desafie narrativa inútil.",
    tags: ["obstaculo", "foco"],
    keywords: ["parece", "sinto que", "catástrofe", "acabou", "interpretação"],
    blocked_personalities: [],
    priority: 10,
  },
  {
    slug: "oc-acao",
    source: "obstaculo_caminho",
    titulo: "Ação certa sob pressão",
    principio:
      "Com a percepção limpa, aja no pedaço disponível. Movimento pequeno quebra paralisia melhor que plano grandioso parado.",
    quando_usar: "Paralisia, overthinking, medo de errar o plano.",
    quando_evitar: "Não incentive ação cega sem o mínimo de direção.",
    tags: ["obstaculo", "foco", "disciplina"],
    keywords: ["parado", "não sei o que fazer", "travado", "agir", "movimento"],
    blocked_personalities: [],
    priority: 11,
  },
  {
    slug: "oc-vontade",
    source: "obstaculo_caminho",
    titulo: "Vontade quando não há saída fácil",
    principio:
      "Há momentos em que só resta aguentar com dignidade e continuar. Endurecer por escolha é virtude; amargura é opcional.",
    quando_usar: "Situação dura sem atalho; temporada difícil.",
    quando_evitar: "Não glorifique sofrimento evitável.",
    tags: ["obstaculo", "carater", "disciplina"],
    keywords: ["aguentar", "difícil", "não tem saída", "peso", "carregar"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "oc-inverter",
    source: "obstaculo_caminho",
    titulo: "Inverta o problema",
    principio:
      "Pergunte: o que esta dificuldade torna possível treinar? Tempo curto → foco; falha → humildade e ajuste.",
    quando_usar: "Reclamação circular sem aprendizado.",
    quando_evitar: "Não force lição prematura.",
    tags: ["obstaculo", "queda"],
    keywords: ["por que isso", "sempre eu", "aprender", "lição", "sentido"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "oc-energia",
    source: "obstaculo_caminho",
    titulo: "Não gaste energia em protesto inútil",
    principio:
      "Reclamar do obstáculo gasta a energia que bastaria para contorná-lo. Proteste menos; execute o próximo passo útil.",
    quando_usar: "Reclamação repetida; estagnação verbal.",
    quando_evitar: "Não cale pedido legítimo de ajuda ou justiça.",
    tags: ["obstaculo", "foco"],
    keywords: ["reclamar", "injusto", "sempre", "nada funciona", "ódio disso"],
    blocked_personalities: [],
    priority: 9,
  },
  {
    slug: "oc-preparo",
    source: "obstaculo_caminho",
    titulo: "Prepare-se na paz",
    principio:
      "Treine o hábito e o caráter antes da crise. Quem só reage sob fogo improvisou demais.",
    quando_usar: "Herói está estável — moment para fortalecer base.",
    quando_evitar: "Não invente crise.",
    tags: ["disciplina", "habito", "obstaculo"],
    keywords: ["preparar", "antes", "quando vier", "treino", "base"],
    blocked_personalities: [],
    priority: 6,
  },
  {
    slug: "oc-persistencia",
    source: "obstaculo_caminho",
    titulo: "Persistência com ajuste",
    principio:
      "Insistir no objetivo; ajustar o método. Cabeça dura no norte, flexível no caminho.",
    quando_usar: "Falhou o plano A; desânimo após tentativa.",
    quando_evitar: "Não confunda persistência com repetir erro óbvio.",
    tags: ["obstaculo", "foco", "queda"],
    keywords: ["tentei", "não deu", "desistir", "outra forma", "persistir"],
    blocked_personalities: [],
    priority: 10,
  },
  {
    slug: "oc-oportunidade",
    source: "obstaculo_caminho",
    titulo: "Enxergue a porta lateral",
    principio:
      "Às vezes o caminho direto fechou. Procure a lateral: hábito menor, prazo novo, atributo vizinho.",
    quando_usar: "Plano original inviável; precisa de desvio criativo.",
    quando_evitar: "Não desvie do valor central do herói.",
    tags: ["obstaculo", "foco"],
    keywords: ["outro jeito", "alternativa", "plano b", "desvio", "fechou"],
    blocked_personalities: [],
    priority: 8,
  },
  {
    slug: "oc-depois",
    source: "obstaculo_caminho",
    titulo: "Depois do obstáculo, mais forte",
    principio:
      "Se atravessou com virtude, o herói não volta igual. Registre o aprendizado (memória) e siga mais capaz.",
    quando_usar: "Após desafio concluído, meta avançada, recuperação de streak.",
    quando_evitar: "Não declare vitória sem evidência.",
    tags: ["obstaculo", "carater", "identidade"],
    keywords: ["consegui", "passei", "superei", "depois", "mais forte"],
    blocked_personalities: [],
    priority: 7,
  },
];
