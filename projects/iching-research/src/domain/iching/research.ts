import { TRIGRAM_BITS } from './hexagrams'
import { isYangLine, linePolarity } from './lines'
import { analyzeLines } from './relationships'
import type { HexagramDefinition, HexagramLineRecord, LineStructure, LineValue, Polarity, TrigramName } from './types'

export type ResearchRelationFilter = '承陽' | '乘剛' | '無承乘'

export interface PolarityCounts {
  yin: number
  yang: number
}

export interface PolarityRun {
  polarity: Polarity
  startPosition: number
  endPosition: number
  length: number
}

export interface HexagramResearchProfile {
  hexagram: HexagramDefinition
  values: LineValue[]
  pattern: string
  structures: LineStructure[]
  totalCounts: PolarityCounts
  lowerCounts: PolarityCounts
  upperCounts: PolarityCounts
  runs: PolarityRun[]
}

export interface ResearchFilter {
  selectedLinePosition: number
  upperTrigram?: TrigramName
  lowerTrigram?: TrigramName
  samePosition: boolean
  polarity?: Polarity
  positionStatus?: '得位' | '失位'
  centralStatus?: '得中' | '不中'
  correspondenceStatus?: '正應' | '無正應'
  adjacentRelation?: ResearchRelationFilter
  runPolarity?: Polarity
  minimumRunLength?: 2 | 3 | 4
  runIncludesSelectedLine?: boolean
}

export interface ResearchMatch {
  profile: HexagramResearchProfile
  line: HexagramLineRecord
  structure: LineStructure
}

function counts(values: readonly LineValue[]): PolarityCounts {
  return values.reduce<PolarityCounts>((result, value) => {
    result[linePolarity(value)] += 1
    return result
  }, { yin: 0, yang: 0 })
}

function runs(values: readonly LineValue[]): PolarityRun[] {
  const result: PolarityRun[] = []
  let startPosition = 1
  let currentPolarity = linePolarity(values[0])

  for (let index = 1; index <= values.length; index += 1) {
    const nextPolarity = index < values.length ? linePolarity(values[index]) : null
    if (nextPolarity === currentPolarity) continue
    result.push({
      polarity: currentPolarity,
      startPosition,
      endPosition: index,
      length: index - startPosition + 1,
    })
    startPosition = index + 1
    if (nextPolarity) currentPolarity = nextPolarity
  }

  return result
}

export function valuesForHexagram(hexagram: HexagramDefinition): LineValue[] {
  return `${TRIGRAM_BITS[hexagram.lower]}${TRIGRAM_BITS[hexagram.upper]}`
    .split('')
    .map((bit) => bit === '1' ? 7 : 8) as LineValue[]
}

export function buildResearchProfile(hexagram: HexagramDefinition): HexagramResearchProfile {
  const values = valuesForHexagram(hexagram)
  return {
    hexagram,
    values,
    pattern: values.map((value) => isYangLine(value) ? '1' : '0').join(''),
    structures: analyzeLines(values),
    totalCounts: counts(values),
    lowerCounts: counts(values.slice(0, 3)),
    upperCounts: counts(values.slice(3, 6)),
    runs: runs(values),
  }
}

function matchesRun(profile: HexagramResearchProfile, linePosition: number, filter: ResearchFilter): boolean {
  const minimumRunLength = filter.minimumRunLength
  if (!minimumRunLength) return true
  const candidates = profile.runs.filter((run) => {
    const matchesPolarity = !filter.runPolarity || run.polarity === filter.runPolarity
    const matchesLength = run.length >= minimumRunLength
    const includesLine = !filter.runIncludesSelectedLine || (linePosition >= run.startPosition && linePosition <= run.endPosition)
    return matchesPolarity && matchesLength && includesLine
  })
  return candidates.length > 0
}

function matchesRelation(structure: LineStructure, relation?: ResearchRelationFilter): boolean {
  if (!relation) return true
  if (relation === '無承乘') return structure.adjacentRelations.length === 0
  return structure.adjacentRelations.some((item) => item.kind === relation)
}

export function matchesResearchFilter(profile: HexagramResearchProfile, linePosition: number, filter: ResearchFilter): boolean {
  const { hexagram, structures } = profile
  const structure = structures[linePosition - 1]
  if (!structure) return false
  if (filter.samePosition && linePosition !== filter.selectedLinePosition) return false
  if (filter.upperTrigram && hexagram.upper !== filter.upperTrigram) return false
  if (filter.lowerTrigram && hexagram.lower !== filter.lowerTrigram) return false
  if (filter.polarity && structure.polarity !== filter.polarity) return false
  if (filter.positionStatus && (structure.isCorrectPosition ? '得位' : '失位') !== filter.positionStatus) return false
  if (filter.centralStatus && (structure.isCentral ? '得中' : '不中') !== filter.centralStatus) return false
  if (filter.correspondenceStatus && structure.correspondenceStatus !== filter.correspondenceStatus) return false
  if (!matchesRelation(structure, filter.adjacentRelation)) return false
  return matchesRun(profile, linePosition, filter)
}

export function findResearchMatches(
  profiles: readonly HexagramResearchProfile[],
  records: readonly HexagramLineRecord[],
  filter: ResearchFilter,
): ResearchMatch[] {
  const recordsById = new Map(records.map((record) => [record.id, record]))
  return profiles.flatMap((profile) => profile.structures.flatMap((structure) => {
    if (!matchesResearchFilter(profile, structure.position, filter)) return []
    const line = recordsById.get(`${profile.hexagram.sequence}-${structure.position}`)
    return line ? [{ profile, line, structure }] : []
  }))
}
