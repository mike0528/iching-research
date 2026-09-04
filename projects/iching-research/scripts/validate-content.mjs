#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const inputPath = resolve(process.argv[2] ?? 'src/data/iching/line-records.json')
const dataset = JSON.parse(await readFile(inputPath, 'utf8'))
const errors = []
const warnings = []
const missingXiaoxiang = []
const missingCommentary = []
const reviewStatuses = new Set(['待校訂', '需複核', '已校訂'])

if (dataset.schemaVersion !== 'iching-line-records-v1') errors.push('schemaVersion 不正確')
if (!dataset.source?.sourcePath) errors.push('缺少 dataset.source.sourcePath')
if (!reviewStatuses.has(dataset.source?.reviewStatus)) errors.push('dataset.source.reviewStatus 不是有效校訂狀態')
if (!Array.isArray(dataset.records)) errors.push('records 必須是陣列')
if (!Array.isArray(dataset.specialLines)) errors.push('specialLines 必須是陣列')
if (!dataset.hexagramTexts || typeof dataset.hexagramTexts !== 'object') errors.push('hexagramTexts 必須是物件')

const records = Array.isArray(dataset.records) ? dataset.records : []
const specialLines = Array.isArray(dataset.specialLines) ? dataset.specialLines : []
const hexagramTexts = dataset.hexagramTexts && typeof dataset.hexagramTexts === 'object' ? dataset.hexagramTexts : {}
const ids = new Set()
const sequencePositions = new Map()

for (const record of records) {
  if (ids.has(record.id)) errors.push(`重複 id：${record.id}`)
  ids.add(record.id)

  const required = ['id', 'hexagramSequence', 'hexagramName', 'position', 'name', 'text', 'reviewStatus', 'sourceRef']
  for (const field of required) {
    if (record[field] === undefined || record[field] === null || record[field] === '') errors.push(`${record.id ?? '(無 id)'} 缺少 ${field}`)
  }
  if (!Object.hasOwn(record, 'xiaoxiang')) errors.push(`${record.id} 缺少 xiaoxiang 欄位`)
  if (!Object.hasOwn(record, 'commentary')) errors.push(`${record.id} 缺少 commentary 欄位`)
  if (!record.xiaoxiang) missingXiaoxiang.push(record.id)
  if (!record.commentary) missingCommentary.push(record.id)
  if (!reviewStatuses.has(record.reviewStatus)) errors.push(`${record.id} reviewStatus 不正確`)
  if (!record.sourceRef?.sourcePath || !Number.isInteger(record.sourceRef?.sourceLine)) errors.push(`${record.id} sourceRef 不完整`)
  if (!Number.isInteger(record.hexagramSequence) || record.hexagramSequence < 1 || record.hexagramSequence > 64) errors.push(`${record.id} 卦序超出 1～64`)
  if (!Number.isInteger(record.position) || record.position < 1 || record.position > 6) errors.push(`${record.id} 爻位超出 1～6`)

  const key = record.hexagramSequence
  if (!sequencePositions.has(key)) sequencePositions.set(key, [])
  sequencePositions.get(key).push(record.position)
}

if (Object.keys(hexagramTexts).length !== 64) errors.push(`卦級資料應有 64 筆，實際為 ${Object.keys(hexagramTexts).length}`)
for (let sequence = 1; sequence <= 64; sequence += 1) {
  if (!hexagramTexts[sequence]?.commentary) warnings.push(`第 ${sequence} 卦缺少卦級注內容`)
}

if (records.length !== 384) errors.push(`爻資料總數應為 384，實際為 ${records.length}`)
if (sequencePositions.size !== 64) errors.push(`卦序數量應為 64，實際為 ${sequencePositions.size}`)
for (let sequence = 1; sequence <= 64; sequence += 1) {
  const positions = sequencePositions.get(sequence) ?? []
  if (positions.length !== 6) errors.push(`第 ${sequence} 卦應有 6 爻，實際為 ${positions.length}`)
  if (positions.sort((a, b) => a - b).join(',') !== '1,2,3,4,5,6') errors.push(`第 ${sequence} 卦爻位不完整：${positions.join(',')}`)
}

const specialIds = new Set(specialLines.map((line) => line.id))
if (specialLines.length !== 2) errors.push(`特殊爻應有 2 筆（用九、用六），實際為 ${specialLines.length}`)
if (!specialIds.has('1-用九')) errors.push('缺少乾卦用九')
if (!specialIds.has('2-用六')) errors.push('缺少坤卦用六')
for (const line of specialLines) {
  if (!reviewStatuses.has(line.reviewStatus)) errors.push(`${line.id} reviewStatus 不正確`)
  if (!line.text || !line.sourceRef?.sourcePath || !Number.isInteger(line.sourceRef?.sourceLine)) errors.push(`${line.id} 資料不完整`)
}

if (errors.length > 0) {
  console.error(`資料驗證失敗（${errors.length} 項）`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

if (missingXiaoxiang.length > 0) warnings.push(`缺少小象內容：${missingXiaoxiang.join('、')}`)
if (missingCommentary.length > 0) warnings.push(`缺少爻級注內容：${missingCommentary.join('、')}`)

if (warnings.length > 0) {
  console.warn(`資料驗證警告（${warnings.length} 項）`)
  for (const warning of warnings) console.warn(`- ${warning}`)
}

console.log(JSON.stringify({
  status: 'ok',
  input: inputPath,
  schemaVersion: dataset.schemaVersion,
  hexagrams: sequencePositions.size,
  lines: records.length,
  specialLines: specialLines.length,
  missingXiaoxiang: missingXiaoxiang.length,
  missingCommentary: missingCommentary.length,
  reviewStatus: dataset.source.reviewStatus,
}, null, 2))
