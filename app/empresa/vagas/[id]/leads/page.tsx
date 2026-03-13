'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Filter, Linkedin, Mail, MapPin, Phone, Search, Sparkles } from 'lucide-react'
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
import { useAppData } from '@/contexts/app-data-context'
import { buildPublicJobUrl, getJobById, getLeadsByJobId } from '@/lib/app-data'

export default function LeadsByJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, submitLead } = useAppData()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [submittingLeadId, setSubmittingLeadId] = useState('')
  const [feedback, setFeedback] = useState('')

  const job = getJobById(data, id)
  const leads = getLeadsByJobId(data, id)
  const publicUrl = job?.shareToken ? buildPublicJobUrl(job.shareToken) : ''

  const filteredLeads = leads.filter((lead) => {
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
    const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.skills.some((skill) => skill.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesStatus && matchesSearch
  })

  async function handleCopyLink() {
    if (!publicUrl) {
      return
    }

    await navigator.clipboard.writeText(`${window.location.origin}${publicUrl}`)
    setFeedback('Link copiado para a area de transferencia.')
  }

  async function handleSubmitLead(leadId: string) {
    setSubmittingLeadId(leadId)
    setFeedback('')

    try {
      await submitLead(id, leadId)
      setFeedback('Lead enviado para a fila de analise com sucesso.')
    } catch (submitError) {
      setFeedback(submitError instanceof Error ? submitError.message : 'Nao foi possivel enviar o lead para analise.')
    } finally {
      setSubmittingLeadId('')
    }
  }

  if (!job) {
    return (
      <>
        <DashboardHeader title="Vaga nao encontrada" subtitle="Esta vaga nao existe mais na sua conta." />
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-muted-foreground">Nao foi possivel localizar a vaga solicitada.</p>
              <Button asChild>
                <Link href="/empresa/vagas">Voltar para vagas</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  return (
    <>
      <DashboardHeader
        title={`Leads da vaga: ${job.title}`}
        subtitle="Revise o pipeline recebido pelo link publico antes de submeter para analise."
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" asChild>
              <Link href="/empresa/vagas">
                <ArrowLeft className="mr-2 size-4" />
                Voltar para vagas
              </Link>
            </Button>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void handleCopyLink()}>
                <Copy className="mr-2 size-4" />
                Copiar link publico
              </Button>
              <Button asChild>
                <Link href={publicUrl} target="_blank">
                  <ExternalLink className="mr-2 size-4" />
                  Abrir pagina da vaga
                </Link>
              </Button>
            </div>
          </div>

          {feedback && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {feedback}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-semibold">{leads.length}</p>
                <p className="text-sm text-muted-foreground">Leads recebidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-semibold text-emerald-600">{leads.filter((lead) => lead.status === 'new').length}</p>
                <p className="text-sm text-muted-foreground">Aguardando triagem</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-semibold text-sky-600">{leads.filter((lead) => lead.status === 'submitted').length}</p>
                <p className="text-sm text-muted-foreground">Ja submetidos</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9"
                    placeholder="Buscar por nome, email ou skill..."
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="mr-2 size-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="new">Novos</SelectItem>
                    <SelectItem value="submitted">Submetidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="overflow-hidden border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/70">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>{lead.name}</CardTitle>
                      <CardDescription>{lead.email}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={lead.status === 'submitted' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}>
                        {lead.status === 'submitted' ? 'Submetido' : 'Novo lead'}
                      </Badge>
                      <Badge variant="secondary">{lead.experience} anos</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="size-4" />
                      <span>{lead.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="size-4" />
                      <span>{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4" />
                      <span>{lead.location}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm">
                    {lead.linkedinUrl && (
                      <Link
                        href={lead.linkedinUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 text-sky-700 transition-colors hover:text-sky-800"
                      >
                        <Linkedin className="size-4" />
                        LinkedIn
                      </Link>
                    )}
                    {lead.resumeUrl && (
                      <Link
                        href={lead.resumeUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 text-emerald-700 transition-colors hover:text-emerald-800"
                      >
                        <ExternalLink className="size-4" />
                        Abrir curriculo
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {lead.skills.map((skill) => (
                      <Badge key={`${lead.id}-${skill}`} variant="secondary">{skill}</Badge>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Formacao</p>
                        <p className="mt-2 text-sm text-slate-800">{lead.education}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Respostas da vaga</p>
                        <div className="mt-3 space-y-3">
                          {lead.customAnswers.length > 0 ? lead.customAnswers.map((answer) => (
                            <div key={answer.questionId} className="rounded-xl bg-white p-3 shadow-sm">
                              <p className="text-sm font-medium">{answer.question}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{answer.answer}</p>
                            </div>
                          )) : (
                            <p className="text-sm text-muted-foreground">Este lead nao respondeu perguntas adicionais.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-emerald-700" />
                        <p className="text-sm font-semibold text-emerald-900">DISC simplificado</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">D</p>
                          <p className="mt-2 text-2xl font-semibold">{lead.discAnswers.dominance}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">I</p>
                          <p className="mt-2 text-2xl font-semibold">{lead.discAnswers.influence}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">S</p>
                          <p className="mt-2 text-2xl font-semibold">{lead.discAnswers.steadiness}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">C</p>
                          <p className="mt-2 text-2xl font-semibold">{lead.discAnswers.conscientiousness}</p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-3 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Curriculo</p>
                        <p className="mt-2 text-sm text-slate-800">{lead.resumeFileName || 'Nao informado'}</p>
                      </div>

                      <Button
                        className="w-full"
                        disabled={lead.status === 'submitted' || submittingLeadId === lead.id}
                        onClick={() => void handleSubmitLead(lead.id)}
                      >
                        {lead.status === 'submitted'
                          ? (
                            <>
                              <CheckCircle2 className="mr-2 size-4" />
                              Ja submetido
                            </>
                          )
                          : submittingLeadId === lead.id
                            ? 'Submetendo...'
                            : 'Submeter para analise'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredLeads.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-lg font-medium">Nenhum lead encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Compartilhe o link publico da vaga para comecar a receber leads.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
