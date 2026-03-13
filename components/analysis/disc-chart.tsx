'use client'

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import type { DISCProfile } from '@/lib/types'

interface DISCChartProps {
  profile: DISCProfile
}

export function DISCChart({ profile }: DISCChartProps) {
  const data = [
    { trait: 'Dominância', value: profile.dominance, fullMark: 100 },
    { trait: 'Influência', value: profile.influence, fullMark: 100 },
    { trait: 'Estabilidade', value: profile.steadiness, fullMark: 100 },
    { trait: 'Conformidade', value: profile.conscientiousness, fullMark: 100 },
  ]

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="trait" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          <Radar
            name="DISC"
            dataKey="value"
            stroke="hsl(var(--chart-2))"
            fill="hsl(var(--chart-2))"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
