'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Briefcase, FileSearch, Users, Timer } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

interface CompanyOverview {
  companyId: string
  jobsTotal: number
  jobsActive: number
  jobsPaused: number
  applicationsTotal: number
  analysesCompleted: number
  averageCompatibility: number
  leadsTotal: number
  leadsPending: number
  leadsSubmitted: number
}

interface FunnelStage {
  status: string
  label: string
  count: number
  percentage: number
}

interface CompanyFunnel {
  companyId: string
  totalApplications: number
  stages: FunnelStage[]
}

interface SourceItem {
  source: string
  key: string
  count: number
  percentage: number
}

interface CompanySources {
  companyId: string
  total: number
  sources: SourceItem[]
  leadBreakdown: {
    pending: number
    submitted: number
  }
}

interface CompanyHiringTime {
  companyId: string
  sampleSize: number
  averageDays: number
  minDays: number
  maxDays: number
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

export default function EmpresaRelatoriosPage() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<CompanyOverview | null>(null)
  const [funnel, setFunnel] = useState<CompanyFunnel | null>(null)
  const [sources, setSources] = useState<CompanySources | null>(null)
  const [hiringTime, setHiringTime] = useState<CompanyHiringTime | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const companyId = user?.id ?? '2'

    async function loadReports() {
      setIsLoading(true)

      try {
        const [overviewResponse, funnelResponse, sourcesResponse, hiringTimeResponse] = await Promise.all([
          fetch(`/api/company/reports/overview?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' }),
          fetch(`/api/company/reports/funnel?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' }),
          fetch(`/api/company/reports/sources?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' }),
          fetch(`/api/company/reports/hiring-time?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' }),
        ])

        const overviewPayload = (await overviewResponse.json()) as { overview?: CompanyOverview; message?: string }
        const funnelPayload = (await funnelResponse.json()) as CompanyFunnel | { message?: string }
        const sourcesPayload = (await sourcesResponse.json()) as CompanySources | { message?: string }
        const hiringTimePayload = (await hiringTimeResponse.json()) as CompanyHiringTime | { message?: string }

        if (!overviewResponse.ok || !overviewPayload.overview) {
          throw new Error(getPayloadMessage(overviewPayload) ?? 'Nao foi possivel carregar relatorio geral.')
        }

        if (!funnelResponse.ok || !('stages' in funnelPayload) || !Array.isArray(funnelPayload.stages)) {
          throw new Error(getPayloadMessage(funnelPayload) ?? 'Nao foi possivel carregar funil de candidaturas.')
        }

        if (!sourcesResponse.ok || !('sources' in sourcesPayload) || !Array.isArray(sourcesPayload.sources)) {
          throw new Error(getPayloadMessage(sourcesPayload) ?? 'Nao foi possivel carregar fontes de candidatos.')
        }

        if (!hiringTimeResponse.ok || !('averageDays' in hiringTimePayload)) {
          throw new Error(getPayloadMessage(hiringTimePayload) ?? 'Nao foi possivel carregar tempo medio de contratacao.')
        }

        if (!isActive) {
          return
        }

        setOverview(overviewPayload.overview)
        setFunnel(funnelPayload as CompanyFunnel)
        setSources(sourcesPayload as CompanySources)
        setHiringTime(hiringTimePayload as CompanyHiringTime)
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar relatorios.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadReports()

    return () => {
      isActive = false
    }
  }, [user?.id])

  return (
    <>
      <DashboardHeader
        title="Relatorios"
        subtitle="Indicadores operacionais das vagas e do funil de recrutamento"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {isLoading && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">Carregando relatorios...</CardContent>
            </Card>
          )}

          {!isLoading && error && (
            <Card>
              <CardContent className="p-10 text-center text-destructive">{error}</CardContent>
            </Card>
          )}

          {!isLoading && !error && overview && funnel && sources && hiringTime && (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Vagas ativas</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-600">{overview.jobsActive}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Candidaturas</p>
                    <p className="mt-2 text-2xl font-bold">{overview.applicationsTotal}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Compatibilidade media</p>
                    <p className="mt-2 text-2xl font-bold text-chart-2">{overview.averageCompatibility}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Tempo medio de contratacao</p>
                    <p className="mt-2 text-2xl font-bold text-primary">{hiringTime.averageDays} dias</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Briefcase className="h-4 w-4 text-primary" />
                      Vagas da empresa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Total de vagas</span>
                      <span className="font-semibold">{overview.jobsTotal}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Vagas ativas</span>
                      <span className="font-semibold text-emerald-600">{overview.jobsActive}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Vagas pausadas</span>
                      <span className="font-semibold text-amber-600">{overview.jobsPaused}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4 text-chart-2" />
                      Funil de candidaturas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {funnel.stages.map((stage) => (
                      <div key={stage.status} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <span className="text-sm text-muted-foreground">{stage.label}</span>
                        <span className="text-sm font-semibold">{stage.count} ({stage.percentage}%)</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4 text-chart-4" />
                      Fontes de candidatos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sources.sources.map((item) => (
                      <div key={item.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <span className="text-sm text-muted-foreground">{item.source}</span>
                        <span className="font-semibold">{item.count} ({item.percentage}%)</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Leads pendentes</span>
                      <span className="font-semibold text-amber-600">{sources.leadBreakdown.pending}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Leads submetidos</span>
                      <span className="font-semibold text-emerald-600">{sources.leadBreakdown.submitted}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Timer className="h-4 w-4 text-primary" />
                      Tempo de contratacao
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Media</span>
                      <span className="font-semibold">{hiringTime.averageDays} dias</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Minimo</span>
                      <span className="font-semibold">{hiringTime.minDays} dias</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">Maximo</span>
                      <span className="font-semibold">{hiringTime.maxDays} dias</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileSearch className="h-4 w-4" />
                        Amostras consideradas
                      </span>
                      <span className="font-semibold">{hiringTime.sampleSize}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}
