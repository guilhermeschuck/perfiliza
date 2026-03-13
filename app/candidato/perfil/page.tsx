'use client'

import { useEffect, useState } from 'react'
import { User, Mail, Phone, MapPin, Linkedin, Briefcase, GraduationCap, Save, Plus, X } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { useAppData } from '@/contexts/app-data-context'
import { useCandidatePanel } from '@/contexts/candidate-panel-context'

type CandidateStatus = 'available' | 'employed' | 'open_to_offers'

interface CandidateProfile {
  id: string
  name: string
  email: string
  phone: string
  location: string
  linkedinUrl?: string
  currentPosition?: string
  currentCompany?: string
  experience: number
  education: string
  skills: string[]
  status: CandidateStatus
  bio?: string
}

interface CandidateProfileResponse {
  candidate: CandidateProfile
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

const defaultProfile: CandidateProfile = {
  id: '3',
  name: '',
  email: '',
  phone: '',
  location: '',
  linkedinUrl: '',
  currentPosition: '',
  currentCompany: '',
  experience: 0,
  education: '',
  skills: [],
  status: 'open_to_offers',
  bio: '',
}

export default function PerfilCandidatoPage() {
  const { user } = useAuth()
  const { refresh } = useAppData()
  const { refreshCandidatePanel } = useCandidatePanel()
  const [profile, setProfile] = useState<CandidateProfile>(defaultProfile)
  const [newSkill, setNewSkill] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const candidateId = user?.id ?? '3'

    async function loadProfile() {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/candidate/profile?candidateId=${encodeURIComponent(candidateId)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json()) as unknown

        if (
          !response.ok ||
          !payload ||
          typeof payload !== 'object' ||
          !('candidate' in payload) ||
          !payload.candidate
        ) {
          throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar o perfil.')
        }

        if (!isActive) {
          return
        }

        const candidate = (payload as CandidateProfileResponse).candidate
        setProfile({
          ...defaultProfile,
          ...candidate,
          skills: Array.isArray(candidate.skills) ? candidate.skills : [],
        })
        setIsAvailable(candidate.status !== 'employed')
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar perfil.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [user?.id])

  const completionFields = [
    profile.name,
    profile.email,
    profile.phone,
    profile.location,
    profile.education,
    profile.currentPosition,
    profile.linkedinUrl,
    profile.skills.length > 0 ? 'ok' : '',
  ]
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100)

  const addSkill = () => {
    const skill = newSkill.trim()
    if (!skill || profile.skills.includes(skill)) {
      return
    }

    setProfile((prev) => ({ ...prev, skills: [...prev.skills, skill] }))
    setNewSkill('')
  }

  const removeSkill = (skill: string) => {
    setProfile((prev) => ({ ...prev, skills: prev.skills.filter((entry) => entry !== skill) }))
  }

  async function saveProfile() {
    if (!user?.id) {
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/candidate/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateId: user.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          location: profile.location,
          linkedinUrl: profile.linkedinUrl || null,
          currentPosition: profile.currentPosition || null,
          currentCompany: profile.currentCompany || null,
          experience: profile.experience,
          education: profile.education,
          skills: profile.skills,
          status: isAvailable ? profile.status : 'employed',
          bio: profile.bio || null,
        }),
      })
      const payload = (await response.json()) as unknown

      if (!response.ok) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel salvar o perfil.')
      }

      await Promise.all([refresh(), refreshCandidatePanel()])
      setSuccess('Perfil atualizado com sucesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar perfil.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Meu Perfil"
        subtitle="Gerencie suas informacoes pessoais e profissionais"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-chart-4/30 bg-chart-4/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Perfil {completion}% completo</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete os campos para melhorar o ranking nas vagas.
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full border-4 border-chart-4 flex items-center justify-center">
                  <span className="text-sm font-bold">{completion}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">Carregando perfil...</CardContent>
            </Card>
          )}

          {!isLoading && error && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          {!isLoading && !error && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Informacoes Basicas</CardTitle>
                  <CardDescription>Seus dados pessoais e de contato</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        <User className="inline h-4 w-4 mr-1" />
                        Nome completo
                      </Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        <Mail className="inline h-4 w-4 mr-1" />
                        E-mail
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        <Phone className="inline h-4 w-4 mr-1" />
                        Telefone
                      </Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">
                        <MapPin className="inline h-4 w-4 mr-1" />
                        Localizacao
                      </Label>
                      <Input
                        id="location"
                        value={profile.location}
                        onChange={(event) => setProfile((prev) => ({ ...prev, location: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="linkedin">
                        <Linkedin className="inline h-4 w-4 mr-1" />
                        LinkedIn
                      </Label>
                      <Input
                        id="linkedin"
                        value={profile.linkedinUrl ?? ''}
                        onChange={(event) => setProfile((prev) => ({ ...prev, linkedinUrl: event.target.value }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informacoes Profissionais</CardTitle>
                  <CardDescription>Experiencia, formacao e resumo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="position">
                        <Briefcase className="inline h-4 w-4 mr-1" />
                        Cargo atual
                      </Label>
                      <Input
                        id="position"
                        value={profile.currentPosition ?? ''}
                        onChange={(event) => setProfile((prev) => ({ ...prev, currentPosition: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Empresa atual</Label>
                      <Input
                        id="company"
                        value={profile.currentCompany ?? ''}
                        onChange={(event) => setProfile((prev) => ({ ...prev, currentCompany: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experience">Anos de experiencia</Label>
                      <Input
                        id="experience"
                        type="number"
                        min={0}
                        max={60}
                        value={profile.experience}
                        onChange={(event) => setProfile((prev) => ({ ...prev, experience: Number(event.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status de disponibilidade</Label>
                      <Select
                        value={profile.status}
                        onValueChange={(value) => setProfile((prev) => ({ ...prev, status: value as CandidateStatus }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Disponivel</SelectItem>
                          <SelectItem value="open_to_offers">Aberto a propostas</SelectItem>
                          <SelectItem value="employed">Empregado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="education">
                        <GraduationCap className="inline h-4 w-4 mr-1" />
                        Formacao
                      </Label>
                      <Input
                        id="education"
                        value={profile.education}
                        onChange={(event) => setProfile((prev) => ({ ...prev, education: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bio">Resumo profissional</Label>
                      <Textarea
                        id="bio"
                        rows={4}
                        value={profile.bio ?? ''}
                        onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
                        placeholder="Destaque seus resultados e objetivos."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Habilidades</CardTitle>
                  <CardDescription>Competencias tecnicas e comportamentais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="text-sm py-1.5 px-3 pr-2 gap-1"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="ml-1 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar habilidade..."
                      value={newSkill}
                      onChange={(event) => setNewSkill(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addSkill()
                        }
                      }}
                    />
                    <Button variant="outline" onClick={addSkill}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Visibilidade</CardTitle>
                  <CardDescription>Controle de exibicao no banco de talentos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <h4 className="font-medium">Visivel para empresas</h4>
                      <p className="text-sm text-muted-foreground">
                        Permitir que recrutadores encontrem seu perfil.
                      </p>
                    </div>
                    <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                  </div>
                </CardContent>
              </Card>

              {success && (
                <Card>
                  <CardContent className="p-4 text-sm text-emerald-600">{success}</CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button size="lg" disabled={isSaving} onClick={() => void saveProfile()}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}
