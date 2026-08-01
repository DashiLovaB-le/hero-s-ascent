# Planejamento — Exercícios Validados (Flexão)

To-do por fases. Marque `[x]` conforme concluir.

**Escopo fechado**
- Primeiro exercício: **flexão**
- Câmera ao vivo para acompanhar a execução
- **Não** salvar vídeo / frames
- **Não** GPS / hábitos medidos por sensor de deslocamento
- Persistir apenas **métricas** da sessão
- Charlie consome o **resumo numérico**, nunca o stream

**Princípio de confiança**
- Hábito declarado (já existe) permanece para ler/água/meditar etc.
- Hábito validado: XP / missão só após sessão fechada com evidência numérica

---

## Fase 0 — Produto e contrato (fundação)

Objetivo: travar regras de negócio e o contrato mínimo da sessão de flexão.

- [x] Documentar tipos de hábito
  - [x] `declared` — check manual (atual)
  - [x] `validated_exercise` — exige sessão (`habits.exercise_type_id`)
- [x] Contrato mínimo da sessão de flexão
  - [x] `reps_validas`
  - [x] `reps_invalidas`
  - [x] `duracao_ms`
  - [x] `amplitude_media` (0–100 ou ângulo normalizado)
  - [x] `forma_pct` (% de reps consideradas corretas)
  - [x] `cadencia_rpm` (opcional no MVP)
  - [x] `fatigue_rep_index` (opcional: rep onde amplitude cai)
- [x] Regras de XP
  - [x] **Híbrido**: `xp_base + xp_por_rep_valida * reps` × fator forma (0.5–1.0), teto `xp_sessao_max`
  - [x] Cap diário: `sessoes_por_dia_max` (seed flexão = 3)
  - [x] Sessão inválida / cancelada / 0 reps → sem XP
- [x] Privacidade / UX legal
  - [x] Consentimento explícito da câmera antes da 1ª sessão (checkbox na página)
  - [x] Copy: “estimativa de execução, não avaliação médica”
  - [x] Texto: vídeo processado só em tempo real no device; nada é gravado
- [ ] Critérios de “rep válida” (flexão) — v0
  - [ ] Ângulos de cotovelo (descida / subida)
  - [ ] Histerese para evitar double-count
  - [ ] Enquadramento mínimo (ombros/quadril/punhos visíveis)

---

## Fase 1 — Schema e API (sem câmera ainda)

Objetivo: persistir sessões e amarrar ao hábito/XP, com fluxo stub.

- [x] Migration Supabase
  - [x] `exercise_types` (seed: `pushup` / flexão)
  - [x] `exercise_sessions`
  - [x] `exercise_session_metrics`
  - [x] `habits.exercise_type_id` + unique (user, type) ativo
  - [x] RLS / grants (SELECT own; writes via service role)
- [x] Tipos gerados / Zod no app
- [x] Server functions
  - [x] `startExerciseSession`
  - [x] `completeExerciseSession`
  - [x] `cancelExerciseSession`
  - [x] `listRecentExerciseSessions` / `ensureValidatedExerciseHabit`
- [x] Integração com hábitos
  - [x] Flag via `exercise_type_id`
  - [x] Bloquear `completeHabit` direto quando validado
  - [x] Auto-criar hábito de flexão na 1ª visita à página
- [x] Stub de UI
  - [x] Card em `/habits` → `/exercises/pushup`
  - [x] Página dedicada com stub de métricas manuais (até Fase 2)
- [ ] Remover stub quando a Fase 2 estiver estável

**Decisões travadas (2026-08-01)**
1. XP híbrido
2. Card em Hábitos → rota `/exercises/$slug`
3. Tipo global em `exercise_types` (igual para todos); hábito por usuário ligado ao tipo

---

## Fase 2 — MVP câmera + pose (flexão)

Objetivo: primeira sessão real sem gravar vídeo.

- [x] Tela `/habits/.../session` ou modal full-screen “Sessão de flexão”
  - [x] Setup: guia de enquadramento (viewfinder) + copy de posicionamento
  - [x] Pedido de permissão de câmera
  - [x] Preview espelhado
  - [x] Controles: Encerrar / Cancelar / Recalibrar (+ troca frontal/traseira)
- [x] Pipeline on-device
  - [x] `getUserMedia` (sem `MediaRecorder`)
  - [x] Pose (MediaPipe PoseLandmarker lite, GPU→CPU fallback)
  - [x] Loop rAF com `detectForVideo` (sem overlap de frames)
  - [x] Garantir: nenhum upload de frame/vídeo
- [x] Motor de reps (flexão v0) + coaching estilo Push Up Boss
  - [x] Fluxo: `framing` → `calibrating` (~3s) → `tracking`
  - [x] Limiares adaptativos ao lockout do herói
  - [x] Contador de reps válidas / inválidas
  - [x] Amplitude por rep + barra de profundidade
  - [x] HUD: contagem + cues de postura + skeleton colorido + flash
- [x] Encerrar sessão
  - [x] Montar payload de métricas (auto, sem input manual)
  - [x] Chamar `completeExerciseSession`
  - [ ] Tela de resumo (reps, amplitude, forma %, tempo, XP)
  - [x] Reusar pop-up de XP cyberpunk se aplicável
- [ ] Qualidade / robustez
  - [x] Detecção de “corpo incompleto no frame” / fora da guia
  - [x] Aviso de pessoa longe/perto (shoulder span)
  - [x] Cancelamento limpo (sem XP)
- [ ] Testes manuais
  - [ ] Android Chrome
  - [ ] iOS Safari
  - [ ] Desktop (dev)

---

## Fase 3 — Forma ao vivo + Charlie treinador

Objetivo: feedback durante a série e memória útil para o Charlie.

- [x] Correções em tempo real (regras v1)
  - [x] “Desça um pouco mais”
  - [x] “Estenda totalmente os braços”
  - [x] “Corpo desalinhado” (quadril/ombro)
- [ ] Métricas extras no resumo
  - [ ] Cadência
  - [ ] Índice de fadiga (queda de amplitude)
- [ ] Contexto do Charlie
  - [ ] Injetar últimas N sessões de flexão no `buildMentorContextBlock`
  - [ ] Prompt: comparar volume, amplitude, tempo vs sessões anteriores
  - [ ] Exemplos de fala: ritmo, fadiga após rep X, tendência semanal
- [ ] Memória / notificação opcional
  - [ ] Ao fechar sessão marcante → memory ou notificação in-app curta

---

## Fase 4 — Progressão, missões e ranking consigo mesmo

Objetivo: transformar evidência em jornada (ainda só flexão, ou +1 exercício se estável).

- [ ] Progressão dinâmica
  - [ ] Meta sugerida da próxima sessão (ex.: +5% reps ou teto fixo semanal)
  - [ ] Integração com desafio do Charlie (opcional: desafio vinculado a sessão validada)
- [ ] Missões comprovadas
  - [ ] Tipo de missão sem botão “Concluir”
  - [ ] Ex.: “40 flexões validadas esta semana”
  - [ ] Progresso só via `exercise_sessions` completed
- [ ] Ranking pessoal (não social)
  - [ ] Recorde de reps numa sessão
  - [ ] Maior volume semanal
  - [ ] Melhor amplitude média
  - [ ] Melhor resistência (reps até queda de amplitude)
- [ ] Atributo Força
  - [ ] Revisar se XP/attr devem ponderar qualidade (`forma_pct`), não só volume

---

## Fase 5 — Expansão (depois da flexão estável)

Só abrir quando o MVP de flexão estiver confiável em mobile real.

- [ ] Critérios de “flexão estável”
  - [ ] Taxa de falso positivo/negativo aceitável em QA interno
  - [ ] Sessões completadas por usuários reais sem suporte excessivo
- [ ] Próximos exercícios (um por vez)
  - [ ] Agachamento **ou** prancha (escolher com base em pose mais simples)
  - [ ] Reusar motor de sessão + trocar só o state machine
- [ ] Biblioteca `exercise_types` + UI de escolha
- [ ] Explicitamente **fora** desta fase
  - [ ] Composição corporal / fotos de progresso de físico
  - [ ] Upload de vídeo para cloud vision
  - [ ] Ranking entre usuários

---

## Checklist técnico transversal (todas as fases)

- [ ] Zero `MediaRecorder` / zero Storage de mídia de exercício
- [ ] Consentimento versionado por sessão
- [ ] Telemetria de erros de pose (sem PII visual)
- [ ] Feature flag `EXERCISE_VALIDATION_ENABLED`
- [ ] Documentar no `.env.example` qualquer chave/modelo local necessário
- [ ] Atualizar `plans/ResumoAplicacao.md` quando a feature entrar em prod

---

## Ordem sugerida de execução

1. Fase 0 (contrato)  
2. Fase 1 (schema + XP stub)  
3. Fase 2 (câmera + flexão) ← **primeiro valor de usuário**  
4. Fase 3 (forma + Charlie)  
5. Fase 4 (missões / progressão / records)  
6. Fase 5 (novos exercícios)

---

## Notas

- Preferir **sempre** pose on-device; cloud LLM só para texto do Charlie a partir de métricas.
- Se iOS limitar demais a pose, manter fallback “modo assistido” (câmera ligada + confirmação manual de rep) sem quebrar o hábito validado.
- Não misturar com GPS neste plano.
