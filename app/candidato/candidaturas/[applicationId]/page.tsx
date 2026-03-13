'use client'

import Link from 'next/link'
import { use } from 'react'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  MapPin,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { CompatibilityGauge } from '@/components/analysis/compatibility-gauge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useAppData } from '@/contexts/app-data-context'
import { useCandidatePanel } from '@/contexts/candidate-panel-context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'

const statusColors = {
  submitted: 'bg-blue-500/10 text-blue-600 border-blue-200',
  analyzing: 'bg-amber-500/10 text-amber-600 border-amber-200',
  analyzed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  reviewed: 'bg-purple-500/10 text-purple-600 border-purple-200',
  approved: 'bg-green-500/10 text-green-600 border-green-200',
  rejected: 'bg-red-500/10 text-red-600 border-red-200',
} as const

const statusLabels = {
  submitted: 'Candidatura enviada',
  analyzing: 'Analise em andamento',
  analyzed: 'Analise concluida',
  reviewed: 'Perfil revisado',
  approved: 'Voce avancou',
  rejected: 'Processo encerrado',
} as const

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Data indisponivel'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export default function CandidateApplicationDetailsPage({
  params,
}: {
  params: Promise<{ applicationId: string }>
}) {
  const { applicationId } = use(params)
  const { user } = useAuth()
  const { data, refresh } = useAppData()
  const { refreshCandidatePanel } = useCandidatePanel()
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null)
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false)

  const candidateId = user?.id ?? '3'
  const application = data.applications.find((entry) => (
    entry.id === applicationId && entry.candidateId === candidateId
  ))

  if (!application) {
    return (
      <>
        <DashboardHeader
          title="Candidatura nao encontrada"
          subtitle="Verifique se a vaga ainda esta vinculada ao seu perfil"
        />
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg font-medium">Nao foi possivel localizar esta candidatura.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ela pode ter sido removida ou nao pertence ao seu perfil.
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <Button variant="outline" asChild>
                  <Link href="/candidato/candidaturas">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para candidaturas
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/candidato/vagas">Ver vagas</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  const isCompletedAnalysis = application.analysis?.status === 'completed'
  const isWithdrawnByCandidate = !!application.withdrawnByCandidate
  const canWithdraw = application.status !== 'rejected' && !isWithdrawnByCandidate
  const currentStatusClassName = isWithdrawnByCandidate
    ? 'bg-slate-500/10 text-slate-600 border-slate-200'
    : statusColors[application.status]
  const currentStatusLabel = isWithdrawnByCandidate
    ? 'Retirada por voce'
    : statusLabels[application.status]
  const applicationIdForWithdraw = application.id

  function getPayloadMessage(payload: unknown) {
    if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
      return payload.message
    }

    return null
  }

  async function handleWithdraw() {
    setIsWithdrawing(true)
    setWithdrawError(null)
    setWithdrawSuccess(null)

    try {
      const response = await fetch(`/api/candidate/applications/${applicationIdForWithdraw}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateId,
        }),
      })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel retirar a candidatura.')
      }

      await Promise.all([refresh(), refreshCandidatePanel()])
      setWithdrawSuccess('Candidatura retirada com sucesso.')
      setIsWithdrawDialogOpen(false)
    } catch (requestError) {
      setWithdrawError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao retirar candidatura.',
      )
    } finally {
      setIsWithdrawing(false)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Detalhes da Candidatura"
        subtitle={`${application.job.title} · ${application.job.company}`}
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/candidato/candidaturas">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/candidato/vagas">Outras vagas</Link>
            </Button>
            {canWithdraw && (
              <Button
                variant="outline"
                disabled={isWithdrawing}
                onClick={() => setIsWithdrawDialogOpen(true)}
              >
                Retirar candidatura
              </Button>
            )}
            {application.job.shareToken && (
              <Button asChild>
                <Link href={`/vagas/${application.job.shareToken}`}>
                  Abrir formulario da vaga
                </Link>
              </Button>
            )}
          </div>

          {withdrawError && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{withdrawError}</CardContent>
            </Card>
          )}

          {withdrawSuccess && (
            <Card>
              <CardContent className="p-4 text-sm text-emerald-600">{withdrawSuccess}</CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Resumo da vaga</CardTitle>
                <CardDescription>Informacoes principais da candidatura</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={currentStatusClassName}>
                    {currentStatusLabel}
                  </Badge>
                  <Badge variant="outline">{application.job.level}</Badge>
                  <Badge variant="outline">{application.job.type}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {application.job.company}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {application.job.location}
                  </p>
                  <p className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {application.job.department}
                  </p>
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Submetida em {formatDate(application.submittedAt)}
                  </p>
                </div>

                {application.notes && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-sm text-muted-foreground">{application.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status atual</CardTitle>
                <CardDescription>Etapa da sua candidatura agora</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {application.status === 'approved' && (
                  <div className="flex items-start gap-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5 mt-0.5" />
                    <p className="text-sm">Sua candidatura avancou para as proximas etapas.</p>
                  </div>
                )}
                {application.status === 'rejected' && !isWithdrawnByCandidate && (
                  <div className="flex items-start gap-2 text-red-600">
                    <XCircle className="h-5 w-5 mt-0.5" />
                    <p className="text-sm">Esta vaga foi encerrada para seu perfil neste momento.</p>
                  </div>
                )}
                {isWithdrawnByCandidate && (
                  <div className="flex items-start gap-2 text-slate-600">
                    <XCircle className="h-5 w-5 mt-0.5" />
                    <p className="text-sm">Voce retirou esta candidatura voluntariamente.</p>
                  </div>
                )}
                {!['approved', 'rejected'].includes(application.status) && !isWithdrawnByCandidate && (
                  <div className="flex items-start gap-2 text-amber-600">
                    <Clock3 className="h-5 w-5 mt-0.5" />
                    <p className="text-sm">O time ainda esta avaliando seu perfil nesta vaga.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Analise da candidatura</CardTitle>
              <CardDescription>
                Resultado tecnico/comportamental gerado para esta vaga
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCompletedAnalysis && application.analysis ? (
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <CompatibilityGauge score={application.analysis.compatibilityScore ?? 0} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Pontos fortes</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        {application.analysis.aiAnalysis.strengths.slice(0, 4).map((item) => (
                          <p key={item}>• {item}</p>
                        ))}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">A desenvolver</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        {application.analysis.aiAnalysis.weaknesses.slice(0, 4).map((item) => (
                          <p key={item}>• {item}</p>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">
                      <Sparkles className="inline mr-2 h-4 w-4 text-chart-4" />
                      {application.analysis.aiAnalysis.summary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Analise ainda nao concluida para esta candidatura.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar retirada da candidatura</AlertDialogTitle>
            <AlertDialogDescription>
              Essa acao encerra sua participacao nesta vaga e nao pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
            <p><span className="font-medium">Vaga:</span> {application.job.title}</p>
            <p><span className="font-medium">Empresa:</span> {application.job.company}</p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWithdrawing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isWithdrawing}
              onClick={(event) => {
                event.preventDefault()
                void handleWithdraw()
              }}
            >
              {isWithdrawing ? 'Retirando...' : 'Confirmar retirada'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
