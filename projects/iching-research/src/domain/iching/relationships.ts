import { isYangLine, linePolarity } from './lines'
import type { AdjacentRelation, LineStructure, LineValue } from './types'

export const ADJACENT_RULE_VERSION = 'general-adjacent-yin-yang-v1' as const

export const POSITION_LABELS = ['初', '二', '三', '四', '五', '上'] as const

export function isCorrectPosition(value: LineValue, position: number): boolean {
  const isYangPosition = position === 1 || position === 3 || position === 5
  return isYangLine(value) === isYangPosition
}

export function isCentralPosition(position: number): boolean {
  return position === 2 || position === 5
}

export function correspondingPosition(position: number): number {
  return position <= 3 ? position + 3 : position - 3
}

export function correspondenceStatus(value: LineValue, correspondingValue: LineValue): '正應' | '無正應' {
  return linePolarity(value) !== linePolarity(correspondingValue) ? '正應' : '無正應'
}

export function adjacentRelations(value: LineValue, position: number, allValues: readonly LineValue[]): AdjacentRelation[] {
  if (isYangLine(value)) return []

  const relations: AdjacentRelation[] = []
  const lowerValue = allValues[position - 2]
  const upperValue = allValues[position]

  if (lowerValue !== undefined && isYangLine(lowerValue)) {
    relations.push({
      kind: '乘剛',
      linePosition: position,
      adjacentPosition: position - 1,
      ruleVersion: ADJACENT_RULE_VERSION,
    })
  }

  if (upperValue !== undefined && isYangLine(upperValue)) {
    relations.push({
      kind: '承陽',
      linePosition: position,
      adjacentPosition: position + 1,
      ruleVersion: ADJACENT_RULE_VERSION,
    })
  }

  return relations
}

export function analyzeLine(value: LineValue, position: number, allValues: readonly LineValue[]): LineStructure {
  const partner = correspondingPosition(position)
  const partnerValue = allValues[partner - 1]

  if (partnerValue === undefined) {
    throw new Error(`缺少第 ${partner} 爻，無法判斷應位`)
  }

  return {
    position,
    value,
    polarity: linePolarity(value),
    isCorrectPosition: isCorrectPosition(value, position),
    isCentral: isCentralPosition(position),
    correspondingPosition: partner,
    correspondenceStatus: correspondenceStatus(value, partnerValue),
    adjacentRelations: adjacentRelations(value, position, allValues),
  }
}

export function analyzeLines(values: readonly LineValue[]): LineStructure[] {
  if (values.length !== 6) {
    throw new Error('需要六爻才能分析結構')
  }

  return values.map((value, index) => analyzeLine(value, index + 1, values))
}
