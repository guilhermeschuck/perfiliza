import type {
  Analysis,
  Application,
  Candidate,
  CompanyTokenWallet,
  CustomQuestion,
  DashboardStats,
  Job,
  Lead,
  LeadDiscAnswers,
  TokenAction,
  TokenActionCost,
  TokenPricing,
  TokenTransaction,
  User,
  UserRole,
} from '@/lib/types'

export interface AppBootstrapData {
  users: User[]
  jobs: Job[]
  candidates: Candidate[]
  analyses: Analysis[]
  applications: Application[]
  leads: Lead[]
  tokenPricing: TokenPricing
  tokenWallets: CompanyTokenWallet[]
  tokenTransactions: TokenTransaction[]
  tokenActions: TokenActionCost[]
  dashboardStats: DashboardStats
}

export interface LoginInput {
  role: UserRole
  email: string
  password: string
}

export interface SubmissionInput {
  jobId: string
  name: string
  email: string
  phone?: string
  location: string
  linkedinUrl?: string
  experienceRange: '0-1' | '2-3' | '4-5' | '6+'
  education: string
  skills: string
  resumeFileName?: string
  resumeFile?: File | null
  notes?: string
}

export interface SubmissionResponse {
  candidate: Candidate
  application: Application
  bootstrap: AppBootstrapData
}

export interface PublicLeadInput {
  name: string
  email: string
  phone: string
  location: string
  linkedinUrl?: string
  experienceRange: '0-1' | '2-3' | '4-5' | '6+'
  education: string
  skills: string
  resumeFileName?: string
  discAnswers: LeadDiscAnswers
  customAnswers: Array<{
    questionId: string
    question: string
    answer: string
  }>
}
export function getJobsByCompanyId(data: AppBootstrapData, companyId: string) {
  return data.jobs.filter((job) => job.companyId === companyId)
}

export function getApplicationsByCompanyId(data: AppBootstrapData, companyId: string) {
  return data.applications.filter((application) => application.companyId === companyId)
}

export function getLeadsByJobId(data: AppBootstrapData, jobId: string) {
  return data.leads.filter((lead) => lead.jobId === jobId)
}

export function getApplicationById(data: AppBootstrapData, applicationId: string) {
  return data.applications.find((application) => application.id === applicationId)
}

export function getJobById(data: AppBootstrapData, jobId: string) {
  return data.jobs.find((job) => job.id === jobId)
}

export function getCompanyTokenWallet(data: AppBootstrapData, companyId: string) {
  return data.tokenWallets.find((wallet) => wallet.companyId === companyId)
}

export function getTokenCost(data: AppBootstrapData, action: TokenAction) {
  return data.tokenPricing[action]
}

export function buildPublicJobUrl(shareToken: string) {
  return `/vagas/${shareToken}`
}

export function buildQuestionDrafts(questions?: CustomQuestion[]) {
  return (questions && questions.length > 0 ? questions : [
    {
      id: 'motivation',
      label: '',
      type: 'textarea' as const,
      required: true,
      placeholder: '',
    },
    {
      id: 'highlight',
      label: '',
      type: 'textarea' as const,
      required: true,
      placeholder: '',
    },
    {
      id: 'availability',
      label: '',
      type: 'text' as const,
      required: false,
      placeholder: '',
    },
  ]).map((question, index) => ({
    id: question.id || `q${index + 1}`,
    label: question.label,
    type: question.type,
    required: question.required,
    placeholder: question.placeholder || '',
  }))
}

export function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  if ('errors' in payload && payload.errors && typeof payload.errors === 'object') {
    const firstError = Object.values(payload.errors)
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .find((value): value is string => typeof value === 'string')

    if (firstError) {
      return firstError
    }
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return fallback
}
