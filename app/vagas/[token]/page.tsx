'use client'

import { use, useEffect, useState } from 'react'
import {
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAppData } from '@/contexts/app-data-context'
import { getErrorMessage } from '@/lib/app-data'
import type { Job } from '@/lib/types'

interface PublicJobResponse {
  job: Job
  message?: string
  errors?: unknown
}

const discLabels = [
  { key: 'dominance', label: 'Dominancia', description: 'Tendencia a tomar a frente e decidir rapido.' },
  { key: 'influence', label: 'Influencia', description: 'Facilidade para engajar pessoas e comunicar ideias.' },
  { key: 'steadiness', label: 'Estabilidade', description: 'Constancia, colaboracao e ritmo sustentavel.' },
  { key: 'conscientiousness', label: 'Conformidade', description: 'Rigor, qualidade e atencao ao detalhe.' },
] as const

export default function PublicJobLeadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { createPublicLead } = useAppData()
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [resumeFileName, setResumeFileName] = useState('')
  const [discAnswers, setDiscAnswers] = useState({
    dominance: 50,
    influence: 50,
    steadiness: 50,
    conscientiousness: 50,
  })
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadJob() {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/public/jobs/${token}`, { cache: 'no-store' })
        const payload = (await response.json()) as PublicJobResponse

        if (!response.ok || !payload.job) {
          throw new Error(getErrorMessage(payload, 'Nao foi possivel carregar a vaga compartilhada.'))
        }

        setJob(payload.job)
        setCustomAnswers(
          Object.fromEntries((payload.job.customQuestions ?? []).map((question) => [question.id, '']))
        )
        setError('')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar a vaga.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadJob()
  }, [token])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!job) {
      return
    }

    const formData = new FormData(event.currentTarget)
    formData.set('discAnswers', JSON.stringify(discAnswers))
    formData.set('customAnswers', JSON.stringify((job.customQuestions ?? []).map((question) => ({
      questionId: question.id,
      question: question.label,
      answer: customAnswers[question.id] ?? '',
    }))))

    setIsSubmitting(true)
    setError('')

    try {
      await createPublicLead(token, formData)

      setIsSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel enviar sua candidatura.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eefbf7_100%)]">
        <div className="animate-pulse text-muted-foreground">Carregando vaga compartilhada...</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.12),transparent_35%),linear-gradient(180deg,#fff7f7_0%,#ffffff_100%)]">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Link de vaga indisponivel</h1>
          <p className="text-sm text-muted-foreground">{error || 'Esta vaga nao foi encontrada ou nao esta mais publica.'}</p>
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),transparent_35%),linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card className="border-emerald-200 shadow-xl shadow-emerald-100/60">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="size-8 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Recebemos seu interesse</h1>
                <p className="text-muted-foreground">
                  Seu perfil entrou como lead da vaga. A empresa agora pode revisar suas respostas e decidir se vai submeter voce para a analise completa.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),transparent_25%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)]">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:px-8 lg:py-12">
        <section className="lg:w-[38%]">
          <div className="sticky top-8 space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_24px_80px_-40px_rgba(16,185,129,0.45)]">
              <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,#0f172a_0%,#083344_40%,#065f46_100%)] p-6 text-white">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80">
                  <Sparkles className="size-3.5" />
                  Lead privado da vaga
                </div>
                <h1 className="text-3xl font-semibold leading-tight">{job.title}</h1>
                <p className="mt-3 text-sm text-white/75">
                  Preencha seu perfil para entrar no pipeline desta vaga. A empresa vai avaliar suas respostas antes de liberar a submissao para analise completa.
                </p>
              </div>

              <div className="space-y-4 p-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Building2 className="size-4 text-emerald-600" />
                  <span>{job.company}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <MapPin className="size-4 text-emerald-600" />
                  <span>{job.location}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Briefcase className="size-4 text-emerald-600" />
                  <span>{job.type} · {job.level}</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {job.requirements.slice(0, 6).map((requirement) => (
                    <Badge key={requirement} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                      {requirement}
                    </Badge>
                  ))}
                </div>

                <div className="rounded-2xl bg-emerald-50/70 p-4 text-sm text-emerald-900">
                  <p className="font-medium">O que voce encontra aqui</p>
                  <ul className="mt-3 space-y-2 text-emerald-800/80">
                    <li>Cadastro unico com dados de contato e qualificacao</li>
                    <li>Upload do curriculo e LinkedIn em um unico fluxo</li>
                    <li>Questionario DISC simplificado</li>
                    <li>Perguntas exclusivas configuradas pela empresa</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1">
          <Card className="overflow-hidden border-white/70 bg-white/95 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="text-2xl">Entrar no pipeline da vaga</CardTitle>
              <CardDescription>
                Seus dados serao usados pela empresa para qualificar o lead antes da submissao para analise.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 lg:p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="name" name="name" className="pl-9" placeholder="Seu nome completo" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" name="email" type="email" className="pl-9" placeholder="voce@email.com" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">WhatsApp / telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="phone" name="phone" className="pl-9" placeholder="(11) 99999-9999" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Localizacao</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="location" name="location" className="pl-9" placeholder="Cidade, estado" required />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="linkedinUrl">LinkedIn</Label>
                    <div className="relative">
                      <Linkedin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="linkedinUrl" name="linkedinUrl" className="pl-9" placeholder="https://linkedin.com/in/seu-perfil" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="education">Formacao</Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="education" name="education" className="pl-9" placeholder="Curso, instituicao e nivel" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experienceRange">Faixa de experiencia</Label>
                    <select
                      id="experienceRange"
                      name="experienceRange"
                      defaultValue="2-3"
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    >
                      <option value="0-1">0-1 anos</option>
                      <option value="2-3">2-3 anos</option>
                      <option value="4-5">4-5 anos</option>
                      <option value="6+">6+ anos</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="skills">Habilidades principais</Label>
                    <Textarea id="skills" name="skills" rows={3} placeholder="Liste suas skills separadas por virgula." required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="resume">Curriculo</Label>
                    <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                      <Input
                        id="resume"
                        name="resumeFile"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(event) => setResumeFileName(event.target.files?.[0]?.name ?? '')}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{resumeFileName || 'Nenhum arquivo selecionado'}</p>
                          <p className="text-xs text-muted-foreground">PDF, DOC ou DOCX com ate 5 MB. O arquivo fica anexado ao lead recebido pela empresa.</p>
                        </div>
                        <Button type="button" variant="outline" onClick={() => document.getElementById('resume')?.click()}>
                          <FileText className="mr-2 size-4" />
                          Escolher arquivo
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">DISC simplificado</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">Como voce se percebe no trabalho</h2>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {discLabels.map((item) => (
                      <div key={item.key} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                            {discAnswers[item.key]}
                          </span>
                        </div>
                        <Slider
                          value={[discAnswers[item.key]]}
                          onValueChange={([value]) => setDiscAnswers((current) => ({ ...current, [item.key]: value ?? 50 }))}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {(job.customQuestions ?? []).length > 0 && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Perguntas da empresa</p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-900">Contexto extra para qualificar seu lead</h2>
                    </div>

                    <div className="grid gap-4">
                      {(job.customQuestions ?? []).map((question) => {
                        const InputComponent = question.type === 'textarea' ? Textarea : Input

                        return (
                          <div key={question.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                            <Label htmlFor={question.id}>{question.label}</Label>
                            <InputComponent
                              id={question.id}
                              placeholder={question.placeholder}
                              required={question.required}
                              value={customAnswers[question.id] ?? ''}
                              onChange={(event) => setCustomAnswers((current) => ({
                                ...current,
                                [question.id]: event.target.value,
                              }))}
                              {...(question.type === 'textarea' ? { rows: 4 } : {})}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Ao enviar, voce entra como lead desta vaga. A empresa vai revisar suas respostas antes de te encaminhar para a analise completa.
                  </p>
                  <Button type="submit" size="lg" className="rounded-full px-8" disabled={isSubmitting}>
                    {isSubmitting ? 'Enviando...' : 'Enviar meu perfil'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
