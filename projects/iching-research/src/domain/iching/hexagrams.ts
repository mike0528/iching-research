import { isYangLine, transformedLineValue } from './lines'
import type { HexagramDefinition, LineValue, TrigramName } from './types'

// 位元由下往上排列：1 為陽爻，0 為陰爻。
// 因此兌為「上缺」110，巽為「下斷」011。
export const TRIGRAM_BITS: Record<TrigramName, string> = {
  乾: '111',
  坤: '000',
  震: '100',
  巽: '011',
  坎: '010',
  離: '101',
  兌: '110',
  艮: '001',
}

const definitions: Array<[string, TrigramName, TrigramName]> = [
  ['乾', '乾', '乾'], ['坤', '坤', '坤'], ['屯', '坎', '震'], ['蒙', '艮', '坎'],
  ['需', '坎', '乾'], ['訟', '乾', '坎'], ['師', '坤', '坎'], ['比', '坎', '坤'],
  ['小畜', '巽', '乾'], ['履', '乾', '兌'], ['泰', '坤', '乾'], ['否', '乾', '坤'],
  ['同人', '乾', '離'], ['大有', '離', '乾'], ['謙', '坤', '艮'], ['豫', '震', '坤'],
  ['隨', '兌', '震'], ['蠱', '艮', '巽'], ['臨', '坤', '兌'], ['觀', '巽', '坤'],
  ['噬嗑', '離', '震'], ['賁', '艮', '離'], ['剝', '艮', '坤'], ['復', '坤', '震'],
  ['无妄', '乾', '震'], ['大畜', '艮', '乾'], ['頤', '艮', '震'], ['大過', '兌', '巽'],
  ['坎', '坎', '坎'], ['離', '離', '離'], ['咸', '兌', '艮'], ['恒', '震', '巽'],
  ['遯', '乾', '艮'], ['大壯', '震', '乾'], ['晉', '離', '坤'], ['明夷', '坤', '離'],
  ['家人', '巽', '離'], ['睽', '離', '兌'], ['蹇', '坎', '艮'], ['解', '震', '坎'],
  ['損', '艮', '兌'], ['益', '巽', '震'], ['夬', '兌', '乾'], ['姤', '乾', '巽'],
  ['萃', '兌', '坤'], ['升', '坤', '巽'], ['困', '兌', '坎'], ['井', '坎', '巽'],
  ['革', '兌', '離'], ['鼎', '離', '巽'], ['震', '震', '震'], ['艮', '艮', '艮'],
  ['漸', '巽', '艮'], ['歸妹', '震', '兌'], ['豐', '震', '離'], ['旅', '離', '艮'],
  ['巽', '巽', '巽'], ['兌', '兌', '兌'], ['渙', '巽', '坎'], ['節', '坎', '兌'],
  ['中孚', '巽', '兌'], ['小過', '震', '艮'], ['既濟', '坎', '離'], ['未濟', '離', '坎'],
]

export const HEXAGRAMS: HexagramDefinition[] = definitions.map(([name, upper, lower], index) => ({
  sequence: index + 1,
  name,
  upper,
  lower,
}))

function patternForTrigrams(upper: TrigramName, lower: TrigramName): string {
  return `${TRIGRAM_BITS[lower]}${TRIGRAM_BITS[upper]}`
}

const byPattern = new Map(
  HEXAGRAMS.map((hexagram) => [patternForTrigrams(hexagram.upper, hexagram.lower), hexagram]),
)

export function patternFromLines(lines: readonly LineValue[]): string {
  if (lines.length !== 6) {
    throw new Error('需要六爻才能辨識卦象')
  }

  return lines.map((line) => (isYangLine(line) ? '1' : '0')).join('')
}

export function getHexagram(lines: readonly LineValue[]): HexagramDefinition {
  const hexagram = byPattern.get(patternFromLines(lines))
  if (!hexagram) {
    throw new Error('找不到對應的六十四卦')
  }
  return hexagram
}

export function changedLines(lines: readonly LineValue[]): LineValue[] {
  if (lines.length !== 6) {
    throw new Error('需要六爻才能計算之卦')
  }

  return lines.map(transformedLineValue)
}

export function trigramLabel(trigram: TrigramName): string {
  const labels: Record<TrigramName, string> = {
    乾: '天',
    坤: '地',
    震: '雷',
    巽: '風',
    坎: '水',
    離: '火',
    兌: '澤',
    艮: '山',
  }
  return labels[trigram]
}
