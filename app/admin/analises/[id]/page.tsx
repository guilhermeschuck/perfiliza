'use client'

import { use, useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ClipboardCheck,
  Brain,
  User,
  Hash,
  Linkedin,
  Download,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  ScanText,
  AlertTriangle,
  Clock3,
} from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DISCChart } from '@/components/analysis/disc-chart'
import { CompatibilityGauge } from '@/components/analysis/compatibility-gauge'
import { AIScoreCard } from '@/components/analysis/ai-score-card'
import { useAppData } from '@/contexts/app-data-context'
import { useAuth } from '@/contexts/auth-context'
import { getApplicationById } from '@/lib/app-data'

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

interface ResumeParseSnapshot {
  id: number
  status: 'pending' | 'completed' | 'failed' | 'skipped'
  ocrUsed: boolean
  language?: string | null
  charCount?: number
  parsedAt?: string | null
  errorMessage?: string | null
  normalized?: {
    skills?: string[]
    skillsDetected?: string[]
    sectionsDetected?: string[]
  } | null
}

interface AnalysisRunSnapshot {
  id: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startedAt?: string | null
  finishedAt?: string | null
  timeline?: Array<{
    step: string
    label: string
    status: string
    at?: string | null
    details?: string | null
  }>
}

interface AnalysisPipelinePayload {
  analysisRun?: AnalysisRunSnapshot | null
  resumeParse?: ResumeParseSnapshot | null
}

interface AnalysisRunEventsPayload {
  analysisRunId: number
  status?: AnalysisRunSnapshot['status']
  startedAt?: string | null
  finishedAt?: string | null
  events?: AnalysisRunSnapshot['timeline']
}

type ReviewDecisionType = 'approved' | 'rejected' | 'needs_review' | 'escalated'

interface AnalysisReviewDecisionPayload {
  id: number
  reviewerId: string
  decision: ReviewDecisionType
  rationale: string
  tags?: string[]
  decidedAt?: string | null
  createdAt?: string | null
}

interface AnalysisRunDetailsPayload {
  analysisRun?: AnalysisRunSnapshot
  reports?: Array<{
    id: number
    format: string
    hasMarkdown: boolean
    pdfUrl?: string | null
    generatedAt?: string | null
    createdAt?: string | null
  }>
  auditLogs?: Array<{
    id: number
    stage: string
    level: string
    eventKey: string
    message: string
    durationMs?: number | null
    happenedAt?: string | null
  }>
}

interface AnalysisRunReviewPayload {
  analysisRunId: number
  latestDecision?: AnalysisReviewDecisionPayload | null
  history?: AnalysisReviewDecisionPayload[]
}

const runStatusLabel: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em progresso',
  completed: 'Concluida',
  failed: 'Falhou',
}

const parseStatusLabel: Record<string, string> = {
  pending: 'Pendente',
  completed: 'Concluido',
  failed: 'Falhou',
  skipped: 'Ignorado',
}

const reviewDecisionLabels: Record<ReviewDecisionType, string> = {
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  needs_review: 'Precisa de revisao',
  escalated: 'Escalado',
}

const reviewDecisionColors: Record<ReviewDecisionType, string> = {
  approved: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-500/10 text-red-700 border-red-200',
  needs_review: 'bg-amber-500/10 text-amber-700 border-amber-200',
  escalated: 'bg-purple-500/10 text-purple-700 border-purple-200',
}

function parseReviewTags(rawTags: string) {
  return Array.from(new Set(
    rawTags
      .split(/[\n,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ))
}

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data } = useAppData()
  const { user } = useAuth()
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<AnalysisPipelinePayload | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [runDetails, setRunDetails] = useState<AnalysisRunDetailsPayload | null>(null)
  const [runDetailsError, setRunDetailsError] = useState<string | null>(null)
  const [reviewHistory, setReviewHistory] = useState<AnalysisRunReviewPayload | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewDecision, setReviewDecision] = useState<ReviewDecisionType>('needs_review')
  const [reviewRationale, setReviewRationale] = useState('')
  const [reviewTags, setReviewTags] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null)
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState<string | null>(null)
  const application = getApplicationById(data, id)

  const loadRunDetails = useCallback(async (analysisRunId: number) => {
    setRunDetailsError(null)

    try {
      const response = await fetch(`/api/admin/analysis-runs/${analysisRunId}`, { cache: 'no-store' })
      const payload = (await response.json()) as unknown

      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar os detalhes da execucao.')
      }

      setRunDetails(payload as AnalysisRunDetailsPayload)
    } catch (requestError) {
      setRunDetailsError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao carregar detalhes da execucao da analise.',
      )
    }
  }, [])

  const loadRunReview = useCallback(async (analysisRunId: number) => {
    setReviewLoading(true)
    setReviewError(null)

    try {
      const response = await fetch(`/api/admin/analysis-runs/${analysisRunId}/review`, { cache: 'no-store' })
      const payload = (await response.json()) as unknown

      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar a revisao humana.')
      }

      setReviewHistory(payload as AnalysisRunReviewPayload)
    } catch (requestError) {
      setReviewError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao carregar historico de revisao.',
      )
    } finally {
      setReviewLoading(false)
    }
  }, [])

  const loadPipeline = useCallback(async (isPolling = false) => {
    if (!isPolling) {
      setPipelineLoading(true)
    }
    setPipelineError(null)

    try {
      const response = await fetch(`/api/admin/applications/${id}/analysis`, { cache: 'no-store' })
      const payload = (await response.json()) as unknown

      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar a pipeline da analise.')
      }

      const pipelinePayload = payload as AnalysisPipelinePayload
      const analysisRunId = pipelinePayload.analysisRun?.id

      if (!analysisRunId) {
        setPipeline(pipelinePayload)
        setRunDetails(null)
        setRunDetailsError(null)
        setReviewHistory(null)
        setReviewError(null)
        return
      }

      const eventsResponse = await fetch(`/api/admin/analysis-runs/${analysisRunId}/events`, { cache: 'no-store' })

      if (!eventsResponse.ok) {
        setPipeline(pipelinePayload)
        return
      }

      const eventsPayload = (await eventsResponse.json()) as AnalysisRunEventsPayload
      const mergedRun: AnalysisRunSnapshot = {
        ...(pipelinePayload.analysisRun ?? { id: analysisRunId, status: 'pending' }),
        status: eventsPayload.status ?? pipelinePayload.analysisRun?.status ?? 'pending',
        startedAt: eventsPayload.startedAt ?? pipelinePayload.analysisRun?.startedAt ?? null,
        finishedAt: eventsPayload.finishedAt ?? pipelinePayload.analysisRun?.finishedAt ?? null,
        timeline: eventsPayload.events ?? pipelinePayload.analysisRun?.timeline ?? [],
      }

      setPipeline({
        ...pipelinePayload,
        analysisRun: mergedRun,
      })
    } catch (requestError) {
      setPipelineError(requestError instanceof Error ? requestError.message : 'Falha ao carregar pipeline.')
    } finally {
      if (!isPolling) {
        setPipelineLoading(false)
      }
    }
  }, [id])

  useEffect(() => {
    void loadPipeline(false)
  }, [loadPipeline])

  useEffect(() => {
    const runStatus = pipeline?.analysisRun?.status
    const runId = pipeline?.analysisRun?.id

    if (!runId || runStatus === 'completed' || runStatus === 'failed') {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadPipeline(true)
    }, 4000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pipeline?.analysisRun?.id, pipeline?.analysisRun?.status, loadPipeline])

  useEffect(() => {
    const runId = pipeline?.analysisRun?.id

    if (!runId) {
      return
    }

    void Promise.all([
      loadRunDetails(runId),
      loadRunReview(runId),
    ])
  }, [loadRunDetails, loadRunReview, pipeline?.analysisRun?.id, pipeline?.analysisRun?.status])

  if (!application || !application.analysis || application.analysis.status !== 'completed') {
    return (
      <>
        <DashboardHeader title="Análise não encontrada" />
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">Esta análise não foi encontrada ou ainda não foi concluída.</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/admin/analises">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Análises
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  const { candidate, job, analysis } = application
  const run = pipeline?.analysisRun
  const resumeParse = pipeline?.resumeParse
  const parsedSkills = resumeParse?.normalized?.skills ?? resumeParse?.normalized?.skillsDetected ?? []
  const sectionsDetected = resumeParse?.normalized?.sectionsDetected ?? []
  const timeline = run?.timeline ?? []
  const reports = runDetails?.reports ?? []
  const auditLogs = runDetails?.auditLogs ?? []
  const latestReviewDecision = reviewHistory?.latestDecision ?? null
  const reviewDecisions = reviewHistory?.history ?? []
  const scoreAdjustments = analysis.aiAnalysis.scoreAdjustments
  const hasScoreAdjustments = Boolean(
    scoreAdjustments && (
      scoreAdjustments.technicalSkills !== 0 ||
      scoreAdjustments.experienceRelevance !== 0 ||
      scoreAdjustments.educationMatch !== 0 ||
      scoreAdjustments.cultureFit !== 0 ||
      scoreAdjustments.reasons.length > 0
    ),
  )

  async function exportAnalysis() {
    setIsExporting(true)
    setExportError(null)

    try {
      const response = await fetch(`/api/admin/applications/${id}/analysis/export`, { cache: 'no-store' })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel exportar a analise.')
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `analise-${id}.json`
      anchor.click()
      URL.revokeObjectURL(objectUrl)
    } catch (requestError) {
      setExportError(requestError instanceof Error ? requestError.message : 'Falha ao exportar analise.')
    } finally {
      setIsExporting(false)
    }
  }

  async function submitReviewDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!run?.id) {
      setReviewSubmitError('Nao existe execucao de analise disponivel para revisao.')
      return
    }

    if (!user?.id) {
      setReviewSubmitError('Usuario autenticado nao encontrado para registrar a revisao.')
      return
    }

    setIsSubmittingReview(true)
    setReviewSubmitError(null)
    setReviewSubmitSuccess(null)

    try {
      const response = await fetch(`/api/admin/analysis-runs/${run.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewerId: user.id,
          decision: reviewDecision,
          rationale: reviewRationale.trim(),
          tags: parseReviewTags(reviewTags),
        }),
      })
      const payload = (await response.json()) as unknown

      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel registrar a revisao manual.')
      }

      setReviewRationale('')
      setReviewTags('')
      setReviewSubmitSuccess('Decisao de revisao registrada com sucesso.')

      if ('history' in payload && Array.isArray(payload.history)) {
        setReviewHistory(payload as AnalysisRunReviewPayload)
      } else {
        await loadRunReview(run.id)
      }

      await loadRunDetails(run.id)
    } catch (requestError) {
      setReviewSubmitError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao registrar revisao manual.',
      )
    } finally {
      setIsSubmittingReview(false)
    }
  }

  return (
    <>
      <DashboardHeader 
        title="Análise Detalhada" 
        subtitle={`${candidate.name} - ${job.title}`}
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Back Button */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/analises">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Análises
            </Link>
          </Button>

          {/* Header with Candidate Info and Compatibility */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Candidate Profile */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Perfil do Candidato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-6">
                  <Avatar className="h-24 w-24 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold">{candidate.name}</h2>
                      <p className="text-muted-foreground">{candidate.currentPosition || 'Posicao nao informada'}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{candidate.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{candidate.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{candidate.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{candidate.experience} anos de experiência</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm sm:col-span-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>{candidate.education}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compatibility Score */}
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Compatibilidade com a Vaga</CardTitle>
                <CardDescription>{job.title}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <CompatibilityGauge score={analysis.compatibilityScore || 0} />
                <Button className="mt-4 w-full" size="sm" disabled={isExporting} onClick={() => void exportAnalysis()}>
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? 'Exportando...' : 'Exportar Relatorio'}
                </Button>
                {exportError && (
                  <p className="mt-2 text-center text-xs text-destructive">{exportError}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanText className="h-4 w-4 text-primary" />
                Pipeline do Curriculo
              </CardTitle>
              <CardDescription>Status de processamento da extração e parsing do arquivo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pipelineLoading && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  Carregando status da pipeline...
                </p>
              )}
              {!pipelineLoading && pipelineError && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {pipelineError}
                </p>
              )}
              {!pipelineLoading && !pipelineError && !run && (
                <p className="text-sm text-muted-foreground">Nenhuma execução de pipeline registrada.</p>
              )}
              {!pipelineLoading && !pipelineError && run && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Run #{run.id} - {runStatusLabel[run.status] ?? run.status}
                    </Badge>
                    {resumeParse && (
                      <Badge variant="secondary">
                        Parse: {parseStatusLabel[resumeParse.status] ?? resumeParse.status}
                      </Badge>
                    )}
                    {resumeParse?.ocrUsed && <Badge variant="outline">OCR habilitado</Badge>}
                    {resumeParse?.language && <Badge variant="outline">Idioma: {resumeParse.language}</Badge>}
                    {typeof resumeParse?.charCount === 'number' && resumeParse.charCount > 0 && (
                      <Badge variant="outline">{resumeParse.charCount} caracteres</Badge>
                    )}
                  </div>
                  {sectionsDetected.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sectionsDetected.map((section) => (
                        <Badge key={section} variant="secondary" className="text-xs">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {parsedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {parsedSkills.slice(0, 8).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {resumeParse?.errorMessage && (
                    <p className="text-xs text-destructive">Erro de parsing: {resumeParse.errorMessage}</p>
                  )}
                  {timeline.length > 0 && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Timeline da Execucao
                      </p>
                      <div className="space-y-2">
                        {timeline.map((item, index) => (
                          <div key={`${item.step}-${index}`} className="rounded-md bg-muted/40 p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{item.label}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {item.status}
                              </Badge>
                            </div>
                            {item.details && (
                              <p className="mt-1 text-muted-foreground">{item.details}</p>
                            )}
                            {item.at && (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {new Date(item.at).toLocaleString('pt-BR')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Governanca da Execucao</CardTitle>
                <CardDescription>
                  Relatorios gerados e trilha de auditoria do run atual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!run && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum run ativo para carregar informacoes tecnicas.
                  </p>
                )}

                {run && !runDetails && !runDetailsError && (
                  <p className="text-sm text-muted-foreground">Carregando detalhes da execucao...</p>
                )}

                {run && runDetailsError && (
                  <p className="text-sm text-destructive">{runDetailsError}</p>
                )}

                {run && runDetails && (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Relatorios
                      </p>
                      {reports.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum relatorio registrado neste run.</p>
                      )}
                      {reports.map((report) => (
                        <div key={report.id} className="rounded-md border border-border p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">#{report.id}</Badge>
                            <Badge variant="secondary">{report.format.toUpperCase()}</Badge>
                            {report.hasMarkdown && <Badge variant="outline">Markdown</Badge>}
                            {report.pdfUrl && (
                              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                                <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
                                  Abrir PDF
                                </a>
                              </Button>
                            )}
                          </div>
                          {report.generatedAt && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Auditoria recente
                      </p>
                      {auditLogs.length === 0 && (
                        <p className="text-sm text-muted-foreground">Sem eventos de auditoria registrados.</p>
                      )}
                      {auditLogs.slice(0, 6).map((log) => (
                        <div key={log.id} className="rounded-md border border-border p-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{log.stage}</Badge>
                            <Badge variant="secondary">{log.level}</Badge>
                            {typeof log.durationMs === 'number' && (
                              <span className="text-muted-foreground">{log.durationMs} ms</span>
                            )}
                          </div>
                          <p className="mt-2 text-sm">{log.message}</p>
                          <p className="mt-1 text-muted-foreground">{log.eventKey}</p>
                          {log.happenedAt && (
                            <p className="mt-1 text-muted-foreground">
                              {new Date(log.happenedAt).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  Revisao Humana
                </CardTitle>
                <CardDescription>
                  Registre aprovacao, rejeicao ou escalonamento do resultado da IA.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!run && (
                  <p className="text-sm text-muted-foreground">
                    A revisao fica disponivel apos a criacao de um run de analise.
                  </p>
                )}

                {run && reviewLoading && (
                  <p className="text-sm text-muted-foreground">Carregando historico de revisao...</p>
                )}

                {run && reviewError && (
                  <p className="text-sm text-destructive">{reviewError}</p>
                )}

                {run && latestReviewDecision && (
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Ultima decisao
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={reviewDecisionColors[latestReviewDecision.decision]}
                      >
                        {reviewDecisionLabels[latestReviewDecision.decision]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        por {latestReviewDecision.reviewerId}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{latestReviewDecision.rationale}</p>
                    {(latestReviewDecision.tags?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {latestReviewDecision.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {run && reviewDecisions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Historico
                    </p>
                    {reviewDecisions.slice(0, 5).map((decision) => (
                      <div key={decision.id} className="rounded-md border border-border p-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={reviewDecisionColors[decision.decision]}>
                            {reviewDecisionLabels[decision.decision]}
                          </Badge>
                          <span className="text-muted-foreground">{decision.reviewerId}</span>
                        </div>
                        <p className="mt-2 text-sm">{decision.rationale}</p>
                        {decision.decidedAt && (
                          <p className="mt-1 text-muted-foreground">
                            {new Date(decision.decidedAt).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {run && (
                  <form className="space-y-3 rounded-md border border-border p-3" onSubmit={(event) => void submitReviewDecision(event)}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="reviewDecision">Decisao</Label>
                        <Select
                          value={reviewDecision}
                          onValueChange={(value) => setReviewDecision(value as ReviewDecisionType)}
                        >
                          <SelectTrigger id="reviewDecision">
                            <SelectValue placeholder="Selecione a decisao" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Aprovado</SelectItem>
                            <SelectItem value="rejected">Rejeitado</SelectItem>
                            <SelectItem value="needs_review">Precisa de revisao</SelectItem>
                            <SelectItem value="escalated">Escalado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reviewTags">Tags (opcional)</Label>
                        <Input
                          id="reviewTags"
                          value={reviewTags}
                          onChange={(event) => setReviewTags(event.target.value)}
                          placeholder="ex: cultura, senioridade, salario"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reviewRationale">Justificativa</Label>
                      <Textarea
                        id="reviewRationale"
                        value={reviewRationale}
                        onChange={(event) => setReviewRationale(event.target.value)}
                        placeholder="Descreva os motivos da decisao."
                        rows={4}
                        required
                      />
                    </div>
                    {reviewSubmitError && (
                      <p className="text-xs text-destructive">{reviewSubmitError}</p>
                    )}
                    {!reviewSubmitError && reviewSubmitSuccess && (
                      <p className="text-xs text-emerald-600">{reviewSubmitSuccess}</p>
                    )}
                    <Button type="submit" size="sm" disabled={isSubmittingReview || !user?.id}>
                      {isSubmittingReview ? 'Registrando...' : 'Registrar decisao'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Analysis Tabs */}
          <Tabs defaultValue="ia" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ia" className="gap-2">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Análise IA</span>
              </TabsTrigger>
              <TabsTrigger value="disc" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Perfil DISC</span>
              </TabsTrigger>
              <TabsTrigger value="numerology" className="gap-2">
                <Hash className="h-4 w-4" />
                <span className="hidden sm:inline">Numerologia</span>
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="gap-2">
                <Linkedin className="h-4 w-4" />
                <span className="hidden sm:inline">LinkedIn</span>
              </TabsTrigger>
            </TabsList>

            {/* AI Analysis Tab */}
            <TabsContent value="ia" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <AIScoreCard
                  title="Score Geral"
                  score={analysis.aiAnalysis.overallScore}
                  variant="primary"
                />
                <AIScoreCard
                  title="Habilidades Técnicas"
                  score={analysis.aiAnalysis.technicalSkills}
                  variant="success"
                />
                <AIScoreCard
                  title="Soft Skills"
                  score={analysis.aiAnalysis.softSkills}
                  variant="info"
                />
                <AIScoreCard
                  title="Relevância da Experiência"
                  score={analysis.aiAnalysis.experienceRelevance}
                  variant="warning"
                />
                <AIScoreCard
                  title="Adequação Educacional"
                  score={analysis.aiAnalysis.educationMatch}
                  variant="default"
                />
                <AIScoreCard
                  title="Fit Cultural"
                  score={analysis.aiAnalysis.cultureFit}
                  variant="primary"
                />
                <AIScoreCard
                  title="Consistência"
                  score={analysis.aiAnalysis.consistencyScore ?? analysis.consistencyScore ?? 0}
                  variant="default"
                />
              </div>

              {hasScoreAdjustments && scoreAdjustments && (
                <Card>
                  <CardHeader>
                    <CardTitle>Ajustes pelo Parsing do Curriculo</CardTitle>
                    <CardDescription>
                      Deltas aplicados no score com base nos sinais extraidos do arquivo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border border-border p-3 text-sm">
                        <p className="text-muted-foreground">Tecnico</p>
                        <p className="font-semibold text-emerald-600">
                          {scoreAdjustments.technicalSkills >= 0 ? '+' : ''}{scoreAdjustments.technicalSkills}
                        </p>
                        {typeof scoreAdjustments.requested?.technicalSkills === 'number' && (
                          <p className="text-[11px] text-muted-foreground">
                            Ajuste solicitado: +{scoreAdjustments.requested.technicalSkills}
                          </p>
                        )}
                      </div>
                      <div className="rounded-md border border-border p-3 text-sm">
                        <p className="text-muted-foreground">Experiencia</p>
                        <p className="font-semibold text-emerald-600">
                          {scoreAdjustments.experienceRelevance >= 0 ? '+' : ''}{scoreAdjustments.experienceRelevance}
                        </p>
                        {typeof scoreAdjustments.requested?.experienceRelevance === 'number' && (
                          <p className="text-[11px] text-muted-foreground">
                            Ajuste solicitado: +{scoreAdjustments.requested.experienceRelevance}
                          </p>
                        )}
                      </div>
                      <div className="rounded-md border border-border p-3 text-sm">
                        <p className="text-muted-foreground">Educacao</p>
                        <p className="font-semibold text-emerald-600">
                          {scoreAdjustments.educationMatch >= 0 ? '+' : ''}{scoreAdjustments.educationMatch}
                        </p>
                        {typeof scoreAdjustments.requested?.educationMatch === 'number' && (
                          <p className="text-[11px] text-muted-foreground">
                            Ajuste solicitado: +{scoreAdjustments.requested.educationMatch}
                          </p>
                        )}
                      </div>
                      <div className="rounded-md border border-border p-3 text-sm">
                        <p className="text-muted-foreground">Fit cultural</p>
                        <p className="font-semibold text-emerald-600">
                          {scoreAdjustments.cultureFit >= 0 ? '+' : ''}{scoreAdjustments.cultureFit}
                        </p>
                        {typeof scoreAdjustments.requested?.cultureFit === 'number' && (
                          <p className="text-[11px] text-muted-foreground">
                            Ajuste solicitado: +{scoreAdjustments.requested.cultureFit}
                          </p>
                        )}
                      </div>
                    </div>
                    {scoreAdjustments.reasons.length > 0 && (
                      <ul className="space-y-1">
                        {scoreAdjustments.reasons.map((reason, index) => (
                          <li key={`${reason}-${index}`} className="text-sm text-muted-foreground">
                            - {reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Resumo da Análise</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {analysis.aiAnalysis.summary}
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-emerald-600">Pontos Fortes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.aiAnalysis.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span className="text-sm">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-amber-600">Pontos a Desenvolver</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.aiAnalysis.weaknesses.map((weakness, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="h-2 w-2 rounded-full bg-amber-500 mt-2 shrink-0" />
                          <span className="text-sm">{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recomendações</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.aiAnalysis.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* DISC Tab */}
            <TabsContent value="disc" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Perfil DISC</CardTitle>
                    <CardDescription>
                      Tipo primário: <span className="font-semibold text-primary">{analysis.discProfile.primaryType}</span>
                      {analysis.discProfile.secondaryType && (
                        <> / Secundário: <span className="font-semibold">{analysis.discProfile.secondaryType}</span></>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DISCChart profile={analysis.discProfile} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Interpretação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed mb-6">
                      {analysis.discProfile.description}
                    </p>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Dominância (D)</span>
                          <span className="font-medium">{analysis.discProfile.dominance}%</span>
                        </div>
                        <Progress value={analysis.discProfile.dominance} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Influência (I)</span>
                          <span className="font-medium">{analysis.discProfile.influence}%</span>
                        </div>
                        <Progress value={analysis.discProfile.influence} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Estabilidade (S)</span>
                          <span className="font-medium">{analysis.discProfile.steadiness}%</span>
                        </div>
                        <Progress value={analysis.discProfile.steadiness} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Conformidade (C)</span>
                          <span className="font-medium">{analysis.discProfile.conscientiousness}%</span>
                        </div>
                        <Progress value={analysis.discProfile.conscientiousness} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Numerology Tab */}
            <TabsContent value="numerology" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="text-center">
                  <CardHeader>
                    <CardDescription>Número do Caminho de Vida</CardDescription>
                    <CardTitle className="text-4xl text-chart-4">{analysis.numerology.lifePathNumber}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="text-center">
                  <CardHeader>
                    <CardDescription>Número de Expressão</CardDescription>
                    <CardTitle className="text-4xl text-chart-2">{analysis.numerology.expressionNumber}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="text-center">
                  <CardHeader>
                    <CardDescription>Número da Alma</CardDescription>
                    <CardTitle className="text-4xl text-chart-1">{analysis.numerology.soulUrgeNumber}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="text-center">
                  <CardHeader>
                    <CardDescription>Número da Personalidade</CardDescription>
                    <CardTitle className="text-4xl text-primary">{analysis.numerology.personalityNumber}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Interpretação Numerológica</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {analysis.numerology.interpretation}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LinkedIn Tab */}
            <TabsContent value="linkedin" className="space-y-6">
              {analysis.linkedinAnalysis ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="text-center">
                      <CardHeader>
                        <CardDescription>Força do Perfil</CardDescription>
                        <CardTitle className="text-4xl text-blue-600">{analysis.linkedinAnalysis.profileStrength}%</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="text-center">
                      <CardHeader>
                        <CardDescription>Conexões</CardDescription>
                        <CardTitle className="text-4xl">{analysis.linkedinAnalysis.connectionsCount}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="text-center">
                      <CardHeader>
                        <CardDescription>Recomendações</CardDescription>
                        <CardTitle className="text-4xl">{analysis.linkedinAnalysis.recommendationsCount}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="text-center">
                      <CardHeader>
                        <CardDescription>Endorsements</CardDescription>
                        <CardTitle className="text-4xl">{analysis.linkedinAnalysis.endorsementsCount}</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Principais Competências</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {analysis.linkedinAnalysis.topSkills.map((skill) => (
                            <Badge key={skill} variant="secondary">{skill}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Nível de Atividade</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge 
                          variant="outline" 
                          className={
                            analysis.linkedinAnalysis.activityLevel === 'high' 
                              ? 'bg-emerald-500/10 text-emerald-600' 
                              : analysis.linkedinAnalysis.activityLevel === 'medium'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-red-500/10 text-red-600'
                          }
                        >
                          {analysis.linkedinAnalysis.activityLevel === 'high' ? 'Alto' : 
                           analysis.linkedinAnalysis.activityLevel === 'medium' ? 'Médio' : 'Baixo'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Progressão de Carreira</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">
                        {analysis.linkedinAnalysis.careerProgression}
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Linkedin className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg">LinkedIn não vinculado</h3>
                    <p className="text-sm text-muted-foreground">
                      O candidato não forneceu seu perfil do LinkedIn
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  )
}
