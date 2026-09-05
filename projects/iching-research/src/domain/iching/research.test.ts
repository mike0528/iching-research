import { describe, expect, it } from 'vitest'
import { HEXAGRAMS } from './hexagrams'
import { HEXAGRAM_LINE_RECORDS } from './hexagramLineTexts'
import { buildResearchProfile, findResearchMatches, matchesResearchFilter, valuesForHexagram } from './research'

const profileFor = (sequence: number) => buildResearchProfile(HEXAGRAMS[sequence - 1])

const baseFilter = (selectedLinePosition = 2) => ({
  selectedLinePosition,
  samePosition: true,
})

describe('易理研究室結構資料', () => {
  it('由下往上產生卦的六爻陰陽與 pattern', () => {
    expect(valuesForHexagram(HEXAGRAMS[62])).toEqual([7, 8, 7, 8, 7, 8])
    expect(profileFor(63).pattern).toBe('101010')
  })

  it('統計整卦、下卦與上卦的陰陽數量', () => {
    const profile = profileFor(1)
    expect(profile.totalCounts).toEqual({ yin: 0, yang: 6 })
    expect(profile.lowerCounts).toEqual({ yin: 0, yang: 3 })
    expect(profile.upperCounts).toEqual({ yin: 0, yang: 3 })
  })

  it('找出連續陰陽區段與選定爻是否在區段內', () => {
    const profile = profileFor(1)
    expect(profile.runs).toEqual([{ polarity: 'yang', startPosition: 1, endPosition: 6, length: 6 }])
    expect(matchesResearchFilter(profile, 4, { ...baseFilter(4), minimumRunLength: 4, runPolarity: 'yang', runIncludesSelectedLine: true })).toBe(true)
    expect(matchesResearchFilter(profileFor(63), 4, { ...baseFilter(4), minimumRunLength: 2, runIncludesSelectedLine: true })).toBe(false)
  })

  it('分析中間爻上下鄰居的承陽與乘剛', () => {
    const structure = profileFor(63).structures[1]
    expect(structure.adjacentRelations.map((relation) => relation.kind)).toEqual(['乘剛', '承陽'])
  })

  it('可依下卦與相同爻位尋找比較資料', () => {
    const profiles = HEXAGRAMS.map(buildResearchProfile)
    const matches = findResearchMatches(profiles, HEXAGRAM_LINE_RECORDS, {
      ...baseFilter(2),
      lowerTrigram: '坎',
    })
    expect(matches).toHaveLength(8)
    expect(matches.every((match) => match.profile.hexagram.lower === '坎' && match.line.position === 2)).toBe(true)
  })

  it('關閉相同爻位後可搜尋同一上下卦環境的全部爻位', () => {
    const profiles = HEXAGRAMS.map(buildResearchProfile)
    const matches = findResearchMatches(profiles, HEXAGRAM_LINE_RECORDS, {
      ...baseFilter(2),
      lowerTrigram: '坎',
      samePosition: false,
    })
    expect(matches).toHaveLength(48)
  })
})
