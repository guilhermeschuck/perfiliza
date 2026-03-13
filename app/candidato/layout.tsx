'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { CandidatoSidebar } from '@/components/dashboard/candidato-sidebar'
import { useAuth } from '@/contexts/auth-context'
import { CandidatePanelProvider } from '@/contexts/candidate-panel-context'

export default function CandidatoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, isLoading, isReady } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && user?.role !== 'candidato') {
      router.replace(`/${user?.role}`)
      return
    }

    if (isReady && !isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated, isReady, user, router])

  if (!isReady || (isLoading && !isAuthenticated) || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <CandidatePanelProvider>
        <CandidatoSidebar />
        <SidebarInset className="flex flex-col">
          {children}
        </SidebarInset>
      </CandidatePanelProvider>
    </SidebarProvider>
  )
}
