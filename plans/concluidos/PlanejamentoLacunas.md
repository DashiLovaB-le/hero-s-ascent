# Planejamento — Lacunas de Progressão e Onboarding

Fecha os buracos listados em `plans/ResumoAplicacao.md` §18.

| Lacuna | Fase | Status |
| --- | --- | --- |
| Soft onboarding | **1** | ✅ |
| Avanço automático de capítulo | **2** | ✅ |
| Unlock automático de conquistas | **2** | ✅ |
| Tela de histórico de atividade | **3** | ✅ |
| Missões (produto) | **4** | ✅ (código; aplicar migration) |
| Hábitos gerados por IA | **5** | ✅ |

Princípios mantidos: engine compartilhada, missões ≠ desafios Charlie, entrega por fases.

---

## Fase 1 — Soft onboarding → gate real

- [x] Centralizar checagem em `/_authenticated` `beforeLoad` (`isOnboardingAllowedPath`)
- [x] Mutations de hábito/meta rejeitam se `!onboarding_completo`
- [x] Onboarding 3 passos (áreas → metas → hábitos sugeridos)
- [x] Empty states com CTA em jornada/hábitos

**Critério:** cumprido.

---

## Fase 2 — Engine de progresso

- [x] `src/lib/progress-engine.ts` (`evaluateProgress`)
- [x] Capítulos via `resolveChapter` / `CHAPTERS` em `src/lib/chapters.ts`
- [x] Conquistas automáticas + XP bônus + notificações `achievement`
- [x] Wire em `completeHabit` e conclusão de desafio do mentor
- [x] Wallpaper notify após capítulo atualizado

**Critério:** cumprido.

---

## Fase 3 — Histórico

- [x] `listActivityHistory`
- [x] Query `["activity-history"]`
- [x] UI no perfil (timeline agrupada por dia BRT)

**Critério:** cumprido.

---

## Fase 4 — Missões

- [x] Migration `supabase/migrations/20260727150103_missions.sql`
- [x] Templates por capítulo + `ensureChapterMissions` / bump em hábito
- [x] UI na jornada (“Missões do capítulo” + “Hábitos de hoje”)
- [ ] **Aplicar migration no Supabase remoto** (SQL Editor / `db push`) — MCP sem permissão neste ambiente

**Critério de código:** cumprido. **Produção:** aguarda aplicar SQL.

---

## Fase 5 — Hábitos IA

- [x] `suggestHabitsFromGoals` + fallback estático
- [x] Revisão antes de gravar (`createHabitsBulk`)
- [x] Onboarding passo 3 + botão em `/habits`
- [x] Rate limit ~90s

**Critério:** cumprido.

---

## Checklist de fechamento global

- [x] Fase 1
- [x] Fase 2
- [x] Fase 3
- [x] Fase 4 (código)
- [x] Fase 5
- [x] Atualizar `plans/ResumoAplicacao.md`
- [ ] Smoke test manual pós-migration
- [ ] Aplicar `20260727150103_missions.sql` no projeto `gmzddccyikpxbiozsiue`

### SQL a rodar no Dashboard (se ainda não aplicado)

Arquivo: `supabase/migrations/20260727150103_missions.sql`
