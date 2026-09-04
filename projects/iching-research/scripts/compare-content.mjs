#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const docxPath = option('--docx')
const pdfPath = option('--pdf')
const outputPath = resolve(option('--output', 'reports/content-diff.json'))
const markdownPath = resolve(option('--markdown', outputPath.replace(/\.json$/u, '.md')))
const docxLabel = option('--docx-label', 'DOCX 文字抽取稿')
const pdfLabel = option('--pdf-label', 'PDF 文字抽取稿')
const lineLabels = /^(初九|初六|九二|六二|九三|六三|九四|六四|九五|六五|上九|上六)(?:：|，|,)(.*)$/u
const boundary = /^(釋|彖|象|注|總論|卦(?:一|二|三|四|五|六|七|八|九|十)|===== PAGE|建立者)/u

if (!docxPath || !pdfPath) {
  console.error('用法：node scripts/compare-content.mjs --docx <DOCX文字抽取稿> --pdf <PDF文字抽取稿> [--output <JSON>] [--markdown <Markdown>]')
  process.exit(1)
}

async function readSource(filePath) {
  return readFile(resolve(filePath), 'utf8')
}

function cleanLine(value) {
  return value
    .replace(/建立者\s+Mike Chang\s+\d+$/u, '')
    .replace(/^===== PAGE \d+ =====$/u, '')
    .replace(/\s+/gu, '')
    .trim()
}

function sourceLineAt(text, offset) {
  return text.slice(0, offset).split(/\r?\n/u).length
}

function sectionAfterMarker(lines, markerIndex, endIndex) {
  if (markerIndex < 0) return ''
  const parts = [lines[markerIndex].trim().slice(2)]
  for (let nextIndex = markerIndex + 1; nextIndex < endIndex; nextIndex += 1) {
    const next = lines[nextIndex].trim()
    if (next.startsWith('注：') || next.startsWith('象：') || next.startsWith('總論') || lineLabels.test(next)) break
    const cleaned = cleanLine(next)
    if (cleaned) parts.push(cleaned)
  }
  return parts.join('').trim()
}

function parseSource(text, sourcePath) {
  const firstHeader = '卦一  乾  乾為天  乾上乾下'
  const contentStart = text.lastIndexOf(firstHeader)
  if (contentStart < 0) throw new Error(`${sourcePath} 找不到內容起點`)
  const content = text.slice(contentStart)
  const headers = [...content.matchAll(/^卦(?:一|二|三|四|五|六|七|八|九|十)[^\n]*$/gmu)]
  if (headers.length !== 64) throw new Error(`${sourcePath} 預期 64 個卦章節，實際找到 ${headers.length} 個`)

  const records = new Map()
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]
    const nextStart = index + 1 < headers.length ? headers[index + 1].index : content.length
    const blockStart = header.index + header[0].length
    const block = content.slice(blockStart, nextStart)
    const headerParts = header[0].trim().split(/\s+/u)
    const sequence = index + 1
    const hexagramName = headerParts[1]
    const lines = block.split(/\r?\n/u)
    let found = 0

    for (let lineIndex = 0; lineIndex < lines.length && found < 6; lineIndex += 1) {
      const raw = lines[lineIndex].trim()
      const match = raw.match(lineLabels)
      if (!match) continue
      if (found > 0 && [...records.values()].at(-1)?.name === match[1]) continue
      found += 1
      const textParts = [match[2]]
      for (let nextIndex = lineIndex + 1; nextIndex < lines.length; nextIndex += 1) {
        const next = lines[nextIndex].trim()
        if (lineLabels.test(next) || boundary.test(next)) break
        const cleaned = cleanLine(next)
        if (cleaned) textParts.push(cleaned)
      }
      const nextLineIndex = lines.findIndex((line, candidateIndex) => candidateIndex > lineIndex && lineLabels.test(line.trim()))
      const lineEnd = nextLineIndex < 0 ? lines.length : nextLineIndex
      const xiaoxiangIndex = lines.findIndex((line, candidateIndex) => candidateIndex > lineIndex && candidateIndex < lineEnd && line.trim().startsWith('象：'))
      const xiaoxiang = sectionAfterMarker(lines, xiaoxiangIndex, lineEnd)
      const commentaryIndex = lines.findIndex((line, candidateIndex) => candidateIndex > lineIndex && candidateIndex < lineEnd && line.trim().startsWith('注：'))
      const commentary = sectionAfterMarker(lines, commentaryIndex, lineEnd)
      const id = `${sequence}-${found}`
      const offsetBeforeLine = lines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? lineIndex : 0)
      records.set(id, {
        id,
        hexagramSequence: sequence,
        hexagramName,
        position: found,
        name: match[1],
        text: cleanLine(textParts.join('')),
        xiaoxiang,
        commentary,
        sourceLine: sourceLineAt(text, contentStart + blockStart + offsetBeforeLine),
      })
    }

    if (found !== 6) throw new Error(`${sourcePath} 第 ${sequence} 卦只找到 ${found} 爻`)
  }
  return records
}

function normalize(value) {
  return value
    .replace(/[：:,，。；;]/gu, '')
    .replace(/[「」『』“”"'（）()【】]/gu, '')
    .replace(/\s+/gu, '')
}

function compareRecords(docxRecords, pdfRecords) {
  const ids = [...new Set([...docxRecords.keys(), ...pdfRecords.keys()])].sort((a, b) => {
    const [aSequence, aPosition] = a.split('-').map(Number)
    const [bSequence, bPosition] = b.split('-').map(Number)
    return aSequence - bSequence || aPosition - bPosition
  })
  return ids.map((id) => {
    const docx = docxRecords.get(id) ?? null
    const pdf = pdfRecords.get(id) ?? null
    let status = 'match'
    if (!docx) status = 'missing-docx'
    else if (!pdf) status = 'missing-pdf'
    else if (docx.name !== pdf.name || normalize(docx.text) !== normalize(pdf.text) || normalize(docx.xiaoxiang) !== normalize(pdf.xiaoxiang) || normalize(docx.commentary) !== normalize(pdf.commentary)) status = 'difference'
    return { id, status, docx, pdf }
  })
}

function markdownReport(report) {
  const { summary } = report
  const rows = report.records.filter((record) => record.status !== 'match')
  const lines = [
    '# DOCX／PDF 384 爻差異報告',
    '',
    `- DOCX：${report.sources.docx.label}`,
    `- PDF：${report.sources.pdf.label}`,
    `- 產生時間：${report.generatedAt}`,
    '',
    '## 摘要',
    '',
    `- 完全一致：${summary.match} 筆`,
    `- 文字或爻名差異：${summary.difference} 筆`,
    `- DOCX 缺漏：${summary['missing-docx']} 筆`,
    `- PDF 缺漏：${summary['missing-pdf']} 筆`,
    '',
    '## 待人工校訂項目',
    '',
  ]

  if (rows.length === 0) {
    lines.push('沒有差異。')
    return `${lines.join('\n')}\n`
  }

  lines.push('| ID | 狀態 | DOCX 爻名／爻辭 | PDF 爻名／爻辭 |')
  lines.push('|---|---|---|---|')
  for (const row of rows) {
    const docx = row.docx ? `${row.docx.name}：${row.docx.text}｜小象：${row.docx.xiaoxiang || '缺漏'}｜注：${row.docx.commentary || '缺漏'}` : '缺漏'
    const pdf = row.pdf ? `${row.pdf.name}：${row.pdf.text}｜小象：${row.pdf.xiaoxiang || '缺漏'}｜注：${row.pdf.commentary || '缺漏'}` : '缺漏'
    lines.push(`| ${row.id} | ${row.status} | ${docx.replaceAll('|', '\\|')} | ${pdf.replaceAll('|', '\\|')} |`)
  }
  return `${lines.join('\n')}\n`
}

const [docx, pdf] = await Promise.all([readSource(docxPath), readSource(pdfPath)])
const records = compareRecords(parseSource(docx, docxPath), parseSource(pdf, pdfPath))
const summary = records.reduce((result, record) => {
  result[record.status] += 1
  return result
}, { match: 0, difference: 0, 'missing-docx': 0, 'missing-pdf': 0 })
const report = {
  schemaVersion: 'iching-content-diff-v1',
  generatedAt: new Date().toISOString(),
  sources: { docx: { label: docxLabel }, pdf: { label: pdfLabel } },
  summary,
  records,
}

await mkdir(dirname(outputPath), { recursive: true })
await mkdir(dirname(markdownPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
await writeFile(markdownPath, markdownReport(report), 'utf8')
console.log(JSON.stringify({ output: outputPath, markdown: markdownPath, total: records.length, summary }, null, 2))
