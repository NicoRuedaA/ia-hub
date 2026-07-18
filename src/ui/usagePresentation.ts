import type { UsageLimit } from '../domain/types'

export type UsageRiskLevel = 'normal' | 'watch' | 'high'

export function calculateUsagePercentage(limit: Pick<UsageLimit, 'used' | 'limit'>): number {
  if (limit.limit <= 0) return 0
  return Math.min(Math.max((limit.used / limit.limit) * 100, 0), 100)
}

export function getUsageRiskLevel(percentage: number): UsageRiskLevel {
  if (percentage >= 80) return 'high'
  if (percentage >= 60) return 'watch'
  return 'normal'
}

export function formatUsagePercentage(percentage: number): string {
  const rounded = Math.round(percentage * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
}
