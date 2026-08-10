# UPGRADE — Fitness (Charlie + Exercise Engine)

Documento canônico do módulo de **treino em casa com câmera**, evolução do MVP de flexão.  
Alinhado ao código atual (`src/lib/exercise/*`, `exercise.functions.ts`, `exercise-xp.ts`) e a `plans/ExerciciosValidados-Flexao.md`.

| Campo | Valor |
| --- | --- |
| **Status** | Fase 1 código + seeds entregues; Fase 2/3 e aceite device pendentes |
| **Produto** | “Treino com o Charlie” — não biblioteca genérica de academia |
| **Privacidade** | Pose **on-device**; **sem** gravar/enviar vídeo |
| **Base** | MediaPipe PoseLandmarker (já em produção na flexão) |
| **Atualizado** | 2026-08-10 (implementação engine + hub + seeds) |

---

## 1. Decisões travadas

### 1.1 Visão

- Não é “mais uma tela de exercícios”.
- É o **Charlie Fitness** como personal trainer visual + gamificação da Jornada.
- Contagem de reps sozinha não basta a longo prazo; o diferencial é **treino guiado + Jornada + Charlie**.

### 1.2 Arquitetura

- **Um Exercise Engine genérico** — não N sistemas (`pushup.ts`, `squat.ts`…) duplicando câmera/sessão/XP/UI.
- A flexão atual vira o **primeiro `ExerciseDefinition`**.
- Novos exercícios = novas regras biomecânicas + seed em `exercise_types`, reaproveitando pipeline.

### 1.3 Níveis de validação (promessa vs realidade)

| Nível | O que entrega | MVP |
| --- | --- | --- |
| **1 Contagem** | “Fez N reps / N segundos” | Obrigatório |
| **2 Amplitude** | “Não desceu o suficiente” | Obrigatório |
| **3 Forma** | “Joelho entrando” (quando landmarks permitem) | Conservador |
| **4 Coaching** | Cues de ritmo/tronco | Depois da estabilidade 1–2 |
| **5 Score 0–100** | “Execução 87/100” | **Fora** do escopo inicial |

### 1.4 Catálogo de exercícios (ordem de implementação)

Corpo inteiro em casa **sem** puxada/ombro isolado/halteres (limites do Pose 2D).

| # | Slug | Nome | Padrão | Papel no corpo |
| --- | --- | --- | --- | --- |
| 0 | `pushup` | Flexão | Push | Peito / tríceps / ombro |
| 1 | `squat` | Agachamento | Squat | Pernas / glúteo |
| 2 | `plank` | Prancha | Hold | Core |
| 3 | `lunge` | Afundo | Split squat | Pernas / equilíbrio |
| 4 | `situp` | Abdominal | Curl trunk | Core |
| 5 | `glute_bridge` | Elevação de quadril | Hip hinge (supino) | Posterior / glúteo |

**Fora do escopo desta versão:** mountain climber, burpee, jumping jack, shoulder press, remada, curl, kettlebell, corrida.

### 1.5 Fases de entrega

| Fase | Nome | Resultado |
| --- | --- | --- |
| **1** | Exercise Engine | Motor genérico + catálogo acima (ship por exercício) |
| **2** | Workout Engine | Sessão multi-exercício (séries, descanso, sequência) |
| **3** | Charlie Personal Trainer | Charlie monta/adapta treinos com contexto da Jornada |

### 1.6 Acesso na UI (travado)

Dois cards distintos em **`/habits`** — não se misturam:

| Card em `/habits` | Destino | Papel |
| --- | --- | --- |
| **Flexão (atual)** | `/exercises/pushup` | Continua **intacto** — atalho direto para a sessão de flexão (como hoje) |
| **Novo: hub Fitness** | `/fitness` (hub completo) | Porta de entrada do **módulo de treino** (catálogo, treinos, depois Charlie) |

Regras:

- O card de flexão **não** é removido, **não** é substituído pelo hub e **não** muda de destino.
- O hub **não** substitui a rota `/exercises/pushup`; flexão avulsa permanece.
- Outros exercícios avulsos (`/exercises/squat`, etc.) podem ser abertos **a partir do hub** (e, se útil, por deep link); não é obrigatório criar um card por exercício em `/habits`.
- Charlie (Fase 3) pode sugerir treino → abre o mesmo hub/player; isso **não** remove os cards de `/habits`.

```text
/habits
  ├── [Card Flexão] ──────────────► /exercises/pushup   (intacto)
  └── [Card Treino / Fitness] ────► /fitness            (hub completo)
         │
         ├── escolher treino (Fase 2+) ──► player multi-exercício
         ├── exercício avulso ───────────► /exercises/$slug
         └── (Fase 3) sugestão Charlie ──► mesmo player
```

### 1.7 Defaults de produto

| Tema | Default |
| --- | --- |
| Hub `/fitness` | Existe como destino do **novo card**; UI mínima na Fase 1 (lista de exercícios / “em breve treinos”); player multi-exercício na **Fase 2** |
| Ship Fase 1 | Um exercício por vez na ordem da tabela (gate de qualidade antes do próximo) |
| XP | Reutilizar modelo híbrido da flexão (`exercise-xp.ts` + caps por tipo) |
| Hábitos validados | Flexão mantém o hábito/card atuais; hub não exige um hábito “Fitness” genérico no MVP (só o card de navegação) |
| Charlie contexto | Resumo numérico de sessões (nunca vídeo) — Fase 3 prioriza; Fase 1 pode só persistir |

---

## 2. O que teremos ao final

Um módulo **Treino com o Charlie**, acessível assim:

- **`/habits` → card Flexão** → sessão de flexão (fluxo atual, intacto)
- **`/habits` → card Fitness/Treino** → hub `/fitness` (módulo completo)

1. Celular apoiado → câmera valida movimento on-device  
2. Charlie (Fase 3) monta o treino do dia (força, pernas, HIIT leve, corpo inteiro…)  
3. Sessão com séries / reps / descanso / cues  
4. Conclusão → XP, atributos (Força/Disciplina), streak, histórico  
5. Charlie usa histórico para adaptar o próximo treino  

Exemplo de treino corpo inteiro com o catálogo:

```text
AGACHAMENTO  3×12
FLEXÃO       3×8
AFUNDO       2×10
PRANCHA      30s
GLUTE BRIDGE 3×12
```

---

## 3. Estado atual (baseline)

Já existe:

- [x] Schema `exercise_types` / `exercise_sessions` / `exercise_session_metrics`
- [x] Server fns start / complete / cancel / ensure habit
- [x] XP híbrido + cap diário (flexão)
- [x] UI `/exercises/pushup` + modal câmera
- [x] Pipeline pose: framing → calibração → counter → overlay (específico de flexão)
- [x] Engine genérico (`ExerciseDefinition` + registry)
- [x] Slugs: `squat`, `plank`, `lunge`, `situp`, `glute_bridge` (+ `pushup`)
- [x] Hub `/fitness` + card em `/habits`
- [ ] Workout multi-exercício (Fase 2)
- [ ] Charlie montando treinos (Fase 3)

Arquivos âncora:

- `src/lib/exercise/pushup-*.ts`, `pose-landmarker.ts`, `usePushupPoseTracker.ts`
- `src/lib/exercise.functions.ts`, `exercise-xp.ts`
- `src/components/ExerciseSessionCameraModal.tsx`
- `src/routes/_authenticated/exercises.$slug.tsx`
- Migration `20260801134500_validated_exercises_pushup.sql`

---

## 4. To-do detalhado

Convenção: marque `[x]` ao concluir. Itens bloqueados por fase anterior ficam explícitos.

---

### Fase 0 — Contrato e critérios (antes de código grande)

Objetivo: travar regras para não refatorar XP/UI no meio.

- [x] Revisar defaults da §1.7 e anotar exceções neste doc
- [x] **UI `/habits` — dois cards (travado §1.6)**
  - [x] Manter card de **flexão** intacto (copy, destino `/exercises/pushup`, fluxo atual)
  - [x] Criar **novo card** “Charlie Fitness / Treino em casa” → navega para `/fitness`
  - [x] Criar rota shell `/fitness` (lista de exercícios + placeholder treinos)
  - [x] Linkada **somente** pelo novo card (não pelo card de flexão)
- [x] Métricas comuns no contrato de sessão
  - [x] `reps_validas` / `reps_invalidas` (prancha: segundos / quebras via `holdMs`)
  - [x] `duracao_ms`
  - [x] `amplitude_media` (0–100)
  - [x] `forma_pct`
  - [x] `cadencia_rpm` (opcional; n/a em holds)
- [x] Definir contrato `ExerciseDefinition` (TypeScript)
  - [x] `slug`, framing guide, region
  - [x] máquina de estados (fases) + thresholds
  - [x] cues por evento (`deeper`, `hold_break`, …)
  - [x] modo `reps` vs `hold`
- [x] Critérios de “rep válida” / “hold válido” por exercício (v0 no código das defs)
  - [x] `squat`
  - [x] `plank`
  - [x] `lunge` (perna fixa / joelho mais flexionado)
  - [x] `situp`
  - [x] `glute_bridge`
- [x] Copy legal reutilizável (já existe na flexão): estimativa, não médico; nada gravado
- [ ] Critério de aceite por exercício (device real)
  - [ ] Contagem ±2 reps vs contagem humana em 10 reps (reps) **ou** hold ±10% do tempo (prancha)
  - [ ] Framing rejeita corpo cortado
  - [ ] Cancelar / 0 reps → sem XP
  - [ ] Smoke Android APK (Live URL) sem crash de câmera

---

### Fase 1A — Exercise Engine (refator da flexão)

Objetivo: flexão continua funcionando; código deixa de ser “só pushup”.

- [x] Extrair tipos compartilhados
  - [x] `LandmarkPoint`, `LM` indices, math de ângulo → `src/lib/exercise/pose-math.ts`
  - [x] `evaluateFraming` com opção `requireAnkles`
- [x] Criar `ExerciseDefinition` + registry
  - [x] `src/lib/exercise/definitions/types.ts`
  - [x] `src/lib/exercise/definitions/pushup.ts` (wrapper da lógica atual)
  - [x] `src/lib/exercise/registry.ts` → `getExerciseDefinition(slug)`
- [x] Session runner genérico
  - [x] `createGenericExerciseSession` / `sessionFromDefinitionParts`
  - [x] Pushup via wrapper de `createPushupSession` (sem regressão)
- [x] Tracker / overlay genéricos
  - [x] `useExercisePoseTracker({ slug })`
  - [x] `drawExerciseOverlay` (reusa renderer da flexão)
- [x] UI
  - [x] `exercises.$slug.tsx` resolve `def` pelo param; 404 se slug desconhecido
  - [x] Modal de câmera recebe `slug` (reps + hold)
- [x] Testes
  - [x] `pushup-counter.test.ts` continua passando
  - [x] `angle-rep-counter.test.ts` (ciclo down-up)
- [ ] **Gate:** smoke flexão em web + APK (manual)

---

### Fase 1B — Seed + hábitos para novos tipos

Objetivo: banco e hábitos prontos antes da visão de cada movimento.

- [x] Migration `exercise_types` seeds
  - [x] `squat`, `plank`, `lunge`, `situp`, `glute_bridge`
  - [x] Campos: nome, slug, `xp_*`, `sessoes_por_dia_max`, ativo
  - [x] Aplicado no projeto remoto (REST upsert + arquivo `20260810180000_fitness_exercise_types.sql`)
- [x] Zod / server fns existentes aceitam qualquer slug ativo (`ensureValidatedExerciseHabit`)
- [x] **Não** adicionar um card por novo exercício em `/habits` (entrada avulsa no hub; flexão intacta)
- [x] Ranking `/exercises/ranking` continua por slug (não quebra)

---

### Fase 1C — Implementar exercícios (ordem obrigatória)

Código v0 entregue para todos; aceite device ainda pendente.

#### Checklist por exercício (código)

- [x] `ExerciseDefinition` com estados + thresholds v0
- [x] Framing landmarks (corpo inteiro / lado conforme guia)
- [x] Calibração (pose neutra N segundos)
- [x] Contagem **ou** hold estável (nível 1)
- [x] Amplitude / profundidade ou break de hold (nível 2)
- [x] Cues básicos de forma/feedback
- [x] Testes unitários (angle-rep + pushup)
- [x] UI `/exercises/{slug}` via registry
- [ ] Aceite device (§ Fase 0)
- [ ] Ajuste fino thresholds com uso real

#### Ordem

1. [x] **`squat` — Agachamento** (código v0)
2. [x] **`plank` — Prancha** (hold v0)
3. [x] **`lunge` — Afundo** (MVP: joelho mais flexionado)
4. [x] **`situp` — Abdominal** (código v0)
5. [x] **`glute_bridge` — Elevação de quadril** (código v0)

**Gate Fase 1:** código pronto; falta smoke device em `pushup` + `squat` + `plank` antes de tratar Fase 2 como estável.

---

### Fase 2 — Workout Engine

Objetivo: uma sessão = sequência de exercícios, não só um movimento avulso.

#### 2A — Modelo de dados

- [ ] Spec de `workout_templates` (catálogo global ou seed)
  - [ ] id, slug, título, dificuldade, duração alvo, lista ordenada de steps
- [ ] Spec de `workout_sessions`
  - [ ] user_id, template_id (nullable se custom), status, started/ended
  - [ ] steps: exercise_type_id, target reps/hold/sets, rest_ms
- [ ] Spec de progresso do step (ligar a `exercise_sessions` existentes **ou** metrics embutidas)
- [ ] Migration + RLS (padrão: SELECT own; writes service role / server fn)
- [ ] Decisão: treino gera **uma** activity/XP consolidada **ou** XP por exercício (recomendado: consolidada + breakdown)

#### 2B — Server / XP

- [ ] `startWorkout` / `advanceWorkoutStep` / `completeWorkout` / `cancelWorkout`
- [ ] Descanso: timer client-side; server só marca timestamps
- [ ] Cap anti-farm (ex.: N treinos/dia ou teto XP workout)
- [ ] Integração atributos (Força / Disciplina) alinhada a `progress-engine`

#### 2C — UI hub `/fitness` (completo)

O **card novo em `/habits` → `/fitness`** e a lista de exercícios avulsos **já existem** (shell Fase 1). Nesta fase o hub ganha o player de treino.

- [x] Hub `/fitness` shell + lista avulsa
  - [ ] Escolha: Força / Peito e braços / Pernas / Corpo inteiro / Core  
  - [ ] Preview do treino (lista de steps)
  - [x] Lista de exercícios avulsos → `/exercises/$slug`
- [ ] Player de treino
  - [ ] Step atual → abre câmera do `ExerciseDefinition`
  - [ ] Entre steps: tela de descanso + “Próximo”
  - [ ] Fim: resumo XP + reps/holds
- [ ] Histórico curto (últimos treinos)
- [x] Regressão: card de flexão em `/habits` ainda aponta só para `/exercises/pushup`

#### 2D — Templates seed (corpo inteiro)

- [ ] Template **Corpo inteiro 12 min** (usa catálogo §1.4)
- [ ] Template **Pernas**
- [ ] Template **Push + core**
- [ ] (Opcional) dificuldade fácil/médio via reps/hold menores

**Gate Fase 2:** 1 template corpo inteiro completo em device + XP creditado 1×.

---

### Fase 3 — Charlie Personal Trainer

Objetivo: Charlie monta/adapta; não só executa templates fixos.

- [ ] Agregar features de treino (por usuário)
  - [ ] frequência 7d / 30d
  - [ ] volume (reps/hold)
  - [ ] tipos mais feitos / evitados
  - [ ] última sessão (quando / qual template)
- [ ] Bloco no `buildMentorContextBlock` (estilo xadrez: enxuto, sem inventar)
- [ ] Prompt: regras “não invente métricas; use só o bloco”
- [ ] Ação Charlie
  - [ ] Sugerir template existente **ou**
  - [ ] Montar lista de steps a partir do catálogo (JSON tipado)
- [ ] Guardrails
  - [ ] Máx. 1 treino sugerido por resposta
  - [ ] Respeitar dor/check-in baixo (se houver): volume reduzido
  - [ ] Não diagnosticar lesão
- [ ] UI: aceitar sugestão → abre Workout Engine com steps
- [ ] (Opcional) memória `mentor_memories` após treinos consistentes

**Gate Fase 3:** Charlie sugere treino coerente com histórico real; aceitar → sessão jogável.

---

### Fase 4 — Polish / mobile / ops (contínuo)

- [ ] Smoke Capacitor Android para cada slug + 1 workout
- [ ] Framing cues em PT-BR curtos (Gen-Z ok, sem medicalês)
- [ ] Empty states (sem câmera / permissão negada)
- [ ] Dashi: telemetria simples (sessões/tipo/dia) se útil
- [ ] Atualizar `plans/ResumoAplicacao.md` + `ExerciciosValidados-Flexao.md` (status)
- [ ] Remover código morto `pushup-*` se totalmente absorvido pelo engine

---

## 5. Fora de escopo (esta versão)

- Score único 0–100 “qualidade absoluta”
- Biblioteca com dezenas de exercícios
- Detecção de peso/halteres
- Upload de vídeo / cloud pose
- Plano alimentar / BMI médico
- Substituição total de hábitos declarados (eles continuam para sono, leitura, etc.)

---

## 6. Riscos e mitigações

| Risco | Mitigação |
| --- | --- |
| Forma falsa (falso positivo/negativo) | Níveis 1–2 primeiro; cues de forma só com alta confiança |
| Afundo / sit-up instáveis | Enquadramento estrito; MVP perna fixa / range conservador |
| Escopo virar app de academia | Hub Charlie + templates curtos; catálogo fechado §1.4 |
| Regressão na flexão | Gate 1A obrigatório antes de novos slugs |
| Farm de XP | Caps por tipo + cap de workout |

---

## 7. Perguntas em aberto (responder e riscar)

1. ~~**Hub na Fase 1 ou só na 2?**~~ → **Travado:** card + rota `/fitness` desde cedo; player multi-exercício na Fase 2 (§1.6).  
2. **Afundo:** perna fixa (mais estável) ou alternado no MVP?  
3. **XP do workout:** só no fim do treino, ou também por exercício avulso como hoje? (default: avulso na Fase 1; consolidado na Fase 2 quando vier de template)  
4. **Nome do card novo** em `/habits` (ex.: “Treino”, “Fitness”, “Treino com Charlie”)?  
5. ~~**Migrar 100% para `/fitness`?**~~ → **Não.** Flexão e hub convivem.

---

## 8. Ordem de execução sugerida (resumo)

```text
0  Contrato + card hub em /habits (flexão intacta) + shell /fitness
1A Engine genérico (pushup como def)
1B Seeds squat/plank/lunge/situp/glute_bridge
1C squat → plank → lunge → situp → glute_bridge (+ lista no hub)
2  Workout templates + player no /fitness
3  Contexto Charlie + sugestão/adaptação
4  Polish mobile + docs
```

---

*Ao implementar, atualize os checkboxes deste arquivo. Não duplicar plano em outros docs — referenciar este.*
