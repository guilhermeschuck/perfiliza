'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CircleCheck, Clock3, ExternalLink } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useCandidatePanel } from '@/contexts/candidate-panel-context'

interface CandidateNotification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  href: string
}

interface NotificationsResponse {
  notifications: CandidateNotification[]
}

function getPayloadMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return null
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export default function CandidatoNotificacoesPage() {
  const { user } = useAuth()
  const { syncNotifications } = useCandidatePanel()
  const [notifications, setNotifications] = useState<CandidateNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const candidateId = user?.id ?? '3'

    async function loadNotifications() {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/candidate/notifications?candidateId=${encodeURIComponent(candidateId)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json()) as unknown

        if (!response.ok) {
          throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel carregar notificacoes.')
        }

        if (
          !payload ||
          typeof payload !== 'object' ||
          !('notifications' in payload) ||
          !Array.isArray(payload.notifications)
        ) {
          throw new Error('Resposta invalida para notificacoes.')
        }

        if (!isActive) {
          return
        }

        setNotifications((payload as NotificationsResponse).notifications)
        syncNotifications((payload as NotificationsResponse).notifications)
        setError(null)
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar notificacoes.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      isActive = false
    }
  }, [syncNotifications, user?.id])

  const unreadCount = notifications.filter((notification) => !notification.read).length

  async function markAsRead(notificationId: string) {
    if (!user?.id) {
      return
    }

    setMarkingNotificationId(notificationId)

    try {
      const response = await fetch(`/api/candidate/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ candidateId: user.id }),
      })
      const payload = (await response.json()) as NotificationsResponse | { message?: string }

      if (!response.ok || !('notifications' in payload) || !Array.isArray(payload.notifications)) {
        throw new Error(getPayloadMessage(payload) ?? 'Nao foi possivel marcar notificacao como lida.')
      }

      setNotifications(payload.notifications)
      syncNotifications(payload.notifications)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar notificacao.')
    } finally {
      setMarkingNotificationId(null)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Notificacoes"
        subtitle="Acompanhe atualizacoes das suas candidaturas e etapas de selecao"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{notifications.length}</p>
                <p className="text-sm text-muted-foreground">Total de notificacoes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-chart-4">{unreadCount}</p>
                <p className="text-sm text-muted-foreground">Nao lidas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{notifications.length - unreadCount}</p>
                <p className="text-sm text-muted-foreground">Lidas</p>
              </CardContent>
            </Card>
          </div>

          {isLoading && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">Carregando notificacoes...</CardContent>
            </Card>
          )}

          {!isLoading && error && (
            <Card>
              <CardContent className="p-10 text-center text-destructive">{error}</CardContent>
            </Card>
          )}

          {!isLoading && !error && (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={notification.read ? '' : 'border-chart-4/40 bg-chart-4/5'}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-muted p-2">
                          {notification.read ? (
                            <CircleCheck className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Bell className="h-4 w-4 text-chart-4" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{notification.title}</p>
                            {!notification.read && (
                              <Badge variant="secondary" className="text-xs">
                                Nova
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{notification.message}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {formatDate(notification.createdAt)}
                            </span>
                            <Link
                              href={notification.href}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                                Ver detalhes
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            {!notification.read && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={markingNotificationId === notification.id}
                                onClick={() => void markAsRead(notification.id)}
                              >
                                {markingNotificationId === notification.id ? 'Salvando...' : 'Marcar como lida'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
