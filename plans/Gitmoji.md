# Guia Gitmoji — commits do V-Project

Resumo da orientação de [gitmoji.dev](https://gitmoji.dev/) para usar emojis nas mensagens de commit.

**Formato sugerido**

```text
:emoji: mensagem curta em português ou inglês
```

Exemplos:

```text
✨ add wallpaper unlock notifications
🐛 fix notification mark-as-read button
💄 polish profile panorama layout
📝 update README with wallpaper docs
```

> Preferir o emoji Unicode no início da mensagem (como acima) ou o código curto (`:sparkles:`). Manter o resto da mensagem claro e no estilo do repositório.

---

## Como escolher

1. Pense no **efeito principal** do commit (bug, feature, docs, UI…).
2. Use **um emoji** por commit — o que melhor resume a mudança.
3. Se houver breaking change, use 💥 e deixe isso explícito na mensagem.
4. WIP / rascunho: 🚧. Hotfix crítico em produção: 🚑.

---

## Catálogo (código → emoji → uso)

| Código | Emoji | Quando usar |
| --- | --- | --- |
| `:art:` | 🎨 | Melhorar estrutura ou formatação do código |
| `:zap:` | ⚡️ | Melhorar performance |
| `:fire:` | 🔥 | Remover código ou arquivos |
| `:bug:` | 🐛 | Corrigir um bug |
| `:ambulance:` | 🚑️ | Hotfix crítico |
| `:sparkles:` | ✨ | Introduzir novas funcionalidades |
| `:memo:` | 📝 | Adicionar ou atualizar documentação |
| `:rocket:` | 🚀 | Deploy / publicação |
| `:lipstick:` | 💄 | Adicionar ou atualizar UI e estilos |
| `:tada:` | 🎉 | Iniciar um projeto |
| `:white_check_mark:` | ✅ | Adicionar, atualizar ou passar testes |
| `:lock:` | 🔒️ | Corrigir problemas de segurança ou privacidade |
| `:closed_lock_with_key:` | 🔐 | Adicionar ou atualizar secrets |
| `:bookmark:` | 🔖 | Release / tags de versão |
| `:rotating_light:` | 🚨 | Corrigir avisos de compilador / linter |
| `:construction:` | 🚧 | Trabalho em andamento (WIP) |
| `:green_heart:` | 💚 | Corrigir build de CI |
| `:arrow_down:` | ⬇️ | Fazer downgrade de dependências |
| `:arrow_up:` | ⬆️ | Fazer upgrade de dependências |
| `:pushpin:` | 📌 | Fixar dependências em versões específicas |
| `:construction_worker:` | 👷 | Adicionar ou atualizar sistema de CI |
| `:chart_with_upwards_trend:` | 📈 | Adicionar ou atualizar analytics / tracking |
| `:recycle:` | ♻️ | Refatorar código |
| `:heavy_plus_sign:` | ➕ | Adicionar uma dependência |
| `:heavy_minus_sign:` | ➖ | Remover uma dependência |
| `:wrench:` | 🔧 | Adicionar ou atualizar arquivos de configuração |
| `:hammer:` | 🔨 | Adicionar ou atualizar scripts de desenvolvimento |
| `:globe_with_meridians:` | 🌐 | Internacionalização e localização (i18n/l10n) |
| `:pencil2:` | ✏️ | Corrigir typos |
| `:poop:` | 💩 | Código ruim que ainda precisa melhorar |
| `:rewind:` | ⏪️ | Reverter mudanças |
| `:twisted_rightwards_arrows:` | 🔀 | Merge de branches |
| `:package:` | 📦️ | Adicionar ou atualizar arquivos compilados / pacotes |
| `:alien:` | 👽️ | Atualizar código por mudança de API externa |
| `:truck:` | 🚚 | Mover ou renomear recursos (arquivos, paths, rotas) |
| `:page_facing_up:` | 📄 | Adicionar ou atualizar licença |
| `:boom:` | 💥 | Introduzir breaking changes |
| `:bento:` | 🍱 | Adicionar ou atualizar assets |
| `:wheelchair:` | ♿️ | Melhorar acessibilidade |
| `:bulb:` | 💡 | Adicionar ou atualizar comentários no código |
| `:beers:` | 🍻 | Código escrito “de brincadeira” / sob influência |
| `:speech_balloon:` | 💬 | Adicionar ou atualizar textos e literais |
| `:card_file_box:` | 🗃️ | Mudanças relacionadas a banco de dados |
| `:loud_sound:` | 🔊 | Adicionar ou atualizar logs |
| `:mute:` | 🔇 | Remover logs |
| `:busts_in_silhouette:` | 👥 | Adicionar ou atualizar contribuidores |
| `:children_crossing:` | 🚸 | Melhorar UX / usabilidade |
| `:building_construction:` | 🏗️ | Mudanças arquiteturais |
| `:iphone:` | 📱 | Trabalho em design responsivo |
| `:clown_face:` | 🤡 | Mocks |
| `:egg:` | 🥚 | Adicionar ou atualizar easter egg |
| `:see_no_evil:` | 🙈 | Adicionar ou atualizar `.gitignore` |
| `:camera_flash:` | 📷️ | Adicionar ou atualizar snapshots |
| `:alembic:` | ⚗️ | Experimentos |
| `:mag:` | 🔍️ | Melhorar SEO |
| `:label:` | 🏷️ | Adicionar ou atualizar types |
| `:seedling:` | 🌱 | Adicionar ou atualizar seeds |
| `:triangular_flag_on_post:` | 🚩 | Adicionar, atualizar ou remover feature flags |
| `:goal_net:` | 🥅 | Capturar erros |
| `:dizzy:` | 💫 | Adicionar ou atualizar animações e transitions |
| `:wastebasket:` | 🗑️ | Depreciar código que precisa ser limpo |
| `:passport_control:` | 🛂 | Autorização, papéis e permissões |
| `:adhesive_bandage:` | 🩹 | Correção simples de issue não crítica |
| `:monocle_face:` | 🧐 | Exploração / inspeção de dados |
| `:coffin:` | ⚰️ | Remover código morto |
| `:test_tube:` | 🧪 | Adicionar um teste que falha |
| `:necktie:` | 👔 | Adicionar ou atualizar lógica de negócio |
| `:stethoscope:` | 🩺 | Adicionar ou atualizar healthcheck |
| `:bricks:` | 🧱 | Mudanças de infraestrutura |
| `:technologist:` | 🧑‍💻 | Melhorar developer experience (DX) |
| `:money_with_wings:` | 💸 | Patrocínios ou infra relacionada a dinheiro |
| `:thread:` | 🧵 | Multithreading / concorrência |
| `:safety_vest:` | 🦺 | Validação |
| `:airplane:` | ✈️ | Melhorar suporte offline |
| `:t-rex:` | 🦖 | Compatibilidade com versões anteriores |

---

## Atalhos úteis no dia a dia (V-Project)

| Situação | Emoji |
| --- | --- |
| Nova feature (mentor, wallpaper, perfil…) | ✨ |
| Correção de bug | 🐛 |
| Ajuste visual / CSS / componentes UI | 💄 |
| Refatoração sem mudar comportamento | ♻️ |
| Migration / schema / RLS | 🗃️ |
| README, plans, docs | 📝 |
| Assets (imagens, wallpapers, fontes) | 🍱 |
| Textos / copy da UI | 💬 |
| Auth / permissões | 🛂 |
| Notificações, validações, guards | 🦺 / 🥅 |
| Config (env, Vite, Supabase) | 🔧 |
| Dependências | ➕ ➖ ⬆️ ⬇️ |
| WIP | 🚧 |

---

## Referência

- Site oficial: [https://gitmoji.dev/](https://gitmoji.dev/)
- Spec / lista completa: mantenha este arquivo alinhado ao site se novos emojis forem adicionados.
