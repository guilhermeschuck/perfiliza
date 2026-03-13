'use client'

import { useEffect, useState } from 'react'
import { Building2, Briefcase, Search, Users, FileSearch } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface AdminCompany {
  id: string
  name: string
  email: string
  company: string
  jobsCount: number
  activeJobsCount: number
  applicationsCount: number
  leadsCount: number
  latestJobCreatedAt: string | null
  tokenBalance: number
  tokensPurchased: number
  tokensSpent: number
}

interface AdminCompaniesResponse {
  companies: AdminCompany[]
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

function formatDate(date: string | null) {
  if (!date) {
    return 'Sem registro'
  }

  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadCompanies() {
      setIsLoading(true)

      try {
        const response = await fetch('/api/admin/companies', { cache: 'no-store' })
        const payload = (await response.json()) as unknown

        if (!response.ok) {
          throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar as empresas.')
        }

        if (
          !payload ||
          typeof payload !== 'object' ||
          !('companies' in payload) ||
          !Array.isArray(payload.companies)
        ) {
          throw new Error('Resposta invalida para listagem de empresas.')
        }

        if (!isActive) {
          return
        }

        setCompanies((payload as AdminCompaniesResponse).companies)
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar empresas.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadCompanies()

    return () => {
      isActive = false
    }
  }, [])

  const filteredCompanies = companies.filter((company) => {
    const query = searchQuery.toLowerCase()
    return (
      company.name.toLowerCase().includes(query) ||
      company.company.toLowerCase().includes(query) ||
      company.email.toLowerCase().includes(query)
    )
  })

  const activeJobsTotal = companies.reduce((total, company) => total + company.activeJobsCount, 0)
  const applicationsTotal = companies.reduce((total, company) => total + company.applicationsCount, 0)
  const leadsTotal = companies.reduce((total, company) => total + company.leadsCount, 0)
  const tokensTotal = companies.reduce((total, company) => total + company.tokenBalance, 0)

  return (
    <>
      <DashboardHeader
        title="Empresas"
        subtitle="Visao consolidada das empresas e performance de vagas"
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
                  placeholder="Buscar por nome, empresa ou email..."
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{companies.length}</p>
                <p className="text-sm text-muted-foreground">Empresas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{activeJobsTotal}</p>
                <p className="text-sm text-muted-foreground">Vagas ativas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{applicationsTotal}</p>
                <p className="text-sm text-muted-foreground">Candidaturas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-chart-2">{leadsTotal}</p>
                <p className="text-sm text-muted-foreground">Leads recebidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{tokensTotal}</p>
                <p className="text-sm text-muted-foreground">Tokens em saldo</p>
              </CardContent>
            </Card>
          </div>

          {isLoading && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Carregando empresas...
              </CardContent>
            </Card>
          )}

          {!isLoading && error && (
            <Card>
              <CardContent className="p-10 text-center text-destructive">{error}</CardContent>
            </Card>
          )}

          {!isLoading && !error && (
            <div className="space-y-4">
              {filteredCompanies.map((company) => (
                <Card key={company.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <h3 className="text-lg font-semibold">{company.company}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{company.name}</p>
                        <p className="text-sm text-muted-foreground">{company.email}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Ultima vaga criada em {formatDate(company.latestJobCreatedAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Briefcase className="h-3 w-3" />
                          {company.jobsCount} vagas
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {company.applicationsCount} candidaturas
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <FileSearch className="h-3 w-3" />
                          {company.leadsCount} leads
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          {company.tokenBalance} tokens em saldo
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && !error && filteredCompanies.length === 0 && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Nenhuma empresa encontrada para o filtro informado.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
