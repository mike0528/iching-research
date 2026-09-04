import { describe, expect, it } from 'vitest'
import { changedLines, getHexagram, HEXAGRAMS, TRIGRAM_BITS, trigramLabel } from './hexagrams'
import { HEXAGRAM_LINE_RECORDS, HEXAGRAM_LINE_TEXTS, SPECIAL_LINE_RECORDS } from './hexagramLineTexts'
import { HEXAGRAM_TEXTS } from './hexagramTexts'
import { analyzeLines } from './relationships'
import { lineFromChanges, performYarrowChange, simulateCast } from './yarrow'
import type { RandomSource } from './yarrow'
import type { LineValue, YarrowChange } from './types'

function fixedRandom(value: number): RandomSource {
  return { next: () => value }
}

function change(overCount: number): YarrowChange {
  return {
    initialStalks: 49,
    leftStalks: 24,
    rightStalks: 25,
    rightAfterHangingOne: 24,
    leftRemainder: overCount === 9 ? 4 : 1,
    rightRemainder: overCount === 9 ? 4 : 3,
    overCount,
    remainingStalks: 49 - overCount,
  }
}

describe('yarrow method', () => {
  it('keeps each change in a valid four-count result', () => {
    const result = performYarrowChange(49, fixedRandom(0.5))

    expect([5, 9]).toContain(result.overCount)
    expect(result.remainingStalks).toBe(49 - result.overCount)
    expect(result.leftRemainder).toBeGreaterThanOrEqual(1)
    expect(result.leftRemainder).toBeLessThanOrEqual(4)
    expect(result.rightRemainder).toBeGreaterThanOrEqual(1)
    expect(result.rightRemainder).toBeLessThanOrEqual(4)
  })

  it('maps three changes to six, seven, eight, or nine', () => {
    expect(lineFromChanges([change(5), change(5), change(5)]).value).toBe(6)
    expect(lineFromChanges([change(5), change(5), change(9)]).value).toBe(8)
    expect(lineFromChanges([change(5), change(9), change(9)]).value).toBe(7)
    expect(lineFromChanges([change(9), change(9), change(9)]).value).toBe(9)
  })

  it('produces six lines from bottom to top', () => {
    const lines = simulateCast(fixedRandom(0.5))

    expect(lines).toHaveLength(6)
    expect(lines.every((line) => [6, 7, 8, 9].includes(line.value))).toBe(true)
    expect(lines.every((line) => line.changes.length === 3)).toBe(true)
    expect(lines.every((line) => line.changes[0].initialStalks === 49)).toBe(true)
  })
})

describe('hexagram and structural analysis', () => {
  it('recognises the all-yang hexagram as 乾', () => {
    expect(getHexagram([7, 7, 7, 7, 7, 7]).name).toBe('乾')
  })

  it('changes six and nine while keeping seven and eight', () => {
    expect(changedLines([6, 7, 8, 9, 7, 8])).toEqual([7, 7, 8, 8, 7, 8])
  })

  it('recognises all 64 hexagrams from their trigram patterns', () => {
    for (const hexagram of HEXAGRAMS) {
      const pattern = `${TRIGRAM_BITS[hexagram.lower]}${TRIGRAM_BITS[hexagram.upper]}`
      const lines = pattern.split('').map((bit) => (bit === '1' ? 7 : 8)) as LineValue[]
      expect(getHexagram(lines)).toEqual(hexagram)
    }
  })

  it('keeps Xun and Dui trigrams distinct in both mapping and display labels', () => {
    const xun = TRIGRAM_BITS['巽'].split('').map((bit) => bit === '1' ? 7 : 8) as LineValue[]
    const dui = TRIGRAM_BITS['兌'].split('').map((bit) => bit === '1' ? 7 : 8) as LineValue[]
    expect(getHexagram([...xun, ...xun])).toMatchObject({ name: '巽', upper: '巽', lower: '巽' })
    expect(getHexagram([...dui, ...dui])).toMatchObject({ name: '兌', upper: '兌', lower: '兌' })
    expect(trigramLabel('巽')).toBe('風')
    expect(trigramLabel('兌')).toBe('澤')
  })

  it('provides judgment, tuan, and great image text for every hexagram', () => {
    expect(Object.keys(HEXAGRAM_TEXTS)).toHaveLength(64)
    for (const sequence of HEXAGRAMS.map((hexagram) => hexagram.sequence)) {
      const text = HEXAGRAM_TEXTS[sequence]
      expect(text.judgment.length).toBeGreaterThan(0)
      expect(text.tuan.length).toBeGreaterThan(0)
      expect(text.greatImage.length).toBeGreaterThan(0)
      expect(text.commentary?.length).toBeGreaterThan(0)
      expect(text.reviewStatus).toBe('待校訂')
    }
  })

  it('provides six line texts for every hexagram', () => {
    expect(Object.keys(HEXAGRAM_LINE_TEXTS)).toHaveLength(64)
    expect(HEXAGRAM_LINE_RECORDS).toHaveLength(384)
    expect(SPECIAL_LINE_RECORDS.map((line) => line.name)).toEqual(['用九', '用六'])
    expect(HEXAGRAM_LINE_RECORDS.find((line) => line.id === '11-6')?.xiaoxiang).toBe('城復于隍，其命亂也。')
    expect(HEXAGRAM_LINE_RECORDS.find((line) => line.id === '30-6')?.xiaoxiang).toBe('王用出征，以正邦也。')
    for (const sequence of HEXAGRAMS.map((hexagram) => hexagram.sequence)) {
      const lines = HEXAGRAM_LINE_TEXTS[sequence]
      expect(lines).toHaveLength(6)
      expect(lines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6])
      expect(lines.every((line) => line.text.length > 0 && typeof line.xiaoxiang === 'string' && typeof line.commentary === 'string' && line.reviewStatus === '待校訂' && line.sourceRef.sourcePath.length > 0)).toBe(true)
    }
    expect(HEXAGRAM_LINE_RECORDS.filter((line) => !line.xiaoxiang).map((line) => line.id)).toEqual([])
  })

  it('marks position and central status separately', () => {
    const structures = analyzeLines([7, 8, 7, 7, 7, 8])

    expect(structures[0].isCorrectPosition).toBe(true)
    expect(structures[0].correspondenceStatus).toBe('無正應')
    expect(structures[1].isCentral).toBe(true)
    expect(structures[1].isCorrectPosition).toBe(true)
    expect(structures[4].isCentral).toBe(true)
    expect(structures[4].correspondenceStatus).toBe('正應')
  })

  it('marks yin lines carrying or receiving yang lines nearby', () => {
    const structures = analyzeLines([7, 8, 8, 7, 8, 7])

    expect(structures[1].adjacentRelations).toEqual([{
      kind: '乘剛',
      linePosition: 2,
      adjacentPosition: 1,
      ruleVersion: 'general-adjacent-yin-yang-v1',
    }])
    expect(structures[2].adjacentRelations).toEqual([{
      kind: '承陽',
      linePosition: 3,
      adjacentPosition: 4,
      ruleVersion: 'general-adjacent-yin-yang-v1',
    }])
    expect(structures[4].adjacentRelations).toEqual([
      {
        kind: '乘剛',
        linePosition: 5,
        adjacentPosition: 4,
        ruleVersion: 'general-adjacent-yin-yang-v1',
      },
      {
        kind: '承陽',
        linePosition: 5,
        adjacentPosition: 6,
        ruleVersion: 'general-adjacent-yin-yang-v1',
      },
    ])
  })
})
