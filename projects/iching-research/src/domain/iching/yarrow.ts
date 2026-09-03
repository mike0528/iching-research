import { linePolarity } from './lines'
import type { LineValue, YarrowChange, YarrowLineResult } from './types'

export interface RandomSource {
  next(): number
}

const systemRandom: RandomSource = {
  next: () => Math.random(),
}

function randomSplit(stalks: number, random: RandomSource): number {
  if (stalks < 2) {
    throw new Error('分草時至少需要兩根蓍草')
  }

  const sample = Math.min(Math.max(random.next(), 0), 0.9999999999999999)
  return 1 + Math.floor(sample * (stalks - 1))
}

function remainderByFour(stalks: number): number {
  const remainder = stalks % 4
  return remainder === 0 ? 4 : remainder
}

/** 執行一變的分二、掛一、揲四、歸奇。 */
export function performYarrowChange(
  initialStalks: number,
  random: RandomSource = systemRandom,
): YarrowChange {
  if (initialStalks !== 49 && initialStalks !== 40 && initialStalks !== 44 && initialStalks !== 32 && initialStalks !== 36 && initialStalks !== 28) {
    throw new Error(`不支援的起始蓍草數：${initialStalks}`)
  }

  const leftStalks = randomSplit(initialStalks, random)
  const rightStalks = initialStalks - leftStalks
  const rightAfterHangingOne = rightStalks - 1
  const leftRemainder = remainderByFour(leftStalks)
  const rightRemainder = remainderByFour(rightAfterHangingOne)
  const overCount = 1 + leftRemainder + rightRemainder

  return {
    initialStalks,
    leftStalks,
    rightStalks,
    rightAfterHangingOne,
    leftRemainder,
    rightRemainder,
    overCount,
    remainingStalks: initialStalks - overCount,
  }
}

function valueFromMajorCount(majorCount: number): LineValue {
  if (majorCount === 0) return 6
  if (majorCount === 1) return 8
  if (majorCount === 2) return 7
  return 9
}

/** 三變後，以 4／5 為少數、8／9 為多數，得到一爻。 */
export function lineFromChanges(changes: YarrowChange[]): YarrowLineResult {
  if (changes.length !== 3) {
    throw new Error('三變完成後才能得到一爻')
  }

  const majorCount = changes.filter((change) => change.overCount === 8 || change.overCount === 9).length
  const value = valueFromMajorCount(majorCount)

  return {
    value,
    polarity: linePolarity(value),
    isChanging: value === 6 || value === 9,
    changes,
  }
}

export function simulateLine(random: RandomSource = systemRandom): YarrowLineResult {
  let stalks = 49
  const changes: YarrowChange[] = []

  for (let index = 0; index < 3; index += 1) {
    const change = performYarrowChange(stalks, random)
    changes.push(change)
    stalks = change.remainingStalks
  }

  return lineFromChanges(changes)
}

export function simulateCast(random: RandomSource = systemRandom): YarrowLineResult[] {
  const lines: YarrowLineResult[] = []

  for (let position = 0; position < 6; position += 1) {
    lines.push(simulateLine(random))
  }

  return lines
}
