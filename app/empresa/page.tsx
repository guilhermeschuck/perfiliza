'use client'

import { useEffect, useState } from 'react'
import { Users, Briefcase, FileSearch, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { useAppData } from '@/contexts/app-data-context'
import { getApplicationsByCompanyId, getCompanyTokenWallet, getErrorMessage, getJobsByCompanyId, getTokenCost } from '@/lib/app-data'
import type { CompanyTokenWallet, TokenTransaction } from '@/lib/types'

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

interface CompanyTokensSummaryResponse {
  wallet?: CompanyTokenWallet
  transactions?: TokenTransaction[]
  message?: string
}

interface CompanyTokenTransactionsResponse {
  transactions?: TokenTransaction[]
  message?: string
}

type TokenWindow = '7d' | '30d' | '90d' | 'all'
type TokenDirectionFilter = 'all' | 'credit' | 'debit'

export default function EmpresaDashboard() {
  const [isBuyingTokens, setIsBuyingTokens] = useState<number | null>(null)
  const [tokenFeedback, setTokenFeedback] = useState<string | null>(null)
  const [tokenStatementFeedback, setTokenStatementFeedback] = useState<string | null>(null)
  const [tokenWindow, setTokenWindow] = useState<TokenWindow>('30d')
  const [tokenDirectionFilter, setTokenDirectionFilter] = useState<TokenDirectionFilter>('all')
  const [tokenPage, setTokenPage] = useState(1)
  const [tokenDetailsWallet, setTokenDetailsWallet] = useState<CompanyTokenWallet | null>(null)
  const [tokenTransactions, setTokenTransactions] = useState<TokenTransaction[]>([])
  const [isLoadingTokenDetails, setIsLoadingTokenDetails] = useState(false)
  const [tokenDetailsError, setTokenDetailsError] = useState<string | null>(null)
  const { user } = useAuth()
  const { data, refresh } = useAppData()
  
  const companyId = user?.id ?? '2'
  const companyJobs = getJobsByCompanyId(data, companyId)
  const companyApplications = getApplicationsByCompanyId(data, companyId)
  const analyzedCount = companyApplications.filter(a => a.status === 'analyzed' || a.status === 'reviewed').length
  const pendingCount = companyApplications.filter(a => a.status === 'submitted' || a.status === 'analyzing').length
  const tokenWallet = getCompanyTokenWallet(data, companyId)
  const campaignCost = getTokenCost(data, 'campaign_create') ?? 0
  const analysisCost = getTokenCost(data, 'resume_analysis_start') ?? 0
  const reprocessCost = getTokenCost(data, 'resume_analysis_reprocess') ?? 0
  const tokenPageSize = 8
  const transactionLimit = tokenWindow === '7d'
    ? 25
    : tokenWindow === '30d'
      ? 80
      : tokenWindow === '90d'
        ? 160
        : 200

  const filteredTokenTransactions = tokenTransactions.filter((transaction) => {
    if (tokenDirectionFilter !== 'all' && transaction.direction !== tokenDirectionFilter) {
      return false
    }

    if (tokenWindow === 'all') {
      return true
    }

    const createdAt = new Date(transaction.createdAt).getTime()
    if (Number.isNaN(createdAt)) {
      return true
    }

    const days = tokenWindow === '7d' ? 7 : tokenWindow === '30d' ? 30 : 90
    return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000
  })
  const totalTokenPages = Math.max(1, Math.ceil(filteredTokenTransactions.length / tokenPageSize))
  const paginatedTokenTransactions = filteredTokenTransactions.slice(
    (tokenPage - 1) * tokenPageSize,
    tokenPage * tokenPageSize,
  )

  async function loadTokenDetails(limit = transactionLimit) {
    setIsLoadingTokenDetails(true)
    setTokenDetailsError(null)

    try {
      const [summaryResponse, transactionsResponse] = await Promise.all([
        fetch(`/api/company/tokens?companyId=${encodeURIComponent(companyId)}&limit=6`, { cache: 'no-store' }),
        fetch(`/api/company/tokens/transactions?companyId=${encodeURIComponent(companyId)}&limit=${limit}`, { cache: 'no-store' }),
      ])

      const summaryPayload = (await summaryResponse.json()) as CompanyTokensSummaryResponse
      const transactionsPayload = (await transactionsResponse.json()) as CompanyTokenTransactionsResponse

      if (!summaryResponse.ok || !summaryPayload.wallet) {
        throw new Error(getErrorMessage(summaryPayload, 'Nao foi possivel carregar o saldo de tokens.'))
      }

      if (!transactionsResponse.ok || !Array.isArray(transactionsPayload.transactions)) {
        throw new Error(getErrorMessage(transactionsPayload, 'Nao foi possivel carregar o extrato de tokens.'))
      }

      setTokenDetailsWallet(summaryPayload.wallet)
      setTokenTransactions(transactionsPayload.transactions)
    } catch (tokenError) {
      setTokenDetailsError(
        tokenError instanceof Error
          ? tokenError.message
          : 'Nao foi possivel carregar os detalhes de tokens.',
      )
    } finally {
      setIsLoadingTokenDetails(false)
    }
  }

  useEffect(() => {
    void loadTokenDetails(transactionLimit)
  }, [companyId, transactionLimit])

  useEffect(() => {
    setTokenPage(1)
  }, [tokenWindow, tokenDirectionFilter, tokenTransactions.length])

  useEffect(() => {
    setTokenPage((currentPage) => (currentPage > totalTokenPages ? totalTokenPages : currentPage))
  }, [totalTokenPages])

  async function purchaseTokens(tokens: number) {
    setIsBuyingTokens(tokens)
    setTokenFeedback(null)

    try {
      const response = await fetch('/api/company/tokens/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          tokens,
          note: `Pacote de ${tokens} tokens`,
        }),
      })

      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Nao foi possivel comprar tokens.'))
      }

      await Promise.all([refresh(), loadTokenDetails(transactionLimit)])
      setTokenFeedback(`Compra concluida: +${tokens} tokens adicionados.`)
    } catch (purchaseError) {
      setTokenFeedback(
        purchaseError instanceof Error
          ? purchaseError.message
          : 'Nao foi possivel concluir a compra de tokens.',
      )
    } finally {
      setIsBuyingTokens(null)
    }
  }

  function handleExportTokenCsv() {
    if (filteredTokenTransactions.length === 0) {
      setTokenStatementFeedback('Nao ha transacoes para exportar com os filtros atuais.')
      return
    }

    const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`
    const headers = ['data_hora', 'direcao', 'acao', 'descricao', 'tokens', 'saldo_apos']
    const rows = filteredTokenTransactions.map((transaction) => [
      new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(transaction.createdAt)),
      transaction.direction === 'credit' ? 'credito' : 'debito',
      transaction.action,
      transaction.description,
      String(transaction.tokens),
      String(transaction.balanceAfter),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateLabel = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `extrato-tokens-${companyId}-${dateLabel}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    setTokenStatementFeedback('Extrato CSV exportado com sucesso.')
  }

  return (
    <>
      <DashboardHeader 
        title={`Bem-vinda, ${user?.name?.split(' ')[0] || 'Empresa'}!`}
        subtitle={user?.company || 'Portal da Empresa'}
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/empresa/submeter">
                <Users className="mr-2 h-4 w-4" />
                Submeter Candidato
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/empresa/vagas">
                <Briefcase className="mr-2 h-4 w-4" />
                Minhas Vagas
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/empresa/resultados">
                <FileSearch className="mr-2 h-4 w-4" />
                Ver Resultados
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tokens da Conta</CardTitle>
              <CardDescription>
                Criar campanha/vaga custa {campaignCost} token(s), iniciar analise custa {analysisCost}
                {' '}e reprocessar analise custa {reprocessCost} token(s).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo disponivel</p>
                  <p className="text-2xl font-bold">{tokenDetailsWallet?.balance ?? tokenWallet?.balance ?? 0} tokens</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Comprados: {tokenDetailsWallet?.purchased ?? tokenWallet?.purchased ?? 0}</p>
                  <p>Consumidos: {tokenDetailsWallet?.spent ?? tokenWallet?.spent ?? 0}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[50, 120, 300].map((pack) => (
                  <Button
                    key={pack}
                    variant="outline"
                    disabled={isBuyingTokens !== null}
                    onClick={() => void purchaseTokens(pack)}
                  >
                    {isBuyingTokens === pack ? 'Processando...' : `Comprar ${pack} tokens`}
                  </Button>
                ))}
              </div>
              {tokenFeedback && (
                <p className="text-sm text-muted-foreground">{tokenFeedback}</p>
              )}

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Extrato recente</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={filteredTokenTransactions.length === 0}
                      onClick={handleExportTokenCsv}
                    >
                      Exportar CSV
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isLoadingTokenDetails}
                      onClick={() => void loadTokenDetails(transactionLimit)}
                    >
                      {isLoadingTokenDetails ? 'Atualizando...' : 'Atualizar'}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={tokenWindow} onValueChange={(value: TokenWindow) => setTokenWindow(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Ultimos 7 dias</SelectItem>
                      <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                      <SelectItem value="90d">Ultimos 90 dias</SelectItem>
                      <SelectItem value="all">Todo periodo</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={tokenDirectionFilter} onValueChange={(value: TokenDirectionFilter) => setTokenDirectionFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Credito e debito</SelectItem>
                      <SelectItem value="credit">Apenas creditos</SelectItem>
                      <SelectItem value="debit">Apenas debitos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tokenDetailsError && (
                  <p className="text-sm text-red-700">{tokenDetailsError}</p>
                )}

                {tokenStatementFeedback && !tokenDetailsError && (
                  <p className="text-sm text-muted-foreground">{tokenStatementFeedback}</p>
                )}

                {!tokenDetailsError && filteredTokenTransactions.length === 0 && !isLoadingTokenDetails && (
                  <p className="text-sm text-muted-foreground">Nenhuma transacao encontrada para esta conta.</p>
                )}

                {!tokenDetailsError && filteredTokenTransactions.length > 0 && (
                  <div className="space-y-2">
                    {paginatedTokenTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{transaction.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(new Date(transaction.createdAt))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${transaction.direction === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {transaction.direction === 'credit' ? '+' : '-'}
                            {transaction.tokens}
                          </p>
                          <p className="text-xs text-muted-foreground">Saldo: {transaction.balanceAfter}</p>
                        </div>
                      </div>
                    ))}

                    {totalTokenPages > 1 && (
                      <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Pagina {tokenPage} de {totalTokenPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={tokenPage <= 1}
                            onClick={() => setTokenPage((currentPage) => Math.max(1, currentPage - 1))}
                          >
                            Anterior
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={tokenPage >= totalTokenPages}
                            onClick={() => setTokenPage((currentPage) => Math.min(totalTokenPages, currentPage + 1))}
                          >
                            Proxima
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Vagas Ativas"
              value={companyJobs.filter(j => j.status === 'active').length}
              icon={Briefcase}
              variant="primary"
            />
            <StatCard
              title="Candidatos Submetidos"
              value={companyApplications.length}
              icon={Users}
              variant="success"
            />
            <StatCard
              title="Análises Concluídas"
              value={analyzedCount}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              title="Análises Pendentes"
              value={pendingCount}
              icon={Clock}
              variant="warning"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Applications */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Últimos Candidatos</CardTitle>
                  <CardDescription>Status das análises recentes</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/empresa/resultados">Ver todos</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {companyApplications.slice(0, 4).map((application) => (
                    <div 
                      key={application.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-chart-2/10 text-chart-2 text-xs">
                            {application.candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{application.candidate.name}</p>
                          <p className="text-xs text-muted-foreground">{application.job.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {application.analysis?.compatibilityScore && (
                          <span className="text-sm font-medium hidden sm:block">
                            {application.analysis.compatibilityScore}%
                          </span>
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

            {/* Company Jobs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Suas Vagas</CardTitle>
                  <CardDescription>Vagas publicadas pela empresa</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/empresa/vagas">Gerenciar</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {companyJobs.slice(0, 4).map((job) => (
                    <div 
                      key={job.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.location}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium">{job.applicationsCount}</p>
                          <p className="text-xs text-muted-foreground">candidatos</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            job.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-600' 
                              : 'bg-amber-500/10 text-amber-600'
                          }
                        >
                          {job.status === 'active' ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo das Análises</CardTitle>
              <CardDescription>Visão geral dos resultados de compatibilidade</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Alta Compatibilidade</span>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {companyApplications.filter(a => (a.analysis?.compatibilityScore || 0) >= 80).length}
                  </p>
                  <p className="text-xs text-muted-foreground">candidatos com 80%+ de match</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Média Compatibilidade</span>
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-amber-600">
                    {companyApplications.filter(a => {
                      const score = a.analysis?.compatibilityScore || 0
                      return score >= 60 && score < 80
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">candidatos com 60-79% de match</p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Baixa Compatibilidade</span>
                    <TrendingUp className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {companyApplications.filter(a => (a.analysis?.compatibilityScore || 0) < 60).length}
                  </p>
                  <p className="text-xs text-muted-foreground">candidatos com menos de 60%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
