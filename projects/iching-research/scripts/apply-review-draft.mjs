#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const inputPath = resolve(argument('--input', 'src/data/iching/line-records.json'))
const draftPath = resolve(argument('--draft', 'iching-line-review-draft.json'))
const outputPath = resolve(argument('--output', 'src/data/iching/line-records.reviewed.json'))

const dataset = JSON.parse(await readFile(inputPath, 'utf8'))
const draft = JSON.parse(await readFile(draftPath, 'utf8'))

if (draft.schemaVersion !== 'iching-line-review-draft-v1' || !draft.items || typeof draft.items !== 'object') {
  throw new Error('校訂草稿格式不正確，應為 iching-line-review-draft-v1')
}

const records = dataset.records.map((record) => {
  const item = draft.items[record.id]
  if (!item) return record
  return {
    ...record,
    text: typeof item.text === 'string' ? item.text : record.text,
    xiaoxiang: typeof item.xiaoxiang === 'string' ? item.xiaoxiang : record.xiaoxiang,
    commentary: typeof item.commentary === 'string' ? item.commentary : record.commentary,
    reviewStatus: item.status ?? record.reviewStatus,
    ...(item.note ? { reviewNote: item.note } : {}),
  }
})

const statuses = new Set(records.map((record) => record.reviewStatus))
const reviewStatus = statuses.size === 1 && statuses.has('已校訂')
  ? '已校訂'
  : statuses.has('需複核')
    ? '需複核'
    : '待校訂'

const reviewedDataset = {
  ...dataset,
  source: {
    ...dataset.source,
    reviewStatus,
    reviewDraft: draftPath,
  },
  records,
}

await writeFile(outputPath, `${JSON.stringify(reviewedDataset, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  output: outputPath,
  appliedItems: Object.keys(draft.items).filter((id) => dataset.records.some((record) => record.id === id)).length,
  totalRecords: records.length,
  reviewStatus,
}, null, 2))
