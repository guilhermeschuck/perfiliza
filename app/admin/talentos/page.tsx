'use client'

import { useState } from 'react'
import { Search, Filter, MapPin, Briefcase, GraduationCap, Mail, Phone, ExternalLink } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppData } from '@/contexts/app-data-context'

const statusColors = {
  available: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  employed: 'bg-blue-500/10 text-blue-600 border-blue-200',
  open_to_offers: 'bg-amber-500/10 text-amber-600 border-amber-200'
}

const statusLabels = {
  available: 'Disponível',
  employed: 'Empregado',
  open_to_offers: 'Aberto a Propostas'
}

export default function TalentosPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [experienceFilter, setExperienceFilter] = useState('all')
  const { data } = useAppData()

  const filteredCandidates = data.candidates.filter(candidate => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase())) ||
      candidate.currentPosition?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter
    const matchesExperience = experienceFilter === 'all' || 
      (experienceFilter === 'junior' && candidate.experience <= 2) ||
      (experienceFilter === 'pleno' && candidate.experience > 2 && candidate.experience <= 5) ||
      (experienceFilter === 'senior' && candidate.experience > 5)
    return matchesSearch && matchesStatus && matchesExperience
  })

  return (
    <>
      <DashboardHeader 
        title="Banco de Talentos" 
        subtitle="Explore e gerencie candidatos disponíveis"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, habilidade ou cargo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="employed">Empregado</SelectItem>
                    <SelectItem value="open_to_offers">Aberto a Propostas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Experiência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toda experiência</SelectItem>
                    <SelectItem value="junior">Júnior (0-2 anos)</SelectItem>
                    <SelectItem value="pleno">Pleno (3-5 anos)</SelectItem>
                    <SelectItem value="senior">Sênior (5+ anos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data.candidates.length}</p>
                <p className="text-sm text-muted-foreground">Total de Talentos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {data.candidates.filter(c => c.status === 'available').length}
                </p>
                <p className="text-sm text-muted-foreground">Disponíveis</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {data.candidates.filter(c => c.status === 'open_to_offers').length}
                </p>
                <p className="text-sm text-muted-foreground">Abertos a Propostas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {data.candidates.filter(c => c.status === 'employed').length}
                </p>
                <p className="text-sm text-muted-foreground">Empregados</p>
              </CardContent>
            </Card>
          </div>

          {/* Candidates Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCandidates.map((candidate) => (
              <Card key={candidate.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold truncate">{candidate.name}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {candidate.currentPosition || 'Não informado'}
                            </p>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={statusColors[candidate.status]}
                          >
                            {statusLabels[candidate.status]}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{candidate.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-4 w-4 shrink-0" />
                        <span>{candidate.experience} anos de experiência</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        <span className="truncate">{candidate.education}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 4).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {candidate.skills.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{candidate.skills.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border bg-muted/30 px-6 py-3 flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Phone className="h-4 w-4" />
                      </Button>
                      {candidate.linkedinUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    <Button size="sm">Ver Perfil</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredCandidates.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">Nenhum talento encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  Tente ajustar os filtros de busca
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
