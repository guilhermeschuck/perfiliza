'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Download, Eye } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/auth-context'
import { useAppData } from '@/contexts/app-data-context'
import { useCandidatePanel } from '@/contexts/candidate-panel-context'

interface ResumePayload {
  candidateId: string
  resumeFileName: string | null
  resumeUrl: string | null
  hasResume: boolean
  updatedAt?: string | null
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

function formatDate(date?: string | null) {
  if (!date) {
    return 'Data indisponivel'
  }

  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export default function CurriculoPage() {
  const { user } = useAuth()
  const { refresh } = useAppData()
  const { refreshCandidatePanel } = useCandidatePanel()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [resume, setResume] = useState<ResumePayload>({
    candidateId: user?.id ?? '3',
    resumeFileName: null,
    resumeUrl: null,
    hasResume: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const candidateId = user?.id ?? '3'

    async function loadResume() {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/candidate/profile/resume?candidateId=${encodeURIComponent(candidateId)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json()) as unknown

        if (
          !response.ok ||
          !payload ||
          typeof payload !== 'object' ||
          !('candidateId' in payload) ||
          !('hasResume' in payload)
        ) {
          throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar o curriculo.')
        }

        if (!isActive) {
          return
        }

        setResume(payload as ResumePayload)
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar curriculo.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadResume()

    return () => {
      isActive = false
    }
  }, [user?.id])

  async function handleUpload(file: File) {
    const candidateId = user?.id ?? '3'
    setIsUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('candidateId', candidateId)
      formData.append('resumeFile', file)

      const response = await fetch('/api/candidate/profile/resume', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as unknown

      if (
        !response.ok ||
        !payload ||
        typeof payload !== 'object' ||
        !('candidateId' in payload) ||
        !('hasResume' in payload)
      ) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel enviar o curriculo.')
      }

      setResume(payload as ResumePayload)
      setSuccess('Curriculo enviado com sucesso.')
      await Promise.all([refresh(), refreshCandidatePanel()])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao enviar curriculo.')
    } finally {
      setIsUploading(false)
    }
  }

  async function removeResume() {
    if (!resume.hasResume) {
      return
    }

    const candidateId = user?.id ?? '3'
    setIsDeleting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/candidate/profile/resume?candidateId=${encodeURIComponent(candidateId)}`, {
        method: 'DELETE',
      })
      const payload = (await response.json()) as unknown

      if (
        !response.ok ||
        !payload ||
        typeof payload !== 'object' ||
        !('candidateId' in payload) ||
        !('hasResume' in payload)
      ) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel remover o curriculo.')
      }

      setResume(payload as ResumePayload)
      setSuccess('Curriculo removido com sucesso.')
      await Promise.all([refresh(), refreshCandidatePanel()])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao remover curriculo.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Meu Curriculo"
        subtitle="Gerencie seu curriculo no Banco de Talentos"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {isLoading && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">Carregando curriculo...</CardContent>
            </Card>
          )}

          {!isLoading && error && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          {!isLoading && success && (
            <Card>
              <CardContent className="p-4 text-sm text-emerald-600">{success}</CardContent>
            </Card>
          )}

          {!isLoading && resume.hasResume && (
            <Card>
              <CardHeader>
                <CardTitle>Curriculo Atual</CardTitle>
                <CardDescription>Arquivo cadastrado no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{resume.resumeFileName ?? 'curriculo.pdf'}</h4>
                      <Badge className="bg-emerald-500 shrink-0">Ativo</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Atualizado em {formatDate(resume.updatedAt)}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      {resume.resumeUrl && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <a href={resume.resumeUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a href={resume.resumeUrl} download>
                              <Download className="mr-2 h-4 w-4" />
                              Baixar
                            </a>
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={isDeleting}
                        onClick={() => void removeResume()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isDeleting ? 'Removendo...' : 'Remover'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-emerald-600">Curriculo Verificado</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Seu curriculo esta visivel para empresas no Banco de Talentos.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isLoading && (
            <Card>
              <CardHeader>
                <CardTitle>{resume.hasResume ? 'Atualizar Curriculo' : 'Enviar Curriculo'}</CardTitle>
                <CardDescription>
                  {resume.hasResume
                    ? 'Envie uma nova versao para substituir o arquivo atual.'
                    : 'Faca upload do seu curriculo para entrar no Banco de Talentos.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isUploading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin h-12 w-12 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="font-medium">Enviando curriculo...</p>
                    <Progress value={66} className="mt-4 max-w-xs mx-auto" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium mb-1">Arraste seu curriculo aqui</p>
                    <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      id="resume"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void handleUpload(file)
                        }
                        event.target.value = ''
                      }}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <FileText className="mr-2 h-4 w-4" />
                      Selecionar Arquivo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                      Formatos aceitos: PDF, DOC, DOCX (max. 10MB)
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-600">Dicas para seu Curriculo</h4>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>- Mantenha seu curriculo atualizado com suas ultimas experiencias</li>
                        <li>- Use formato PDF para melhor compatibilidade</li>
                        <li>- Inclua habilidades tecnicas e comportamentais</li>
                        <li>- Destaque projetos relevantes e resultados alcancados</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
