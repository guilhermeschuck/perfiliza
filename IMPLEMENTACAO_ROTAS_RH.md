# Implementacao de Rotas RH

## Objetivo
Cobrir as lacunas de navegacao e API do sistema de RH por fases, com entregas incrementais e validacao tecnica por etapa.

## Fases

### Fase 1 - Navegacao quebrada e rotas read-only
Status: `completed`

- [x] Paginas faltantes do menu:
  - `/admin/empresas`
  - `/admin/candidatos`
  - `/admin/analises/ia`
  - `/empresa/relatorios`
  - `/candidato/notificacoes`
- [x] Rotas read-only no backend:
  - `GET /api/admin/companies`
  - `GET /api/admin/candidates`
  - `GET /api/admin/analyses/ia-metrics`
  - `GET /api/company/reports/overview`
  - `GET /api/candidate/notifications`
- [x] Proxies Next para essas rotas em `app/api`
- [x] Validacao tecnica (tsc, route:list, curl)

### Fase 2 - Operacoes principais de vagas e analises
Status: `completed`

- [x] CRUD/status de vagas (admin)
- [x] Listagem de candidatos por vaga
- [x] Acao "Iniciar analise" e "Reprocessar analise"
- [x] Endpoint de detalhe de analise por aplicacao

### Fase 3 - Perfil, curriculo e configuracoes persistentes
Status: `completed`

- [x] `GET/PATCH` perfil do candidato
- [x] `POST/GET/DELETE` curriculo do candidato
- [x] Persistencia de configuracoes por perfil (`admin`, `empresa`, `candidato`)
- [x] Notificacoes com marcação de leitura

### Fase 4 - Relatorios e exportacao
Status: `completed`

- [x] Funil da empresa
- [x] Fontes de candidatos
- [x] Tempo medio de contratacao
- [x] Exportacao de analise

### Fase 5 - Endurecimento da API
Status: `completed`

- [x] Migrar closures para controllers por dominio
- [x] Padrao de request/response e validacao
- [x] Cobertura de testes de feature por modulo

## Registro de Progresso

- 2026-03-13: Documento criado. Fase 1 iniciada.
- 2026-03-13: Fase 1 concluida com 5 paginas novas, 5 endpoints read-only no backend e 5 proxies Next.
- 2026-03-13: Validacao concluida com `pnpm exec tsc --noEmit`, `php artisan route:list --path=api` e `curl` nos endpoints novos (backend e proxies Next).
- 2026-03-13: Fase 2 iniciada com endpoints/proxies para status de vaga, candidatos por vaga e ciclo de analise (start/reprocess + detalhe).
- 2026-03-13: Frontend admin conectado aos novos endpoints de status de vagas e processamento de analise.
- 2026-03-13: CRUD completo de vagas entregue (criar, editar, excluir e alterar status) com integracao em `admin/vagas`.
- 2026-03-13: Validacao de CRUD executada com `curl` no backend (`:8000`) e nos proxies Next (`:3000`).
- 2026-03-13: Fase 3 concluida com endpoints/proxies de perfil, curriculo, configuracoes e notificacoes com leitura persistente.
- 2026-03-13: Frontend conectado para salvar perfil/curriculo do candidato, persistir configuracoes e marcar notificacoes como lidas.
- 2026-03-13: Fase 4 concluida com novos relatorios (`funnel`, `sources`, `hiring-time`) e endpoint de exportacao de analise.
- 2026-03-13: Pagina de relatorios da empresa atualizada para consumir os novos endpoints e detalhe de analise admin com exportacao JSON.
- 2026-03-13: Fase 5 concluida com migracao de `api.php` para controllers por dominio e validacoes em FormRequests.
- 2026-03-13: Suite de testes de feature criada por modulo (`admin jobs`, `candidate`, `reports`, `settings`) com `php artisan test` passando.
