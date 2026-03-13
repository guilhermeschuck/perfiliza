'use client'

import { useState, type FormEvent } from 'react'
import {
  Search,
  Plus,
  MapPin,
  Building2,
  Users,
  DollarSign,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Pause,
  Play,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAppData } from '@/contexts/app-data-context'
import type { Application, Job } from '@/lib/types'

type JobFormState = {
  companyId: string
  title: string
  department: string
  level: Job['level']
  type: Job['type']
  location: string
  status: Job['status']
  description: string
  salaryMin: string
  salaryMax: string
  requirementsText: string
  benefitsText: string
}

interface JobCandidatesResponse {
  job: Job
  applications: Application[]
  total: number
}

const statusColors: Record<Job['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  closed: 'bg-red-500/10 text-red-600 border-red-200',
}

const statusLabels: Record<Job['status'], string> = {
  active: 'Ativa',
  paused: 'Pausada',
  closed: 'Encerrada',
}

const applicationStatusColors: Record<Application['status'], string> = {
  submitted: 'bg-blue-500/10 text-blue-600 border-blue-200',
  analyzing: 'bg-amber-500/10 text-amber-600 border-amber-200',
  analyzed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  reviewed: 'bg-purple-500/10 text-purple-600 border-purple-200',
  approved: 'bg-green-500/10 text-green-600 border-green-200',
  rejected: 'bg-red-500/10 text-red-600 border-red-200',
}

const applicationStatusLabels: Record<Application['status'], string> = {
  submitted: 'Enviado',
  analyzing: 'Analisando',
  analyzed: 'Analisado',
  reviewed: 'Revisado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'errors' in payload && payload.errors && typeof payload.errors === 'object') {
    const firstError = Object.values(payload.errors)
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .find((value): value is string => typeof value === 'string')

    if (firstError) {
      return firstError
    }
  }

  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

function buildInitialForm(companyId = ''): JobFormState {
  return {
    companyId,
    title: '',
    department: '',
    level: 'Pleno',
    type: 'CLT',
    location: '',
    status: 'active',
    description: '',
    salaryMin: '',
    salaryMax: '',
    requirementsText: '',
    benefitsText: '',
  }
}

function parseList(value: string) {
  return Array.from(new Set(
    value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ))
}

function mapJobToForm(job: Job): JobFormState {
  return {
    companyId: job.companyId,
    title: job.title,
    department: job.department,
    level: job.level,
    type: job.type,
    location: job.location,
    status: job.status,
    description: job.description,
    salaryMin: job.salary ? String(job.salary.min) : '',
    salaryMax: job.salary ? String(job.salary.max) : '',
    requirementsText: job.requirements.join(', '),
    benefitsText: job.benefits.join(', '),
  }
}

export default function VagasPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [jobForm, setJobForm] = useState<JobFormState>(buildInitialForm())
  const [isSavingJob, setIsSavingJob] = useState(false)
  const [statusActionJobId, setStatusActionJobId] = useState<string | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isCandidatesDialogOpen, setIsCandidatesDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedApplications, setSelectedApplications] = useState<Application[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const { data, refresh } = useAppData()

  const companyUsers = data.users.filter((user) => user.role === 'empresa')
  const hasCompanies = companyUsers.length > 0

  const filteredJobs = data.jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const formatSalary = (salary?: { min: number; max: number } | null) => {
    if (!salary) return 'A combinar'
    return `R$ ${salary.min.toLocaleString()} - R$ ${salary.max.toLocaleString()}`
  }

  function openCreateDialog() {
    const defaultCompanyId = companyUsers[0]?.id ?? ''
    setEditingJob(null)
    setJobForm(buildInitialForm(defaultCompanyId))
    setStatusError(null)
    setIsJobDialogOpen(true)
  }

  function openEditDialog(job: Job) {
    setEditingJob(job)
    setJobForm(mapJobToForm(job))
    setStatusError(null)
    setIsJobDialogOpen(true)
  }

  function buildJobPayload(form: JobFormState) {
    const payload: Record<string, unknown> = {
      companyId: form.companyId,
      title: form.title.trim(),
      department: form.department.trim(),
      level: form.level,
      type: form.type,
      location: form.location.trim(),
      status: form.status,
      description: form.description.trim(),
      requirements: parseList(form.requirementsText),
      benefits: parseList(form.benefitsText),
    }

    if (form.salaryMin !== '' && form.salaryMax !== '') {
      payload.salary = {
        min: Number(form.salaryMin),
        max: Number(form.salaryMax),
      }
    }

    return payload
  }

  async function handleSaveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingJob(true)
    setStatusError(null)

    try {
      const payload = buildJobPayload(jobForm)
      const endpoint = editingJob ? `/api/admin/jobs/${editingJob.id}` : '/api/admin/jobs'
      const method = editingJob ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const responsePayload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(responsePayload) ?? 'Nao foi possivel salvar a vaga.')
      }

      await refresh()
      setIsJobDialogOpen(false)
      setEditingJob(null)
    } catch (requestError) {
      setStatusError(requestError instanceof Error ? requestError.message : 'Falha ao salvar vaga.')
    } finally {
      setIsSavingJob(false)
    }
  }

  async function changeJobStatus(jobId: string, status: Job['status']) {
    setStatusActionJobId(jobId)
    setStatusError(null)

    try {
      const response = await fetch(`/api/admin/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel atualizar o status da vaga.')
      }

      await refresh()
    } catch (requestError) {
      setStatusError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar status da vaga.')
    } finally {
      setStatusActionJobId(null)
    }
  }

  async function deleteJob(job: Job) {
    if (!window.confirm(`Deseja excluir a vaga "${job.title}"? Esta acao remove candidaturas e leads relacionados.`)) {
      return
    }

    setDeletingJobId(job.id)
    setStatusError(null)

    try {
      const response = await fetch(`/api/admin/jobs/${job.id}`, {
        method: 'DELETE',
      })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel excluir a vaga.')
      }

      await refresh()
    } catch (requestError) {
      setStatusError(requestError instanceof Error ? requestError.message : 'Falha ao excluir vaga.')
    } finally {
      setDeletingJobId(null)
    }
  }

  async function openCandidatesDialog(job: Job) {
    setSelectedJob(job)
    setSelectedApplications([])
    setCandidatesError(null)
    setIsCandidatesDialogOpen(true)
    setIsLoadingCandidates(true)

    try {
      const response = await fetch(`/api/admin/jobs/${job.id}/candidates`, { cache: 'no-store' })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar os candidatos da vaga.')
      }

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('applications' in payload) ||
        !Array.isArray(payload.applications)
      ) {
        throw new Error('Resposta invalida para candidatos da vaga.')
      }

      const candidatesPayload = payload as JobCandidatesResponse
      setSelectedJob(candidatesPayload.job ?? job)
      setSelectedApplications(candidatesPayload.applications)
    } catch (requestError) {
      setCandidatesError(requestError instanceof Error ? requestError.message : 'Falha ao carregar candidatos da vaga.')
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Gestao de Vagas"
        subtitle="Gerencie vagas, status e candidatos por oportunidade"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar vagas..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="paused">Pausadas</SelectItem>
                  <SelectItem value="closed">Encerradas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={openCreateDialog} disabled={!hasCompanies}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Vaga
            </Button>
          </div>

          {!hasCompanies && (
            <Card>
              <CardContent className="p-4 text-sm text-amber-700">
                Nenhuma empresa cadastrada. Crie um usuario com role `empresa` para publicar vagas.
              </CardContent>
            </Card>
          )}

          {statusError && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{statusError}</CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data.jobs.length}</p>
                <p className="text-sm text-muted-foreground">Total de vagas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {data.jobs.filter((job) => job.status === 'active').length}
                </p>
                <p className="text-sm text-muted-foreground">Vagas ativas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {data.jobs.filter((job) => job.status === 'paused').length}
                </p>
                <p className="text-sm text-muted-foreground">Vagas pausadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {data.jobs.reduce((total, job) => total + job.applicationsCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total de candidaturas</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{job.title}</h3>
                            <Badge variant="outline" className={statusColors[job.status]}>
                              {statusLabels[job.status]}
                            </Badge>
                            <Badge variant="secondary">{job.type}</Badge>
                            <Badge variant="outline">{job.level}</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {job.company}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {job.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              {formatSalary(job.salary)}
                            </span>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={(event) => {
                              event.preventDefault()
                              void openCandidatesDialog(job)
                            }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Ver candidatos
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(event) => {
                              event.preventDefault()
                              openEditDialog(job)
                            }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={statusActionJobId === job.id}
                              onSelect={(event) => {
                                event.preventDefault()
                                const nextStatus = job.status === 'active' ? 'paused' : 'active'
                                void changeJobStatus(job.id, nextStatus)
                              }}
                            >
                              {job.status === 'active' ? (
                                <>
                                  <Pause className="mr-2 h-4 w-4" />
                                  {statusActionJobId === job.id ? 'Atualizando...' : 'Pausar'}
                                </>
                              ) : (
                                <>
                                  <Play className="mr-2 h-4 w-4" />
                                  {statusActionJobId === job.id ? 'Atualizando...' : 'Ativar'}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              disabled={deletingJobId === job.id}
                              onSelect={(event) => {
                                event.preventDefault()
                                void deleteJob(job)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingJobId === job.id ? 'Excluindo...' : 'Excluir'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
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

                    <div className="w-full lg:w-48 p-6 bg-muted/30 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-border">
                      <div className="flex items-center gap-2 text-2xl font-bold">
                        <Users className="h-6 w-6 text-muted-foreground" />
                        {job.applicationsCount}
                      </div>
                      <p className="text-sm text-muted-foreground">Candidatos</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full"
                        onClick={() => void openCandidatesDialog(job)}
                      >
                        Ver Candidatos
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredJobs.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">Nenhuma vaga encontrada</h3>
                <p className="text-sm text-muted-foreground">
                  Tente ajustar os filtros de busca
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? 'Editar vaga' : 'Criar nova vaga'}</DialogTitle>
            <DialogDescription>
              {editingJob
                ? 'Atualize as informacoes da vaga selecionada.'
                : 'Preencha os dados da vaga para publicacao no sistema.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveJob} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="companyId">Empresa</Label>
              <Select
                value={jobForm.companyId}
                onValueChange={(value) => setJobForm((prev) => ({ ...prev, companyId: value }))}
              >
                <SelectTrigger id="companyId">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companyUsers.map((companyUser) => (
                    <SelectItem key={companyUser.id} value={companyUser.id}>
                      {companyUser.company ?? companyUser.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Titulo da vaga</Label>
              <Input
                id="title"
                value={jobForm.title}
                onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ex: Desenvolvedor Full Stack"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="department">Departamento</Label>
                <Input
                  id="department"
                  value={jobForm.department}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, department: event.target.value }))}
                  placeholder="Ex: Engenharia"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Localizacao</Label>
                <Input
                  id="location"
                  value={jobForm.location}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Ex: Sao Paulo, SP"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="level">Nivel</Label>
                <Select
                  value={jobForm.level}
                  onValueChange={(value) => setJobForm((prev) => ({ ...prev, level: value as Job['level'] }))}
                >
                  <SelectTrigger id="level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Júnior">Júnior</SelectItem>
                    <SelectItem value="Pleno">Pleno</SelectItem>
                    <SelectItem value="Sênior">Sênior</SelectItem>
                    <SelectItem value="Especialista">Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo de contrato</Label>
                <Select
                  value={jobForm.type}
                  onValueChange={(value) => setJobForm((prev) => ({ ...prev, type: value as Job['type'] }))}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLT">CLT</SelectItem>
                    <SelectItem value="PJ">PJ</SelectItem>
                    <SelectItem value="Estágio">Estágio</SelectItem>
                    <SelectItem value="Freelancer">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobStatus">Status</Label>
                <Select
                  value={jobForm.status}
                  onValueChange={(value) => setJobForm((prev) => ({ ...prev, status: value as Job['status'] }))}
                >
                  <SelectTrigger id="jobStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="closed">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="salaryMin">Salario minimo (R$)</Label>
                <Input
                  id="salaryMin"
                  type="number"
                  min={0}
                  value={jobForm.salaryMin}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, salaryMin: event.target.value }))}
                  placeholder="Ex: 8000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="salaryMax">Salario maximo (R$)</Label>
                <Input
                  id="salaryMax"
                  type="number"
                  min={0}
                  value={jobForm.salaryMax}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, salaryMax: event.target.value }))}
                  placeholder="Ex: 12000"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                value={jobForm.description}
                onChange={(event) => setJobForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                placeholder="Descreva responsabilidades e objetivo da vaga."
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="requirements">Requisitos (separados por virgula ou linha)</Label>
              <Textarea
                id="requirements"
                value={jobForm.requirementsText}
                onChange={(event) => setJobForm((prev) => ({ ...prev, requirementsText: event.target.value }))}
                rows={3}
                placeholder="React, TypeScript, Node.js"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="benefits">Beneficios (separados por virgula ou linha)</Label>
              <Textarea
                id="benefits"
                value={jobForm.benefitsText}
                onChange={(event) => setJobForm((prev) => ({ ...prev, benefitsText: event.target.value }))}
                rows={3}
                placeholder="Plano de saude, Vale refeicao, Home office"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsJobDialogOpen(false)}
                disabled={isSavingJob}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingJob}>
                {isSavingJob ? 'Salvando...' : editingJob ? 'Salvar alteracoes' : 'Criar vaga'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCandidatesDialogOpen} onOpenChange={setIsCandidatesDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Candidatos da vaga</DialogTitle>
            <DialogDescription>
              {selectedJob ? selectedJob.title : 'Carregando vaga...'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {isLoadingCandidates && (
              <p className="text-sm text-muted-foreground">Carregando candidatos...</p>
            )}

            {!isLoadingCandidates && candidatesError && (
              <p className="text-sm text-destructive">{candidatesError}</p>
            )}

            {!isLoadingCandidates && !candidatesError && selectedApplications.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum candidato associado a esta vaga.</p>
            )}

            {!isLoadingCandidates && !candidatesError && selectedApplications.map((application) => (
              <Card key={application.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{application.candidate.name}</p>
                      <p className="text-xs text-muted-foreground">{application.candidate.email}</p>
                      <p className="text-xs text-muted-foreground">{application.submittedAt}</p>
                    </div>
                    <Badge variant="outline" className={applicationStatusColors[application.status]}>
                      {applicationStatusLabels[application.status]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
