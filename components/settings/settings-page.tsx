'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Coins,
  Clock3,
  Globe,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import type { TokenAction, TokenActionCost, TokenPricing, UserRole } from '@/lib/types'

type RoleConfig = {
  badge: string
  headline: string
  subtitle: string
  accent: string
  accentSoft: string
  icon: LucideIcon
  highlights: string[]
  visibilityLabel: string
  visibilityHint: string
  identityLabel: string
  workspaceLabel: string
  notesLabel: string
  statusCopy: string
}

type StoredSettings = {
  displayName?: string
  email?: string
  workspace?: string
  notes?: string
  browserAlerts?: boolean
  emailDigest?: boolean
  smartRecommendations?: boolean
  profileVisibility?: boolean
  timezone?: string
}

type CandidateStatus = 'available' | 'employed' | 'open_to_offers'
type SettingsTab = 'perfil' | 'alertas' | 'seguranca'

type TokenPricingResponse = {
  pricing?: TokenPricing
  actions?: TokenActionCost[]
  updatedAt?: string
  message?: string
}

type TokenPricingFormState = Record<TokenAction, string>

const tokenPricingFallbackActions: Array<{ action: TokenAction; label: string; description: string }> = [
  {
    action: 'campaign_create',
    label: 'Criacao de campanha',
    description: 'Custo para abrir uma nova campanha de recrutamento.',
  },
  {
    action: 'job_create',
    label: 'Criacao de vaga',
    description: 'Custo para publicar uma nova vaga.',
  },
  {
    action: 'resume_analysis_start',
    label: 'Analise inicial',
    description: 'Custo para iniciar a analise automatizada de curriculo.',
  },
  {
    action: 'resume_analysis_reprocess',
    label: 'Reprocessamento',
    description: 'Custo para reprocessar uma analise existente.',
  },
]

const defaultTokenPricingFormState: TokenPricingFormState = {
  campaign_create: '24',
  job_create: '18',
  resume_analysis_start: '8',
  resume_analysis_reprocess: '5',
}

const roleConfig: Record<UserRole, RoleConfig> = {
  admin: {
    badge: 'Administrador',
    headline: 'Centro de controle do Perfiliza',
    subtitle: 'Permissoes, alertas operacionais e padroes da plataforma em um unico painel.',
    accent: 'from-emerald-500/90 via-teal-500/80 to-cyan-500/90',
    accentSoft: 'border-emerald-500/20 bg-emerald-500/5',
    icon: ShieldCheck,
    highlights: ['Alertas de operacao', 'Padroes da IA', 'Gestao de acessos'],
    visibilityLabel: 'Receber alertas de seguranca em tempo real',
    visibilityHint: 'Notifica logins suspeitos, falhas de integracao e alteracoes administrativas.',
    identityLabel: 'Nome exibido para o time',
    workspaceLabel: 'Equipe principal',
    notesLabel: 'Diretrizes internas',
    statusCopy: 'Governanca e configuracao global da operacao.',
  },
  empresa: {
    badge: 'Empresa',
    headline: 'Operacao da empresa sob medida',
    subtitle: 'Ajuste notificacoes, assinaturas e preferencias de recrutamento sem sair do fluxo.',
    accent: 'from-sky-500/90 via-blue-500/80 to-indigo-500/90',
    accentSoft: 'border-sky-500/20 bg-sky-500/5',
    icon: Building2,
    highlights: ['Resumo semanal', 'Marca da empresa', 'Fluxo de candidatos'],
    visibilityLabel: 'Compartilhar dashboard com gestores da vaga',
    visibilityHint: 'Mantem lideres alinhados com entrevistas, funil e candidatos priorizados.',
    identityLabel: 'Responsavel pela conta',
    workspaceLabel: 'Empresa',
    notesLabel: 'Tom de comunicacao com candidatos',
    statusCopy: 'Configuracoes para recrutamento, marca empregadora e acompanhamento.',
  },
  candidato: {
    badge: 'Candidato',
    headline: 'Preferencias do seu perfil profissional',
    subtitle: 'Defina visibilidade, alertas e sinais que ajudam o mercado a encontrar voce.',
    accent: 'from-fuchsia-500/90 via-rose-500/80 to-orange-400/90',
    accentSoft: 'border-fuchsia-500/20 bg-fuchsia-500/5',
    icon: UserRound,
    highlights: ['Privacidade do perfil', 'Alertas de vagas', 'Disponibilidade'],
    visibilityLabel: 'Exibir perfil no banco de talentos',
    visibilityHint: 'Permite que empresas encontrem seu perfil com base em habilidades e senioridade.',
    identityLabel: 'Nome profissional',
    workspaceLabel: 'Area de atuacao',
    notesLabel: 'Resumo para recrutadores',
    statusCopy: 'Controle sua presenca, notificacoes e posicionamento profissional.',
  },
}

const activityCards = [
  {
    title: 'Tempo medio de resposta',
    value: '2h 14m',
    icon: Clock3,
  },
  {
    title: 'Canal principal',
    value: 'Email + dashboard',
    icon: Bell,
  },
  {
    title: 'Escopo atual',
    value: 'Portal web',
    icon: Globe,
  },
]

function toTokenPricingForm(pricing?: TokenPricing): TokenPricingFormState {
  if (!pricing) {
    return defaultTokenPricingFormState
  }

  return {
    campaign_create: String(pricing.campaign_create ?? 24),
    job_create: String(pricing.job_create ?? 18),
    resume_analysis_start: String(pricing.resume_analysis_start ?? 8),
    resume_analysis_reprocess: String(pricing.resume_analysis_reprocess ?? 5),
  }
}

export function SettingsPage({ role }: { role: UserRole }) {
  const { user, logout } = useAuth()
  const config = roleConfig[role]
  const Icon = config.icon
  const emailInputRef = useRef<HTMLInputElement | null>(null)

  const [displayName, setDisplayName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [workspace, setWorkspace] = useState(user?.company ?? '')
  const [notes, setNotes] = useState('')
  const [browserAlerts, setBrowserAlerts] = useState(true)
  const [emailDigest, setEmailDigest] = useState(true)
  const [smartRecommendations, setSmartRecommendations] = useState(true)
  const [profileVisibility, setProfileVisibility] = useState(role !== 'admin')
  const [candidateStatus, setCandidateStatus] = useState<CandidateStatus>('open_to_offers')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [activeTab, setActiveTab] = useState<SettingsTab>('perfil')
  const [isSaving, setIsSaving] = useState(false)
  const [isEndingSession, setIsEndingSession] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [securityMessage, setSecurityMessage] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [tokenPricing, setTokenPricing] = useState<TokenPricingFormState>(defaultTokenPricingFormState)
  const [tokenActions, setTokenActions] = useState<TokenActionCost[]>([])
  const [isLoadingTokenPricing, setIsLoadingTokenPricing] = useState(role === 'admin')
  const [tokenPricingError, setTokenPricingError] = useState<string | null>(null)
  const [isSavingTokenPricing, setIsSavingTokenPricing] = useState(false)
  const [tokenPricingSavedAt, setTokenPricingSavedAt] = useState<string | null>(null)

  const firstName = useMemo(() => displayName?.split(' ')[0] ?? config.badge, [config.badge, displayName])
  const tokenPricingCatalog = useMemo(
    () => tokenPricingFallbackActions.map((item) => ({
      ...item,
      label: tokenActions.find((action) => action.action === item.action)?.label ?? item.label,
    })),
    [tokenActions],
  )

  useEffect(() => {
    let isActive = true

    async function loadSettings() {
      if (!user?.id) {
        return
      }

      try {
        const response = await fetch(`/api/settings?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(user.id)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json()) as { settings?: StoredSettings; message?: string }

        if (!response.ok || !payload.settings) {
          throw new Error(payload.message ?? 'Nao foi possivel carregar configuracoes.')
        }

        if (!isActive) {
          return
        }

        const settings = payload.settings
        setDisplayName(settings.displayName ?? user.name ?? '')
        setEmail(settings.email ?? user.email ?? '')
        setWorkspace(settings.workspace ?? user.company ?? '')
        setNotes(settings.notes ?? '')
        setBrowserAlerts(settings.browserAlerts ?? true)
        setEmailDigest(settings.emailDigest ?? true)
        setSmartRecommendations(settings.smartRecommendations ?? true)
        setProfileVisibility(settings.profileVisibility ?? role !== 'admin')
        setTimezone(settings.timezone ?? 'America/Sao_Paulo')
        setSettingsError(null)

        if (role === 'candidato') {
          try {
            const candidateResponse = await fetch(`/api/candidate/profile?candidateId=${encodeURIComponent(user.id)}`, {
              cache: 'no-store',
            })
            const candidatePayload = (await candidateResponse.json()) as {
              candidate?: { status?: CandidateStatus }
              message?: string
            }

            if (candidateResponse.ok && candidatePayload.candidate?.status) {
              setCandidateStatus(candidatePayload.candidate.status)
              setProfileVisibility(candidatePayload.candidate.status !== 'employed')
            }
          } catch {
            // Keep settings payload fallback when candidate profile is unavailable.
          }
        }
      } catch (loadError) {
        if (!isActive) {
          return
        }

        setSettingsError(loadError instanceof Error ? loadError.message : 'Falha ao carregar configuracoes.')
      }
    }

    void loadSettings()

    return () => {
      isActive = false
    }
  }, [role, user?.company, user?.email, user?.id, user?.name])

  useEffect(() => {
    if (role !== 'admin') {
      setIsLoadingTokenPricing(false)
      setTokenPricingError(null)
      return
    }

    let isActive = true

    async function loadTokenPricing() {
      setIsLoadingTokenPricing(true)
      setTokenPricingError(null)

      try {
        const response = await fetch('/api/admin/token-pricing', { cache: 'no-store' })
        const payload = (await response.json()) as TokenPricingResponse

        if (!response.ok || !payload.pricing) {
          throw new Error(payload.message ?? 'Nao foi possivel carregar o preco de tokens.')
        }

        if (!isActive) {
          return
        }

        setTokenPricing(toTokenPricingForm(payload.pricing))
        setTokenActions(payload.actions ?? [])
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setTokenPricingError(
          requestError instanceof Error
            ? requestError.message
            : 'Falha ao carregar preco de tokens.',
        )
      } finally {
        if (isActive) {
          setIsLoadingTokenPricing(false)
        }
      }
    }

    void loadTokenPricing()

    return () => {
      isActive = false
    }
  }, [role])

  const handleSave = async () => {
    if (!user?.id) {
      return
    }

    setIsSaving(true)
    setSettingsError(null)
    setSecurityMessage(null)

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          userId: user.id,
          settings: {
            displayName,
            email,
            workspace,
            notes,
            browserAlerts,
            emailDigest,
            smartRecommendations,
            profileVisibility,
            timezone,
          },
        }),
      })
      const payload = (await response.json()) as { savedAt?: string; message?: string }

      if (!response.ok) {
        throw new Error(payload.message ?? 'Nao foi possivel salvar configuracoes.')
      }

      if (role === 'candidato') {
        const nextStatus: CandidateStatus = profileVisibility
          ? (candidateStatus === 'employed' ? 'open_to_offers' : candidateStatus)
          : 'employed'

        const profileResponse = await fetch('/api/candidate/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            candidateId: user.id,
            status: nextStatus,
          }),
        })
        const profilePayload = (await profileResponse.json()) as { message?: string }

        if (!profileResponse.ok) {
          throw new Error(profilePayload.message ?? 'Nao foi possivel atualizar visibilidade do perfil.')
        }

        setCandidateStatus(nextStatus)
      }

      const timestamp = payload.savedAt ? new Date(payload.savedAt) : new Date()
      setSavedAt(
        new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(timestamp),
      )
    } catch (saveError) {
      setSettingsError(saveError instanceof Error ? saveError.message : 'Falha ao salvar configuracoes.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFocusAccessFields = () => {
    setActiveTab('perfil')
    setSecurityMessage('Atualize o email principal e salve para aplicar as alteracoes de acesso.')
    setTimeout(() => {
      emailInputRef.current?.focus()
    }, 0)
  }

  const handleEndSession = () => {
    setSecurityMessage('Sessao encerrada com sucesso.')
    setIsEndingSession(true)
    logout()
  }

  const handleSaveTokenPricing = async () => {
    setIsSavingTokenPricing(true)
    setTokenPricingError(null)
    setTokenPricingSavedAt(null)

    try {
      const parsedPricing = {
        campaign_create: Number(tokenPricing.campaign_create),
        job_create: Number(tokenPricing.job_create),
        resume_analysis_start: Number(tokenPricing.resume_analysis_start),
        resume_analysis_reprocess: Number(tokenPricing.resume_analysis_reprocess),
      }

      const hasInvalidPricing = Object.values(parsedPricing)
        .some((value) => !Number.isInteger(value) || value < 1 || value > 10000)

      if (hasInvalidPricing) {
        throw new Error('Informe valores inteiros entre 1 e 10000 para todos os custos.')
      }

      const payload = {
        pricing: parsedPricing,
      }

      const response = await fetch('/api/admin/token-pricing', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const responsePayload = (await response.json()) as TokenPricingResponse

      if (!response.ok || !responsePayload.pricing) {
        throw new Error(responsePayload.message ?? 'Nao foi possivel atualizar o preco de tokens.')
      }

      setTokenPricing(toTokenPricingForm(responsePayload.pricing))
      setTokenActions(responsePayload.actions ?? tokenActions)

      const timestamp = responsePayload.updatedAt ? new Date(responsePayload.updatedAt) : new Date()
      setTokenPricingSavedAt(
        new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(timestamp),
      )
    } catch (requestError) {
      setTokenPricingError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao salvar preco de tokens.',
      )
    } finally {
      setIsSavingTokenPricing(false)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Configuracoes"
        subtitle={config.statusCopy}
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <Card className={cn('overflow-hidden border shadow-sm', config.accentSoft)}>
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-[1.35fr_0.85fr]">
                <div className="relative overflow-hidden px-6 py-8 sm:px-8">
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-95', config.accent)} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.18),transparent_40%)]" />
                  <div className="relative text-white">
                    <Badge className="border-white/20 bg-white/14 text-white hover:bg-white/14">
                      {config.badge}
                    </Badge>
                    <div className="mt-5 flex items-start justify-between gap-4">
                      <div className="max-w-2xl space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/90">
                          <Icon className="h-3.5 w-3.5" />
                          Preferencias ativas
                        </div>
                        <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                          {config.headline}
                        </h2>
                        <p className="max-w-2xl text-sm leading-6 text-white/84 sm:text-base">
                          {config.subtitle}
                        </p>
                      </div>
                      <div className="hidden rounded-3xl border border-white/15 bg-slate-950/16 p-4 backdrop-blur sm:block">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/72">Conta ativa</div>
                        <div className="mt-3 text-xl font-semibold">{firstName}</div>
                        <div className="mt-1 text-sm text-white/74">{email || user?.email}</div>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                      {config.highlights.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-white/15 bg-slate-950/14 px-4 py-3 backdrop-blur"
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Check className="h-4 w-4" />
                            {item}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-border/60 bg-background/80 p-6 lg:border-t-0 lg:border-l">
                  {activityCards.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('rounded-2xl p-3', config.accentSoft)}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {item.title}
                          </div>
                          <div className="mt-1 text-sm font-medium">{item.value}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className={cn('rounded-2xl border px-4 py-4', config.accentSoft)}>
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-background/80 p-3">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Modo inteligente ativo</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Recomendacoes ajustadas ao seu contexto para reduzir operacao manual.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.55fr_0.8fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Preferencias da conta</CardTitle>
                <CardDescription>
                  Ajuste informacoes essenciais, seguranca e comunicacao da sua area.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)} className="gap-5">
                  <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/70 p-1">
                    <TabsTrigger value="perfil" className="rounded-xl py-2.5">Perfil</TabsTrigger>
                    <TabsTrigger value="alertas" className="rounded-xl py-2.5">Alertas</TabsTrigger>
                    <TabsTrigger value="seguranca" className="rounded-xl py-2.5">Seguranca</TabsTrigger>
                  </TabsList>

                  <TabsContent value="perfil">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">{config.identityLabel}</Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="Digite o nome exibido"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email principal</Label>
                        <Input
                          ref={emailInputRef}
                          id="email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="Digite o email de contato"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="workspace">{config.workspaceLabel}</Label>
                        <Input
                          id="workspace"
                          value={workspace}
                          onChange={(event) => setWorkspace(event.target.value)}
                          placeholder="Preencha a referencia principal"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Fuso horario</Label>
                        <Input
                          id="timezone"
                          value={timezone}
                          onChange={(event) => setTimezone(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="notes">{config.notesLabel}</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Defina orientacoes, contexto ou preferencias importantes."
                          rows={5}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="alertas">
                    <div className="space-y-3">
                      {[
                        {
                          title: 'Notificacoes no navegador',
                          description: 'Avisos instantaneos para atividade relevante sem depender do email.',
                          checked: browserAlerts,
                          onChange: setBrowserAlerts,
                        },
                        {
                          title: 'Resumo diario por email',
                          description: 'Entrega consolidada com o que mudou no seu portal.',
                          checked: emailDigest,
                          onChange: setEmailDigest,
                        },
                        {
                          title: 'Sugestoes inteligentes',
                          description: 'Ativa recomendacoes de IA baseadas no historico da conta.',
                          checked: smartRecommendations,
                          onChange: setSmartRecommendations,
                        },
                      ].map((item) => (
                        <div
                          key={item.title}
                          className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-muted/25 px-4 py-4"
                        >
                          <div className="space-y-1">
                            <div className="font-medium">{item.title}</div>
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                          </div>
                          <Switch checked={item.checked} onCheckedChange={item.onChange} />
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="seguranca">
                    <div className="space-y-3">
                      <div className={cn('rounded-2xl border px-4 py-4', config.accentSoft)}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{config.visibilityLabel}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {config.visibilityHint}
                            </div>
                          </div>
                          <Switch
                            checked={profileVisibility}
                            onCheckedChange={setProfileVisibility}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/70 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">Sessao autenticada</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              Encerre a sessao atual neste dispositivo quando precisar.
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isEndingSession}
                            onClick={handleEndSession}
                          >
                            {isEndingSession ? 'Encerrando...' : 'Encerrar sessao'}
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/70 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">Senha e autenticacao</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              Altere credenciais sensiveis e fortalece o acesso da conta.
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={handleFocusAccessFields}>
                            Atualizar acesso
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {savedAt ? `Ultimo salvamento as ${savedAt}` : 'Nenhuma alteracao salva nesta sessao.'}
                  </div>
                  <Button onClick={() => void handleSave()} disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar configuracoes'}
                    {!isSaving && <ChevronRight className="ml-1 h-4 w-4" />}
                  </Button>
                </div>

                {settingsError && (
                  <div className="mt-3 text-sm text-destructive">
                    {settingsError}
                  </div>
                )}

                {!settingsError && securityMessage && (
                  <div className="mt-3 text-sm text-primary">
                    {securityMessage}
                  </div>
                )}

                {!settingsError && savedAt && (
                  <div className="mt-3 text-sm text-emerald-600">
                    Configuracoes persistidas com sucesso.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Resumo rapido</CardTitle>
                  <CardDescription>
                    Sinais principais para manter a conta alinhada com seu fluxo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      icon: Users,
                      title: 'Responsavel',
                      value: displayName || user?.name || 'Conta principal',
                    },
                    {
                      icon: Briefcase,
                      title: 'Contexto',
                      value: workspace || user?.company || config.badge,
                    },
                    {
                      icon: Bell,
                      title: 'Alertas',
                      value: emailDigest ? 'Resumo ativo' : 'Resumo pausado',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-4"
                    >
                      <div className={cn('rounded-2xl p-3', config.accentSoft)}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {item.title}
                        </div>
                        <div className="mt-1 text-sm font-medium">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {role === 'admin' && (
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-600" />
                      Preco de tokens
                    </CardTitle>
                    <CardDescription>
                      Defina o custo por acao para uso de tokens na plataforma.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingTokenPricing && (
                      <p className="text-sm text-muted-foreground">Carregando configuracao de tokens...</p>
                    )}

                    {!isLoadingTokenPricing && (
                      <div className="space-y-3">
                        {tokenPricingCatalog.map((item) => (
                          <div key={item.action} className="rounded-2xl border border-border/70 px-4 py-4">
                            <div className="mb-2 text-sm font-medium">{item.label}</div>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                            <div className="mt-3 flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={10000}
                                value={tokenPricing[item.action]}
                                onChange={(event) =>
                                  setTokenPricing((current) => ({
                                    ...current,
                                    [item.action]: event.target.value,
                                  }))
                                }
                              />
                              <Badge variant="outline">tokens</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {tokenPricingError && (
                      <p className="text-sm text-destructive">{tokenPricingError}</p>
                    )}

                    {!tokenPricingError && tokenPricingSavedAt && (
                      <p className="text-sm text-emerald-600">
                        Preco atualizado as {tokenPricingSavedAt}.
                      </p>
                    )}

                    <Button
                      className="w-full"
                      disabled={isLoadingTokenPricing || isSavingTokenPricing}
                      onClick={() => void handleSaveTokenPricing()}
                    >
                      {isSavingTokenPricing ? 'Salvando preco...' : 'Salvar preco de tokens'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle>Zona de saida</CardTitle>
                  <CardDescription>
                    Encerre a sessao atual com redirecionamento para a tela inicial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-muted-foreground">
                    O logout agora bloqueia a reautenticacao automatica nesta sessao para evitar retorno imediato ao painel.
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full justify-between"
                    onClick={logout}
                  >
                    Sair da conta
                    <LogOut className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
