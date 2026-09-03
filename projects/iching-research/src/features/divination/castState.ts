import { lineFromChanges } from '../../domain/iching/yarrow'
import { performYarrowChange } from '../../domain/iching/yarrow'
import type { RandomSource } from '../../domain/iching/yarrow'
import type { YarrowChange, YarrowLineResult } from '../../domain/iching/types'

export const YARROW_OPERATION_COUNT = 4
export const YARROW_CHANGE_COUNT = 18
export const CAST_STORAGE_KEY = 'iching-research:cast-state'

export type CastSnapshot = {
  stalks: number
  lineIndex: number
  changeIndex: number
  stage: number
  activeChange: YarrowChange | null
  lineChanges: YarrowChange[]
  completedLines: YarrowLineResult[]
  lastCompletedLine: YarrowLineResult | null
  completed: boolean
}

export type CastState = CastSnapshot & {
  history: CastSnapshot[]
}

function snapshotOf(state: CastState): CastSnapshot {
  const { history: _history, ...snapshot } = state
  return snapshot
}

export function createCastState(): CastState {
  return {
    stalks: 49,
    lineIndex: 0,
    changeIndex: 0,
    stage: -1,
    activeChange: null,
    lineChanges: [],
    completedLines: [],
    lastCompletedLine: null,
    completed: false,
    history: [],
  }
}

function completeChange(state: CastSnapshot, change: YarrowChange): CastSnapshot {
  const lineChanges = [...state.lineChanges, change]
  const lineComplete = lineChanges.length === 3

  if (!lineComplete) {
    return {
      ...state,
      stalks: change.remainingStalks,
      changeIndex: state.changeIndex + 1,
      stage: -1,
      activeChange: null,
      lineChanges,
    }
  }

  const line = lineFromChanges(lineChanges)
  const completedLines = [...state.completedLines, line]
  const castComplete = state.lineIndex === 5

  return {
    ...state,
    // 每一爻都從 49 根重新開始；上一爻的過揲之數不帶入下一爻。
    stalks: castComplete ? 0 : 49,
    lineIndex: castComplete ? 6 : state.lineIndex + 1,
    changeIndex: castComplete ? 3 : 0,
    stage: -1,
    activeChange: null,
    lineChanges: [],
    completedLines,
    lastCompletedLine: line,
    completed: castComplete,
  }
}

export function advanceCast(state: CastState, random?: RandomSource): CastState {
  if (state.completed) return state

  const history = [...state.history, snapshotOf(state)]
  if (!state.activeChange) {
    return {
      ...state,
      activeChange: performYarrowChange(state.stalks, random),
      stage: 0,
      history,
    }
  }

  if (state.stage < YARROW_OPERATION_COUNT - 1) {
    return {
      ...state,
      stage: state.stage + 1,
      history,
    }
  }

  return {
    ...completeChange(state, state.activeChange),
    history,
  }
}

export function autoCompleteCast(state: CastState, random?: RandomSource): CastState {
  if (state.completed) return state

  const history = [...state.history, snapshotOf(state)]
  const change = state.activeChange ?? performYarrowChange(state.stalks, random)
  return {
    ...completeChange(state, change),
    history,
  }
}

export function completeCast(state: CastState, random?: RandomSource): CastState {
  if (state.completed) return state

  const initialHistory = state.history
  const initialSnapshot = snapshotOf(state)
  let completedState: CastState = { ...state, history: [] }
  while (!completedState.completed) {
    completedState = autoCompleteCast(completedState, random)
  }

  return {
    ...completedState,
    history: [...initialHistory, initialSnapshot],
  }
}

export function undoCast(state: CastState): CastState {
  if (state.history.length === 0) return state

  const previous = state.history[state.history.length - 1]
  return {
    ...previous,
    history: state.history.slice(0, -1),
  }
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isYarrowChange(value: unknown): value is YarrowChange {
  if (!value || typeof value !== 'object') return false
  const change = value as Partial<YarrowChange>
  return [
    change.initialStalks,
    change.leftStalks,
    change.rightStalks,
    change.rightAfterHangingOne,
    change.leftRemainder,
    change.rightRemainder,
    change.overCount,
    change.remainingStalks,
  ].every(isNumber)
}

function isLineResult(value: unknown): value is YarrowLineResult {
  if (!value || typeof value !== 'object') return false
  const line = value as Partial<YarrowLineResult>
  return (line.value === 6 || line.value === 7 || line.value === 8 || line.value === 9)
    && (line.polarity === 'yin' || line.polarity === 'yang')
    && typeof line.isChanging === 'boolean'
    && Array.isArray(line.changes)
    && line.changes.length === 3
    && line.changes.every(isYarrowChange)
}

function isSnapshot(value: unknown): value is CastSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<CastSnapshot>
  return isNumber(snapshot.stalks)
    && isNumber(snapshot.lineIndex)
    && snapshot.lineIndex >= 0 && snapshot.lineIndex <= 6
    && isNumber(snapshot.changeIndex)
    && snapshot.changeIndex >= 0 && snapshot.changeIndex <= 3
    && isNumber(snapshot.stage)
    && snapshot.stage >= -1 && snapshot.stage < YARROW_OPERATION_COUNT
    && (snapshot.activeChange === null || isYarrowChange(snapshot.activeChange))
    && Array.isArray(snapshot.lineChanges)
    && snapshot.lineChanges.length <= 2
    && snapshot.lineChanges.every(isYarrowChange)
    && Array.isArray(snapshot.completedLines)
    && snapshot.completedLines.length <= 6
    && snapshot.completedLines.every(isLineResult)
    && (snapshot.lastCompletedLine === null || isLineResult(snapshot.lastCompletedLine))
    && typeof snapshot.completed === 'boolean'
}

export function parseCastState(raw: string | null): CastState | null {
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const state = parsed as Partial<CastState> & { history?: unknown }
    const history = state.history
    if (!isSnapshot(state) || !Array.isArray(history) || !history.every(isSnapshot)) return null
    return { ...state, history } as CastState
  } catch {
    return null
  }
}

export function loadCastState(storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.sessionStorage): CastState | null {
  try {
    return parseCastState(storage?.getItem(CAST_STORAGE_KEY) ?? null)
  } catch {
    return null
  }
}

export function saveCastState(state: CastState, storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.sessionStorage): void {
  try {
    storage?.setItem(CAST_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 私密瀏覽或儲存空間不足時，起卦仍可在記憶體內繼續。
  }
}

export function clearCastState(storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.sessionStorage): void {
  try {
    storage?.removeItem(CAST_STORAGE_KEY)
  } catch {
    // 清除失敗不應阻止重新起卦。
  }
}
