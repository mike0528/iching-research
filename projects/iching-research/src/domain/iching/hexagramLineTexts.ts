import lineDataset from '../../data/iching/line-records.json'
import type { HexagramLineRecord, SpecialLineRecord } from './types'

const records = lineDataset.records as unknown as HexagramLineRecord[]

export const HEXAGRAM_LINE_RECORDS = records
export const SPECIAL_LINE_RECORDS = lineDataset.specialLines as unknown as SpecialLineRecord[]

export const HEXAGRAM_LINE_TEXTS: Record<number, HexagramLineRecord[]> = records.reduce<Record<number, HexagramLineRecord[]>>((grouped, record) => {
  grouped[record.hexagramSequence] ??= []
  grouped[record.hexagramSequence].push(record)
  return grouped
}, {})
