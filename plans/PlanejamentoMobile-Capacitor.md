# Planejamento Mobile — V-Project (Capacitor)

Documento de estratégia para levar o **V-Project** ao Android e iOS sem reescrever o produto.  
Alinhado ao estado do app em agosto 2026 (TanStack Start, Supabase, Charlie, flexão validada, Web Push, Telegram, ML).

| Campo | Valor |
| --- | --- |
| **Produto** | V-Project |
| **Repo** | `hero-s-ascent` |
| **Web produção** | `https://v-project-rho.vercel.app` |
| **Abordagem recomendada** | Web canônico + shell **Capacitor** + bridges nativas |
| **Ícone do app** | `public/charlie-ico.ico` (fonte oficial do ícone nas lojas / shell) |
| **Alternativa rejeitada (MVP shell)** | WebView “cru” sem plugins |
| **Alternativa adiada** | App nativo 100% (React Native / Flutter) do zero |

**Documento irmão:** [`ResumoAplicacao.md`](./ResumoAplicacao.md) · flexão: [`ExerciciosValidados-Flexao.md`](./ExerciciosValidados-Flexao.md) · push: [`PlanejamentoNotificacoes.md`](./PlanejamentoNotificacoes.md) · call/alarme: [`Charlie-Call-Nativo.md`](./Charlie-Call-Nativo.md) · [`Charlie-Despertador.md`](./Charlie-Despertador.md)

---

## 0. Garantia: Capacitor **não** danifica a web

**Resposta curta:** com as regras abaixo, **não**. A web em Vercel permanece canônica e independente do binário das lojas.

### 0.1 O que já está decidido (protege a web)

| Regra | Onde no plano |
| --- | --- |
| Web = fonte da verdade de features/UI/server fns | §3.1 |
| Capacitor = container + bridges, não fork do produto | §3.1 |
| Mesmo código React/TanStack no shell | §1, §4 |
| APIs nativas só com `Capacitor.isNativePlatform()` | §11 |
| Google OAuth **fora** do WebView | §3.2, §7.1, Fase 2 |
| Admin `/dashitecnology` fora do app store | §4, §9 |
| Drift web×mobile listado como risco | §10 |

### 0.2 Regras duras (obrigatórias na implementação)

1. **Nunca** remover ou quebrar caminho web para “fazer o app funcionar”.
2. Todo uso de plugin Capacitor passa por um helper (`src/lib/platform.ts` ou similar):
   - web → no-op / fallback browser
   - native → plugin
3. **Proibido** `import` top-level de `@capacitor/*` em rotas compartilhadas sem dynamic import ou guard — evita bundle web quebrado / erros em SSR.
4. Auth Google: web continua fluxo browser atual; nativo só adiciona Custom Tabs / redirect scheme — **dois caminhos, uma sessão Supabase**.
5. Push: no web segue Web Push; no nativo FCM/APNs. Deduplicar envio (§10) — não desligar Web Push “porque tem app”.
6. Deep links (`vproject://`) só afetam nativo; URLs `https://` da produção intactas.
7. Feature flags / build flags podem **esconder** UI no app; não podem **apagar** código web.
8. PR que toca Capacitor inclui smoke **web** (login, jornada, hábitos, Charlie) antes do merge.

### 0.3 Onde ainda **não** estamos “prontos” (gaps honestos)

O **documento** está bem encaminhado; o **repositório ainda não** tem o shell. Até existir código Capacitor, estes itens são dívida consciente:

| Gap | Risco se ignorar | Mitigação |
| --- | --- | --- |
| Não existe `src/lib/platform.ts` (ou equivalente) | Devs chamam plugin direto e quebram web/SSR | Criar na Fase 1, dia 1 |
| TanStack Start → assets no binário (§5 B) ainda é TBD | Build mobile malfeito pode forçar hacks no web | Começar Live URL (A); formalizar export SPA antes de B |
| Sem checklist CI “web não regressou” | Merge mobile quebra produção web | Script smoke + checklist PR (§0.2 item 8) |
| Charlie Call / Despertador | Tentação de meter nativo cedo demais | Só **depois** Fases 1–4; ver docs irmãos |
| Live update / Capgo | Dois “mundos” de versão JS | Fora da v1 |

### 0.4 Veredito de preparação

| Pergunta | Status |
| --- | --- |
| Arquitetura evita danificar a web? | **Sim** (web canônico + flags) |
| Regras anti-regressão explícitas? | **Sim** (esta §0) |
| Código Capacitor já isolado? | **Não** — ainda não iniciado |
| Prontos para implementar shell sem medo? | **Sim**, desde que Fase 1 siga §0.2 |

---

## 1. Objetivo

Entregar o V-Project na **Play Store** e, em seguida, na **App Store**, com:

1. Paridade funcional com o web nas jornadas principais (auth, hábitos, metas, Charlie, perfil)
2. **Câmera + pose** (flexão) estável o bastante para uso diário
3. **Push nativo** confiável (Android FCM + iOS APNs)
4. **Google OAuth** sem bloqueio típico de WebView embutido
5. Um único codebase de produto (React / TanStack) — mobile só adiciona o que o browser não resolve sozinho

Não é objetivo deste plano “virar app nativo puro” na primeira leva.

---

## 2. Contexto do produto (por que mobile importa)

O herói usa o app em ritmo diário: check de hábitos, streak, Charlie, e — crítico — **sessões de flexão com câmera**. Mobile é o dispositivo natural para:

- Abrir o app no horário do treino / rotina matinal
- Receber lembretes de hábito e risco de streak
- Usar a câmera frontal sem “abrir o Chrome e achar o site”

Canais que o web já tem e o mobile precisa **igualar ou superar**:

| Capacidade web hoje | Impacto no mobile |
| --- | --- |
| Auth e-mail/senha + Google | Google em WebView embutido costuma falhar |
| Web Push (VAPID) | Frágil/ausente em iOS WebView; no Android shell precisa FCM |
| `getUserMedia` + MediaPipe (flexão) | Precisa permissões nativas + performance de device |
| Telegram deep link | Abre browser / app Telegram (ok com Custom Tabs) |
| Sessão Supabase (localStorage) | Funciona no WebView do Capacitor; cuidado com storage quotas e logout |

---

## 3. Decisão de arquitetura

### 3.1 Escolha: Capacitor (recomendado)

```text
┌─────────────────────────────────────────────────────────┐
│  Stores (Play / App Store)                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Capacitor shell (Android / iOS)                  │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Web app (mesmo build / mesma origem)       │  │  │
│  │  │  TanStack Start · React · Supabase client   │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  Plugins: Camera · Push · Browser/Auth · App     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
              │
              ▼
     Supabase + Vercel (backend/web atuais)
```

**Princípio:** o web continua a **fonte da verdade** de features, UI e server functions. O Capacitor é um **container nativo** que:

- Empacota a UI (load da URL de produção **ou** assets estáticos do build)
- Expõe APIs nativas via plugins quando o browser não basta
- Publica binários nas lojas

### 3.2 Por que não WebView “cru”

Um APK/IPA que só abre `WebView.loadUrl(produção)` **não** garante o funcionamento perfeito deste produto.

| Área | WebView cru | Capacitor + plugins |
| --- | --- | --- |
| UI / hábitos / Charlie | Em geral ok | Ok |
| Google OAuth | Frequentemente **bloqueado** | Custom Tabs / ASWebAuthenticationSession |
| Câmera + MediaPipe | Permissões e estabilidade frágeis | Permissões nativas + tuning |
| Push | Quase inviável no iOS; limitado no Android | FCM / APNs |
| Store review | Risco de rejeição (“só um site”) | App com valor nativo (push, câmera) ajuda |
| Atualizações | Imediatas (só URL) | Depende do modo (live URL vs assets) |

### 3.3 Por que não React Native / Flutter agora

| Critério | Capacitor | RN / Flutter greenfield |
| --- | --- | --- |
| Reaproveitar Charlie, metas, ML UI, flexão web | Alto | Baixo (reescrita) |
| Tempo até 1º binário na Play | Semanas | Meses |
| Paridade com web | Natural | Drift constante |
| Pose / MediaPipe | Continua no WebView (com risco de perf) | Pode ser nativo (melhor, mais caro) |
| Quando faz sentido migrar | Se pose/push/UX nativa exigirem | Se Capacitor falhar em métricas reais |

**Regra:** só abrir projeto nativo puro se, após Capacitor em devices reais, a flexão ou o push não atingirem qualidade mínima (ver §8).

---

## 4. Matriz de capacidades (web → mobile)

| Feature | Web hoje | Mobile Capacitor (alvo) | Bridge / nota |
| --- | --- | --- | --- |
| Landing / auth e-mail | Sim | Sim | — |
| Google OAuth | Sim (browser) | Sim | `@capacitor/browser` ou plugin auth; **não** OAuth dentro do WebView puro |
| Jornada, hábitos, metas, store | Sim | Sim | Mesmo código |
| Charlie (chat / presença) | Sim | Sim | Rede + teclado mobile; testar scroll/viewport |
| Flexão (MediaPipe) | Sim (Chrome/Safari) | Sim com validação em device | Permissão câmera; possível fallback nativo depois |
| Web Push | Sim (opt-in) | Complementar / substituir | Push **nativo** Capacitor + backend FCM/APNs |
| Notificações in-app (sino) | Sim | Sim | — |
| Telegram | Sim | Sim | Abrir `t.me` via browser plugin |
| Wallpapers / localStorage | Sim | Sim | Validar persistência após kill do app |
| Control room `/dashitecnology` | Sim | **Fora do app mobile** (só web) | Evitar superfície admin no store build |
| Assinatura / loja (futuro) | Planejado | Store IAP ou Kiwify web | Ver `Assinatura-Kiwify.md` — alinhar política das lojas |

---

## 5. Duas estratégias de entrega do conteúdo web

### Opção A — Live URL (carrega produção)

- Shell abre `https://v-project-rho.vercel.app` (ou domínio dedicado `app.…`)
- **Prós:** deploy web = app atualizado; sem rebuild de store a cada bugfix
- **Contras:** offline frágil; Apple pode questionar “wrapper”; precisa deep linking / splash / error de rede bem feitos
- **Quando usar:** fase de validação interna e Android early access

### Opção B — Assets no binário (build embutido)

- `npm run build` → copiar output estático / SSR conforme preset Capacitor
- **Prós:** mais “app de verdade”; funciona melhor offline parcial; review stores mais previsível
- **Contras:** cada mudança de UI relevante pode exigir novo binário (ou usar live update tipo Capgo — avaliar depois)
- **Quando usar:** release pública nas lojas

**Recomendação de plano:** começar com **A (Android interno)** para achar bugs de câmera/OAuth/push; fechar release com **B** (ou híbrido: assets + feature flags).

> TanStack Start / Nitro: o empacote “assets no binário” precisa de um passo explícito (SPA export ou server separado). Tratar como tarefa de engenharia na Fase 1 — não assumir que `vercel` preset cola direto no Capacitor sem ajuste.

---

## 6. Roadmap por fases

### Fase 0 — Pré-requisitos (1–3 dias)

- [ ] Congelar lista de rotas **incluídas** no app mobile (ex.: sem `/dashitecnology`)
- [ ] Definir `APP_PUBLIC_URL` / deep links (`vproject://` ou universal links)
- [ ] Contas: Google Cloud (OAuth Android/iOS), Firebase (FCM), Apple Developer (quando iOS)
- [ ] Device farm mínimo: 1 Android médio + 1 Android fraco; depois 1 iPhone
- [ ] Critérios de aceite da flexão no mobile (ver §8)

### Fase 1 — Shell Capacitor Android (semana 1–2)

- [ ] Criar `src/lib/platform.ts` (isNative / getPlatform / safe wrappers) **antes** de plugins
- [ ] `npm create` / add `@capacitor/core` `@capacitor/android`
- [ ] Configurar `capacitor.config` (appId, appName, server.url opcional)
- [ ] Splash, ícone, status bar, safe areas (notch)
  - **Ícone do app:** usar `public/charlie-ico.ico` como arte-fonte (converter para densidades Android: mdpi…xxxhdpi / adaptive icon no Android Studio ou `@capacitor/assets`)
- [ ] Build interno (APK/AAB) apontando para staging ou produção
- [ ] Smoke test **nativo:** login e-mail, jornada, hábitos, Charlie, metas, perfil
- [ ] Smoke test **web** (produção ou preview): mesmos fluxos — confirmar zero regressão

**Saída:** herói abre o app e usa o core **sem** câmera/push ainda; web inalterada.

### Fase 2 — Auth Google seguro (semana 2)

- [ ] Fluxo OAuth fora do WebView (Custom Tabs / Browser plugin)
- [ ] Redirect URIs no Supabase + Google Cloud para o scheme do app
- [ ] Testar: login, logout, troca de conta, cold start com sessão
- [ ] Documentar edge case: usuário só Google definindo senha no `/profile`

**Saída:** Google login confiável no Android Capacitor.

### Fase 3 — Câmera e flexão (semana 2–4)

- [x] Permissões `CAMERA` / rationale em PT-BR (`AndroidManifest` + `ensureCameraPermission`)
- [ ] Validar pipeline atual: framing → calibração → contagem MediaPipe **no APK**
- [ ] Medir: FPS, aquecimento, falsos positivos, crash em background
- [x] UX: manter tela acesa na sessão (`requestSessionWakeLock`)
- [ ] Se falhar critérios (§8): spike ML Kit / pose nativa (Fase 3b)

**Saída:** sessão de flexão usável no dia a dia no Android alvo.

**Notas (2026-08-08)**
- Pipeline web (MediaPipe + `getUserMedia`) reutilizado no WebView — sem gravar vídeo
- Bridge: `@capacitor/camera` só para permissão nativa; preview continua via WebRTC
- Resolução ideal 960×540 no mobile para performance
- Teste manual necessário no device após rebuild do APK

### Fase 4 — Push nativo (semana 3–5)

- [ ] Plugin Push Notifications + Firebase no Android
- [ ] Backend: registrar device token (nova tabela ou coluna) ligado a `user_id`
- [ ] Espelhar tipos críticos já usados no Telegram/Web Push:
  - `habit_reminder`, `streak_risk`, `mentor_challenge*`, `agent_initiative`
- [ ] Quiet hours / anti-spam: reutilizar regras de `notification-jobs`
- [ ] Opt-in na UI de perfil (ao lado do Web Push)
- [ ] iOS APNs na fase iOS (certificados, capability Push)

**Saída:** lembretes chegam com app fechado no Android.

### Fase 5 — Polimento store Android (semana 5–6)

- [ ] Privacy policy / termos (câmera: processamento on-device, sem upload de vídeo)
- [ ] Data safety form (Play)
- [ ] Screenshots, descrição, classificação etária
- [ ] Remover rotas admin do bundle ou bloquear por user-agent/build flag
- [ ] Crash reporting (Sentry ou similar)
- [ ] Internal testing → closed → production

### Fase 6 — iOS (após Android estável)

- [ ] Capacitor iOS + certificados Apple
- [ ] OAuth / Universal Links
- [ ] Câmera + pose (Safari WebView ≠ Chrome — revalidar MediaPipe)
- [ ] APNs
- [ ] Review Guidelines: câmera, conta, pagamentos futuros

### Fase 7 — Evolução (só se necessário)

- [ ] Live update (Capgo / mechanism próprio) para hotfixes de JS
- [ ] Módulo nativo de pose se MediaPipe não bastar
- [ ] Avaliar RN só para módulo de exercício (micro-app) se fizer sentido
- [ ] IAP vs checkout web (Kiwify) alinhado às regras das lojas

---

## 7. Detalhamento técnico por pilar

### 7.1 Autenticação

- Manter Supabase Auth como única fonte de identidade
- E-mail/senha: já ok no WebView do Capacitor
- Google: **sempre** browser/custom tab; nunca `signInWithOAuth` preso no iframe/WebView interno sem escape
- Após redirect, trocar code/session e persistir no storage do app
- Deep link: `vproject://auth/callback` (exemplo) registrado no Capacitor + Supabase Redirect URLs

### 7.2 Câmera e exercícios validados

Referência de produto: `ExerciciosValidados-Flexao.md`.

No mobile:

1. Solicitar permissão **antes** de abrir o modal de sessão
2. Preferir câmera frontal; permitir troca se o plugin expuser
3. Manter regra de produto: **não gravar / não enviar vídeo**
4. Telemetria só de métricas já persistidas (`exercise_sessions` / metrics)
5. Testar thermal throttling (sessões longas esquentam o aparelho → MediaPipe cai FPS)

### 7.3 Notificações

| Canal | Papel no mobile |
| --- | --- |
| Sino in-app | Igual ao web |
| Web Push | Opcional / secundário dentro do Capacitor |
| Push nativo | **Canal primário** mobile |
| Telegram | Continua como espelho opt-in |

Modelo de dados sugerido (a formalizar em migration futura):

- `push_devices (user_id, platform, token, created_at, last_seen_at, enabled)`
- Envio: estender `createNotification` ou job paralelo para fan-out FCM/APNs

### 7.4 Rede, ambiente e segurança

- Mesmo projeto Supabase (`gmzddccyikpxbiozsiue`)
- `VITE_*` / env de build mobile alinhados ao web
- Certificate pinning: **não** na v1 (complexidade alta)
- Cleartext HTTP: proibido
- Esconder `SUPABASE_SERVICE_ROLE` — nunca no app (já é regra do web)
- Jailbreak/root: fora de escopo v1

### 7.5 UX mobile específica

- Bottom nav já existe — validar safe-area (home indicator)
- Teclado do Charlie: `visualViewport` / scroll para última mensagem
- Sessão de flexão: fullscreen + keep-awake
- Estados offline: banner “sem conexão” (não fingir sync)
- First launch: explicar por que pedimos câmera e notificações (transparência = store + confiança)

---

## 8. Critérios de aceite (definição de “bom o bastante”)

### Flexão (Android alvo)

| Métrica | Alvo mínimo |
| --- | --- |
| Contagem correta em série controlada (10 reps) | ≥ 90% das reps |
| Tempo até calibração pronta | ≤ 5 s após framing ok |
| Crash / freeze na sessão | 0 em 20 sessões de teste |
| FPS percebido (fluidez do skeleton) | Usável (não precisa 60; evitar “slideshow”) |
| Permissão negada | UI clara + não quebrar `/habits` |

### Auth

| Caso | Esperado |
| --- | --- |
| E-mail/senha | Login/logout/cold start ok |
| Google | Completa sem “disallowed_useragent” |
| Troca de e-mail/senha no perfil | Continua refletindo em Auth (já no web) |

### Push

| Caso | Esperado |
| --- | --- |
| App em background | `habit_reminder` / `streak_risk` chegam |
| Opt-out | Para de enviar |
| Quiet hours | Respeitadas como no job atual |

Se **flexão** falhar os alvos em devices fracos após tuning: abrir spike **Fase 3b (pose nativa)** antes de escalar marketing mobile.

---

## 9. O que fica de fora do app mobile (v1)

- Control room `/dashitecnology`
- Treino ML Python / shadow scores UI admin
- Qualquer ferramenta interna Dashi
- (Opcional) Landing marketing completa — deep link direto para `/auth` ou `/journey`

---

## 10. Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| MediaPipe lento em Android low-end | Flexão inutilizável | Device mínimo documentado; reduzir resolução do vídeo; Fase 3b nativa |
| Apple rejeita “wrapper” | Sem iOS | Assets no binário + valor nativo (push/câmera) + metadata honesta |
| OAuth mal configurado | Churn no onboarding | Checklist Redirect URLs + teste em release build (não só debug) |
| Dois canais de push (Web + nativo) | Spam duplicado | Preferência por plataforma; dedupe por `notification` id |
| Drift web × mobile | Bugs só num dos lados | Mesmo QA script; feature flags; smoke checklist por release (**web + nativo**) |
| Plugin Capacitor importado sem guard | Erro/SSR quebrado no web | Só via `platform.ts`; dynamic import |
| “Ajuste rápido” que remove fluxo web | Web produção piora | Regra §0.2 — PR bloqueada se web regressar |
| Pagamentos nas lojas vs Kiwify | Rejeição / chargeback | Decidir modelo antes do IAP; ver `Assinatura-Kiwify.md` |

---

## 11. Estrutura de pasta sugerida (quando implementar)

```text
hero-s-ascent/
  src/                    # app web atual (canônico)
  android/                # projeto Capacitor Android
  ios/                    # projeto Capacitor iOS (fase 6)
  capacitor.config.ts
  plans/
    PlanejamentoMobile-Capacitor.md   # este arquivo
```

Flags úteis no client:

- `Capacitor.isNativePlatform()`
- `Capacitor.getPlatform()` → `'android' | 'ios' | 'web'`

Usar para: pedir permissão de câmera, registrar push token, esconder Web Push no nativo, abrir links externos.

---

## 12. Ordem de prioridade (resumo executivo)

1. **Capacitor Android** com core do produto (+ `platform.ts` + smoke web)  
2. **Google OAuth** via browser nativo  
3. **Câmera / flexão** validada em devices reais  
4. **Push nativo** (FCM) alinhado aos jobs atuais  
5. Polimento Play Store  
6. **iOS** só depois do Android estável  
7. **Charlie Call** nativo → depois **Despertador** (docs irmãos)  
8. Pose nativa / RN **somente** se a métrica da flexão exigir  

---

## 13. Checklist rápido “estamos prontos para Capacitor?”

### Preparação (contas / produto)

- [ ] Build web estável em produção  
- [ ] Flexão ok no Chrome Android (baseline)  
- [ ] Política de privacidade menciona câmera on-device  
- [ ] Conta Google Cloud + SHA-1 do keystore  
- [ ] Decisão Live URL vs assets (§5)  
- [ ] Dono do app na Play (organização / conta)  
- [ ] Alguém com device físico para QA semanal  

### Proteção da web (antes do 1º merge Capacitor)

- [ ] Helper `platform.ts` combinado  
- [ ] Regra de PR: smoke web obrigatório  
- [ ] Nenhum plugin sem guard no código compartilhado  
- [ ] Live URL (A) na fase interna — evita forçar mudanças no pipeline web cedo demais  

---

## 14. Glossário

| Termo | Significado |
| --- | --- |
| **Capacitor** | Runtime Ionic que embute WebView + plugins nativos |
| **Bridge** | Ponte JS ↔ código nativo (câmera, push, etc.) |
| **Custom Tabs** | Browser in-app Android (bom para OAuth) |
| **FCM / APNs** | Push Google / Apple |
| **Live URL** | Shell que carrega o site em produção |
| **Web canônico** | Este repositório web é a fonte das features |
| **platform.ts** | Camada única de detecção native/web + wrappers seguros |

---

## 15. Próximo passo concreto

Quando for **implementar** (não só planejar):

1. Criar branch `feat/mobile-capacitor-android`
2. Adicionar `src/lib/platform.ts` + Capacitor + projeto Android
3. Rodar smoke nativo (§6 Fase 1) **e** smoke web (§0.2)
4. Só então abrir Fase 2 (Google) e Fase 3 (câmera)
5. Call / Despertador só após push nativo estável

Até lá, este documento é a **bússola**: web primeiro, Capacitor como shell inteligente, nativo puro só sob evidência.

---

*Plano vivo. Ao mudar auth, push ou o pipeline de exercícios, atualize as seções 0, 4, 6–8 e 10.*
