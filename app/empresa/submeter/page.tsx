'use client'

import { useState } from 'react'
import { Upload, FileText, User, Mail, Phone, MapPin, Linkedin, Briefcase, GraduationCap, CheckCircle } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { useAppData } from '@/contexts/app-data-context'
import { getJobsByCompanyId } from '@/lib/app-data'

export default function SubmeterCandidatoPage() {
  const [step, setStep] = useState(1)
  const [selectedJob, setSelectedJob] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [experienceRange, setExperienceRange] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeFileName, setResumeFileName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { user } = useAuth()
  const { data, createSubmission } = useAppData()

  const companyJobs = getJobsByCompanyId(data, user?.id ?? '2').filter((job) => job.status === 'active')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!selectedJob || !experienceRange) {
      setErrorMessage('Preencha a vaga e a experiencia do candidato antes de continuar.')
      return
    }

    const formData = new FormData(e.currentTarget)

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await createSubmission({
        jobId: selectedJob,
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        location: String(formData.get('location') ?? ''),
        linkedinUrl: String(formData.get('linkedin') ?? ''),
        experienceRange: experienceRange as '0-1' | '2-3' | '4-5' | '6+',
        education: String(formData.get('education') ?? ''),
        skills: String(formData.get('skills') ?? ''),
        resumeFileName,
        resumeFile,
        notes: String(formData.get('notes') ?? ''),
      })

      setIsSubmitted(true)
    } catch (submissionError) {
      setErrorMessage(
        submissionError instanceof Error
          ? submissionError.message
          : 'Nao foi possivel submeter o candidato.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <>
        <DashboardHeader 
          title="Candidato Submetido" 
          subtitle="O candidato foi enviado para análise"
        />
        <main className="flex-1 overflow-auto p-6">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Candidato Submetido com Sucesso!</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                O currículo foi enviado para análise. Você receberá uma notificação quando a análise estiver concluída.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => {
                  setIsSubmitted(false)
                  setStep(1)
                  setSelectedJob('')
                  setExperienceRange('')
                  setResumeFile(null)
                  setResumeFileName('')
                }}>
                  Submeter Outro
                </Button>
                <Button onClick={() => window.location.href = '/empresa/resultados'}>
                  Ver Resultados
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  return (
    <>
      <DashboardHeader 
        title="Submeter Candidato" 
        subtitle="Envie um candidato para análise de compatibilidade"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`
                  flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
                  ${step >= s 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`
                    h-0.5 w-12 mx-2
                    ${step > s ? 'bg-primary' : 'bg-muted'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 text-sm text-muted-foreground">
            <span className={step >= 1 ? 'text-foreground font-medium' : ''}>Selecionar Vaga</span>
            <span className={step >= 2 ? 'text-foreground font-medium' : ''}>Dados do Candidato</span>
            <span className={step >= 3 ? 'text-foreground font-medium' : ''}>Currículo</span>
          </div>

          <form onSubmit={handleSubmit}>
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}
            {/* Step 1: Select Job */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Vaga</CardTitle>
                  <CardDescription>
                    Escolha para qual vaga este candidato está sendo submetido
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {companyJobs.map((job) => (
                      <div
                        key={job.id}
                        className={`
                          p-4 rounded-lg border-2 cursor-pointer transition-colors
                          ${selectedJob === job.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-muted-foreground/30'
                          }
                        `}
                        onClick={() => setSelectedJob(job.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{job.title}</h3>
                            <p className="text-sm text-muted-foreground">{job.location}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">{job.level}</Badge>
                            <Badge variant="outline">{job.type}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-3">
                          {job.requirements.slice(0, 4).map((req) => (
                            <Badge key={req} variant="secondary" className="text-xs">
                              {req}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button 
                      type="button" 
                      onClick={() => setStep(2)}
                      disabled={!selectedJob}
                    >
                      Próximo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Candidate Data */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Dados do Candidato</CardTitle>
                  <CardDescription>
                    Preencha as informações básicas do candidato
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        <User className="inline h-4 w-4 mr-1" />
                        Nome Completo
                      </Label>
                      <Input id="name" name="name" placeholder="Nome do candidato" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        <Mail className="inline h-4 w-4 mr-1" />
                        E-mail
                      </Label>
                      <Input id="email" name="email" type="email" placeholder="email@exemplo.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        <Phone className="inline h-4 w-4 mr-1" />
                        Telefone
                      </Label>
                      <Input id="phone" name="phone" placeholder="(00) 00000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">
                        <MapPin className="inline h-4 w-4 mr-1" />
                        Localização
                      </Label>
                      <Input id="location" name="location" placeholder="Cidade, Estado" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin">
                        <Linkedin className="inline h-4 w-4 mr-1" />
                        LinkedIn (opcional)
                      </Label>
                      <Input id="linkedin" name="linkedin" placeholder="https://linkedin.com/in/..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experience">
                        <Briefcase className="inline h-4 w-4 mr-1" />
                        Anos de Experiência
                      </Label>
                      <Select value={experienceRange} onValueChange={setExperienceRange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-1">0-1 anos</SelectItem>
                          <SelectItem value="2-3">2-3 anos</SelectItem>
                          <SelectItem value="4-5">4-5 anos</SelectItem>
                          <SelectItem value="6+">6+ anos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="education">
                        <GraduationCap className="inline h-4 w-4 mr-1" />
                        Formação
                      </Label>
                      <Input id="education" name="education" placeholder="Ex: Bacharel em Ciência da Computação - USP" required />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="skills">Habilidades (separadas por vírgula)</Label>
                      <Input id="skills" name="skills" placeholder="React, Node.js, TypeScript, SQL..." required />
                    </div>
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Voltar
                    </Button>
                    <Button type="button" onClick={() => setStep(3)}>
                      Próximo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Resume Upload */}
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload do Currículo</CardTitle>
                  <CardDescription>
                    Faça upload do currículo do candidato para análise
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium mb-1">Arraste o currículo aqui</p>
                    <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
                    <Input 
                      type="file" 
                      accept=".pdf,.doc,.docx" 
                      className="hidden" 
                      id="resume"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setResumeFile(file)
                        setResumeFileName(file?.name ?? '')
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => document.getElementById('resume')?.click()}>
                      <FileText className="mr-2 h-4 w-4" />
                      {resumeFileName || 'Selecionar Arquivo'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                      Formatos aceitos: PDF, DOC, DOCX (máx. 10MB)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações (opcional)</Label>
                    <Textarea 
                      id="notes"
                      name="notes"
                      placeholder="Adicione observações sobre o candidato..."
                      rows={3}
                    />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Resumo da Submissão</h4>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p>
                        <span className="text-foreground font-medium">Vaga:</span>{' '}
                        {companyJobs.find(j => j.id === selectedJob)?.title}
                      </p>
                      <p>
                        <span className="text-foreground font-medium">Análises incluídas:</span>{' '}
                        IA, DISC, Numerologia, LinkedIn
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Voltar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Submetendo...' : 'Submeter Candidato'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </form>
        </div>
      </main>
    </>
  )
}
