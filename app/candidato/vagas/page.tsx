'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  MapPin,
  Building2,
  DollarSign,
  Clock,
  Bookmark,
  ExternalLink,
  HeartHandshake,
} from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAppData } from '@/contexts/app-data-context'
import { useAuth } from '@/contexts/auth-context'
import { useCandidatePanel } from '@/contexts/candidate-panel-context'
import type { SubmissionInput } from '@/lib/app-data'
import type { Job } from '@/lib/types'

function formatSalary(salary?: { min: number; max: number }) {
  if (!salary) {
    return 'A combinar'
  }

  return `R$ ${salary.min.toLocaleString('pt-BR')} - R$ ${salary.max.toLocaleString('pt-BR')}`
}

function formatPublishedAt(date?: string) {
  if (!date) {
    return 'Publicacao recente'
  }

  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Publicacao recente'
  }

  return `Publicada em ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate)}`
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function computeCompatibility(job: Job, candidateSkills: Set<string>) {
  if (candidateSkills.size === 0 || job.requirements.length === 0) {
    return 55
  }

  const matchedRequirements = job.requirements.filter((requirement) => (
    candidateSkills.has(normalize(requirement))
  )).length

  const ratio = matchedRequirements / job.requirements.length
  return Math.min(99, Math.round(45 + (ratio * 55)))
}

function toExperienceRange(experience: number): SubmissionInput['experienceRange'] {
  if (experience <= 1) {
    return '0-1'
  }

  if (experience <= 3) {
    return '2-3'
  }

  if (experience <= 5) {
    return '4-5'
  }

  return '6+'
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

type SavedJobsResponse = {
  candidateId: string
  jobIds: string[]
  message?: string
}

export default function VagasCandidatoPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [onlySaved, setOnlySaved] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [savedJobIds, setSavedJobIds] = useState<string[]>([])
  const [isSavingJobId, setIsSavingJobId] = useState<string | null>(null)
  const [pendingSubmission, setPendingSubmission] = useState<{
    job: Job
    submission: SubmissionInput
  } | null>(null)
  const [isSubmittingJobId, setIsSubmittingJobId] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null)
  const { data, createSubmission } = useAppData()
  const { user } = useAuth()
  const { candidate, refreshCandidatePanel } = useCandidatePanel()

  const candidateId = user?.id ?? '3'
  const candidateSkills = useMemo(() => (
    new Set((candidate?.skills ?? []).map((skill) => normalize(skill)))
  ), [candidate?.skills])
  const savedJobsSet = useMemo(() => new Set(savedJobIds), [savedJobIds])

  const appliedJobs = useMemo(() => (
    new Set(
      data.applications
        .filter((application) => application.candidateId === candidateId)
        .map((application) => application.jobId),
    )
  ), [candidateId, data.applications])

  useEffect(() => {
    let isActive = true

    async function loadSavedJobs() {
      try {
        const response = await fetch(`/api/candidate/saved-jobs?candidateId=${encodeURIComponent(candidateId)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json()) as unknown

        if (!response.ok) {
          throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar vagas salvas.')
        }

        if (
          !payload ||
          typeof payload !== 'object' ||
          !('jobIds' in payload) ||
          !Array.isArray(payload.jobIds)
        ) {
          throw new Error('Resposta invalida para vagas salvas.')
        }

        if (!isActive) {
          return
        }

        setSavedJobIds((payload as SavedJobsResponse).jobIds.filter((jobId) => typeof jobId === 'string'))
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setSubmissionError(
          requestError instanceof Error
            ? requestError.message
            : 'Falha ao carregar vagas salvas.',
        )
      }
    }

    void loadSavedJobs()

    return () => {
      isActive = false
    }
  }, [candidateId])

  const activeJobs = data.jobs.filter((job) => job.status === 'active')

  const filteredJobs = activeJobs.filter((job) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = query === '' ||
      job.title.toLowerCase().includes(query) ||
      job.company.toLowerCase().includes(query) ||
      job.requirements.some((requirement) => requirement.toLowerCase().includes(query))
    const matchesLocation = locationFilter === 'all' || normalize(job.location).includes(normalize(locationFilter))
    const matchesLevel = levelFilter === 'all' || job.level === levelFilter
    const matchesSaved = !onlySaved || savedJobsSet.has(job.id)

    return matchesSearch && matchesLocation && matchesLevel && matchesSaved
  })

  const sortedJobs = [...filteredJobs].sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ))

  const toggleSavedJob = async (jobId: string) => {
    setIsSavingJobId(jobId)
    setSubmissionError(null)

    try {
      const isSaved = savedJobsSet.has(jobId)
      const response = await fetch(
        isSaved
          ? `/api/candidate/saved-jobs/${jobId}?candidateId=${encodeURIComponent(candidateId)}`
          : '/api/candidate/saved-jobs',
        isSaved
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                candidateId,
                jobId,
              }),
            },
      )
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel atualizar vagas salvas.')
      }

      if (!payload || typeof payload !== 'object' || !('jobIds' in payload) || !Array.isArray(payload.jobIds)) {
        throw new Error('Resposta invalida para vagas salvas.')
      }

      setSavedJobIds((payload as SavedJobsResponse).jobIds.filter((value): value is string => typeof value === 'string'))
    } catch (requestError) {
      setSubmissionError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao atualizar vagas salvas.',
      )
    } finally {
      setIsSavingJobId(null)
    }
  }

  function buildCandidateSubmission(jobId: string): SubmissionInput | null {
    if (!candidate) {
      return null
    }

    const candidateSkillsList = candidate.skills.filter((skill) => skill.trim() !== '')
    const hasRequiredFields = (
      candidate.name.trim() !== '' &&
      candidate.email.trim() !== '' &&
      candidate.location.trim() !== '' &&
      candidate.education.trim() !== '' &&
      candidateSkillsList.length > 0
    )

    if (!hasRequiredFields) {
      return null
    }

    return {
      jobId,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone || '',
      location: candidate.location,
      linkedinUrl: candidate.linkedinUrl || undefined,
      experienceRange: toExperienceRange(candidate.experience),
      education: candidate.education,
      skills: candidateSkillsList.join(', '),
      resumeFileName: candidate.resumeFileName ?? undefined,
      notes: 'Submissao realizada pelo proprio candidato no painel.',
    }
  }

  function requestSubmission(job: Job) {
    if (appliedJobs.has(job.id)) {
      setSubmissionError('Voce ja enviou candidatura para esta vaga.')
      setSubmissionSuccess(null)
      return
    }

    const submission = buildCandidateSubmission(job.id)
    if (!submission) {
      setSubmissionError('Complete seu perfil (nome, email, localizacao, formacao e skills) antes de se candidatar.')
      setSubmissionSuccess(null)
      return
    }

    setSubmissionError(null)
    setSubmissionSuccess(null)
    setPendingSubmission({
      job,
      submission,
    })
  }

  async function submitOwnApplication(payload: { job: Job; submission: SubmissionInput }) {
    const { job, submission } = payload
    setIsSubmittingJobId(job.id)

    try {
      await createSubmission(submission)
      await refreshCandidatePanel()
      setSubmissionSuccess(`Candidatura enviada com sucesso para ${job.title}.`)
    } catch (requestError) {
      setSubmissionError(
        requestError instanceof Error
          ? requestError.message
          : 'Nao foi possivel enviar sua candidatura agora.',
      )
    } finally {
      setIsSubmittingJobId(null)
      setPendingSubmission(null)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Vagas Disponiveis"
        subtitle="Explore oportunidades, salve favoritas e candidate-se pelo formulario da vaga"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cargo, empresa ou habilidade..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-full md:w-44">
                    <MapPin className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Localizacao" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="remoto">Remoto</SelectItem>
                    <SelectItem value="sao paulo">Sao Paulo</SelectItem>
                    <SelectItem value="rio de janeiro">Rio de Janeiro</SelectItem>
                    <SelectItem value="hibrido">Hibrido</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-full md:w-36">
                    <SelectValue placeholder="Nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Júnior">Junior</SelectItem>
                    <SelectItem value="Pleno">Pleno</SelectItem>
                    <SelectItem value="Sênior">Senior</SelectItem>
                    <SelectItem value="Especialista">Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={onlySaved ? 'default' : 'outline'}
                  onClick={() => setOnlySaved((current) => !current)}
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  {onlySaved ? 'Exibindo salvas' : 'Somente salvas'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{sortedJobs.length} vagas encontradas</span>
            <span>{savedJobIds.length} vagas salvas</span>
          </div>

          {submissionError && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{submissionError}</CardContent>
            </Card>
          )}

          {submissionSuccess && (
            <Card>
              <CardContent className="p-4 text-sm text-emerald-600">{submissionSuccess}</CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {sortedJobs.map((job) => {
              const compatibility = computeCompatibility(job, candidateSkills)
              const isSaved = savedJobsSet.has(job.id)
              const hasApplied = appliedJobs.has(job.id)
              const isSubmitting = isSubmittingJobId === job.id

              return (
                <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row">
                      <div className="flex-1 p-6">
                        <div className="flex items-start gap-4">
                          <div className="h-14 w-14 rounded-lg bg-chart-4/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-7 w-7 text-chart-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-semibold text-lg">{job.title}</h3>
                                <p className="text-muted-foreground">{job.company}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                disabled={isSavingJobId === job.id}
                                onClick={() => void toggleSavedJob(job.id)}
                                aria-label={isSaved ? 'Remover vaga salva' : 'Salvar vaga'}
                              >
                                <Bookmark className={isSaved ? 'h-5 w-5 fill-current text-chart-4' : 'h-5 w-5'} />
                              </Button>
                            </div>

                            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {job.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                {formatSalary(job.salary)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {job.type}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <Badge variant="secondary">{job.level}</Badge>
                              <Badge variant="outline">{job.department}</Badge>
                              {hasApplied && (
                                <Badge className="bg-emerald-500">Candidatura enviada</Badge>
                              )}
                              {isSaved && (
                                <Badge variant="outline" className="border-chart-4 text-chart-4">
                                  Salva
                                </Badge>
                              )}
                            </div>

                            <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                              {job.description}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-1">
                              {job.requirements.slice(0, 5).map((requirement) => (
                                <Badge key={requirement} variant="secondary" className="text-xs">
                                  {requirement}
                                </Badge>
                              ))}
                              {job.requirements.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{job.requirements.length - 5}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="w-full lg:w-56 p-6 bg-muted/30 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-border gap-3">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">{compatibility}%</p>
                          <p className="text-xs text-muted-foreground">Compatibilidade</p>
                        </div>
                        <Button className="w-full" onClick={() => setSelectedJob(job)}>
                          Ver Detalhes
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          className="w-full"
                          variant={hasApplied ? 'secondary' : 'outline'}
                          disabled={hasApplied || isSubmitting}
                          onClick={() => requestSubmission(job)}
                        >
                          {hasApplied ? 'Candidatura enviada' : isSubmitting ? 'Enviando...' : 'Candidatar agora'}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          {formatPublishedAt(job.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {sortedJobs.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">Nenhuma vaga encontrada</h3>
                <p className="text-sm text-muted-foreground">
                  Ajuste os filtros para encontrar mais oportunidades.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={!!selectedJob} onOpenChange={(isOpen) => !isOpen && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedJob.title}</DialogTitle>
                <DialogDescription>{selectedJob.company} · {selectedJob.location}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedJob.level}</Badge>
                  <Badge variant="outline">{selectedJob.type}</Badge>
                  <Badge variant="outline">{selectedJob.department}</Badge>
                  <Badge variant="outline">{formatSalary(selectedJob.salary)}</Badge>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Descricao</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedJob.description}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Requisitos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedJob.requirements.map((requirement) => (
                      <div key={requirement} className="flex items-start gap-2 text-sm">
                        <HeartHandshake className="h-4 w-4 mt-0.5 text-chart-4" />
                        <span>{requirement}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {selectedJob.benefits.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Beneficios</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedJob.benefits.map((benefit) => (
                        <p key={benefit} className="text-sm text-muted-foreground">• {benefit}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedJob.shareToken ? (
                    <Button asChild>
                      <Link href={`/vagas/${selectedJob.shareToken}`}>
                        Candidatar-se nesta vaga
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled>
                      Link publico indisponivel
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={appliedJobs.has(selectedJob.id) || isSubmittingJobId === selectedJob.id}
                    onClick={() => requestSubmission(selectedJob)}
                  >
                    {appliedJobs.has(selectedJob.id)
                      ? 'Candidatura enviada'
                      : isSubmittingJobId === selectedJob.id
                        ? 'Enviando...'
                        : 'Candidatar 1-clique'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSavingJobId === selectedJob.id}
                    onClick={() => void toggleSavedJob(selectedJob.id)}
                  >
                    <Bookmark className="mr-2 h-4 w-4" />
                    {isSavingJobId === selectedJob.id
                      ? 'Salvando...'
                      : (savedJobsSet.has(selectedJob.id) ? 'Remover dos salvos' : 'Salvar vaga')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingSubmission}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isSubmittingJobId) {
            setPendingSubmission(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar candidatura 1-clique</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao envia seu perfil atual para a vaga selecionada. Revise os dados antes de confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingSubmission && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
              <p><span className="font-medium">Vaga:</span> {pendingSubmission.job.title}</p>
              <p><span className="font-medium">Empresa:</span> {pendingSubmission.job.company}</p>
              <p><span className="font-medium">Nome:</span> {pendingSubmission.submission.name}</p>
              <p><span className="font-medium">E-mail:</span> {pendingSubmission.submission.email}</p>
              <p><span className="font-medium">Localizacao:</span> {pendingSubmission.submission.location}</p>
              <p><span className="font-medium">Formacao:</span> {pendingSubmission.submission.education}</p>
              <p><span className="font-medium">Habilidades:</span> {pendingSubmission.submission.skills}</p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!isSubmittingJobId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingSubmission || !!isSubmittingJobId}
              onClick={(event) => {
                event.preventDefault()

                if (!pendingSubmission) {
                  return
                }

                void submitOwnApplication(pendingSubmission)
              }}
            >
              {isSubmittingJobId ? 'Enviando...' : 'Confirmar candidatura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
