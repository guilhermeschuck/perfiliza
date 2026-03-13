'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UserPlus,
  FileText,
  Briefcase,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  ChevronRight
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

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/empresa'
  },
  {
    title: 'Submeter Candidato',
    icon: UserPlus,
    href: '/empresa/submeter'
  },
  {
    title: 'Minhas Vagas',
    icon: Briefcase,
    href: '/empresa/vagas'
  },
  {
    title: 'Resultados',
    icon: FileText,
    href: '/empresa/resultados'
  },
  {
    title: 'Relatórios',
    icon: BarChart3,
    href: '/empresa/relatorios'
  }
]

export function EmpresaSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border px-6 py-4">
        <Link href="/empresa" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-2">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Perfiliza</span>
            <span className="text-xs text-muted-foreground">Portal da Empresa</span>
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
                  (item.href !== '/empresa' && pathname.startsWith(item.href))
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        'w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive 
                          ? 'bg-chart-2/10 text-chart-2' 
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {isActive && <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
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
            Empresa
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="rounded-lg border border-border bg-card p-4 mx-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                  <Building2 className="h-5 w-5 text-chart-2" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.company || 'TechCorp Brasil'}</p>
                  <p className="text-xs text-muted-foreground">Plano Enterprise</p>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-chart-2/10 text-chart-2 text-sm font-medium">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'EM'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium">{user?.name || 'Empresa'}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2" asChild>
            <Link href="/empresa/configuracoes">
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
