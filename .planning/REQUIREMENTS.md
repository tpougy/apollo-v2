# Requirements: Apollo v2 — Milestone v1.4

**Milestone:** v1.4 — CLI instalável via `uv tool install`, sem dependência de admin token no fluxo de uso real
**Status:** Defining → Roadmap in progress

## Context

Esta milestone nasceu de uma discussão (não de research) sobre por que `cli/` não pode ser instalado hoje via `uv tool install` fora do checkout do monorepo. Duas causas raiz identificadas e uma simplificação adicional de auth, todas confirmadas lendo o código-fonte do projeto e do SDK `instantdb` (Python) instalado, mais o código-fonte oficial do client JS do InstantDB no GitHub:

1. `cli/apollo_cli/bizdays.py` localiza `shared/anbima-calendar.json` via `find_repo_root()`, que resolve a partir de `Path(__file__)` — quebra assim que o pacote é copiado para um venv isolado (`uv tool install`), pois nunca mais encontra `shared/` do monorepo.
2. `cli/apollo_cli/config.py::load_instant_config()` exige um `.env.instantdb` (achado do mesmo jeito, via `find_repo_root()`) para resolver o `app_id` — mas `NEXT_PUBLIC_INSTANT_APP_ID` não é secreto (já é público no bundle do `web/`), então pode ter um default embutido no pacote.
3. Ao investigar a real necessidade de `.env.instantdb`, descobrimos que `apollo auth login` hoje depende de `INSTANT_APP_ADMIN_TOKEN` porque usa `client.auth.send_magic_code`/`check_magic_code` do pacote `instantdb` (Python "Admin SDK"), que chamam `POST /admin/send_magic_code` / `POST /admin/verify_magic_code` — endpoints que exigem admin token (`_sync/http.py::_validate_auth`). Confirmado no código-fonte oficial do InstantDB (`client/packages/core/src/authAPI.ts`, repo `instantdb/instant`) que existem endpoints públicos equivalentes usados pelo próprio SDK JS/web: `POST /runtime/auth/send_magic_code` e `POST /runtime/auth/verify_magic_code`, sem exigir nenhuma autorização, só `app-id` + `email`/`code` no corpo. O pacote Python já usa esse padrão `/runtime/auth/*` + `unauthenticated=True` para `verify_token` (refresh token) mas nunca estendeu a magic code — lacuna de escopo do pacote, não restrição deliberada da API.

**Decisão de implementação registrada** (não é uma pergunta em aberto — já foi decidida em conversa antes desta milestone): `admin_token_present`/`apollo doctor` permanecem exatamente como estão hoje. Servem só para apoiar desenvolvimento do projeto (ex.: um agente de IA verificando se o `.env.instantdb` local tem o token de admin configurado para tarefas administrativas/seed), mesmo não sendo mais necessários no caminho de uso real do CLI após esta milestone.

## v1 Requirements

### Empacotamento (PKG)

- [ ] **PKG-01**: O calendário ANBIMA vendorizado (`shared/anbima-calendar.json`) tem uma cópia dentro do pacote Python (`cli/apollo_cli/data/anbima-calendar.json`), incluída no wheel via package-data do `uv_build`, e `cli/apollo_cli/bizdays.py` lê essa cópia via `importlib.resources` — nunca mais via `find_repo_root()`.
- [ ] **PKG-02**: Existe um teste automatizado que garante paridade byte-a-byte entre `shared/anbima-calendar.json` (fonte original, também usada pelo `web/`) e `cli/apollo_cli/data/anbima-calendar.json` (cópia vendorizada), falhando se alguém editar um e esquecer o outro.
- [ ] **PKG-03**: `cli/apollo_cli/config.py` tem um `app_id` default embutido no pacote (extraído do `.env.instantdb` atual da raiz do repo), usado quando nenhum `.env.instantdb`/`APOLLO_ENV_FILE`/argumento explícito resolve um app_id — eliminando a obrigatoriedade de `.env.instantdb` para o caso comum de uso pós-instalação.
- [ ] **PKG-04**: `.env.instantdb`/`APOLLO_ENV_FILE` continuam funcionando como override válido do `app_id` embutido (para apontar a outro app InstantDB, ex. staging), sem quebrar a ordem de resolução hoje existente (argumento explícito > `APOLLO_ENV_FILE` > `.env.instantdb` via `find_repo_root()` > default embutido).
- [ ] **PKG-05**: O pacote `cli/` builda e instala com sucesso via `uv build`/`uv tool install` a partir de um checkout limpo, e `apollo --version`/`apollo doctor`/qualquer subcomando de leitura funciona rodando de um diretório fora do repo `apollo-v2` (comprovado via instalação real em ambiente isolado, não apenas inspeção estática).

### Autenticação (AUTH)

- [ ] **AUTH-01**: `apollo auth login` (envio e verificação de magic code) chama diretamente `POST {api_uri}/runtime/auth/send_magic_code` e `POST {api_uri}/runtime/auth/verify_magic_code` via `httpx`, em vez de `client.auth.send_magic_code`/`check_magic_code` do pacote `instantdb` — eliminando a exigência de `INSTANT_APP_ADMIN_TOKEN` no fluxo de login.
- [ ] **AUTH-02**: O formato de saída observável de `apollo auth login` (JSON em stdout/stderr, exit codes, mensagens de erro para código expirado/inválido/rede) permanece idêntico ao comportamento atual — mudança é só na implementação interna de transporte.
- [ ] **AUTH-03**: Nenhum comando do CLI, incluindo `apollo auth login`, lê ou depende de `INSTANT_APP_ADMIN_TOKEN` para funcionar operacionalmente. `session_client()` continua nunca carregando admin token (comportamento já existente, preservado).
- [ ] **AUTH-04**: `admin_token_present` (campo em `InstantConfig`) e o comando `apollo doctor` continuam existindo e funcionando exatamente como hoje — apoio a desenvolvimento/operações do projeto, não removidos nem alterados além do necessário para refletir a mudança de resolução do `app_id` (PKG-03/PKG-04).
- [ ] **AUTH-05**: Testes existentes que hoje verificam ausência de admin token durante o uso normal (`tests/test_auth_rejection.py`, `tests/test_instant_client.py`) são atualizados para refletir a garantia mais forte ("CLI nunca usa admin token em lugar nenhum, nem no login"), sem perder a intenção original de que a sessão do usuário nunca carrega admin token.

## Future Requirements

<!-- Table-stakes deferidos, não nesta milestone -->

- Novo mecanismo de storage de config (ex. `~/.config/apollo-cli/config.toml`) para múltiplos apps InstantDB simultâneos — não há caso de uso real hoje (single-user, single-app)
- Publicação real no PyPI / CI de release automatizado — fora do escopo desta milestone, que resolve apenas a instalabilidade local via `uv tool install`

## Out of Scope

<!-- Exclusões explícitas desta milestone, com razão -->

- Qualquer mudança no `web/` — a mudança de auth/config é isolada ao `cli/`; o SPA já usa o client SDK JS, que já chama os endpoints `/runtime/auth/*` nativamente
- Qualquer mudança em schema (`shared/instant.schema.ts`) ou permissões (`instant.perms.ts`)
- Qualquer mudança de comportamento observável dos demais subcomandos do CLI (`fundo`, `projeto`, `etapa`, `tarefa`, `ticket`, `subtarefa`, `rotina`, `log-inferencia`, `routine-job`)
- Suporte a múltiplos apps InstantDB simultâneos, ou qualquer novo arquivo/diretório de config além do já existente `.env.instantdb`/`APOLLO_ENV_FILE`/`~/.config/apollo-cli/session`
- Publicação real no PyPI, CI/CD de release
- Remoção de `admin_token_present`/`apollo doctor` — decisão explícita de manter, registrada no Context acima

## Traceability

| Requirement | Phase |
|-------------|-------|
| PKG-01 | TBD (roadmap) |
| PKG-02 | TBD (roadmap) |
| PKG-03 | TBD (roadmap) |
| PKG-04 | TBD (roadmap) |
| PKG-05 | TBD (roadmap) |
| AUTH-01 | TBD (roadmap) |
| AUTH-02 | TBD (roadmap) |
| AUTH-03 | TBD (roadmap) |
| AUTH-04 | TBD (roadmap) |
| AUTH-05 | TBD (roadmap) |
