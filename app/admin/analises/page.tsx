'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Filter, Eye, Brain, User, Hash, Linkedin, RefreshCw } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppData } from '@/contexts/app-data-context'

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

export default function AnalisesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [processingApplicationId, setProcessingApplicationId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pollUntil, setPollUntil] = useState<number | null>(null)
  const { data, refresh } = useAppData()

  useEffect(() => {
    if (!pollUntil) {
      return
    }

    if (Date.now() > pollUntil) {
      setPollUntil(null)
      return
    }

    const intervalId = window.setInterval(() => {
      void refresh()

      if (Date.now() > pollUntil) {
        setPollUntil(null)
      }
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pollUntil, refresh])

  async function runAnalysisAction(applicationId: string, action: 'start' | 'reprocess') {
    setProcessingApplicationId(applicationId)
    setActionError(null)

    try {
      const endpoint = action === 'start' ? 'start' : 'reprocess'
      const response = await fetch(`/api/admin/applications/${applicationId}/analysis/${endpoint}`, {
        method: 'POST',
      })
      const payload = (await response.json()) as { message?: string; errors?: Record<string, unknown> }

      if (!response.ok) {
        const firstError = Object.values(payload.errors ?? {})
          .flatMap((value) => (Array.isArray(value) ? value : []))
          .find((value): value is string => typeof value === 'string')

        throw new Error(firstError ?? payload.message ?? 'Nao foi possivel processar esta analise.')
      }

      await refresh()
      setPollUntil(Date.now() + 45_000)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Falha ao processar analise.')
    } finally {
      setProcessingApplicationId(null)
    }
  }

  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase()

    return data.applications.filter(app => {
      const matchesSearch = app.candidate.name.toLowerCase().includes(normalizedSearch) ||
        app.job.title.toLowerCase().includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.applications, searchQuery, statusFilter])

  return (
    <>
      <DashboardHeader 
        title="Análise de Currículos" 
        subtitle="Gerencie e visualize análises de candidatos"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
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
                    <SelectItem value="submitted">Enviado</SelectItem>
                    <SelectItem value="analyzing">Analisando</SelectItem>
                    <SelectItem value="analyzed">Analisado</SelectItem>
                    <SelectItem value="reviewed">Revisado</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Applications List */}
          {actionError && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{actionError}</CardContent>
            </Card>
          )}
          {pollUntil && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Atualizacao automatica ativa para acompanhar o processamento da analise.
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {filteredApplications.map((application) => (
              <Card key={application.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Candidate Info */}
                    <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-border">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">
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
                            {application.candidate.currentPosition} - {application.candidate.experience} anos de experiência
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
                            {application.candidate.skills.length > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{application.candidate.skills.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Analysis Summary */}
                    <div className="w-full lg:w-80 p-6 bg-muted/30">
                      {application.analysis && application.analysis.status === 'completed' ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Compatibilidade</span>
                            <span className="text-2xl font-bold text-primary">
                              {application.analysis.compatibilityScore}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4 text-primary" />
                              <span>IA: {application.analysis.aiAnalysis.overallScore}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-chart-2" />
                              <span>DISC: {application.analysis.discProfile.primaryType}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-chart-4" />
                              <span>Num: {application.analysis.numerology.lifePathNumber}</span>
                            </div>
                            {application.analysis.linkedinAnalysis && (
                              <div className="flex items-center gap-2">
                                <Linkedin className="h-4 w-4 text-blue-600" />
                                <span>LI: {application.analysis.linkedinAnalysis.profileStrength}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button className="w-full" size="sm" asChild>
                              <Link href={`/admin/analises/${application.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Análise Completa
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full"
                              size="sm"
                              disabled={processingApplicationId === application.id}
                              onClick={() => void runAnalysisAction(application.id, 'reprocess')}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reprocessar
                            </Button>
                          </div>
                        </div>
                      ) : application.analysis?.status === 'in_progress' ? (
                        <div className="flex flex-col items-center justify-center h-full py-4">
                          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
                          <p className="text-sm text-muted-foreground">Análise em andamento...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-4">
                          <Button
                            className="w-full"
                            size="sm"
                            disabled={processingApplicationId === application.id}
                            onClick={() => void runAnalysisAction(application.id, 'start')}
                          >
                            <Brain className="mr-2 h-4 w-4" />
                            {processingApplicationId === application.id ? 'Processando...' : 'Iniciar Análise'}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Clique para iniciar a análise completa
                          </p>
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
                <h3 className="font-semibold text-lg">Nenhuma aplicação encontrada</h3>
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
