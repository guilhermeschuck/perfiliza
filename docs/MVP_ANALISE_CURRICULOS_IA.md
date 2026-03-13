# MVP - Analise de Curriculos com IA

## 1. Objetivo do MVP
Entregar em producao um fluxo minimo funcional de analise automatica de curriculos que:
- extrai dados de PDF,
- cruza com dados de LinkedIn informados,
- calcula score por vaga,
- gera relatorio automatico reutilizavel pelo RH.

## 2. Janela de entrega sugerida
- Duracao: 6 semanas
- Cadencia: 3 sprints de 2 semanas
- Go-live alvo: fim da semana 6

## 3. Escopo fechado (in)
1. Ingestao
- Upload de PDF com metadados.
- Campo URL do LinkedIn obrigatorio ou opcional configuravel.

2. Parser de curriculo
- Extracao de texto de PDF nativo.
- OCR fallback para PDF sem camada de texto.

3. Extracao estruturada IA
- JSON schema com:
  - resumo profissional
  - experiencias e vinculos
  - skills tecnicas e comportamentais
  - formacao e certificacoes
  - idiomas

4. Conciliacao com LinkedIn (MVP-safe)
- Validar URL.
- Capturar dados declarados no formulario e comparar com curriculo.
- Flag de consistencia por experiencia/periodo/skills.

5. Score e recomendacao
- Score geral (0-100) e subscores por criterio.
- Recomendacao: Aprovar, Revisar, Rejeitar.

6. Relatorio automatico
- JSON estruturado (obrigatorio).
- Visualizacao no painel admin (obrigatorio).
- PDF (opcional no MVP, recomendavel na semana 6).

7. Operacao
- Reprocessamento manual.
- Log de execucao e erro por etapa.

## 4. Fora do escopo (out)
- Scraping autenticado de LinkedIn.
- Integracao ATS externa (Greenhouse, Lever, etc.).
- Entrevista por agente de voz/video.
- Ajuste automatico de pesos por machine learning.

## 5. Premissas
- O sistema atual continuara com Next.js no frontend e Laravel no backend.
- As rotas atuais de analise serao reutilizadas e evoluidas.
- O MVP aceitara revisao humana obrigatoria para decisao final.

## 6. Backlog por sprint

## Sprint 1 (Semanas 1-2) - Fundacao tecnica
1. Dados e storage
- Criar tabelas: `resumes`, `resume_parses`, `analysis_runs`, `analysis_reports`.
- Persistir hash do arquivo e metadados de upload.

2. Pipeline base
- Implementar job assincro `ProcessResumeAnalysisJob`.
- Etapas: fetch arquivo, extracao texto, normalizacao inicial.

3. Parser/OCR
- Suporte PDF nativo.
- Fallback OCR configuravel.

4. API e status
- Expandir endpoint `analysis/start` para devolver `analysis_run_id`.
- Endpoint de status detalhado por etapa.

5. Critério de aceite sprint 1
- Candidato com PDF gera texto extraido persistido.
- UI mostra status de processamento sem travar pagina.

## Sprint 2 (Semanas 3-4) - IA estruturada e scoring
1. Extracao IA
- Definir JSON schema versionado.
- Integrar provider LLM com validacao de schema.

2. Conciliacao
- Comparar experiencias por datas/empresa.
- Gerar `consistency_score` e lista de divergencias.

3. Scoring
- Implementar formula configuravel com pesos default:
  - skills: 35
  - experiencia: 25
  - senioridade: 15
  - estabilidade: 10
  - formacao: 10
  - consistencia: 5

4. Persistencia
- Salvar subscores, score final e recomendacao.

5. Critério de aceite sprint 2
- 100% das analises concluidas retornam JSON valido no schema.
- Cada score possui evidencia textual no relatorio.

## Sprint 3 (Semanas 5-6) - Relatorio, UX e hardening
1. Relatorio
- Gerar resumo executivo e perguntas sugeridas de entrevista.
- Exportacao JSON e endpoint para PDF (se ativado).

2. UX RH
- Ajustar pagina de detalhe para mostrar:
  - confianca por campo
  - divergencias PDF x LinkedIn
  - historico de reprocessamento

3. Operacao
- Logs estruturados por `analysis_run_id`.
- Retry e timeout por etapa.
- Dashboard de metricas basicas.

4. Testes
- Feature tests backend para start/status/reprocess/export.
- Testes de regressao de schema.

5. Critério de aceite sprint 3
- Fluxo ponta a ponta completo em ambiente de homologacao.
- Reprocessamento funcional sem perder historico.

## 7. User stories MVP
- US-001: Como recrutador, quero subir um curriculo e obter score automatico para priorizar triagem.
- US-002: Como recrutador, quero ver divergencias entre curriculo e LinkedIn para investigar riscos.
- US-003: Como lider tecnico, quero receber perguntas sugeridas para entrevista focada.
- US-004: Como admin, quero reprocessar uma analise quando houver ajuste de prompt/peso.

## 8. Criterios de aceite do MVP (Go/No-Go)
- Pelo menos 90% dos PDFs processados sem erro fatal.
- Tempo medio por analise <= 90s (P95).
- Relatorio com score + evidencias + recomendacao em 100% das analises concluidas.
- Reprocessamento executa nova versao sem sobrescrever auditoria anterior.

## 9. Modelo de resposta JSON (resumo)
```json
{
  "analysisRunId": "ar_123",
  "applicationId": "app_789",
  "status": "completed",
  "scores": {
    "overall": 82,
    "skills": 88,
    "experience": 79,
    "seniority": 75,
    "stability": 80,
    "education": 84,
    "consistency": 70
  },
  "recommendation": "revisar",
  "evidence": [
    "Experiencia forte em stack principal da vaga",
    "Divergencia de periodo em 1 vinculo no LinkedIn"
  ],
  "interviewQuestions": [
    "Descreva projeto com maior impacto tecnico",
    "Explique transicao entre empresas de 2022 para 2023"
  ]
}
```

## 10. Mudancas tecnicas no repositorio atual
1. Backend Laravel
- Evoluir `DemoStateService` para pipeline real em servicos dedicados.
- Introduzir fila (`queue`) para jobs de analise.
- Adicionar migracoes para tabelas de analise.

2. Frontend Next
- Adaptar pagina `admin/analises` para status por etapa.
- Adaptar detalhe `admin/analises/[id]` para novos campos de consistencia e confianca.

3. APIs existentes que serao preservadas
- `GET /admin/applications/{id}/analysis`
- `POST /admin/applications/{id}/analysis/start`
- `POST /admin/applications/{id}/analysis/reprocess`
- `GET /admin/applications/{id}/analysis/export`

## 11. Riscos do MVP e mitigacao
- Risco: resposta IA fora do schema.
- Mitigacao: validacao estrita + retry com prompt de correcao.

- Risco: OCR lento em PDFs pesados.
- Mitigacao: limite de tamanho, fila assincra e timeout por pagina.

- Risco: falso positivo em divergencia LinkedIn.
- Mitigacao: classificar divergencia por severidade e exigir revisao humana.

## 12. Plano de rollout
1. Fase piloto (semana 6)
- 1 vaga, ate 50 curriculos, uso por 2 recrutadores.

2. Fase controlada (2 semanas apos piloto)
- Expandir para todas as vagas de 1 empresa.

3. Fase geral
- Liberar para todos os tenants apos KPI minimo atingido.

## 13. Definicao de pronto (DoD)
- Codigo em branch com testes principais passando.
- Documentacao de schema e versao de prompt publicada.
- Logs e metricas visiveis para suporte.
- Treinamento rapido do RH concluido.
