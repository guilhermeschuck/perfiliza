'use client'

import { useState } from 'react'
import { Search, Filter, Eye, Brain, User, Hash, Download } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CompatibilityGauge } from '@/components/analysis/compatibility-gauge'
import { useAuth } from '@/contexts/auth-context'
import { useAppData } from '@/contexts/app-data-context'
import { getApplicationsByCompanyId, getErrorMessage } from '@/lib/app-data'

const statusColors = {
  submitted: 'bg-blue-500/10 text-blue-600 border-blue-200',
  analyzing: 'bg-amber-500/10 text-amber-600 border-amber-200',
  analyzed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  reviewed: 'bg-purple-500/10 text-purple-600 border-purple-200',
  approved: 'bg-green-500/10 text-green-600 border-green-200',
  rejected: 'bg-red-500/10 text-red-600 border-red-200'
}

const statusLabels = {
  submitted: 'Enviado',
  analyzing: 'Analisando',
  analyzed: 'Analisado',
  reviewed: 'Revisado',
  approved: 'Aprovado',
  rejected: 'Rejeitado'
}

type FeedbackState = {
  kind: 'success' | 'error'
  message: string
} | null

export default function ResultadosPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [processingAction, setProcessingAction] = useState<{
    applicationId: string
    action: 'start' | 'reprocess'
  } | null>(null)
  const [downloadingApplicationId, setDownloadingApplicationId] = useState<string | null>(null)
  const { user } = useAuth()
  const { data, refresh } = useAppData()
  
  const companyApplications = getApplicationsByCompanyId(data, user?.id ?? '2')

  const filteredApplications = companyApplications.filter(app => {
    const matchesSearch = app.candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.job.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter
    return matchesSearch && matchesStatus
  })

  async function runAnalysisAction(applicationId: string, action: 'start' | 'reprocess') {
    setProcessingAction({ applicationId, action })
    setFeedback(null)

    try {
      const response = await fetch(`/api/admin/applications/${applicationId}/analysis/${action}`, {
        method: 'POST',
      })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Nao foi possivel processar a analise.'))
      }

      await refresh()
      setFeedback({
        kind: 'success',
        message: action === 'start'
          ? 'Analise iniciada com sucesso.'
          : 'Reprocessamento da analise iniciado com sucesso.',
      })
    } catch (analysisError) {
      setFeedback({
        kind: 'error',
        message: analysisError instanceof Error
          ? analysisError.message
          : 'Nao foi possivel processar a analise.',
      })
    } finally {
      setProcessingAction(null)
    }
  }

  async function downloadAnalysisReport(applicationId: string, candidateName: string) {
    setDownloadingApplicationId(applicationId)
    setFeedback(null)

    try {
      const response = await fetch(`/api/admin/applications/${applicationId}/analysis/export`, { cache: 'no-store' })
      const payload = (await response.json()) as Record<string, unknown>

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Nao foi possivel exportar a analise.'))
      }

      const normalizedName = candidateName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      const baseName = normalizedName || `candidato-${applicationId}`
      const markdown = payload.reportMarkdown

      if (typeof markdown === 'string' && markdown.trim() !== '') {
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${baseName}-analise.md`
        document.body.append(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      } else {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${baseName}-analise.json`
        document.body.append(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      }

      setFeedback({ kind: 'success', message: 'Relatorio exportado com sucesso.' })
    } catch (downloadError) {
      setFeedback({
        kind: 'error',
        message: downloadError instanceof Error
          ? downloadError.message
          : 'Nao foi possivel exportar a analise.',
      })
    } finally {
      setDownloadingApplicationId(null)
    }
  }

  return (
    <>
      <DashboardHeader 
        title="Resultados das Análises" 
        subtitle="Visualize os resultados dos candidatos submetidos"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {feedback && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por candidato ou vaga..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="analyzed">Analisado</SelectItem>
                    <SelectItem value="reviewed">Em revisão</SelectItem>
                    <SelectItem value="analyzing">Analisando</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Results List */}
          <div className="space-y-4">
            {filteredApplications.map((application) => (
              <Card key={application.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Candidate Info */}
                    <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-border">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-chart-2/10 text-chart-2">
                            {application.candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{application.candidate.name}</h3>
                            <Badge 
                              variant="outline" 
                              className={statusColors[application.status]}
                            >
                              {statusLabels[application.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {application.candidate.currentPosition || 'Posicao nao informada'} - {application.candidate.experience} anos
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Vaga: <span className="text-foreground font-medium">{application.job.title}</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {application.candidate.skills.slice(0, 4).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Analysis Results */}
                    <div className="w-full lg:w-96 p-6 bg-muted/30">
                      {application.analysis && application.analysis.status === 'completed' ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Compatibilidade</span>
                            <span className="text-2xl font-bold text-primary">
                              {application.analysis.compatibilityScore}%
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Técnico</span>
                                <span>{application.analysis.aiAnalysis.technicalSkills}%</span>
                              </div>
                              <Progress value={application.analysis.aiAnalysis.technicalSkills} className="h-1.5" />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Soft Skills</span>
                                <span>{application.analysis.aiAnalysis.softSkills}%</span>
                              </div>
                              <Progress value={application.analysis.aiAnalysis.softSkills} className="h-1.5" />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Experiência</span>
                                <span>{application.analysis.aiAnalysis.experienceRelevance}%</span>
                              </div>
                              <Progress value={application.analysis.aiAnalysis.experienceRelevance} className="h-1.5" />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" className="flex-1">
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver Detalhes
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
                                <DialogHeader>
                                  <DialogTitle>Análise de {application.candidate.name}</DialogTitle>
                                  <DialogDescription>
                                    Resultados completos da análise para a vaga de {application.job.title}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                  {/* Compatibility */}
                                  <div className="flex justify-center">
                                    <CompatibilityGauge score={application.analysis.compatibilityScore || 0} />
                                  </div>

                                  {/* AI Analysis */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold flex items-center gap-2">
                                      <Brain className="h-4 w-4 text-primary" />
                                      Análise por IA
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      {application.analysis.aiAnalysis.summary}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                        <p className="text-xs text-muted-foreground mb-1">Pontos Fortes</p>
                                        <ul className="text-xs space-y-1">
                                          {application.analysis.aiAnalysis.strengths.slice(0, 2).map((s, i) => (
                                            <li key={i} className="flex items-start gap-1">
                                              <span className="text-emerald-600">+</span> {s}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                        <p className="text-xs text-muted-foreground mb-1">A Desenvolver</p>
                                        <ul className="text-xs space-y-1">
                                          {application.analysis.aiAnalysis.weaknesses.slice(0, 2).map((w, i) => (
                                            <li key={i} className="flex items-start gap-1">
                                              <span className="text-amber-600">-</span> {w}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>

                                  {/* DISC Profile */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold flex items-center gap-2">
                                      <User className="h-4 w-4 text-chart-2" />
                                      Perfil DISC: {application.analysis.discProfile.primaryType}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      {application.analysis.discProfile.description}
                                    </p>
                                  </div>

                                  {/* Numerology */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold flex items-center gap-2">
                                      <Hash className="h-4 w-4 text-chart-4" />
                                      Numerologia
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                      <div className="p-2 rounded bg-muted">
                                        <p className="text-lg font-bold">{application.analysis.numerology.lifePathNumber}</p>
                                        <p className="text-xs text-muted-foreground">Vida</p>
                                      </div>
                                      <div className="p-2 rounded bg-muted">
                                        <p className="text-lg font-bold">{application.analysis.numerology.expressionNumber}</p>
                                        <p className="text-xs text-muted-foreground">Expressão</p>
                                      </div>
                                      <div className="p-2 rounded bg-muted">
                                        <p className="text-lg font-bold">{application.analysis.numerology.soulUrgeNumber}</p>
                                        <p className="text-xs text-muted-foreground">Alma</p>
                                      </div>
                                      <div className="p-2 rounded bg-muted">
                                        <p className="text-lg font-bold">{application.analysis.numerology.personalityNumber}</p>
                                        <p className="text-xs text-muted-foreground">Pessoal</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Recommendations */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold">Recomendações</h4>
                                    <ul className="text-sm space-y-1">
                                      {application.analysis.aiAnalysis.recommendations.map((rec, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="text-primary">•</span> {rec}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={downloadingApplicationId === application.id}
                              onClick={() => void downloadAnalysisReport(application.id, application.candidate.name)}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Baixar relatorio</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={processingAction?.applicationId === application.id}
                              onClick={() => void runAnalysisAction(application.id, 'reprocess')}
                            >
                              {processingAction?.applicationId === application.id && processingAction.action === 'reprocess'
                                ? 'Reprocessando...'
                                : 'Reprocessar'}
                            </Button>
                          </div>
                        </div>
                      ) : application.analysis?.status === 'in_progress' ? (
                        <div className="flex flex-col items-center justify-center h-full py-4 space-y-3">
                          <div className="animate-spin h-8 w-8 border-2 border-chart-2 border-t-transparent rounded-full mb-3" />
                          <p className="text-sm text-muted-foreground">Análise em andamento...</p>
                          <p className="text-xs text-muted-foreground mt-1">Tempo estimado: 5-10 min</p>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingAction?.applicationId === application.id}
                            onClick={() => void runAnalysisAction(application.id, 'reprocess')}
                          >
                            {processingAction?.applicationId === application.id && processingAction.action === 'reprocess'
                              ? 'Reprocessando...'
                              : 'Reprocessar'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-4 space-y-3">
                          <p className="text-sm text-muted-foreground">Aguardando análise</p>
                          <p className="text-xs text-muted-foreground mt-1">O candidato está na fila</p>
                          <Button
                            size="sm"
                            disabled={processingAction?.applicationId === application.id}
                            onClick={() => void runAnalysisAction(application.id, 'start')}
                          >
                            {processingAction?.applicationId === application.id && processingAction.action === 'start'
                              ? 'Iniciando...'
                              : 'Iniciar analise'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredApplications.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">Nenhum resultado encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  Tente ajustar os filtros de busca
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
