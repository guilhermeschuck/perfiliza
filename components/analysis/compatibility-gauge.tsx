'use client'

import { cn } from '@/lib/utils'

interface CompatibilityGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export function CompatibilityGauge({ score, size = 'md' }: CompatibilityGaugeProps) {
  const sizeConfig = {
    sm: { width: 120, strokeWidth: 8, fontSize: 'text-2xl' },
    md: { width: 160, strokeWidth: 10, fontSize: 'text-4xl' },
    lg: { width: 200, strokeWidth: 12, fontSize: 'text-5xl' }
  }

  const config = sizeConfig[size]
  const radius = (config.width - config.strokeWidth) / 2
  const circumference = radius * Math.PI
  const offset = circumference - (score / 100) * circumference

  const getColor = (value: number) => {
    if (value >= 80) return 'stroke-emerald-500'
    if (value >= 60) return 'stroke-chart-4'
    if (value >= 40) return 'stroke-amber-500'
    return 'stroke-red-500'
  }

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={config.width}
        height={config.width / 2 + 20}
        className="transform -rotate-0"
      >
        {/* Background arc */}
        <path
          d={`M ${config.strokeWidth / 2}, ${config.width / 2}
              A ${radius},${radius} 0 0 1 ${config.width - config.strokeWidth / 2},${config.width / 2}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M ${config.strokeWidth / 2}, ${config.width / 2}
              A ${radius},${radius} 0 0 1 ${config.width - config.strokeWidth / 2},${config.width / 2}`}
          fill="none"
          className={cn('transition-all duration-1000 ease-out', getColor(score))}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: config.width / 4 }}>
        <div className="text-center">
          <span className={cn('font-bold', config.fontSize)}>{score}</span>
          <span className="text-lg text-muted-foreground">%</span>
        </div>
      </div>
    </div>
  )
}
