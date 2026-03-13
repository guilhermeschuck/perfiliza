'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search, Filter, Eye, Sparkles } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type { Application } from '@/lib/types'

const statusColors = {
  submitted: 'bg-blue-500/10 text-blue-600 border-blue-200',
  analyzing: 'bg-amber-500/10 text-amber-600 border-amber-200',
  analyzed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  reviewed: 'bg-purple-500/10 text-purple-600 border-purple-200',
  approved: 'bg-green-500/10 text-green-600 border-green-200',
  rejected: 'bg-red-500/10 text-red-600 border-red-200',
} as const

const statusLabels = {
  submitted: 'Enviada',
  analyzing: 'Em analise',
  analyzed: 'Analisada',
  reviewed: 'Revisada',
  approved: 'Aprovada',
  rejected: 'Encerrada',
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

export default function CandidatoApplicationsPage() {
  const { user } = useAuth()
  const { data, refresh } = useAppData()
  const { refreshCandidatePanel } = useCandidatePanel()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pendingWithdraw, setPendingWithdraw] = useState<Application | null>(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null)

  const candidateId = user?.id ?? '3'

  const applications = useMemo(() => (
    data.applications
      .filter((application) => application.candidateId === candidateId)
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
  ), [candidateId, data.applications])

  const filteredApplications = applications.filter((application) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = query === '' ||
      application.job.title.toLowerCase().includes(query) ||
      application.job.company.toLowerCase().includes(query)
    const matchesStatus = statusFilter === 'all' || application.status === statusFilter

    return matchesSearch && matchesStatus
  })

  function getApplicationStatusLabel(application: Application) {
    if (application.withdrawnByCandidate) {
      return 'Retirada por voce'
    }

    return statusLabels[application.status]
  }

  function getApplicationStatusClassName(application: Application) {
    if (application.withdrawnByCandidate) {
      return 'bg-slate-500/10 text-slate-600 border-slate-200'
    }

    return statusColors[application.status]
  }

  function canWithdrawApplication(application: Application) {
    return !application.withdrawnByCandidate && application.status !== 'rejected'
  }

  function getPayloadMessage(payload: unknown) {
    if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
      return payload.message
    }

    return null
  }

  async function confirmWithdraw() {
    if (!pendingWithdraw) {
      return
    }

    setIsWithdrawing(true)
    setWithdrawError(null)
    setWithdrawSuccess(null)

    try {
      const response = await fetch(`/api/candidate/applications/${pendingWithdraw.id}/withdraw`, {
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
      setPendingWithdraw(null)
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
        title="Minhas Candidaturas"
        subtitle="Acompanhe status, analises e proximos passos de cada vaga"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por vaga ou empresa..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-56">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="submitted">Enviada</SelectItem>
                    <SelectItem value="analyzing">Em analise</SelectItem>
                    <SelectItem value="analyzed">Analisada</SelectItem>
                    <SelectItem value="reviewed">Revisada</SelectItem>
                    <SelectItem value="approved">Aprovada</SelectItem>
                    <SelectItem value="rejected">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">
            {filteredApplications.length} candidatura(s) encontrada(s)
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

          <div className="space-y-4">
            {filteredApplications.map((application) => (
              <Card key={application.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{application.job.title}</h3>
                        <Badge className={getApplicationStatusClassName(application)}>
                          {getApplicationStatusLabel(application)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{application.job.company} · {application.job.location}</p>
                      <p className="text-sm text-muted-foreground">Submetida em {formatDate(application.submittedAt)}</p>
                      {application.analysis?.status === 'completed' && (
                        <div className="inline-flex items-center gap-2 text-sm text-emerald-600">
                          <Sparkles className="h-4 w-4" />
                          Compatibilidade calculada: {application.analysis.compatibilityScore ?? 0}%
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {canWithdrawApplication(application) && (
                        <Button
                          variant="outline"
                          disabled={isWithdrawing}
                          onClick={() => setPendingWithdraw(application)}
                        >
                          Retirar candidatura
                        </Button>
                      )}
                      <Button variant="outline" asChild>
                        <Link href="/candidato/vagas">Ver vagas</Link>
                      </Button>
                      <Button asChild>
                        <Link href={`/candidato/candidaturas/${application.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredApplications.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-lg font-medium">Nenhuma candidatura encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajuste os filtros ou candidate-se em novas vagas.
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/candidato/vagas">Explorar vagas</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <AlertDialog
        open={!!pendingWithdraw}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isWithdrawing) {
            setPendingWithdraw(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar candidatura</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao encerra sua candidatura para a vaga selecionada. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingWithdraw && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p><span className="font-medium">Vaga:</span> {pendingWithdraw.job.title}</p>
              <p><span className="font-medium">Empresa:</span> {pendingWithdraw.job.company}</p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWithdrawing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isWithdrawing}
              onClick={(event) => {
                event.preventDefault()
                void confirmWithdraw()
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
