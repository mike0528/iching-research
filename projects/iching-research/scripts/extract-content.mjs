#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const inputPath = option('--input')
const outputPath = resolve(option('--output', 'src/data/iching/line-records.json'))
const sourcePath = option('--source', '參考資料/易經六十四卦_白話 Final_Mike 2026.docx')
const inputLabel = option('--input-label', 'UTF-8文字抽取檔')
const overridesPath = resolve(option('--overrides', 'src/data/iching/line-overrides.json'))
let overrides = {}
try {
  const overrideDataset = JSON.parse(await readFile(overridesPath, 'utf8'))
  if (overrideDataset.schemaVersion !== 'iching-line-overrides-v1' || !overrideDataset.records || typeof overrideDataset.records !== 'object') throw new Error(`校訂覆寫格式不正確：${overridesPath}`)
  overrides = overrideDataset.records
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

if (!inputPath) {
  console.error('用法：node scripts/extract-content.mjs --input <UTF-8文字抽取檔> [--output <JSON路徑>]')
  process.exit(1)
}

const input = await readFile(resolve(inputPath), 'utf8')
const firstHeader = '卦一  乾  乾為天  乾上乾下'
const contentStart = input.lastIndexOf(firstHeader)
if (contentStart < 0) throw new Error(`找不到內容起點：${firstHeader}`)

const content = input.slice(contentStart)
const headers = [...content.matchAll(/^卦(?:一|二|三|四|五|六|七|八|九|十)[^\n]*$/gm)]
const lineLabels = /^(初九|初六|九二|六二|九三|六三|九四|六四|九五|六五|上九|上六)(?:：|，|,)(.*)$/

if (headers.length !== 64) throw new Error(`預期 64 個卦章節，實際找到 ${headers.length} 個`)

function sourceLineAt(offset) {
  return input.slice(0, contentStart + offset).split(/\r?\n/).length
}

function cleanContinuation(value) {
  return value.replace(/^===== PAGE \d+ =====$/u, '').replace(/建立者\s+Mike Chang\s+\d+$/u, '').trim()
}

function sectionAfterMarker(lines, markerIndex, endIndex) {
  if (markerIndex < 0) return ''
  const parts = [lines[markerIndex].trim().slice(2)]
  for (let nextIndex = markerIndex + 1; nextIndex < endIndex; nextIndex += 1) {
    const next = lines[nextIndex].trim()
    if (next.startsWith('注：') || next.startsWith('象：') || next.startsWith('總論') || lineLabels.test(next)) break
    const cleaned = cleanContinuation(next)
    if (cleaned) parts.push(cleaned)
  }
  return parts.join('').trim()
}

const records = []
const specialLines = []
const hexagramTexts = {}
for (let index = 0; index < headers.length; index += 1) {
  const header = headers[index]
  const nextStart = index + 1 < headers.length ? headers[index + 1].index : content.length
  const block = content.slice(header.index + header[0].length, nextStart)
  const headerParts = header[0].trim().split(/\s+/)
  const sequence = index + 1
  const hexagramName = headerParts[1]
  const lines = block.split(/\r?\n/)
  const found = []
  const firstLineIndex = lines.findIndex((line) => lineLabels.test(line.trim()))
  const hexagramCommentaryIndex = lines.findIndex((line, lineIndex) => lineIndex < firstLineIndex && line.trim().startsWith('注：'))
  hexagramTexts[sequence] = {
    commentary: sectionAfterMarker(lines, hexagramCommentaryIndex, firstLineIndex < 0 ? lines.length : firstLineIndex),
    sourceLine: hexagramCommentaryIndex >= 0 ? sourceLineAt(header.index + header[0].length + block.slice(0, lines.slice(0, hexagramCommentaryIndex + 1).join('\\n').length).length) : null,
  }

  for (let lineIndex = 0; lineIndex < lines.length && found.length < 6; lineIndex += 1) {
    const match = lines[lineIndex].trim().match(lineLabels)
    if (!match) continue
    if (found.length > 0 && found[found.length - 1].name === match[1]) continue
    const nextLineIndex = lines.findIndex((line, candidateIndex) => candidateIndex > lineIndex && lineLabels.test(line.trim()))
    const lineEnd = nextLineIndex < 0 ? lines.length : nextLineIndex
    const xiaoxiangIndex = lines.findIndex((line, candidateIndex) => candidateIndex > lineIndex && candidateIndex < lineEnd && line.trim().startsWith('象：'))
    const xiaoxiang = sectionAfterMarker(lines, xiaoxiangIndex, lineEnd)
    const commentaryIndex = lines.findIndex((line, candidateIndex) => candidateIndex > lineIndex && candidateIndex < lineEnd && line.trim().startsWith('注：'))
    const commentary = sectionAfterMarker(lines, commentaryIndex, lineEnd)
    found.push({
      position: found.length + 1,
      name: match[1],
      text: match[2].trim(),
      xiaoxiang,
      commentary,
      sourceLine: sourceLineAt(header.index + header[0].length + block.slice(0, lines.slice(0, lineIndex + 1).join('\n').length).length),
    })
  }

  if (found.length !== 6) throw new Error(`${sequence} ${hexagramName} 只找到 ${found.length} 爻`)

  for (const line of found) {
    const id = `${sequence}-${line.position}`
    const override = overrides[id] ?? {}
    records.push({
      id,
      hexagramSequence: sequence,
      hexagramName,
      position: line.position,
      name: line.name,
      text: override.text ?? line.text,
      xiaoxiang: override.xiaoxiang ?? line.xiaoxiang,
      commentary: override.commentary ?? line.commentary,
      reviewStatus: override.status ?? '待校訂',
      ...(override.note ? { reviewNote: override.note } : {}),
      sourceRef: { sourcePath, sourceLine: line.sourceLine },
    })
  }

  const special = block.match(/^(用九|用六)(?:：|，|,)(.*)$/m)
  if (special) {
    specialLines.push({
      id: `${sequence}-${special[1]}`,
      hexagramSequence: sequence,
      hexagramName,
      name: special[1],
      text: special[2].trim(),
      reviewStatus: '待校訂',
      sourceRef: { sourcePath, sourceLine: sourceLineAt(header.index + header[0].length + block.indexOf(special[0])) },
    })
  }
}

const dataset = {
  schemaVersion: 'iching-line-records-v1',
  source: {
    sourcePath,
    extractedInput: inputLabel,
    reviewStatus: '待校訂',
  },
  records,
  specialLines,
  hexagramTexts,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
console.log(`已產生 ${records.length} 筆爻資料與 ${specialLines.length} 筆特殊爻：${outputPath}`)
