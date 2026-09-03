import { describe, expect, it } from 'vitest'
import { autoCompleteCast, advanceCast, completeCast, createCastState, parseCastState, undoCast } from './castState'
import type { RandomSource } from '../../domain/iching/yarrow'

const fixedRandom: RandomSource = { next: () => 0.5 }

describe('casting state machine', () => {
  it('advances through four operations and completes one change', () => {
    let state = createCastState()

    state = advanceCast(state, fixedRandom)
    expect(state.activeChange).not.toBeNull()
    expect(state.stage).toBe(0)
    expect(state.completedLines).toHaveLength(0)

    state = advanceCast(state, fixedRandom)
    state = advanceCast(state, fixedRandom)
    state = advanceCast(state, fixedRandom)
    expect(state.stage).toBe(3)
    expect(state.lineChanges).toHaveLength(0)

    state = advanceCast(state, fixedRandom)
    expect(state.activeChange).toBeNull()
    expect(state.lineChanges).toHaveLength(1)
    expect(state.completedLines).toHaveLength(0)
    expect([40, 44]).toContain(state.stalks)
  })

  it('auto completion uses the same state transition and resets each new line to 49', () => {
    let state = createCastState()

    for (let change = 0; change < 3; change += 1) {
      state = autoCompleteCast(state, fixedRandom)
    }
    expect(state.completedLines).toHaveLength(1)
    expect(state.stalks).toBe(49)

    for (let change = 0; change < 15; change += 1) {
      state = autoCompleteCast(state, fixedRandom)
    }
    expect(state.completed).toBe(true)
    expect(state.completedLines).toHaveLength(6)
    expect(state.stalks).toBe(0)
  })

  it('completes all six lines in one action and undoes that action as a whole', () => {
    const initial = createCastState()
    const completed = completeCast(initial, fixedRandom)

    expect(completed.completed).toBe(true)
    expect(completed.completedLines).toHaveLength(6)
    expect(completed.history).toHaveLength(1)
    expect(undoCast(completed)).toEqual(initial)
  })

  it('undoes the latest state transition', () => {
    const initial = createCastState()
    const advanced = advanceCast(initial, fixedRandom)

    expect(undoCast(advanced)).toEqual(initial)
    expect(undoCast(initial)).toEqual(initial)
  })
})

describe('cast session persistence', () => {
  it('round-trips a valid cast state', () => {
    const state = advanceCast(createCastState(), fixedRandom)
    expect(parseCastState(JSON.stringify(state))).toEqual(state)
  })

  it('rejects malformed or incomplete session data', () => {
    expect(parseCastState(null)).toBeNull()
    expect(parseCastState('{"stalks":"49"}')).toBeNull()
    expect(parseCastState('not-json')).toBeNull()
  })
})
