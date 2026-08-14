# Charlie — voz no despertador (to-do de entrega)

Documento de execução: **só o que vamos usar agora**.  
Escopo inicial = **despertador / Charlie Call → ritual matinal com fala curta**.  
Evening, Discord voice, STT e conversa livre ficam **fora** desta entrega.

**Princípio:** voz = presença curta. Charlie fala; o herói não precisa falar de volta no MVP.

Relacionados (contexto, não escopo deste arquivo):

- `plans/Charlie-Despertador.md` — alarme nativo + tela de chamada  
- `plans/Charlie-Call-Nativo.md` — plugin Capacitor  
- `plans/PlanejamentoVozCharlie.md` — visão geral de voz (mais ampla)  
- `integracao-raon.md` — referência do pipeline Fish TTS (inspiração técnica)

---

## Em uma frase

> Ao atender o despertador do Charlie, o app toca um áudio curto (TTS) com o norte do dia — tom da personalidade ativa + opcional 1 linha do Alter Ego — e depois o ritual `/alarm/ritual` → LEVANTEI → Jornada.

---

## O que entra / o que fica de fora

| Entra (MVP voz-despertador) | Fora (depois) |
| --- | --- |
| TTS no fluxo do alarme / pós-atendimento | STT (ouvir o herói) |
| Texto falado curto (1–3 frases) | Chat de voz contínuo |
| Fish Audio (ou provedor equivalente) no **server** | NVIDIA / Gemini como stack obrigatória |
| OpenRouter já do app para gerar `spoken_text` (ou template) | Discord `/join` + voice channel |
| Opt-in de voz + fallback se TTS falhar | Evening em voz, urgência ML em voz |
| Cache opcional de áudio por hash | Clonar 7 vozes perfeitas no dia 1 |

---

## Arquitetura-alvo (só despertador)

```text
Alarme nativo dispara
  → tela Charlie Call (atender)
  → server: monta spoken_text (briefing matinal curto)
  → server: Fish TTS → arquivo/URL (ou stream)
  → client toca áudio (opt-in voz)
  → /alarm/ritual (texto na tela + LEVANTEI)
  → /journey

Fallback: se TTS falhar → ritual só texto (fluxo atual). Voz nunca bloqueia o dia.
```

**Sem microfone. Sem STT. Sem Discord voice nesta fase.**

---

## Stack que vamos usar

| Peça | Escolha | Nota |
| --- | --- | --- |
| Gatilho | Capacitor Charlie Call / `charlie_alarms` | Já existe no app |
| Texto falado | Template + micro-geração OpenRouter **ou** só template no MVP-0 | ≤ ~40 palavras |
| TTS | **Fish Audio** (`/v1/tts`, MP3) | `FISH_API_KEY` + `FISH_REFERENCE_ID` no server |
| Storage | Supabase Storage / signed URL **ou** bytes temporários | Preferir cache por hash |
| Client | Capacitor / WebView toca áudio após gesto “Atender” | Autoplay OK pós-tap |
| Persona | `profiles.charlie_personality` | Tom do texto; voz pode ser 1 clone Charlie no MVP |

---

## Critério de pronto (MVP)

- [ ] Herói com alarme opt-in no Android atende a chamada e **ouve** 1 clip curto do Charlie
- [ ] Clip usa contexto real (nome e/ou código do Alter Ego e/ou 1 hábito pendente) quando disponível
- [ ] Sem rede no momento do TTS → fallback para áudio empacotado **ou** só texto no ritual (definir na Fase B)
- [ ] Toggle “Voz no despertador” off por padrão (ou herda opt-in do alarme — decidir na Fase A)
- [ ] Falha de TTS **não** impede `/alarm/ritual` nem LEVANTEI
- [ ] Quiet hours do alarme continuam sendo do alarme nativo (não misturar com quiet hours de notificação)

---

## To-do detalhado

### Fase 0 — Decisões travadas (antes de código)

- [ ] **0.1** Confirmar provedor TTS = Fish Audio (reference_id da voz Charlie)
- [ ] **0.2** MVP de voz: **1 voz** para todos os slugs **ou** 1 `reference_id` por personalidade (recomendação: 1 voz no MVP; tom muda no texto)
- [ ] **0.3** Momento exato do play:
  - Opção A: ao tocar **Atender** na Call UI (recomendado)
  - Opção B: ao abrir `/alarm/ritual`
- [ ] **0.4** Offline: áudio genérico empacotado (`classic` / `warrior` / `calm` já existentes) **vs** só texto
- [ ] **0.5** Opt-in: campo novo `voice_on_alarm` em `charlie_alarms` **vs** “alarme ligado = voz ligada”
- [ ] **0.6** Limite duro: máximo **~20 s** / ~40 palavras; sem listas

**Saída da Fase 0:** decisões 0.1–0.6 anotadas neste doc (seção “Decisões”).

---

### Fase A — Contrato de dados e preferências

- [ ] **A.1** Migration (se preciso):
  - `charlie_alarms.voice_enabled boolean default false` (ou nome acordado em 0.5)
  - opcional: `last_voice_clip_url` / `last_voice_at` **não** necessário no MVP
- [ ] **A.2** Atualizar `getCharlieAlarm` / `upsertCharlieAlarm` + UI em `CharlieAlarmSettingsCard`
  - Toggle claro: “Charlie fala ao atender”
- [ ] **A.3** Tipos Supabase + Dashi (se flags globais afetarem voz)
- [ ] **A.4** Feature flag global opcional: `charlie_alarm_voice_enabled` em `app_settings` (kill switch)

**Saída:** preferência persistida; UI no perfil; flag de emergência.

---

### Fase B — Gerar o que Charlie vai dizer (`spoken_text`)

- [ ] **B.1** Server fn `getAlarmSpokenScript` (ou estender `getMorningBriefing`):
  - Inputs: `userId`, personalidade, nome, Alter Ego (1 linha do código se houver), 1 hábito pendente / streak (se couber)
  - Output: `{ spoken_text: string, source: "template" | "llm" }`
- [ ] **B.2** MVP-0 com **templates** por personalidade (sem LLM) — 5–7 variantes curtas
- [ ] **B.3** (Opcional MVP-1) Micro-prompt OpenRouter: “1–2 frases, sem emoji, tom da personalidade, cite no máx. 1 linha do código”
- [ ] **B.4** Sanitizar para TTS: sem markdown, sem bullets, sem URLs
- [ ] **B.5** Testes unitários dos templates + sanitização

**Saída:** string estável e curta pronta para TTS.

---

### Fase C — Fish TTS no server

- [ ] **C.1** Secrets (nunca `VITE_*`):
  - `FISH_API_KEY`
  - `FISH_REFERENCE_ID`
  - `FISH_MODEL` (se aplicável)
- [ ] **C.2** Módulo `src/lib/charlie-voice/fish-tts.ts`:
  - POST Fish `/v1/tts` com `text`, `reference_id`, `format: mp3`, `latency: low`
  - Retorna `ArrayBuffer` / stream
- [ ] **C.3** Server fn `synthesizeCharlieAlarmVoice({ spoken_text })` → URL assinada ou data URL temporária
- [ ] **C.4** Cache (recomendado):
  - key = hash(`personality + spoken_text + reference_id`)
  - Storage bucket privado `charlie-voice-cache` + signed URL curta
- [ ] **C.5** Timeout / retry 1x; em falha retornar `{ ok: false }` sem throw fatal
- [ ] **C.6** Log estruturado: latência, bytes, falha (sem logar texto sensível demais se não precisar)

**Saída:** server gera MP3 sob demanda com fallback limpo.

---

### Fase D — Ligar no fluxo do despertador (client nativo)

- [ ] **D.1** No plugin / Call UI: após **Atender**, se `voice_enabled`:
  - pedir script + URL ao server
  - tocar áudio (Audio native / HTMLAudioElement)
- [ ] **D.2** Se TTS falhar ou offline → seguir para `/alarm/ritual` sem bloquear
- [ ] **D.3** Não empilhar clips; um play por atendimento
- [ ] **D.4** Botão opcional “Ouvir de novo” no ritual (só se URL ainda válida)
- [ ] **D.5** Evento analytics: `charlie_alarm_events` meta `{ voice_played: true|false, voice_error?: string }`
- [ ] **D.6** QA Android: app killed → alarme → atender → ouve → ritual → LEVANTEI

**Saída:** caminho feliz ponta a ponta no APK.

---

### Fase E — Conteúdo e qualidade

- [ ] **E.1** Validar tom com as 7 personalidades (mesmo `reference_id`: texto carrega o tom)
- [ ] **E.2** Incluir Alter Ego só quando `hero_alter_ego.active` e código existe (máx. 1 linha)
- [ ] **E.3** Proibir: listas, “como posso ajudar”, emojis, spoiler de desafios longos
- [ ] **E.4** Gravidade: ≤ 20 s; se TTS > 25 s, cortar texto e regenerar/truncar
- [ ] **E.5** Amostra A/B manual: 10 heróis internos; ajustar templates

**Saída:** frases “de mentor”, não de assistente.

---

### Fase F — Hardening e docs

- [ ] **F.1** Rate limit por user (ex.: 1 síntese / atendimento; cache evita spam)
- [ ] **F.2** Custo: dashboard simples (contagem de sínteses/dia) no Dashi opcional
- [ ] **F.3** Atualizar `plans/ResumoAplicacao.md` + `Charlie-Despertador.md` com “voz Fish no atender”
- [ ] **F.4** `.env.example` com nomes `FISH_*` (sem valores)
- [ ] **F.5** Checklist de regressão: alarme sem voz, alarme com voz, TTS down, rede off

**Saída:** pronto para produção controlada (flag).

---

## Ordem de execução sugerida

```text
0 (decisões) → A (prefs) → B (spoken_text templates) → C (Fish) → D (Call UI) → E (qualidade) → F (harden)
```

Não começar C/D sem A.1–A.2.  
Não ligar flag global sem D.6 verde.

---

## Decisões (preencher na Fase 0)

| # | Decisão | Valor |
| --- | --- | --- |
| 0.1 | Provedor TTS | Fish Audio |
| 0.2 | Vozes por personalidade | _a definir: 1 voz MVP_ |
| 0.3 | Momento do play | _a definir: ao Atender_ |
| 0.4 | Offline | _a definir_ |
| 0.5 | Opt-in | _a definir_ |
| 0.6 | Limite duração | ~20 s / ~40 palavras |

---

## Explicitamente NÃO fazer nesta entrega

- [ ] ~~STT / “Charlie te escuta”~~
- [ ] ~~Discord voice channel / `/join`~~
- [ ] ~~NVIDIA como LLM da voz~~
- [ ] ~~Evening em áudio~~
- [ ] ~~Falar em todo push/Telegram~~
- [ ] ~~Web Speech API~~
- [ ] ~~Conversa livre no Call~~

---

## Pitch de 30 segundos

> No despertador, quando o herói atende o Charlie, o server monta uma fala curta e a Fish Audio transforma em voz. O app toca o clip e segue o ritual. Sem microfone, sem Discord voice, sem conversa — só presença matinal. Se o TTS cair, o dia continua no texto.

---

*Atualizar checkboxes conforme avançar. Próximo doc pós-MVP: evening voice / identity_report falado.*
