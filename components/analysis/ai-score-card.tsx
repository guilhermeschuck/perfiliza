'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AIScoreCardProps {
  title: string
  score: number
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info'
}

const variantStyles = {
  default: {
    bg: 'bg-muted/50',
    ring: 'stroke-muted-foreground',
    text: 'text-foreground'
  },
  primary: {
    bg: 'bg-primary/5',
    ring: 'stroke-primary',
    text: 'text-primary'
  },
  success: {
    bg: 'bg-emerald-500/5',
    ring: 'stroke-emerald-500',
    text: 'text-emerald-600'
  },
  warning: {
    bg: 'bg-amber-500/5',
    ring: 'stroke-amber-500',
    text: 'text-amber-600'
  },
  info: {
    bg: 'bg-blue-500/5',
    ring: 'stroke-blue-500',
    text: 'text-blue-600'
  }
}

export function AIScoreCard({ title, score, variant = 'default' }: AIScoreCardProps) {
  const styles = variantStyles[variant]
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference

  return (
    <Card className={cn('border-0', styles.bg)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pb-6">
        <div className="relative">
          <svg width="100" height="100" className="-rotate-90">
            <circle
              cx="50"
              cy="50"
              r="36"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="36"
              fill="none"
              className={cn('transition-all duration-1000 ease-out', styles.ring)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-2xl font-bold', styles.text)}>{score}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
