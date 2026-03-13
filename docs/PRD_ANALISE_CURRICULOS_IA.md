# PRD - Analise de Curriculos com IA

## 1. Metadados
- Produto: Perfiliza - Modulo de Analise de Curriculos com IA
- Versao do documento: v1.0
- Data: 2026-03-13
- Status: Draft para execucao
- Dono do produto: RH / Operacoes de Talentos
- Dono tecnico: Engenharia

## 2. Contexto
O sistema atual ja possui fluxo de candidaturas, upload de curriculo e pagina de analise, mas a analise ainda e baseada em heuristicas mockadas no backend (`DemoStateService::buildCompletedAnalysis`). O produto precisa evoluir para uma esteira real de IA com extracao de PDF, conciliacao com LinkedIn, score por vaga e relatorio automatico auditavel.

## 3. Problema
- Triagem manual e lenta para grande volume de curriculos.
- Dificuldade de padronizar avaliacao entre recrutadores.
- Baixa rastreabilidade de por que um candidato foi aprovado ou rejeitado.
- Falta de comparacao objetiva entre dados do curriculo e dados do LinkedIn.

## 4. Objetivos de negocio
- Reduzir tempo de triagem inicial por candidato em pelo menos 60%.
- Aumentar consistencia de avaliacao entre recrutadores.
- Gerar relatorio padrao com justificativas e evidencias por candidato.
- Entregar ranking priorizado por aderencia a vaga.

## 5. Objetivos de produto
- Extrair automaticamente dados de curriculo (PDF; OCR quando necessario).
- Estruturar experiencias, vinculos, skills, formacao e certificacoes.
- Cruzar curriculo x LinkedIn para sinalizar consistencia e gaps.
- Calcular score por vaga com pesos configuraveis.
- Gerar relatorio automatico em JSON + visualizacao no painel.

## 6. Nao objetivos (nesta fase)
- Decisao final 100% automatica sem revisao humana.
- Predicao de performance futura com garantia causal.
- Scraping nao autorizado de dados privados de LinkedIn.
- Eliminacao de etapas de entrevista humana.

## 7. Personas
- Recrutador(a): precisa shortlist rapido com justificativa.
- Lider de area: valida candidatos finalistas e gaps tecnicos.
- Operacoes RH: monitora SLA, qualidade e auditoria.
- Admin: ajusta pesos de score e regras de compliance.

## 8. Escopo funcional (produto alvo)
1. Ingestao
- Upload de curriculo em PDF/DOC/DOCX.
- Captura de URL do LinkedIn.
- Captura de consentimento LGPD (uso para triagem automatizada).

2. Extracao de dados
- Parser de texto nativo do PDF.
- Fallback OCR para PDF escaneado.
- Normalizacao de datas, cargos, empresas e skills.

3. Analise com IA
- Extracao estruturada com schema JSON fixo.
- Calculo de confianca por campo.
- Consolidacao de perfil profissional (resumo tecnico e comportamental).

4. Conciliacao de fontes
- Comparar historico de experiencias PDF x LinkedIn.
- Detectar divergencias de cargo, periodo e senioridade.
- Sinalizar links ausentes e baixa confiabilidade de dados.

5. Scoring e recomendacao
- Score geral de aderencia por vaga.
- Subscores: skills obrigatorias, experiencia, senioridade, estabilidade e formacao.
- Recomendacao: Aprovar, Revisar, Rejeitar (com justificativa).

6. Relatorio automatico
- Resumo executivo.
- Evidencias e gaps.
- Riscos de consistencia.
- Perguntas sugeridas para entrevista.
- Exportacao JSON e PDF.

7. Painel RH
- Fila de analise (pendente, em progresso, concluida, erro).
- Ranking por score.
- Filtros por vaga, status e faixas de score.
- Historico de reprocessamento.

## 9. Requisitos funcionais (RF)
- RF-001: Sistema deve receber curriculo e URL LinkedIn na candidatura.
- RF-002: Sistema deve armazenar arquivo original e metadados de ingestao.
- RF-003: Sistema deve extrair texto de PDF nativo.
- RF-004: Sistema deve usar OCR quando o PDF nao possuir texto extraivel.
- RF-005: Sistema deve produzir estrutura padrao de dados do candidato.
- RF-006: Sistema deve calcular confianca por campo extraido.
- RF-007: Sistema deve comparar informacoes de experiencia e skills entre fontes.
- RF-008: Sistema deve calcular score por vaga com pesos configuraveis.
- RF-009: Sistema deve gerar relatorio automatico em ate 2 formatos (JSON/PDF).
- RF-010: Sistema deve registrar trilha de auditoria (entrada, prompt, modelo, saida, timestamp).
- RF-011: Sistema deve permitir reprocessamento manual de analise.
- RF-012: Sistema deve manter historico de versoes da analise.

## 10. Requisitos nao funcionais (RNF)
- RNF-001: P95 de processamento por candidato <= 90s no MVP.
- RNF-002: Disponibilidade da API de analise >= 99.5%.
- RNF-003: Observabilidade com logs estruturados e correlacao por `analysis_id`.
- RNF-004: Dados sensiveis criptografados em repouso e em transito.
- RNF-005: Retencao e exclusao de dados conforme politica LGPD.
- RNF-006: Fail-safe; erro de IA nao pode corromper candidatura.

## 11. Arquitetura alvo
1. Frontend (Next.js)
- Fluxo de upload, status de analise, visualizacao de relatorio.

2. API BFF (Next API routes)
- Proxy para backend Laravel.

3. Backend (Laravel)
- Endpoints de ingestao, orquestracao, scoring e exportacao.
- Jobs assincros para parser e IA (queue).

4. Storage
- Arquivos de curriculo em armazenamento de objetos.
- Banco relacional para dados estruturados e historico de analise.

5. Motor IA
- Extracao estruturada (LLM em JSON mode).
- Classificacao de aderencia e geracao de resumo.

## 12. Modelo de dados (alto nivel)
1. `resumes`
- `id`, `candidate_id`, `file_url`, `file_name`, `file_hash`, `mime`, `size_bytes`, `uploaded_at`

2. `resume_parses`
- `id`, `resume_id`, `raw_text`, `ocr_used`, `language`, `parse_status`, `error`, `created_at`

3. `candidate_profiles_ai`
- `id`, `candidate_id`, `source` (`resume`, `linkedin`, `merged`), `structured_json`, `confidence_json`, `created_at`

4. `analysis_runs`
- `id`, `application_id`, `job_id`, `status`, `model_name`, `prompt_version`, `started_at`, `finished_at`, `error`

5. `analysis_scores`
- `id`, `analysis_run_id`, `overall_score`, `skills_score`, `experience_score`, `seniority_score`, `stability_score`, `education_score`, `consistency_score`

6. `analysis_reports`
- `id`, `analysis_run_id`, `report_json`, `report_markdown`, `report_pdf_url`, `created_at`

7. `analysis_audit_logs`
- `id`, `analysis_run_id`, `step`, `input_ref`, `output_ref`, `metadata_json`, `created_at`

## 13. Contratos de API (alto nivel)
1. `POST /api/admin/applications/{id}/analysis/start`
- Inicia pipeline assincro.
- Resposta: `analysis_run_id`, `status`.

2. `GET /api/admin/applications/{id}/analysis`
- Retorna ultimo estado e resultado.

3. `POST /api/admin/applications/{id}/analysis/reprocess`
- Reexecuta pipeline com nova versao de prompt/modelo.

4. `GET /api/admin/applications/{id}/analysis/export?format=json|pdf`
- Exporta relatorio.

5. `PATCH /api/admin/jobs/{id}/analysis-weights`
- Atualiza pesos da formula de score por vaga.

## 14. Pipeline de IA
1. Parser
- Extrai texto bruto e estrutura preliminar.

2. Entity extraction
- LLM converte texto para JSON schema:
  - dados pessoais
  - experiencias (empresa, cargo, inicio, fim, vinculo)
  - skills (tecnicas e comportamentais)
  - educacao e certificacoes
  - idiomas

3. Enriquecimento LinkedIn
- Entrada principal: URL + dados declarados.
- No MVP, sem scraping autenticado.
- Quando houver texto publico permitido, gerar perfil estruturado paralelo.

4. Conciliacao
- Match de experiencias por empresa + periodo.
- Score de consistencia e flags de divergencia.

5. Scoring
- Formula base recomendada:
  - skills obrigatorias: 35%
  - experiencia relevante: 25%
  - senioridade: 15%
  - estabilidade de vinculos: 10%
  - formacao/certificacoes: 10%
  - consistencia PDF x LinkedIn: 5%

6. Relatorio
- Gera resumo executivo, strengths, gaps, riscos e perguntas de entrevista.

## 15. Qualidade de output e guardrails
- Resposta sempre no schema validado (sem texto livre fora de contrato).
- Score deve vir acompanhado de evidencias textuais.
- Campos com baixa confianca devem ser sinalizados.
- Relatorio deve conter disclaimer: "suporte a decisao, nao decisao final automatica".

## 16. LGPD e compliance
- Consentimento explicito para analise automatizada.
- Base legal e finalidade registradas.
- Direito de revisao humana.
- Politica de retencao e exclusao por prazo.
- Minimizacao de dados e controle de acesso por perfil.

## 17. Observabilidade e operacao
- Logs por etapa: ingestao, parse, IA, scoring, relatorio, exportacao.
- Metricas:
  - volume diario de analises
  - tempo medio por analise
  - taxa de erro por etapa
  - distribuicao de scores
  - taxa de reprocessamento
- Alertas:
  - fila parada
  - erro de parser acima do limite
  - falha de provider IA acima do limite

## 18. Metricas de sucesso (KPIs)
- Tempo medio de triagem inicial (baseline vs pos-lancamento).
- Taxa de shortlist aproveitada na entrevista tecnica.
- Concordancia entre analise IA e decisao final humana.
- Taxa de analises com dados completos (sem campos criticos vazios).

## 19. Criterios de aceite do produto
- Todo candidato com curriculo enviado gera analise rastreavel.
- Relatorio pode ser exportado e auditado.
- Reprocessamento mantem historico de versoes.
- Divergencias PDF x LinkedIn aparecem de forma explicita.
- Score por vaga respeita pesos configurados.

## 20. Riscos e mitigacoes
- Risco: baixa qualidade de PDF escaneado.
- Mitigacao: OCR + score de confianca + fila de revisao manual.

- Risco: dados desatualizados no LinkedIn.
- Mitigacao: sinalizar data da fonte e divergencias.

- Risco: vi ses na recomendacao automatica.
- Mitigacao: avaliacao periodica de fairness e revisao humana obrigatoria.

- Risco: dependencia de provider IA.
- Mitigacao: fallback de modelo e retentativas com timeout.

## 21. Base atual no repositorio (gap analysis)
1. Ja existe
- Upload de curriculo e armazenamento de arquivo.
- Endpoints de iniciar/reprocessar/exportar analise.
- UI de analise com score e detalhes.

2. Falta para o produto real
- Parser/OCR de curriculo.
- Extracao estruturada real por IA.
- Conciliacao real com LinkedIn.
- Versionamento robusto de prompt/modelo.
- Score configuravel por vaga com pesos persistidos.
- Exportacao PDF de relatorio.
