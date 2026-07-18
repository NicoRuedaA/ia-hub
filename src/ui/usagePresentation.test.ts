import { describe, expect, it } from 'vitest'
import { calculateUsagePercentage, formatUsagePercentage, getUsageRiskLevel } from './usagePresentation'

describe('usage presentation', () => {
  it('uses the real percentage consistently around risk thresholds', () => {
    const percentage = calculateUsagePercentage({ used: 79.6, limit: 100 })
    expect(percentage).toBe(79.6)
    expect(formatUsagePercentage(percentage)).toBe('79.6%')
    expect(getUsageRiskLevel(percentage)).toBe('watch')
    expect(getUsageRiskLevel(80)).toBe('high')
  })

  it('clamps invalid ranges for progress display', () => {
    expect(calculateUsagePercentage({ used: 10, limit: 0 })).toBe(0)
    expect(calculateUsagePercentage({ used: -5, limit: 100 })).toBe(0)
    expect(calculateUsagePercentage({ used: 150, limit: 100 })).toBe(100)
  })
})
