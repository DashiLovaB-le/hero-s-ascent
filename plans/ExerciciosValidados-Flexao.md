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

- [ ] Documentar tipos de hábito
  - [ ] `declared` — check manual (atual)
  - [ ] `validated_exercise` — exige sessão
- [ ] Contrato mínimo da sessão de flexão
  - [ ] `reps_validas`
  - [ ] `reps_invalidas`
  - [ ] `duracao_ms`
  - [ ] `amplitude_media` (0–100 ou ângulo normalizado)
  - [ ] `forma_pct` (% de reps consideradas corretas)
  - [ ] `cadencia_rpm` (opcional no MVP)
  - [ ] `fatigue_rep_index` (opcional: rep onde amplitude cai)
- [ ] Regras de XP
  - [ ] XP base por sessão vs por rep válida (escolher uma e documentar)
  - [ ] Cap diário / anti-abuso (máx sessões ou reps/dia)
  - [ ] Sessão inválida / cancelada → sem XP
- [ ] Privacidade / UX legal
  - [ ] Consentimento explícito da câmera antes da 1ª sessão
  - [ ] Copy: “estimativa de execução, não avaliação médica”
  - [ ] Texto: vídeo processado só em tempo real no device; nada é gravado
- [ ] Critérios de “rep válida” (flexão) — v0
  - [ ] Ângulos de cotovelo (descida / subida)
  - [ ] Histerese para evitar double-count
  - [ ] Enquadramento mínimo (ombros/quadril/punhos visíveis)

---

## Fase 1 — Schema e API (sem câmera ainda)

Objetivo: persistir sessões e amarrar ao hábito/XP, com fluxo stub.

- [ ] Migration Supabase
  - [ ] `exercise_types` (seed: `pushup` / flexão)
  - [ ] `exercise_sessions`
    - [ ] `id`, `user_id`, `exercise_type`, `habit_id` (nullable)
    - [ ] `status` (`active` | `completed` | `cancelled` | `rejected`)
    - [ ] `started_at`, `ended_at`
    - [ ] `client_meta` (JSONB: userAgent, permissão câmera)
    - [ ] `consent_version`
  - [ ] `exercise_session_metrics`
    - [ ] FK `session_id`
    - [ ] colunas do contrato mínimo
  - [ ] Índices `(user_id, started_at DESC)`, `(habit_id, started_at DESC)`
  - [ ] RLS: usuário só lê as próprias; INSERT/UPDATE de métricas via server fn / service role conforme padrão do app
- [ ] Tipos gerados / Zod no app
- [ ] Server functions
  - [ ] `startExerciseSession`
  - [ ] `completeExerciseSession` (recebe métricas; valida; grava; libera XP se ok)
  - [ ] `cancelExerciseSession`
  - [ ] `listExerciseSessions` (histórico recente)
- [ ] Integração com hábitos
  - [ ] Campo/flag no hábito: `validation_mode = validated_exercise` + `exercise_type = pushup`
  - [ ] Bloquear `completeHabit` direto quando modo validado
  - [ ] Criar/editar hábito de flexão validada (UI mínima ou seed)
- [ ] Stub de UI “Iniciar sessão”
  - [ ] Sem pose ainda: botão → sessão → formulário manual de reps (só para testar XP/pipeline)
  - [ ] Remover stub quando a Fase 2 estiver estável

---

## Fase 2 — MVP câmera + pose (flexão)

Objetivo: primeira sessão real sem gravar vídeo.

- [ ] Tela `/habits/.../session` ou modal full-screen “Sessão de flexão”
  - [ ] Setup: como posicionar o celular (diagrama simples)
  - [ ] Pedido de permissão de câmera
  - [ ] Preview espelhado
  - [ ] Controles: Iniciar / Pausar / Encerrar
- [ ] Pipeline on-device
  - [ ] `getUserMedia` (sem `MediaRecorder`)
  - [ ] Pose (MediaPipe Pose ou equivalente leve)
  - [ ] Loop de frames com cap de FPS (ex.: 24–30)
  - [ ] Garantir: nenhum upload de frame/vídeo
- [ ] Motor de reps (flexão v0)
  - [ ] Estados: `idle` → `descending` → `bottom` → `ascending` → `lockout`
  - [ ] Contador de reps válidas / inválidas
  - [ ] Amplitude por rep
  - [ ] HUD: `Flexão #N ✔` / feedback curto de erro
- [ ] Encerrar sessão
  - [ ] Montar payload de métricas
  - [ ] Chamar `completeExerciseSession`
  - [ ] Tela de resumo (reps, amplitude, forma %, tempo, XP)
  - [ ] Reusar pop-up de XP cyberpunk se aplicável
- [ ] Qualidade / robustez
  - [ ] Detecção de “corpo incompleto no frame”
  - [ ] Aviso de pouca luz / pessoa longe
  - [ ] Cancelamento limpo (sem XP)
- [ ] Testes manuais
  - [ ] Android Chrome
  - [ ] iOS Safari
  - [ ] Desktop (dev)

---

## Fase 3 — Forma ao vivo + Charlie treinador

Objetivo: feedback durante a série e memória útil para o Charlie.

- [ ] Correções em tempo real (regras v1)
  - [ ] “Desça um pouco mais”
  - [ ] “Estenda totalmente os braços”
  - [ ] “Corpo desalinhado” (quadril/ombro)
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
