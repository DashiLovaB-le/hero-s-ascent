# Mobile Capacitor — V-Project

## Shell

- Config: `capacitor.config.ts` (Live URL → `https://v-project-rho.vercel.app`)
- Android: pasta `android/`
- Helpers web-safe: `src/lib/platform.ts`
- OAuth nativo: `src/lib/native-oauth.ts` (Custom Tabs + `com.vproject.app://auth`)
- Boot nativo: `src/components/NativeShellHost.tsx`

## Comandos

Requer **JDK 21** (ex.: Android Studio JBR):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run cap:sync
npm run cap:build:apk
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## Google OAuth nativo — checklist (passo a passo)

O código já abre o Google em **Custom Tabs** e espera o retorno em `com.vproject.app://auth`.
Web continua com redirect `https://…/auth` (sem mudança para o usuário no browser).

### A) Supabase (Auth → URL Configuration)

1. Abra o projeto Supabase → **Authentication** → **URL Configuration**.
2. Em **Redirect URLs**, adicione (uma por linha):
   - `com.vproject.app://auth`
   - `https://v-project-rho.vercel.app/auth`
   - `http://localhost:3000/auth` (ou a porta local que você usa, se testar web)
3. **Site URL** pode permanecer `https://v-project-rho.vercel.app`.
4. Salve.

### B) Google Cloud (OAuth client do Supabase)

O Supabase usa o **Client ID Web** do Google (não é o client “Android” do Firebase).

1. Abra [Google Cloud Console](https://console.cloud.google.com/) → APIs e serviços → **Credenciais**.
2. Abra o OAuth client do tipo **Web application** que já está no Supabase (Authentication → Providers → Google).
3. Em **URIs de redirecionamento autorizados**, garanta o callback do Supabase:
   - `https://gmzddccyikpxbiozsiue.supabase.co/auth/v1/callback`
4. Não precisa colocar `com.vproject.app://auth` no Google — o Google redireciona para o Supabase; o Supabase é quem redireciona para o scheme do app.
5. Salve.

### C) (Opcional) Client Android no Google Cloud

Só necessário se no futuro você usar Google Sign-In nativo SDK. **Não é obrigatório** para o fluxo atual (Custom Tabs + Supabase).

### D) Deploy do front

1. Faça deploy da web (Vercel) com o código novo (`native-oauth`, `auth.tsx`, `NativeShellHost`).
2. Como o APK usa Live URL, o shell já puxa a auth nova **depois** do deploy — mas o **intent-filter** do deep link exige rebuild do APK (passo E).

### E) Rebuild do APK (só a parte nativa do deep link)

1. Confirme `android/app/src/main/AndroidManifest.xml` com o intent-filter `com.vproject.app` / host `auth`.
2. Rode:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run cap:sync
npm run cap:build:apk
```

3. Instale `android/app/build/outputs/apk/debug/app-debug.apk` no aparelho (substituindo o anterior).

### F) Teste no aparelho

1. Abra o app → tela de auth → **Continuar com Google**.
2. Deve abrir **Custom Tabs** (Chrome), não a WebView interna.
3. Escolha a conta Google.
4. Após autorizar, o Custom Tab fecha / volta ao app.
5. Deve cair em `/auth` com a porta/welcome (flag de door) e seguir para a jornada.
6. Mate o app (swipe away) e reabra: sessão deve persistir.
7. Logout → login Google de novo (troca de conta: `prompt=select_account`).

### G) Se falhar — diagnóstico rápido

| Sintoma | Causa comum | Ação |
| --- | --- | --- |
| Fica preso no WebView / `disallowed_useragent` | OAuth ainda no WebView | Confirme deploy + que `isNativePlatform()` é true no APK |
| Volta do Google e nada acontece | Redirect URL não liberada no Supabase | Adicione `com.vproject.app://auth` nas Redirect URLs |
| `redirect_uri_mismatch` no Google | Callback Supabase ausente no client Web | Adicione `https://…supabase.co/auth/v1/callback` |
| App não abre após login | Intent-filter / APK velho | Rebuild APK com Manifest atualizado |
| `code verifier not found` | PKCE perdido (storage limpo no meio) | Não limpe dados do app durante o login; refaça o fluxo |

## Push nativo (FCM) — pendente (não rebuild agora)

1. Crie app Android no Firebase (`com.vproject.app`)
2. Baixe `google-services.json` → `android/app/google-services.json` (não commitiar)
3. No servidor (Vercel / `.env`): `FCM_SERVER_KEY` (Cloud Messaging API legacy server key)
4. No app: Perfil → Ativar push neste aparelho
5. Tokens ficam em `push_devices`; Web Push continua em `push_subscriptions`

Sem `google-services.json` o shell abre, mas o registro FCM falha (esperado).

## Web

Não é afetada: Capacitor só adiciona bridges com guard. Smoke web após mudanças mobile (login Google no browser deve continuar igual).
