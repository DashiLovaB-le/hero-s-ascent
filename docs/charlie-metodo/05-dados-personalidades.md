# 05 — Dados, personalidades e efeitos

## Tabelas centrais (conceito)

Qualquer stack serve; na V-Project é Postgres/Supabase.

| Tabela / entidade | Papel |
| --- | --- |
| `mentor_messages` | Histórico (user/assistant) + `kind` + `metadata` |
| `mentor_memories` | Long-term (texto + importância 1–5); prune ~20 |
| `mentor_challenges` | Missões com prazo e status |
| `mentor_objectives` | 1 objetivo ativo por usuário |
| `mentor_personalities` | Catálogo de prompts/tom |
| `mentor_settings` | Ex.: `openrouter_model` |
| `profiles.charlie_personality` | Slug da variante ativa |
| `ai_usage_events` | Tokens / custo por chamada |

Espelho documental: `src/mentor/schema.sql` + migrations em `supabase/migrations/`.

---

## Mensagens

Campos úteis para reproduzir:

- `role`: `user` | `assistant`  
- `content`: texto  
- `kind`: `chat` | `welcome` | `morning` | `evening` | `return` | …  
- `metadata`: model usado, challenge_id, pending_question, habit_suggestion, etc.

---

## Memórias

- Só gravar quando o JSON trouxer `memory` com valor útil  
- `memory_importance` 1–5  
- Manter teto (ex.: 20) apagando as de menor importância / mais antigas  

Isso evita que o contexto exploda e o free model “esqueça” o que importa.

---

## Desafios

Criados pelo mentor (JSON `challenge`) **depois** de validação:

- duração em dias → `expires_at`  
- XP / título de recompensa com tetos  
- opcionalmente vinculados a um `habit_id` existente  
- status: ativo → concluído / expirado / recusado  

Ao criar: notificação in-app (e canais espelho: Telegram/Discord/push, se existirem).

Jobs podem expirar desafios vencidos e notificar.

---

## Sugestão de hábito

`habit_suggestion` **não** cria o hábito sozinho.  
Fica pendente na UI até o herói aceitar/recusar (`respondMentorHabitSuggestion`).

Regra: nunca challenge + habit_suggestion no mesmo turno.

---

## Personalidades (variantes Charlie)

| Slug | Nome |
| --- | --- |
| `classico` | Charlie Clássico |
| `militar` | Charlie Militar |
| `estoico` | Charlie Estoico |
| `empresarial` | Charlie Empresarial |
| `cristao` | Charlie Cristão |
| `fitness` | Charlie Fitness |
| `financeiro` | Charlie Financeiro |

Seeds: `src/mentor/personalities.seed.ts`.  
Admin edita em `/dashitecnology/charlie`.

### Padrão reproduzível

```text
personalities
  id/slug
  display_name
  system_prompt   ← identidade + (opcional) protocolo

users
  active_personality_slug
```

Na hora do chat:

```ts
const prompt = await loadPrompt(user.active_personality_slug);
```

---

## Alter ego ≠ Charlie

- **Alter ego**: quem o herói quer ser (código, virtudes, inimigo interno) — feature `/identity`  
- **Charlie**: mentor que **guarda** essa identidade e a cita em fricção  

No contexto, isso aparece como bloco `IDENTIDADE DO HERÓI`.  
O protocolo manda: Charlie nunca fala *como se fosse* o alter ego.

---

## Notificações ligadas ao mentor

Tipos relevantes:

- `mentor_challenge` / `_done` / `_expired`  
- `mentor_presence`  
- (jornada) `identity_report` no evening  

A voz da notificação pode variar com a personalidade (`charlie-telegram-voice.ts`), depois espelhada para Telegram/Discord/push.

Para o MVP do amigo: in-app basta.

---

## Outros usos do mesmo proxy

O mesmo `chatCompletion` / OpenRouter serve para:

- sugestão de hábitos (`habit-suggest.ts`)  
- síntese de alter ego (`alter-ego.functions.ts`)  

Ou seja: **um client OpenRouter no server**, vários produtos em cima.
