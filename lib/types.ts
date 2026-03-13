// Tipos de usuário
export type UserRole = 'admin' | 'empresa' | 'candidato'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  company?: string
}

export interface CustomQuestion {
  id: string
  label: string
  type: 'text' | 'textarea'
  required: boolean
  placeholder?: string
}

export interface LeadDiscAnswers {
  dominance: number
  influence: number
  steadiness: number
  conscientiousness: number
}

// Tipos de vaga
export interface Job {
  id: string
  title: string
  company: string
  companyId: string
  department: string
  location: string
  type: 'CLT' | 'PJ' | 'Estágio' | 'Freelancer'
  level: 'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'
  salary?: {
    min: number
    max: number
  }
  description: string
  requirements: string[]
  benefits: string[]
  status: 'active' | 'paused' | 'closed'
  createdAt: string
  applicationsCount: number
  shareToken?: string
  leadCount?: number
  customQuestions?: CustomQuestion[]
}

// Tipos de candidato
export interface Candidate {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  linkedinUrl?: string
  resumeUrl?: string
  resumeFileName?: string
  location: string
  experience: number
  education: string
  skills: string[]
  currentPosition?: string
  currentCompany?: string
  status: 'available' | 'employed' | 'open_to_offers'
  submittedBy?: {
    type: 'empresa' | 'candidato'
    companyId?: string
    companyName?: string
  }
  createdAt: string
}

// Tipos de análise
export interface DISCProfile {
  dominance: number
  influence: number
  steadiness: number
  conscientiousness: number
  primaryType: 'D' | 'I' | 'S' | 'C'
  secondaryType?: 'D' | 'I' | 'S' | 'C'
  description: string
}

export interface NumerologyProfile {
  lifePathNumber: number
  expressionNumber: number
  soulUrgeNumber: number
  personalityNumber: number
  interpretation: string
}

export interface LinkedInAnalysis {
  profileStrength: number
  connectionsCount: string
  endorsementsCount: number
  recommendationsCount: number
  activityLevel: 'low' | 'medium' | 'high'
  topSkills: string[]
  careerProgression: string
}

export interface AIAnalysis {
  overallScore: number
  technicalSkills: number
  softSkills: number
  experienceRelevance: number
  educationMatch: number
  cultureFit: number
  consistencyScore?: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  resumeSignals?: {
    detectedSkillsCount: number
    experienceHintsCount: number
    educationHintsCount: number
    sectionsDetectedCount: number
    textExtractionConfidence: number
    parsedLinkedinUrlsCount?: number
    linkedinMatched?: boolean
  }
  scoreAdjustments?: {
    technicalSkills: number
    experienceRelevance: number
    educationMatch: number
    cultureFit: number
    requested?: {
      technicalSkills: number
      experienceRelevance: number
      educationMatch: number
      cultureFit: number
    }
    reasons: string[]
  }
}

export interface Analysis {
  id: string
  candidateId: string
  jobId?: string
  aiAnalysis: AIAnalysis
  discProfile: DISCProfile
  numerology: NumerologyProfile
  linkedinAnalysis?: LinkedInAnalysis
  compatibilityScore?: number
  consistencyScore?: number
  status: 'pending' | 'in_progress' | 'completed'
  createdAt: string
  completedAt?: string
}

// Tipos de aplicação
export interface Application {
  id: string
  candidateId: string
  candidate: Candidate
  jobId: string
  job: Job
  companyId: string
  analysis?: Analysis
  status: 'submitted' | 'analyzing' | 'analyzed' | 'reviewed' | 'approved' | 'rejected'
  withdrawnByCandidate?: boolean
  withdrawnAt?: string
  submittedAt: string
  notes?: string
}

export interface Lead {
  id: string
  jobId: string
  companyId: string
  name: string
  email: string
  phone: string
  location: string
  linkedinUrl?: string
  resumeUrl?: string
  resumeFileName?: string
  experienceRange: '0-1' | '2-3' | '4-5' | '6+'
  experience: number
  education: string
  skills: string[]
  discAnswers: LeadDiscAnswers
  customAnswers: Array<{
    questionId: string
    question: string
    answer: string
  }>
  status: 'new' | 'submitted'
  createdAt: string
  applicationId?: string | null
}

export type TokenAction =
  | 'campaign_create'
  | 'job_create'
  | 'resume_analysis_start'
  | 'resume_analysis_reprocess'

export type TokenPricing = Record<TokenAction, number>

export interface TokenActionCost {
  action: TokenAction
  label: string
  cost: number
}

export interface CompanyTokenWallet {
  companyId: string
  companyName: string
  balance: number
  purchased: number
  spent: number
  createdAt: string
  updatedAt: string
}

export interface TokenTransaction {
  id: string
  companyId: string
  direction: 'credit' | 'debit'
  action: string
  description: string
  tokens: number
  balanceAfter: number
  metadata: Record<string, unknown>
  createdAt: string
}

// Estatísticas do dashboard
export interface DashboardStats {
  totalCandidates: number
  totalJobs: number
  totalApplications: number
  pendingAnalyses: number
  completedAnalyses: number
  averageCompatibility: number
}
