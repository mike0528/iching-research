export type Polarity = 'yin' | 'yang'
export type LineValue = 6 | 7 | 8 | 9
export type ReviewStatus = '待校訂' | '需複核' | '已校訂'
export type TrigramName = '乾' | '坤' | '震' | '巽' | '坎' | '離' | '兌' | '艮'

export interface YarrowChange {
  initialStalks: number
  leftStalks: number
  rightStalks: number
  rightAfterHangingOne: number
  leftRemainder: number
  rightRemainder: number
  overCount: number
  remainingStalks: number
}

export interface YarrowLineResult {
  value: LineValue
  polarity: Polarity
  isChanging: boolean
  changes: YarrowChange[]
}

export interface HexagramText {
  judgment: string
  tuan: string
  greatImage: string
  commentary?: string
  reviewStatus: ReviewStatus
}

export interface SourceReference {
  sourcePath: string
  sourceLine: number
}

export interface HexagramLineText {
  position: number
  name: string
  text: string
  xiaoxiang: string
  commentary: string
  reviewStatus: ReviewStatus
}

export interface HexagramLineRecord extends HexagramLineText {
  id: string
  hexagramSequence: number
  hexagramName: string
  sourceRef: SourceReference
}

export interface SpecialLineRecord {
  id: string
  hexagramSequence: number
  hexagramName: string
  name: '用九' | '用六'
  text: string
  reviewStatus: ReviewStatus
  sourceRef: SourceReference
}

export interface HexagramDefinition {
  sequence: number
  name: string
  upper: TrigramName
  lower: TrigramName
}

export type AdjacentRelationKind = '承陽' | '乘剛'

export interface AdjacentRelation {
  kind: AdjacentRelationKind
  linePosition: number
  adjacentPosition: number
  ruleVersion: 'general-adjacent-yin-yang-v1'
}

export interface LineStructure {
  position: number
  value: LineValue
  polarity: Polarity
  isCorrectPosition: boolean
  isCentral: boolean
  correspondingPosition: number
  correspondenceStatus: '正應' | '無正應'
  adjacentRelations: AdjacentRelation[]
}
