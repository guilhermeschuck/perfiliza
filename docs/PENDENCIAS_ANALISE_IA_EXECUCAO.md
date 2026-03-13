# Pendências da Análise de Currículos com IA

Data de início da execução: 2026-03-13
Status geral: Em execução

## Objetivo
Consolidar e executar as pendências do pipeline de análise de currículos (PDF, vínculos, skills, LinkedIn e geração automática de relatórios com IA).

## Backlog consolidado

## P0 - Core de análise IA
- [x] Integrar provedor LLM real para análise estruturada (com fallback controlado).
- [x] Validar saída do modelo com schema estrito antes de persistir.
- [x] Implementar retries com backoff e tratamento de erro por tentativa.
- [x] Registrar auditoria por execução (prompt/version, modelo, resultado, erro, duração).

## P0 - Persistência e trilha de decisão
- [x] Criar entidades para perfil enriquecido por IA do candidato.
- [x] Persistir breakdown de score por dimensão e peso aplicado.
- [x] Registrar ajustes e justificativas de score (aplicado x solicitado).
- [x] Criar logs de auditoria de análise para rastreabilidade e compliance.

## P0 - Score configurável por vaga
- [x] Definir pesos configuráveis por vaga para dimensões de score.
- [x] Aplicar pesos no cálculo de compatibilidade final.
- [x] Expor pesos no payload de análise/export para explicabilidade.

## P1 - Coerência currículo x LinkedIn x vínculo
- [x] Detectar divergência entre LinkedIn do currículo e LinkedIn informado no perfil.
- [x] Incluir vínculo de submissão (candidato/empresa) no contexto da consistência.
- [x] Gerar sinal de consistência de identidade para o relatório final.

## P1 - Relatórios automáticos
- [x] Gerar relatório textual enriquecido (markdown) automaticamente por análise.
- [x] Estruturar conteúdo com resumo executivo, riscos, recomendações e trilha de score.
- [x] Preparar contrato para exportação em PDF (URL/arquivo e metadados).

## P1 - Observabilidade e operação
- [x] Adicionar correlação por `analysis_run_id` nos eventos críticos.
- [x] Registrar métricas operacionais básicas (tempo, falha, retries).
- [ ] Definir baseline de SLA técnico do pipeline.

## P1 - LGPD e governança
- [x] Definir retenção e minimização de dados de currículo bruto. (implementado via comando `analysis:cleanup-sensitive-data`)
- [x] Marcar base legal e finalidade por processamento no registro de auditoria.
- [x] Criar trilha de revisão manual para decisões automatizadas.

## Andamento desta execução

### Sprint técnica iniciada (2026-03-13)
- [x] Backlog consolidado em documento versionável.
- [x] Implementação do bloco de persistência (perfil IA, score, auditoria).
- [x] Implementação do serviço de IA estruturada com validação/retry.
- [x] Integração do pipeline com novos registros e relatório enriquecido.
- [x] Aplicação de pesos por vaga no cálculo de score.
- [x] Atualização da suíte de testes.

## Critério de pronto desta etapa
- APIs mantêm compatibilidade de contrato atual.
- Novas tabelas e modelos ativos com migração aplicada.
- Pipeline salva auditoria e score breakdown por execução.
- Testes de integração do backend passando.
