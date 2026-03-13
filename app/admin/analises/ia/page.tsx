'use client'

import { useEffect, useState } from 'react'
import { Brain, CheckCircle2, Clock3, LoaderCircle, Sparkles } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SkillMetric {
  skill: string
  count: number
}

interface IaMetricsPayload {
  totalAnalyses: number
  completedAnalyses: number
  pendingAnalyses: number
  inProgressAnalyses: number
  averageOverallScore: number
  averageCompatibility: number
  statusBreakdown: {
    pending: number
    in_progress: number
    completed: number
  }
  topSkills: SkillMetric[]
}

interface IaMetricsResponse {
  metrics: IaMetricsPayload
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

export default function AnaliseIaPage() {
  const [metrics, setMetrics] = useState<IaMetricsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadMetrics() {
      setIsLoading(true)

      try {
        const response = await fetch('/api/admin/analyses/ia-metrics', { cache: 'no-store' })
        const payload = (await response.json()) as unknown

        if (!response.ok) {
          throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar metricas de IA.')
        }

        if (
          !payload ||
          typeof payload !== 'object' ||
          !('metrics' in payload) ||
          !payload.metrics ||
          typeof payload.metrics !== 'object'
        ) {
          throw new Error('Resposta invalida para metricas de IA.')
        }

        if (!isActive) {
          return
        }

        setMetrics((payload as IaMetricsResponse).metrics)
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar metricas de IA.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadMetrics()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <>
      <DashboardHeader
        title="Analise com IA"
        subtitle="Metricas agregadas das analises automatizadas e sinais de qualidade"
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando metricas...
            </CardContent>
          </Card>
        )}

        {!isLoading && error && (
          <Card>
            <CardContent className="p-10 text-center text-destructive">{error}</CardContent>
          </Card>
        )}

        {!isLoading && !error && metrics && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Analises totais</p>
                  <p className="mt-2 text-2xl font-bold">{metrics.totalAnalyses}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Concluidas</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">{metrics.completedAnalyses}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Nota media IA</p>
                  <p className="mt-2 text-2xl font-bold text-primary">{metrics.averageOverallScore}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Compatibilidade media</p>
                  <p className="mt-2 text-2xl font-bold text-chart-2">{metrics.averageCompatibility}%</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4 text-primary" />
                    Distribuicao por status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="flex items-center gap-2 text-sm">
                      <Clock3 className="h-4 w-4 text-amber-600" />
                      Pendentes
                    </span>
                    <span className="font-semibold">{metrics.statusBreakdown.pending}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="flex items-center gap-2 text-sm">
                      <LoaderCircle className="h-4 w-4 text-blue-600" />
                      Em progresso
                    </span>
                    <span className="font-semibold">{metrics.statusBreakdown.in_progress}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Concluidas
                    </span>
                    <span className="font-semibold">{metrics.statusBreakdown.completed}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-chart-2" />
                    Skills mais recorrentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {metrics.topSkills.map((item) => (
                    <div key={item.skill} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm">{item.skill}</span>
                      <span className="text-sm font-semibold">{item.count}</span>
                    </div>
                  ))}
                  {metrics.topSkills.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem skills suficientes para consolidar ranking.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
