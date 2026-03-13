'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { EmpresaSidebar } from '@/components/dashboard/empresa-sidebar'
import { useAuth } from '@/contexts/auth-context'

export default function EmpresaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, isLoading, isReady } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && user?.role !== 'empresa') {
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
      <EmpresaSidebar />
      <SidebarInset className="flex flex-col">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
