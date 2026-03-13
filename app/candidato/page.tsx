'use client'

import Link from 'next/link'
import { FileUp, User, Briefcase, Bell, Eye, CheckCircle, Clock, MapPin, Building2 } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/auth-context'
import { useAppData } from '@/contexts/app-data-context'
import { useCandidatePanel } from '@/contexts/candidate-panel-context'

const candidateStatusLabel: Record<string, string> = {
  available: 'Disponivel',
  open_to_offers: 'Aberto a propostas',
  employed: 'Empregado',
}

function formatRelativeDate(date?: string) {
  if (!date) {
    return 'Sem atualizacao recente'
  }

  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Sem atualizacao recente'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate)
}

export default function CandidatoDashboard() {
  const { user } = useAuth()
  const { data } = useAppData()
  const { candidate, profileCompletion, unreadNotifications } = useCandidatePanel()

  const candidateId = user?.id ?? '3'
  const candidateApplications = data.applications.filter((application) => application.candidateId === candidateId)
  const activeJobs = data.jobs.filter((job) => job.status === 'active')
  const candidateSkills = new Set((candidate?.skills ?? []).map((skill) => skill.toLowerCase()))

  const matchingJobs = activeJobs.filter((job) => (
    job.requirements.some((requirement) => candidateSkills.has(requirement.toLowerCase()))
  )).length

  const hasResume = !!candidate?.resumeUrl
  const candidateStatus = candidate?.status ? candidateStatusLabel[candidate.status] ?? 'Nao informado' : 'Nao informado'
  const lastUpdate = formatRelativeDate(candidate?.updatedAt ?? candidate?.createdAt)

  return (
    <>
      <DashboardHeader 
        title={`Olá, ${user?.name?.split(' ')[0] || 'Candidato'}!`}
        subtitle="Seu portal de oportunidades"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Profile Completion Alert */}
          {profileCompletion < 100 && (
            <Card className="border-chart-4/30 bg-chart-4/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-chart-4">Complete seu perfil</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Perfis completos têm 3x mais chances de serem encontrados por recrutadores
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <Progress value={profileCompletion} className="h-2 flex-1 max-w-xs" />
                      <span className="text-sm font-medium">{profileCompletion}%</span>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href="/candidato/perfil">Completar Perfil</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/candidato/curriculo">
                <FileUp className="mr-2 h-4 w-4" />
                Enviar Currículo
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/candidato/perfil">
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/candidato/vagas">
                <Briefcase className="mr-2 h-4 w-4" />
                Ver Vagas
              </Link>
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Perfil Completo"
              value={`${profileCompletion}%`}
              icon={User}
              variant="primary"
            />
            <StatCard
              title="Candidaturas"
              value={candidateApplications.length}
              icon={Eye}
              variant="success"
            />
            <StatCard
              title="Vagas Compatíveis"
              value={matchingJobs}
              icon={Briefcase}
              variant="warning"
            />
            <StatCard
              title="Notificações"
              value={unreadNotifications}
              description="nao lidas"
              icon={Bell}
              variant="default"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Seu Status no Banco de Talentos</CardTitle>
                <CardDescription>Visibilidade para recrutadores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-600">Currículo Ativo</p>
                      <p className="text-sm text-muted-foreground">Visível para empresas</p>
                    </div>
                  </div>
                  <Badge className={hasResume ? 'bg-emerald-500' : 'bg-slate-500'}>
                    {hasResume ? 'Ativo' : 'Pendente'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Última atualização</span>
                    <span className="font-medium">{lastUpdate}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Currículo enviado</span>
                    <span className="font-medium">{hasResume ? 'Sim' : 'Nao'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status de disponibilidade</span>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                      {candidateStatus}
                    </Badge>
                  </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <Link href="/candidato/perfil">
                    Atualizar Status
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Matching Jobs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Vagas Recomendadas</CardTitle>
                  <CardDescription>Baseado no seu perfil</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/candidato/vagas">Ver todas</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeJobs.slice(0, 3).map((job) => (
                    <div 
                      key={job.id} 
                      className="flex items-start gap-4 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-chart-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{job.title}</h4>
                        <p className="text-xs text-muted-foreground">{job.company}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{job.location}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{job.level}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Dicas para Melhorar seu Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <h4 className="font-medium">Complete seu LinkedIn</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Adicione seu perfil do LinkedIn para uma análise mais completa
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-chart-2/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-chart-2">2</span>
                    </div>
                    <h4 className="font-medium">Atualize suas Skills</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Liste todas as suas habilidades técnicas e soft skills
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-chart-4/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-chart-4">3</span>
                    </div>
                    <h4 className="font-medium">Mantenha Atualizado</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Atualize seu currículo regularmente com novas experiências
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
