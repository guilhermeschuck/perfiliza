'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileUp,
  User,
  Briefcase,
  FileSearch,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCandidatePanel } from '@/contexts/candidate-panel-context'

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/candidato'
  },
  {
    title: 'Meu Perfil',
    icon: User,
    href: '/candidato/perfil'
  },
  {
    title: 'Enviar Currículo',
    icon: FileUp,
    href: '/candidato/curriculo'
  },
  {
    title: 'Vagas Disponíveis',
    icon: Briefcase,
    href: '/candidato/vagas'
  },
  {
    title: 'Minhas Candidaturas',
    icon: FileSearch,
    href: '/candidato/candidaturas'
  },
  {
    title: 'Notificações',
    icon: Bell,
    href: '/candidato/notificacoes'
  }
]

export function CandidatoSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { profileCompletion, unreadNotifications, isLoading } = useCandidatePanel()
  const clampedProfileCompletion = Math.max(0, Math.min(100, profileCompletion))

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border px-6 py-4">
        <Link href="/candidato" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Perfiliza</span>
            <span className="text-xs text-muted-foreground">Portal do Candidato</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/candidato' && pathname.startsWith(item.href))
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        'w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive 
                          ? 'bg-chart-4/10 text-chart-4' 
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.href === '/candidato/notificacoes' && unreadNotifications > 0 && (
                          <Badge variant="secondary" className="ml-auto h-5 w-5 shrink-0 justify-center p-0 text-xs">
                            {unreadNotifications}
                          </Badge>
                        )}
                        {isActive && !(item.href === '/candidato/notificacoes' && unreadNotifications > 0) && (
                          <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Seu Status
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="rounded-lg border border-border bg-card p-4 mx-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Perfil Completo</span>
                <span className="text-sm font-semibold text-chart-4">
                  {isLoading ? '--' : `${clampedProfileCompletion}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-chart-4 rounded-full" style={{ width: `${clampedProfileCompletion}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Complete seu perfil para aumentar suas chances
              </p>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-chart-4/10 text-chart-4 text-sm font-medium">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'CA'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium">{user?.name || 'Candidato'}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2" asChild>
            <Link href="/candidato/configuracoes">
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
