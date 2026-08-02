# Planejamento — Voz do Charlie

Visão de produto e implementação. Opt-in, momentos curtos, timbre alinhado à personalidade — **não** TTS genérico em toda mensagem.

---

## Princípio

Voz serve para **presença**, não para conteúdo denso.

| Voz (curto, emocional) | Texto (lido na tela) |
|---|---|
| Presença / check-in | Coaching longo |
| Novo desafio (1 frase) | Detalhe do desafio, hábitos, listas |
| Conquista / marco | Explicações, sugestões estruturadas |

**Regra:** se a frase passa de ~25–40 palavras ou é uma lista, não fala — só mostra.

---

## Quando Charlie fala

1. **Presença / check-in** — bom dia, streak em risco, “ainda dá tempo hoje”.
2. **Novo desafio** — tom + título; o corpo do desafio fica na UI.
3. **Conquista / marco** — wallpaper, streak alto, desafio concluído.
4. **Modo foco em `/mentor`** — reforça o ritual quando o usuário já está imerso.
5. **Só com opt-in** — toggle “Voz do Charlie” (off por padrão), igual push.

### Quando *não* fala

- Todo reply do chat.
- Respostas longas de mentoring.
- Enquanto o usuário está digitando (não sobrepor).
- Quiet hours (alinhar às regras de notificação).

---

## Voz “do Charlie” (não genérica)

Duas camadas obrigatórias:

### A) Persona vocal por personalidade

Cada slug (`classico`, etc.) mapeia para:

- `voice_id` (provedor)
- `style_prompt` / instructions (“calmo, masculino, mentor; sem tom de comercial”)
- `speed` / stability (se o provedor expuser)

Personalidades diferentes **não** compartilham a mesma voz default.

### B) Provedor com character voice

| Opção | Uso |
|---|---|
| **Ideal** | Voz clonada (amostra curta no “tom Charlie”) — ElevenLabs ou similar |
| **Boa** | Voz de catálogo bem específica + style prompt forte |
| **Evitar** | Web Speech API do browser (genérico, muda por SO) |

Config no servidor (tabela / settings), não hardcode espalhado:

- `charlie_voice_id`
- `style_prompt`
- por `personality` slug

---

## Arquitetura

```
evento curto
  → spoken_text (1–2 frases no tom da personalidade ativa)
  → TTS (voice_id + style da personalidade)
  → URL do áudio (Storage/CDN ou signed URL)
  → client toca se voice_opt_in + gesto/foco ok
```

1. Evento (ex.: criou `mentor_challenge`, presença, conquista).
2. Server gera `spoken_text` no estilo de `charlie_personality` (LLM curto ou template + micro-geração).
3. Server chama TTS com a voz daquela personalidade.
4. Persiste áudio ou devolve URL temporária.
5. Client reproduz só com opt-in e após interação do usuário (autoplay policies).
6. **Fallback:** se TTS falhar, UI/notificação seguem — voz nunca quebra o fluxo.

### Cache (opcional, recomendado)

Hash `(personality + spoken_text)` → reutilizar áudio de frases repetidas (presença genérica) e reduzir custo.

---

## UX / produto

- **`/profile`:** toggle “Voz do Charlie” (default off) + texto LGPD curto (como desligar).
- **`/mentor` (foco):** ícone de ouvir nas falas de presença; “ouvir de novo”.
- Volume baixo, frase curta.
- Não empilhar áudios; um clip por vez.
- Quiet hours: mesma janela das notificações (~23:00–06:59 BRT), salvo override explícito depois.

---

## Ordem de implementação

1. [ ] Opt-in no perfil + tocar um áudio fixo de teste no “desafio novo” (provar UX sem TTS).
2. [ ] Mapear **1 voz** à personalidade `classico` + `style_prompt`.
3. [ ] Gerar `spoken_text` nos 3 eventos (presença, desafio, conquista).
4. [ ] Clonar / afinar timbre; depois outras personalidades.
5. [ ] Só então: “ouvir esta mensagem” em replies longos do chat (opcional, sob demanda).

---

## Critério de pronto (MVP)

- Usuário ativa voz no perfil.
- Em pelo menos **um** evento real (ex.: desafio novo), ouve uma frase curta no tom do Charlie clássico.
- Sem opt-in → silêncio total.
- Falha de TTS → app continua normal.

---

## Fora de escopo (MVP)

- Narrar o chat inteiro automaticamente.
- Lip-sync / avatar falando.
- App nativo (AVSpeech / etc.) — só web primeiro.
- Múltiplos provedores TTS ao mesmo tempo.

---

## Relação com o que já existe

- Personalidades / prompts: `src/mentor/` (ex.: `personalities.seed`, `prompt.server`).
- Eventos de produto: desafios, presença, conquistas / wallpapers, notificações.
- Preferências: espelhar o padrão de opt-in de push/Telegram em `/profile`.

---

## Resumo

Charlie fala em **rituais curtos**; o texto falado nasce da **personalidade**; o áudio usa **voz dedicada + style**. Assim o timbre é do personagem — não de assistente genérico.
