'use client'

import { useEffect, useState } from 'react'
import { Search, MapPin, Briefcase, GraduationCap, FileSearch } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Candidate } from '@/lib/types'

type ApplicationStatus = 'submitted' | 'analyzing' | 'analyzed' | 'reviewed' | 'approved' | 'rejected'

type CandidateWithMetrics = Candidate & {
  applicationsCount: number
  latestApplicationStatus: ApplicationStatus | null
  latestApplicationAt: string | null
}

interface AdminCandidatesResponse {
  candidates: CandidateWithMetrics[]
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

const statusLabels: Record<ApplicationStatus, string> = {
  submitted: 'Enviado',
  analyzing: 'Analisando',
  analyzed: 'Analisado',
  reviewed: 'Revisado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
}

const statusColors: Record<ApplicationStatus, string> = {
  submitted: 'bg-blue-500/10 text-blue-600 border-blue-200',
  analyzing: 'bg-amber-500/10 text-amber-600 border-amber-200',
  analyzed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  reviewed: 'bg-purple-500/10 text-purple-600 border-purple-200',
  approved: 'bg-green-500/10 text-green-600 border-green-200',
  rejected: 'bg-red-500/10 text-red-600 border-red-200',
}

export default function CandidatosPage() {
  const [candidates, setCandidates] = useState<CandidateWithMetrics[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadCandidates() {
      setIsLoading(true)

      try {
        const response = await fetch('/api/admin/candidates', { cache: 'no-store' })
        const payload = (await response.json()) as unknown

        if (!response.ok) {
          throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar os candidatos.')
        }

        if (
          !payload ||
          typeof payload !== 'object' ||
          !('candidates' in payload) ||
          !Array.isArray(payload.candidates)
        ) {
          throw new Error('Resposta invalida para listagem de candidatos.')
        }

        if (!isActive) {
          return
        }

        setCandidates((payload as AdminCandidatesResponse).candidates)
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar candidatos.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadCandidates()

    return () => {
      isActive = false
    }
  }, [])

  const filteredCandidates = candidates.filter((candidate) => {
    const query = searchQuery.toLowerCase()
    return (
      candidate.name.toLowerCase().includes(query) ||
      candidate.email.toLowerCase().includes(query) ||
      candidate.skills.some((skill) => skill.toLowerCase().includes(query))
    )
  })

  return (
    <>
      <DashboardHeader
        title="Candidatos"
        subtitle="Base consolidada de candidatos submetidos e status de candidatura"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nome, email ou skill..."
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Carregando candidatos...
              </CardContent>
            </Card>
          )}

          {!isLoading && error && (
            <Card>
              <CardContent className="p-10 text-center text-destructive">{error}</CardContent>
            </Card>
          )}

          {!isLoading && !error && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCandidates.map((candidate) => (
                <Card key={candidate.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {candidate.name.split(' ').map((name) => name[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{candidate.name}</h3>
                        <p className="truncate text-sm text-muted-foreground">{candidate.email}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{candidate.location}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Briefcase className="h-3 w-3" />
                          <span>{candidate.experience} anos de experiencia</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          <span className="truncate">{candidate.education}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 4).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {candidate.skills.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{candidate.skills.length - 4}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                      <Badge variant="outline" className="gap-1">
                        <FileSearch className="h-3 w-3" />
                        {candidate.applicationsCount} candidaturas
                      </Badge>
                      {candidate.latestApplicationStatus && (
                        <Badge
                          variant="outline"
                          className={statusColors[candidate.latestApplicationStatus]}
                        >
                          {statusLabels[candidate.latestApplicationStatus]}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && !error && filteredCandidates.length === 0 && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Nenhum candidato encontrado para o filtro informado.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
