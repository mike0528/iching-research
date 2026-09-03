import type { LineValue, Polarity } from './types'

export function isYangLine(value: LineValue): boolean {
  return value === 7 || value === 9
}

export function linePolarity(value: LineValue): Polarity {
  return isYangLine(value) ? 'yang' : 'yin'
}

export function isChangingLine(value: LineValue): boolean {
  return value === 6 || value === 9
}

export function transformedLineValue(value: LineValue): LineValue {
  if (value === 6) return 7
  if (value === 9) return 8
  return value
}

export function lineLabel(value: LineValue): string {
  if (value === 6) return '老陰'
  if (value === 7) return '少陽'
  if (value === 8) return '少陰'
  return '老陽'
}

export function lineName(value: LineValue, position: number): string {
  const positionLabel = position === 1 ? '初' : position === 6 ? '上' : String(position)
  const polarityLabel = isYangLine(value) ? '九' : '六'
  return `${positionLabel}${polarityLabel}`
}
