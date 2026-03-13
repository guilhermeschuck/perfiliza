'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import {
  Copy,
  DollarSign,
  ExternalLink,
  FileQuestion,
  Link2,
  MapPin,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAppData } from '@/contexts/app-data-context'
import { useAuth } from '@/contexts/auth-context'
import { buildPublicJobUrl, buildQuestionDrafts, getErrorMessage, getJobsByCompanyId } from '@/lib/app-data'
import type { CustomQuestion, Job } from '@/lib/types'

const statusColors = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  closed: 'bg-red-500/10 text-red-600 border-red-200',
}

const statusLabels = {
  active: 'Ativa',
  paused: 'Pausada',
  closed: 'Encerrada',
}

type FeedbackState = {
  kind: 'success' | 'error'
  message: string
} | null

type CreateJobFormState = {
  title: string
  department: string
  level: 'Júnior' | 'Pleno' | 'Sênior'
  type: 'CLT' | 'PJ' | 'Freelancer'
  location: string
  description: string
  requirementsText: string
}

function buildCreateJobForm(): CreateJobFormState {
  return {
    title: '',
    department: '',
    level: 'Pleno',
    type: 'CLT',
    location: '',
    description: '',
    requirementsText: '',
  }
}

function buildCreateJobFormFromJob(job: Job): CreateJobFormState {
  return {
    title: job.title,
    department: job.department,
    level: job.level === 'Especialista' ? 'Sênior' : job.level,
    type: job.type === 'Estágio' ? 'CLT' : job.type,
    location: job.location,
    description: job.description,
    requirementsText: job.requirements.join('\n'),
  }
}

function parseList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function createQuestionDraft(index: number): CustomQuestion {
  return {
    id: `custom-${Date.now()}-${index}`,
    label: '',
    type: 'textarea',
    required: true,
    placeholder: '',
  }
}

export default function EmpresaVagasPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isUpdatingJobStatus, setIsUpdatingJobStatus] = useState<string | null>(null)
  const [pendingStatusJob, setPendingStatusJob] = useState<Job | null>(null)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [createJobForm, setCreateJobForm] = useState<CreateJobFormState>(buildCreateJobForm())
  const [configureJobId, setConfigureJobId] = useState<string | null>(null)
  const [questionDrafts, setQuestionDrafts] = useState<CustomQuestion[]>([])
  const [isSavingQuestions, setIsSavingQuestions] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const { user } = useAuth()
  const { data, refresh, updateJobQuestions } = useAppData()

  const companyId = user?.id ?? '2'
  const companyJobs = getJobsByCompanyId(data, companyId)
  const companyLeads = data.leads.filter((lead) => lead.companyId === companyId)

  const filteredJobs = companyJobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const configuredJob = configureJobId
    ? companyJobs.find((job) => job.id === configureJobId) ?? null
    : null
  const editingJob = editingJobId
    ? companyJobs.find((job) => job.id === editingJobId) ?? null
    : null

  const formatSalary = (salary?: { min: number; max: number }) => {
    if (!salary) return 'A combinar'
    return `R$ ${salary.min.toLocaleString()} - R$ ${salary.max.toLocaleString()}`
  }

  function openCreateJobDialog() {
    setEditingJobId(null)
    setCreateJobForm(buildCreateJobForm())
    setFeedback(null)
    setIsCreateDialogOpen(true)
  }

  function openEditJobDialog(job: Job) {
    setEditingJobId(job.id)
    setCreateJobForm(buildCreateJobFormFromJob(job))
    setFeedback(null)
    setIsCreateDialogOpen(true)
  }

  async function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreatingJob(true)
    setFeedback(null)

    try {
      const endpoint = editingJobId ? `/api/admin/jobs/${editingJobId}` : '/api/admin/jobs'
      const method = editingJobId ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          title: createJobForm.title.trim(),
          department: createJobForm.department.trim(),
          level: createJobForm.level,
          type: createJobForm.type,
          location: createJobForm.location.trim(),
          status: editingJob?.status ?? 'active',
          description: createJobForm.description.trim(),
          requirements: parseList(createJobForm.requirementsText),
          benefits: [],
        }),
      })

      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Nao foi possivel salvar a vaga.'))
      }

      await refresh()
      setIsCreateDialogOpen(false)
      setEditingJobId(null)
      setCreateJobForm(buildCreateJobForm())
      setFeedback({
        kind: 'success',
        message: editingJobId
          ? 'Vaga atualizada com sucesso.'
          : 'Vaga criada com sucesso e tokens debitados.',
      })
    } catch (createError) {
      setFeedback({
        kind: 'error',
        message: createError instanceof Error
          ? createError.message
          : 'Nao foi possivel salvar a vaga.',
      })
    } finally {
      setIsCreatingJob(false)
    }
  }

  async function handleToggleJobStatus(job: Job) {
    const nextStatus = job.status === 'active' ? 'paused' : 'active'
    setIsUpdatingJobStatus(job.id)
    setFeedback(null)

    try {
      const response = await fetch(`/api/admin/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Nao foi possivel atualizar o status da vaga.'))
      }

      await refresh()
      setFeedback({
        kind: 'success',
        message: nextStatus === 'active'
          ? 'Vaga ativada com sucesso.'
          : 'Vaga pausada com sucesso.',
      })
    } catch (statusError) {
      setFeedback({
        kind: 'error',
        message: statusError instanceof Error
          ? statusError.message
          : 'Nao foi possivel atualizar o status da vaga.',
      })
    } finally {
      setIsUpdatingJobStatus(null)
    }
  }

  async function handleConfirmToggleJobStatus() {
    if (!pendingStatusJob) {
      return
    }

    const job = pendingStatusJob
    setPendingStatusJob(null)
    await handleToggleJobStatus(job)
  }

  function openQuestionEditor(jobId: string) {
    const job = companyJobs.find((item) => item.id === jobId)

    if (!job) {
      return
    }

    setConfigureJobId(jobId)
    setQuestionDrafts(buildQuestionDrafts(job.customQuestions))
  }

  function handleQuestionChange(index: number, patch: Partial<CustomQuestion>) {
    setQuestionDrafts((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...patch } : question
    )))
  }

  function handleAddQuestion() {
    setQuestionDrafts((current) => [...current, createQuestionDraft(current.length + 1)])
  }

  function handleRemoveQuestion(index: number) {
    setQuestionDrafts((current) => (
      current.length === 1 ? current : current.filter((_, questionIndex) => questionIndex !== index)
    ))
  }

  async function handleCopyLink(shareToken?: string) {
    if (!shareToken) {
      setFeedback({ kind: 'error', message: 'Esta vaga ainda nao possui um link publico disponivel.' })
      return
    }

    await navigator.clipboard.writeText(`${window.location.origin}${buildPublicJobUrl(shareToken)}`)
    setFeedback({ kind: 'success', message: 'Link publico copiado para a area de transferencia.' })
  }

  async function handleSaveQuestions() {
    if (!configureJobId) {
      return
    }

    const questions = questionDrafts
      .map((question, index) => ({
        ...question,
        id: question.id || `q${index + 1}`,
        label: question.label.trim(),
        placeholder: question.placeholder?.trim() ?? '',
      }))
      .filter((question) => question.label !== '')

    if (questions.length === 0) {
      setFeedback({ kind: 'error', message: 'Adicione pelo menos uma pergunta personalizada para salvar o formulario publico.' })
      return
    }

    setIsSavingQuestions(true)

    try {
      await updateJobQuestions(configureJobId, questions)
      setConfigureJobId(null)
      setFeedback({ kind: 'success', message: 'Formulario publico atualizado com sucesso.' })
    } catch (saveError) {
      setFeedback({
        kind: 'error',
        message: saveError instanceof Error
          ? saveError.message
          : 'Nao foi possivel atualizar o formulario publico desta vaga.',
      })
    } finally {
      setIsSavingQuestions(false)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Minhas Vagas"
        subtitle="Compartilhe a vaga, receba leads qualificados e escolha quem vai para analise."
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 justify-between sm:flex-row">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
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
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="paused">Pausadas</SelectItem>
                  <SelectItem value="closed">Encerradas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={(open) => {
                setIsCreateDialogOpen(open)
                if (!open) {
                  setEditingJobId(null)
                  setCreateJobForm(buildCreateJobForm())
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openCreateJobDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Vaga
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingJobId ? 'Editar Vaga' : 'Criar Nova Vaga'}</DialogTitle>
                  <DialogDescription>
                    {editingJobId
                      ? 'Atualize as informacoes da vaga e salve as alteracoes.'
                      : 'Preencha as informacoes da vaga para solicitar publicacao'}
                  </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4 py-4" onSubmit={(event) => void handleCreateJob(event)}>
                  <div className="grid gap-2">
                    <Label htmlFor="title">Titulo da Vaga</Label>
                    <Input
                      id="title"
                      value={createJobForm.title}
                      onChange={(event) => setCreateJobForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Ex: Desenvolvedor Full Stack"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="department">Departamento</Label>
                      <Input
                        id="department"
                        value={createJobForm.department}
                        onChange={(event) => setCreateJobForm((current) => ({ ...current, department: event.target.value }))}
                        placeholder="Ex: Engenharia"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Nivel</Label>
                      <Select
                        value={createJobForm.level}
                        onValueChange={(value: 'Júnior' | 'Pleno' | 'Sênior') => {
                          setCreateJobForm((current) => ({ ...current, level: value }))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Júnior">Junior</SelectItem>
                          <SelectItem value="Pleno">Pleno</SelectItem>
                          <SelectItem value="Sênior">Senior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Tipo de contrato</Label>
                      <Select
                        value={createJobForm.type}
                        onValueChange={(value: 'CLT' | 'PJ' | 'Freelancer') => {
                          setCreateJobForm((current) => ({ ...current, type: value }))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLT">CLT</SelectItem>
                          <SelectItem value="PJ">PJ</SelectItem>
                          <SelectItem value="Freelancer">Freelancer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="location">Localizacao</Label>
                      <Input
                        id="location"
                        value={createJobForm.location}
                        onChange={(event) => setCreateJobForm((current) => ({ ...current, location: event.target.value }))}
                        placeholder="Ex: Sao Paulo, SP ou Remoto"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descricao</Label>
                    <Textarea
                      id="description"
                      value={createJobForm.description}
                      onChange={(event) => setCreateJobForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Descreva a vaga..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="requirements">Requisitos (um por linha)</Label>
                    <Textarea
                      id="requirements"
                      value={createJobForm.requirementsText}
                      onChange={(event) => setCreateJobForm((current) => ({ ...current, requirementsText: event.target.value }))}
                      placeholder={'React\nNode.js\n3+ anos de experiencia'}
                      rows={3}
                    />
                  </div>

                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isCreatingJob}>
                      {isCreatingJob
                        ? (editingJobId ? 'Salvando...' : 'Criando...')
                        : (editingJobId ? 'Salvar alteracoes' : 'Criar vaga')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

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

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {companyJobs.filter((job) => job.status === 'active').length}
                </p>
                <p className="text-sm text-muted-foreground">Vagas Ativas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{companyLeads.length}</p>
                <p className="text-sm text-muted-foreground">Leads Recebidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-chart-2">
                  {companyLeads.filter((lead) => lead.status === 'new').length}
                </p>
                <p className="text-sm text-muted-foreground">Aguardando Triagem</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const submittedLeads = companyLeads.filter((lead) => lead.jobId === job.id && lead.status === 'submitted').length
              const publicJobUrl = job.shareToken ? buildPublicJobUrl(job.shareToken) : ''

              return (
                <Card key={job.id} className="overflow-hidden border-slate-200">
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
                                <MapPin className="h-4 w-4" />
                                {job.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                {formatSalary(job.salary)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Link2 className="h-4 w-4" />
                                {job.shareToken}
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
                              <DropdownMenuItem asChild>
                                <Link href={`/empresa/vagas/${job.id}/leads`}>
                                  Ver leads
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleCopyLink(job.shareToken)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar link publico
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openQuestionEditor(job.id)}>
                                <FileQuestion className="mr-2 h-4 w-4" />
                                Editar formulario
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditJobDialog(job)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar vaga
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPendingStatusJob(job)}
                                disabled={isUpdatingJobStatus === job.id}
                              >
                                {job.status === 'active'
                                  ? (
                                    <>
                                      <Pause className="mr-2 h-4 w-4" />
                                      {isUpdatingJobStatus === job.id ? 'Pausando...' : 'Pausar'}
                                    </>
                                  )
                                  : (
                                    <>
                                      <Play className="mr-2 h-4 w-4" />
                                      {isUpdatingJobStatus === job.id ? 'Ativando...' : 'Ativar'}
                                    </>
                                  )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Link publico</p>
                            <p className="mt-2 text-sm text-emerald-950">
                              Compartilhe esta pagina para receber leads estruturados antes da submissao.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Perguntas personalizadas</p>
                            <p className="mt-2 text-sm text-slate-900">
                              {(job.customQuestions ?? []).length} pergunta{(job.customQuestions ?? []).length === 1 ? '' : 's'} ativas no formulario.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Pipeline</p>
                            <p className="mt-2 text-sm text-sky-950">
                              {job.leadCount ?? 0} leads captados, {submittedLeads} ja enviados para analise.
                            </p>
                          </div>
                        </div>

                        <p className="mt-5 text-sm text-muted-foreground line-clamp-2">
                          {job.description}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-1">
                          {job.requirements.slice(0, 5).map((requirement) => (
                            <Badge key={requirement} variant="secondary" className="text-xs">
                              {requirement}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button variant="outline" size="sm" onClick={() => void handleCopyLink(job.shareToken)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar link
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openQuestionEditor(job.id)}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Configurar perguntas
                          </Button>
                          <Button size="sm" asChild>
                            <Link href={`/empresa/vagas/${job.id}/leads`}>
                              <Users className="mr-2 h-4 w-4" />
                              Ver leads
                            </Link>
                          </Button>
                          {publicJobUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={publicJobUrl} target="_blank">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Abrir pagina publica
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="w-full border-t border-border bg-muted/30 p-6 lg:w-56 lg:border-l lg:border-t-0">
                        <div className="flex h-full flex-col items-center justify-center text-center">
                          <div className="flex items-center gap-2 text-3xl font-bold">
                            <Users className="h-7 w-7 text-muted-foreground" />
                            {job.leadCount ?? 0}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">Leads captados</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {job.applicationsCount} candidatos submetidos para analise
                          </p>
                          <Button className="mt-5 w-full" asChild>
                            <Link href={`/empresa/vagas/${job.id}/leads`}>Gerenciar leads</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredJobs.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="font-semibold text-lg">Nenhuma vaga encontrada</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Crie uma nova vaga ou ajuste seus filtros.
                </p>
                <Button onClick={openCreateJobDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Vaga
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog
        open={configureJobId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfigureJobId(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Formulario publico da vaga</DialogTitle>
            <DialogDescription>
              {configuredJob
                ? `Defina as perguntas que o candidato responde antes de entrar como lead em ${configuredJob.title}.`
                : 'Defina as perguntas personalizadas da vaga.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <Card className="border-dashed border-emerald-200 bg-emerald-50/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">O que o link compartilhado coleta</CardTitle>
                <CardDescription>
                  Dados pessoais, contato, qualificacao, LinkedIn, upload do curriculo, DISC e as perguntas abaixo.
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-4">
              {questionDrafts.map((question, index) => (
                <div key={question.id || `question-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Pergunta {index + 1}</p>
                      <p className="text-xs text-muted-foreground">Use perguntas objetivas para melhorar a triagem.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={questionDrafts.length === 1}
                      onClick={() => handleRemoveQuestion(index)}
                    >
                      Remover
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`question-label-${index}`}>Pergunta</Label>
                      <Input
                        id={`question-label-${index}`}
                        value={question.label}
                        onChange={(event) => handleQuestionChange(index, { label: event.target.value })}
                        placeholder="Ex: Qual resultado recente melhor demonstra seu impacto?"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                      <div className="grid gap-2">
                        <Label>Tipo de resposta</Label>
                        <Select
                          value={question.type}
                          onValueChange={(value: 'text' | 'textarea') => handleQuestionChange(index, { type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Resposta curta</SelectItem>
                            <SelectItem value="textarea">Resposta longa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`question-placeholder-${index}`}>Placeholder</Label>
                        <Input
                          id={`question-placeholder-${index}`}
                          value={question.placeholder ?? ''}
                          onChange={(event) => handleQuestionChange(index, { placeholder: event.target.value })}
                          placeholder="Ex: Resuma em 3 a 5 linhas."
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Resposta obrigatoria</p>
                        <p className="text-xs text-muted-foreground">Desative apenas se a pergunta for opcional.</p>
                      </div>
                      <Switch
                        checked={question.required}
                        onCheckedChange={(checked) => handleQuestionChange(index, { required: checked })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={handleAddQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar pergunta
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigureJobId(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveQuestions()} disabled={isSavingQuestions}>
              {isSavingQuestions ? 'Salvando...' : 'Salvar formulario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingStatusJob !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatusJob(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatusJob?.status === 'active' ? 'Pausar vaga' : 'Ativar vaga'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusJob?.status === 'active'
                ? 'A vaga deixara de receber novos leads ate ser reativada.'
                : 'A vaga voltara a receber novos leads e submissões.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleConfirmToggleJobStatus()
              }}
            >
              {pendingStatusJob?.status === 'active' ? 'Confirmar pausa' : 'Confirmar ativacao'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
