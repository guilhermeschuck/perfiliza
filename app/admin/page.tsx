'use client'

import Link from 'next/link'
import { Users, Briefcase, FileSearch, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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

export default function AdminDashboard() {
  const { data } = useAppData()
  const recentApplications = data.applications.slice(0, 5)
  const recentCandidates = data.candidates.slice(0, 4)

  return (
    <>
      <DashboardHeader 
        title="Dashboard" 
        subtitle="Visão geral do sistema de análise de currículos"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              title="Total de Candidatos"
              value={data.dashboardStats.totalCandidates}
              icon={Users}
              variant="primary"
              trend={{ value: 12, isPositive: true }}
            />
            <StatCard
              title="Vagas Ativas"
              value={data.dashboardStats.totalJobs}
              icon={Briefcase}
              variant="success"
            />
            <StatCard
              title="Aplicações"
              value={data.dashboardStats.totalApplications}
              icon={FileSearch}
              variant="default"
            />
            <StatCard
              title="Análises Pendentes"
              value={data.dashboardStats.pendingAnalyses}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="Análises Completas"
              value={data.dashboardStats.completedAnalyses}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              title="Compatibilidade Média"
              value={`${data.dashboardStats.averageCompatibility.toFixed(0)}%`}
              icon={TrendingUp}
              variant="primary"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Applications */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Aplicações Recentes</CardTitle>
                  <CardDescription>Últimas submissões de candidatos</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/analises">Ver todas</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentApplications.map((application) => (
                    <div 
                      key={application.id} 
                      className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {application.candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{application.candidate.name}</p>
                          <p className="text-sm text-muted-foreground">{application.job.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {application.analysis?.compatibilityScore && (
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">{application.analysis.compatibilityScore}%</p>
                            <p className="text-xs text-muted-foreground">Compatibilidade</p>
                          </div>
                        )}
                        <Badge 
                          variant="outline" 
                          className={statusColors[application.status]}
                        >
                          {statusLabels[application.status]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Candidates */}
            <Card>
              <CardHeader>
                <CardTitle>Banco de Talentos</CardTitle>
                <CardDescription>Candidatos recentes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentCandidates.map((candidate) => (
                    <div 
                      key={candidate.id} 
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-chart-4/10 text-chart-4 text-xs">
                          {candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {candidate.currentPosition || candidate.skills[0]}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {candidate.experience} anos
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-4" asChild>
                  <Link href="/admin/talentos">Ver banco completo</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Visão Geral das Análises</CardTitle>
              <CardDescription>Distribuição dos tipos de análise realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="text-sm font-medium">Análise IA</span>
                  </div>
                  <p className="text-2xl font-bold">156</p>
                  <p className="text-xs text-muted-foreground">análises realizadas</p>
                </div>
                <div className="p-4 rounded-lg bg-chart-2/5 border border-chart-2/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-3 w-3 rounded-full bg-chart-2" />
                    <span className="text-sm font-medium">Perfil DISC</span>
                  </div>
                  <p className="text-2xl font-bold">142</p>
                  <p className="text-xs text-muted-foreground">perfis gerados</p>
                </div>
                <div className="p-4 rounded-lg bg-chart-4/5 border border-chart-4/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-3 w-3 rounded-full bg-chart-4" />
                    <span className="text-sm font-medium">Numerologia</span>
                  </div>
                  <p className="text-2xl font-bold">138</p>
                  <p className="text-xs text-muted-foreground">análises numéricas</p>
                </div>
                <div className="p-4 rounded-lg bg-chart-1/5 border border-chart-1/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-3 w-3 rounded-full bg-chart-1" />
                    <span className="text-sm font-medium">LinkedIn</span>
                  </div>
                  <p className="text-2xl font-bold">98</p>
                  <p className="text-xs text-muted-foreground">perfis analisados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
