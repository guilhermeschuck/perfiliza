'use client'

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { Button } from '@/components/ui/button'
import type {
  AppBootstrapData,
  SubmissionResponse,
  SubmissionInput,
} from '@/lib/app-data'
import { getErrorMessage } from '@/lib/app-data'
import type { CustomQuestion } from '@/lib/types'

interface AppDataContextType {
  data: AppBootstrapData
  error: string | null
  isRefreshing: boolean
  refresh: () => Promise<void>
  createSubmission: (input: SubmissionInput) => Promise<SubmissionResponse>
  submitLead: (jobId: string, leadId: string) => Promise<SubmissionResponse>
  updateJobQuestions: (jobId: string, questions: CustomQuestion[]) => Promise<void>
  createPublicLead: (shareToken: string, input: FormData) => Promise<void>
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppBootstrapData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(true)

  async function refresh() {
    setIsRefreshing(true)

    try {
      const response = await fetch('/api/bootstrap', { cache: 'no-store' })
      const payload = (await response.json()) as AppBootstrapData | { message?: string; errors?: unknown }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Nao foi possivel carregar os dados do sistema.'))
      }

      startTransition(() => {
        setData(payload as AppBootstrapData)
        setError(null)
      })
    } catch (refreshError) {
      const message = refreshError instanceof Error
        ? refreshError.message
        : 'Nao foi possivel carregar os dados do sistema.'

      setError(message)
    } finally {
      setIsRefreshing(false)
    }
  }

  async function createSubmission(input: SubmissionInput) {
    const { resumeFile, ...inputWithoutFile } = input
    let response: Response

    if (typeof File !== 'undefined' && resumeFile instanceof File) {
      const formData = new FormData()

      Object.entries(inputWithoutFile).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.set(key, String(value))
        }
      })

      formData.set('resumeFile', resumeFile)

      response = await fetch('/api/submissions', {
        method: 'POST',
        body: formData,
      })
    } else {
      response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputWithoutFile),
      })
    }

    const payload = (await response.json()) as SubmissionResponse | { message?: string; errors?: unknown }

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Nao foi possivel submeter o candidato.'))
    }

    startTransition(() => {
      setData((payload as SubmissionResponse).bootstrap)
      setError(null)
    })

    return payload as SubmissionResponse
  }

  async function submitLead(jobId: string, leadId: string) {
    const response = await fetch(`/api/jobs/${jobId}/leads/${leadId}/submit`, {
      method: 'POST',
    })

    const payload = (await response.json()) as SubmissionResponse | { message?: string; errors?: unknown }

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Nao foi possivel submeter o lead para analise.'))
    }

    startTransition(() => {
      setData((payload as SubmissionResponse).bootstrap)
      setError(null)
    })

    return payload as SubmissionResponse
  }

  async function updateJobQuestions(jobId: string, questions: CustomQuestion[]) {
    const response = await fetch(`/api/jobs/${jobId}/public-form`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questions }),
    })

    const payload = (await response.json()) as { bootstrap?: AppBootstrapData; message?: string; errors?: unknown }

    if (!response.ok || !payload.bootstrap) {
      throw new Error(getErrorMessage(payload, 'Nao foi possivel atualizar o formulario publico da vaga.'))
    }

    startTransition(() => {
      setData(payload.bootstrap ?? null)
      setError(null)
    })
  }

  async function createPublicLead(shareToken: string, input: FormData) {
    const response = await fetch(`/api/public/jobs/${shareToken}/leads`, {
      method: 'POST',
      body: input,
    })

    const payload = (await response.json()) as { message?: string; errors?: unknown }

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Nao foi possivel registrar o lead da vaga.'))
    }

    await refresh()
  }

  useEffect(() => {
    void refresh()
  }, [])

  if (!data) {
    if (error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Falha ao conectar com o backend</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => void refresh()}>Tentar novamente</Button>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
      </div>
    )
  }

  return (
    <AppDataContext.Provider
      value={{
        data,
        error,
        isRefreshing,
        refresh,
        createSubmission,
        submitLead,
        updateJobQuestions,
        createPublicLead,
      }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const context = useContext(AppDataContext)

  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider')
  }

  return context
}
