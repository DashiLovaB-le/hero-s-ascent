# Relação de Ícones e Emojis — V-Project

Inventário para troca em lote por assets de bibliotecas externas.  
Gerado a partir do código em `src/` e seeds em `supabase/migrations/`.

**Legenda**
- **Tipo**: `emoji` (Unicode), `lucide` (componente Lucide React), `slug` (string no banco, nome estilo Lucide), `imagem` (PNG/JPG em `/public`)
- **Imagem esperada**: descrição visual do que o símbolo representa (para busca em packs)

---

## 1. Emojis Unicode (prioridade para troca)

| # | Símbolo | Nome / busca sugerida | Imagem esperada | Arquivo | Linha(s) | Uso |
|---|---------|----------------------|-----------------|---------|----------|-----|
| 1 | 💪 | flexed biceps / muscle | Braço flexionado mostrando bíceps (força física) | `src/lib/journey.ts` | 56 | Categoria **Corpo** (definição) |
| 2 | 🧠 | brain | Cérebro (mente, foco, intelecto) | `src/lib/journey.ts` | 57 | Categoria **Mente** |
| 3 | 🕊️ | dove | Pomba branca em voo (espírito, paz) | `src/lib/journey.ts` | 58 | Categoria **Espírito** |
| 4 | 💰 | money bag | Saco de dinheiro com cifrão (prosperidade) | `src/lib/journey.ts` | 59 | Categoria **Prosperidade** |
| 5 | 🤝 | handshake | Aperto de mãos (relacionamentos) | `src/lib/journey.ts` | 60 | Categoria **Relacionamentos** |
| 6 | 🏛️ | classical building | Templo/edifício clássico com colunas (propósito, legado) | `src/lib/journey.ts` | 61 | Categoria **Propósito** |
| 7 | 🔥 | fire / flame | Chama de fogo (streak / sequência diária) | `src/routes/_authenticated/journey.tsx` | 91 | Toast ao concluir hábito (`Streak N🔥`) |

### Onde os emojis de categoria são renderizados

Os itens 1–6 são definidos em `CATEGORIAS` e reutilizados assim:

| Arquivo | Linha(s) | Contexto |
|---------|----------|----------|
| `src/routes/_authenticated/onboarding.tsx` | 80 | Card da área escolhida (emoji grande) |
| `src/routes/_authenticated/onboarding.tsx` | 101 | Lista de metas sugeridas |
| `src/routes/_authenticated/goals.tsx` | 87 | `<SelectItem>` ao escolher categoria |
| `src/routes/_authenticated/goals.tsx` | 114 | Lista de metas salvas |
| `src/routes/_authenticated/goals.tsx` | 131 | Rascunhos de meta |
| `src/routes/_authenticated/habits.tsx` | 205 | `<SelectItem>` ao criar hábito |

**Dica de lote:** trocar só em `src/lib/journey.ts` (campo `emoji`) propaga para onboarding, metas e hábitos, **exceto** o 🔥 do toast na linha 91 de `journey.tsx`.

---

## 2. Ícones Lucide — telas do produto

Biblioteca: [`lucide-react`](https://lucide.dev). Nome do componente = slug Lucide.

### Landing (`src/routes/index.tsx`)

| Componente | Imagem esperada | Linha definição | Linha render |
|------------|-----------------|-----------------|--------------|
| `TrendingUp` | Gráfico/seta subindo (evolução, XP) | 11 | 152 (`<p.icon />` no mapa PILARES) |
| `Shield` | Escudo (atributos / proteção) | 16 | 152 |
| `Flame` | Chama (streak) | 21 | 152 |
| `Compass` | Bússola (capítulos / jornada) | 26 | 152 |
| `Sword` | Espada (missões) | 31 | 152 |
| `Sparkles` | Brilhos/estrelas (Charlie / magia) | 36 | 152 |

### Layout autenticado (`src/routes/_authenticated/route.tsx`)

| Componente | Imagem esperada | Linha(s) | Uso |
|------------|-----------------|----------|-----|
| `LayoutDashboard` | Grade/painel de dashboard | 43, 73 | Nav **Jornada** (desktop + mobile) |
| `Flame` | Chama | 44, 74 | Nav **Hábitos** |
| `Target` | Alvo circular com mira | 56, 76 | Nav **Metas** |
| `User` | Silhueta de pessoa | 57, 77 | Nav **Perfil** |
| `LogOut` | Seta saindo de porta | 60 | Botão sair |

### Jornada (`src/routes/_authenticated/journey.tsx`)

| Componente | Imagem esperada | Linha | Uso |
|------------|-----------------|-------|-----|
| `ArrowRight` | Seta para a direita | 110 | CTA continuar onboarding |
| `Flame` | Chama | 139 | Badge de streak |
| `ChevronRight` | Chevron `>` | 173 | Link “Gerenciar” hábitos |
| `Target` | Alvo | 182 | Estado vazio (sem hábitos) |
| `Check` | Check / visto | 209 | Hábito concluído |
| `Sparkles` | Brilhos | 228 | Mensagem “dia completo” |
| `Trophy` | Troféu | 256, 263 | Título e itens de conquistas |

### Hábitos (`src/routes/_authenticated/habits.tsx`)

| Componente | Imagem esperada | Linha | Uso |
|------------|-----------------|-------|-----|
| `Plus` | Sinal de adição `+` | 118 | Botão “Novo” |
| `Flame` | Chama | 146 | Botão “Fazer / Feito” |
| `Trash2` | Lixeira | 149 | Remover hábito |

### Metas (`src/routes/_authenticated/goals.tsx`)

| Componente | Imagem esperada | Linha | Uso |
|------------|-----------------|-------|-----|
| `Plus` | Sinal `+` | 92 | Adicionar meta |
| `X` | X / fechar | 121, 143 | Remover meta / rascunho |

### Onboarding (`src/routes/_authenticated/onboarding.tsx`)

| Componente | Imagem esperada | Linha | Uso |
|------------|-----------------|-------|-----|
| `Check` | Check | 85 | Área selecionada |
| `ArrowRight` | Seta direita | 91 | Continuar |

### Mentor Charlie

| Componente | Arquivo | Linha | Imagem esperada | Uso |
|------------|---------|-------|-----------------|-----|
| `Swords` | `src/mentor/MentorPage.tsx` | 160 | Duas espadas cruzadas | Card de desafio ativo |
| `Check` | `src/mentor/MentorPage.tsx` | 177 | Check | Concluir desafio |
| `X` | `src/mentor/MentorPage.tsx` | 185 | X | Recusar / adiar desafio |
| `Sparkles` | `src/mentor/MentorPage.tsx` | 200 | Brilhos | Estado vazio da thread |
| `Send` | `src/mentor/MentorPage.tsx` | 253 | Avião de papel / enviar | Enviar mensagem |
| `ChevronRight` | `src/mentor/MentorJourneyCard.tsx` | 24 | Chevron `>` | Link para o mentor |

---

## 3. Slugs de ícone no banco (achievements)

Campo `achievements.icone` — strings no estilo Lucide.  
Hoje a UI de jornada **ainda não renderiza** esses slugs (usa `Trophy` genérico); o valor já está seedado para troca futura.

| Slug | Imagem esperada | Código conquista | Arquivo | Linha |
|------|-----------------|------------------|---------|-------|
| `footprints` | Pegadas / rastros | `primeiro_passo` | `supabase/migrations/20260717004140_complete_schema.sql` | 275 |
| `flame` | Chama | `streak_7` | idem | 276 |
| `crown` | Coroa | `streak_30` | idem | 277 |
| `trophy` | Troféu | `streak_100` | idem | 278 |
| `chevron-up` | Chevron apontando para cima | `primeiro_nivel` | idem | 279 |
| `shield` | Escudo | `cavaleiro` | idem | 280 |
| `star` | Estrela | `lenda` | idem | 281 |

Também referenciado em:
- `src/lib/journey.functions.ts` linha **40** (select `achievements(... icone)`)
- `src/integrations/supabase/types.ts` linhas **21, 29, 37** (tipo TS do campo)

---

## 4. Ícones Lucide — kit UI (shadcn)

Usados pelos componentes em `src/components/ui/`. Úteis se forem trocar o design system inteiro.

| Componente | Arquivo | Linha(s) | Imagem esperada |
|------------|---------|----------|-----------------|
| `X` | `dialog.tsx` | 48 | Fechar modal |
| `X` | `sheet.tsx` | 65 | Fechar sheet |
| `Check` | `checkbox.tsx` | 20 | Checkbox marcado |
| `Check` | `select.tsx` | 121 | Item selecionado |
| `Check` | `dropdown-menu.tsx` | 109 | Item checked |
| `Check` | `menubar.tsx` | 146 | Item checked |
| `Check` | `context-menu.tsx` | 105 | Item checked |
| `ChevronDown` | `select.tsx` | 29, 58 | Abrir select / scroll down |
| `ChevronUp` | `select.tsx` | 44 | Scroll up no select |
| `ChevronDown` | `accordion.tsx` | 31 | Expandir accordion |
| `ChevronDown` | `navigation-menu.tsx` | 51 | Trigger do menu |
| `ChevronRight` | `breadcrumb.tsx` | 75 | Separador |
| `ChevronRight` | `dropdown-menu.tsx` | 37 | Submenu |
| `ChevronRight` | `menubar.tsx` | 73 | Submenu |
| `ChevronRight` | `context-menu.tsx` | 35 | Submenu |
| `ChevronRight` | `pagination.tsx` | 73 | Página seguinte |
| `ChevronLeft` | `pagination.tsx` | 59 | Página anterior |
| `ChevronLeftIcon` | `calendar.tsx` | 113 | Mês anterior |
| `ChevronRightIcon` | `calendar.tsx` | ~117 | Mês seguinte |
| `ChevronDownIcon` | `calendar.tsx` | 120 | Dropdown do calendário |
| `MoreHorizontal` | `pagination.tsx` | 84 | Ellipsis `…` |
| `MoreHorizontal` | `breadcrumb.tsx` | 87 | Ellipsis |
| `Circle` | `radio-group.tsx` | 29 | Bolinha do radio |
| `Circle` | `dropdown-menu.tsx` | 131 | Radio item |
| `Circle` | `menubar.tsx` | 168 | Radio item |
| `Circle` | `context-menu.tsx` | 127 | Radio item |
| `ArrowLeft` | `carousel.tsx` | 197 | Slide anterior |
| `ArrowRight` | `carousel.tsx` | 225 | Próximo slide |
| `Search` | `command.tsx` | 43 | Lupa / busca |
| `Minus` | `input-otp.tsx` | 64 | Traço do OTP |
| `PanelLeft` | `sidebar.tsx` | 279 | Painel / toggle sidebar |
| `GripVertical` | `resizable.tsx` | 31 | Handle de redimensionar (pontos verticais) |

---

## 5. Imagens raster (não são emoji/Lucide)

Incluídas para o inventário visual completo; não são candidatos típicos a pack de emoji.

| Asset | Imagem esperada | Arquivo | Linha(s) |
|-------|-----------------|---------|----------|
| `/logo.png` | Logo V-Project (marca) | `src/routes/index.tsx` | 67 |
| | | `src/routes/_authenticated/route.tsx` | 36 |
| | | `src/routes/auth.tsx` | 165 |
| | | `src/routes/__root.tsx` | 95–96 (favicon / apple-touch) |
| `/charlie.png` | Retrato do mentor Charlie | `src/routes/_authenticated/route.tsx` | 49 |
| | | `src/mentor/CharlieNavButton.tsx` | 19 |
| | | `src/mentor/MentorPage.tsx` | 136 |
| | | `src/mentor/MentorJourneyCard.tsx` | 12 |
| `/images/hero-section-lp.jpg` | Hero da landing (cena/personagem) | `src/routes/index.tsx` | 48 |
| `/images/hero-bg-mobile.png` | BG fixo mobile (cyberpunk) | `src/routes/__root.tsx` | 105 (preload); CSS em `src/styles.css` |
| `/images/hero-bg-desktop.png` | BG desktop | `src/routes/__root.tsx` | 111 (preload) |

---

## 6. Resumo para troca em lote

### Lote A — Emojis de categoria (6 assets)
Fonte única: `src/lib/journey.ts` linhas **56–61**.  
Consumidores: onboarding, goals, habits.

### Lote B — Emoji de streak
`src/routes/_authenticated/journey.tsx` linha **91** → 🔥

### Lote C — Lucide de produto (telas reais)
`Flame`, `Target`, `Check`, `Trophy`, `Sparkles`, `Sword`/`Swords`, `Shield`, `Compass`, `TrendingUp`, `LayoutDashboard`, `User`, `LogOut`, `Plus`, `Trash2`, `X`, `ArrowRight`, `ChevronRight`, `Send`

### Lote D — Slugs de conquistas (7 assets)
Migration `20260717004140_complete_schema.sql` linhas **275–281** + futura UI que renderize `achievements.icone`.

### Lote E — Lucide do design system (opcional)
Pasta `src/components/ui/*` (seção 4).

---

## 7. Lista única de slugs Lucide usados no produto

Para busca rápida em bibliotecas compatíveis com Lucide:

```
arrow-left, arrow-right, check, chevron-down, chevron-left, chevron-right,
chevron-up, circle, compass, flame, grip-vertical, layout-dashboard,
log-out, minus, more-horizontal, panel-left, plus, search, send, shield,
sparkles, sword, swords, target, trash-2, trending-up, trophy, user, x
```

Slugs só no banco (ainda sem componente dedicado na UI):

```
footprints, flame, crown, trophy, chevron-up, shield, star
```
