# Planejamento — MCP na produção (não no Charlie)

Como usar o [Model Context Protocol servers](https://github.com/modelcontextprotocol/servers) para **operar e desenvolver** a V-Project: dump/restore, GitHub, Drive, inspeção de schema, pesquisa, tempo. **Fora do chat do mentor.**

**Status:** planejamento — não implementado no produto.  
**Fonte oficial:** [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) + [MCP Registry](https://registry.modelcontextprotocol.io/).  
**Relacionado:** backup Drive (`plans/PlanejamentoBackupDrive.md`), Discord, control room.

---

## Princípio

MCP aqui é **ferramenta de produção** (Cursor / CI / control room), não feature do herói.

| Usar MCP para | Não usar MCP para |
| --- | --- |
| Dump, restore, inspecionar schema | Charlie falar com o usuário |
| Issues, PRs, Actions no GitHub | Expor `OPENROUTER_API_KEY` no client |
| Upload/listagem de backups no Drive | Dar ao modelo acesso irrestrito ao Postgres de prod |
| Fetch de docs / páginas | Substituir server functions autenticadas |
| Git local (diff, log, blame) | Rodar reference servers “como estão” em prod sem revisão de segurança |

O README oficial avisa: os servers do repo são **referência educacional**, não solução pronta de produção. Avaliar ameaça, permissões e secrets antes de ligar em projeto real.

---

## O que já temos no Cursor

`.cursor/mcp.json` hoje:

| Server | Uso atual |
| --- | --- |
| Motion, Higgsfield, Annnimate | Mídia / vídeo |
| `gsap-master` | Animação landing |

Falta a camada **ops**: Git, GitHub, Postgres/Supabase (read-only), Drive, Fetch, Time.

---

## Servers de referência (repo oficial)

Mantidos pelo steering group — úteis como **padrão de implementação** e, com cuidado, no Cursor.

| Server | Pacote / start | Uso na V-Project |
| --- | --- | --- |
| **Filesystem** | `npx -y @modelcontextprotocol/server-filesystem <pasta>` | Só pastas allowlist (`plans/`, `docs/`, dumps locais). Nunca `.env`. |
| **Git** | `uvx mcp-server-git --repository <repo>` | Log, blame, status no `hero-s-ascent`. |
| **Fetch** | `src/fetch` | Puxar docs (Supabase, Discord, OpenRouter) sem colar HTML cru. |
| **Memory** | `npx -y @modelcontextprotocol/server-memory` | Memória **de ops** (decisões de deploy, IDs de pasta Drive) — **não** `mentor_memories`. |
| **Sequential Thinking** | `src/sequentialthinking` | Incidentes, restore, migrations desalinhadas. |
| **Time** | `src/time` | Cron BRT vs UTC (`notification-jobs` 22:00 BRT). |
| **Everything** | `src/everything` | Só lab / teste do protocolo. |

### Arquivados (ainda úteis como mapa)

Em [servers-archived](https://github.com/modelcontextprotocol/servers-archived). Preferir **forks oficiais atuais** no [Registry](https://registry.modelcontextprotocol.io/).

| Conceito | Encaixa em | Cuidado |
| --- | --- | --- |
| **PostgreSQL** (read-only + schema) | Inspeção de `profiles`, `app_popups`, `discord_*` | Só SELECT; connection string de **read replica / role limitada**, nunca `service_role` no MCP |
| **Google Drive** | Plano de backup off-site | Service Account + pasta compartilhada (mesmo B0 do backup) |
| **GitHub** | PRs, Actions, secrets checklist | PAT com scopes mínimos; nunca token no git |
| **Sentry** | Se/quando houver Sentry | Issues de prod |
| **Slack** | Alternativa a alerta Discord do backup | Fora de escopo agora |
| **Puppeteer** | Smoke da landing / auth | Pesado; Cursor já tem browser MCP |
| **Redis** | Não usamos | Ignorar |

---

## Arquitetura desejada (ops)

```
Cursor (MCP client)
  → Git          (repo local)
  → GitHub       (PRs / Actions / checks)
  → Postgres RO  (schema + queries limitadas)
  → Drive        (listar / subir dumps — fase backup)
  → Fetch        (docs externas)
  → Time         (fusos dos crons)
  → Filesystem   (só plans/docs/backups-tmp)

App V-Project (produção)
  → continua igual: server fns + Supabase + OpenRouter
  → Charlie NÃO vira client MCP
```

OpenRouter (`openrouter/free` ou pago) continua **só no backend** (`src/mentor/openrouter.ts`). MCP não substitui esse proxy.

---

## Mapa produção V-Project → MCP

| Área de prod | Dor atual | MCP / padrão |
| --- | --- | --- |
| Migrations desalinhadas (`db push --include-all`) | Histórico local ≠ remoto | Postgres RO para ver o que existe; Git para achar a migration |
| Backup Drive (planejado) | Dump + upload + retenção | Drive (SA) + Filesystem (arquivo `.sql.gz` local) + Time (cron) |
| Discord / Telegram webhooks | Secrets, endpoint, deploy Edge | GitHub Actions + Fetch docs Discord/Supabase |
| Control room Tokens | Trocar modelo OpenRouter | Sem MCP no app; ops pode Fetch catálogo de models |
| Landing / GSAP | Já temos `gsap-master` | Manter |
| Observabilidade | Falha de job silenciosa | Sequential Thinking + (futuro) Sentry MCP |

---

## Segurança (obrigatório)

- [ ] **Nunca** apontar Filesystem para a raiz do repo sem deny de `.env`, `android/`, `google-services.json`
- [ ] Postgres MCP: role `mcp_readonly` (SELECT em `public`, sem `auth.users` senhas, sem Storage objects binários)
- [ ] GitHub: PAT só `repo` / `actions:read` conforme necessidade
- [ ] Drive: só a pasta `V-Project/Backups`, não o Drive inteiro
- [ ] Reference servers: copiar o **padrão** (tools + allowlist); não ligar archived GitHub/Postgres em prod sem revisar o código atual no Registry
- [ ] MCP **não** recebe `OPENROUTER_API_KEY` nem `SUPABASE_SERVICE_ROLE_KEY`

---

## Todo de implementação (futuro)

### M0 — Decisões
- [ ] Confirmar: MCP só no **Cursor** (dev) nesta fase — não no runtime Vercel
- [ ] Lista allowlist de pastas Filesystem
- [ ] Postgres: criar role read-only no Supabase **ou** adiar até ter staging
- [ ] Drive MCP só depois do B0 de `PlanejamentoBackupDrive.md`

### M1 — Cursor: servers oficiais leves
- [ ] `git` no `hero-s-ascent`
- [ ] `time` (BRT)
- [ ] `fetch` (docs)
- [ ] `filesystem` limitado a `plans/`, `docs/`
- [ ] Documentar no `.cursor/mcp.json` (sem secrets no arquivo)
- [ ] Teste: “qual o último commit da pasta notifications?”

### M2 — GitHub (ops)
- [ ] Escolher server **atual** no Registry (não o archived cego)
- [ ] PAT em env do Cursor / secret local — não commitar
- [ ] Teste: listar checks do último push
- [ ] (Opcional) falha de backup Action → issue automática

### M3 — Postgres read-only (quando houver role)
- [ ] Role `mcp_readonly` + connection string própria
- [ ] Schema inspection: `app_popups`, `discord_link_codes`, `mentor_*`
- [ ] Proibir INSERT/UPDATE/DELETE nas tools
- [ ] Teste: “existe coluna `discord_user_id` em profiles?”

### M4 — Drive (junto do backup)
- [ ] Reusar Service Account do plano de backup
- [ ] Tools: listar pasta backups, confirmar último `.sql.gz`
- [ ] Não apagar arquivos via MCP até retenção estar scriptada

### M5 — Harden
- [ ] README curto em `docs/` ou neste plano: o que cada MCP pode/não pode
- [ ] Revisar `.cursor/mcp.json` no PR (sem tokens)
- [ ] Drill: incidente “migration falhou” usando Sequential Thinking + Git + Postgres RO

**Critério de pronto (fase Cursor):** Git + Time + Fetch + Filesystem restrito ligados; nenhum secret no git; 1 tarefa real de ops feita só com MCP (ex.: conferir schema Discord sem abrir o Dashboard).

---

## Ordem sugerida

1. M0 (escopo Cursor-only)  
2. M1 (Git, Time, Fetch, FS) — baixo risco  
3. M2 GitHub  
4. M3 Postgres RO (depois de role)  
5. M4 Drive (depois de B0 backup)  
6. M5 drill  

---

## Fora de escopo

- Charlie como MCP client / tools no turno do herói  
- `@modelcontextprotocol/server-everything` em produção  
- Redis, Slack, Maps, EverArt  
- Substituir `supabase functions deploy` por MCP  

---

## Referências

- [MCP servers (referência)](https://github.com/modelcontextprotocol/servers)  
- [MCP Registry](https://registry.modelcontextprotocol.io/)  
- [Arquivados](https://github.com/modelcontextprotocol/servers-archived)  
- [Introdução MCP](https://modelcontextprotocol.io/introduction)  
- TypeScript SDK: [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)  
- Backup: `plans/PlanejamentoBackupDrive.md`  
- Charlie (produto, separado): `docs/charlie-metodo/`
