'use client'

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/contexts/auth-context'
import type { Candidate } from '@/lib/types'

type CandidatePanelProfile = Candidate & {
  bio?: string
  updatedAt?: string
}

type CandidateNotification = {
  id: string
  read: boolean
}

interface CandidatePanelContextValue {
  candidate: CandidatePanelProfile | null
  profileCompletion: number
  notificationsCount: number
  unreadNotifications: number
  isLoading: boolean
  error: string | null
  refreshCandidatePanel: () => Promise<void>
  syncNotifications: (notifications: CandidateNotification[]) => void
}

const CandidatePanelContext = createContext<CandidatePanelContextValue | undefined>(undefined)

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

function computeProfileCompletion(candidate: CandidatePanelProfile | null) {
  if (!candidate) {
    return 0
  }

  const fields = [
    candidate.name,
    candidate.email,
    candidate.phone,
    candidate.location,
    candidate.education,
    candidate.currentPosition,
    candidate.linkedinUrl,
    candidate.skills.length > 0 ? 'ok' : '',
  ]

  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

function isCandidateProfileResponse(
  payload: unknown,
): payload is {
  candidate: CandidatePanelProfile
} {
  return !!payload && typeof payload === 'object' && 'candidate' in payload && !!payload.candidate
}

function isNotificationsResponse(
  payload: unknown,
): payload is {
  notifications: CandidateNotification[]
} {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'notifications' in payload &&
    Array.isArray(payload.notifications)
  )
}

export function CandidatePanelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [candidate, setCandidate] = useState<CandidatePanelProfile | null>(null)
  const [profileCompletion, setProfileCompletion] = useState(0)
  const [notificationsCount, setNotificationsCount] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCandidatePanel = useCallback(async () => {
    const candidateId = user?.id ?? '3'
    setIsLoading(true)

    try {
      const [profileResponse, notificationsResponse] = await Promise.all([
        fetch(`/api/candidate/profile?candidateId=${encodeURIComponent(candidateId)}`, { cache: 'no-store' }),
        fetch(`/api/candidate/notifications?candidateId=${encodeURIComponent(candidateId)}`, { cache: 'no-store' }),
      ])

      const [profilePayload, notificationsPayload] = (await Promise.all([
        profileResponse.json(),
        notificationsResponse.json(),
      ])) as [unknown, unknown]

      if (!profileResponse.ok || !isCandidateProfileResponse(profilePayload)) {
        throw new Error(getPayloadMessage(profilePayload) ?? 'Nao foi possivel carregar dados do candidato.')
      }

      if (!notificationsResponse.ok || !isNotificationsResponse(notificationsPayload)) {
        throw new Error(getPayloadMessage(notificationsPayload) ?? 'Nao foi possivel carregar notificacoes.')
      }

      const nextCandidate = profilePayload.candidate
      const nextNotifications = notificationsPayload.notifications

      startTransition(() => {
        setCandidate(nextCandidate)
        setProfileCompletion(computeProfileCompletion(nextCandidate))
        setNotificationsCount(nextNotifications.length)
        setUnreadNotifications(nextNotifications.filter((notification) => !notification.read).length)
        setError(null)
      })
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Nao foi possivel carregar o painel do candidato.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const syncNotifications = useCallback((notifications: CandidateNotification[]) => {
    setNotificationsCount(notifications.length)
    setUnreadNotifications(notifications.filter((notification) => !notification.read).length)
  }, [])

  useEffect(() => {
    void refreshCandidatePanel()
  }, [refreshCandidatePanel])

  const contextValue = useMemo<CandidatePanelContextValue>(() => ({
    candidate,
    profileCompletion,
    notificationsCount,
    unreadNotifications,
    isLoading,
    error,
    refreshCandidatePanel,
    syncNotifications,
  }), [
    candidate,
    error,
    isLoading,
    notificationsCount,
    profileCompletion,
    refreshCandidatePanel,
    syncNotifications,
    unreadNotifications,
  ])

  return (
    <CandidatePanelContext.Provider value={contextValue}>
      {children}
    </CandidatePanelContext.Provider>
  )
}

export function useCandidatePanel() {
  const context = useContext(CandidatePanelContext)

  if (!context) {
    throw new Error('useCandidatePanel must be used within a CandidatePanelProvider')
  }

  return context
}
