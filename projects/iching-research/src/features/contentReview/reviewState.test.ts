import { describe, expect, it } from 'vitest'
import { createReviewDraft, parseReviewDraft, updateReviewItem } from './reviewState'

describe('content review draft', () => {
  it('updates one line without changing the source dataset', () => {
    const initial = createReviewDraft()
    const updated = updateReviewItem(initial, '1-1', {
      text: '潛龍勿用。',
      xiaoxiang: '潛龍勿用，陽在下也。',
      commentary: '乾，龍。',
      status: '已校訂',
      note: '已與兩份抽取稿核對。',
    })

    expect(initial.items).toEqual({})
    expect(updated.items['1-1']).toEqual({
      text: '潛龍勿用。',
      xiaoxiang: '潛龍勿用，陽在下也。',
      commentary: '乾，龍。',
      status: '已校訂',
      note: '已與兩份抽取稿核對。',
    })
  })

  it('round-trips and rejects malformed drafts', () => {
    const draft = updateReviewItem(createReviewDraft(), '1-1', {
      text: '潛龍勿用。',
      xiaoxiang: '潛龍勿用，陽在下也。',
      commentary: '乾，龍。',
      status: '需複核',
      note: '',
    })

    expect(parseReviewDraft(JSON.stringify(draft))).toEqual(draft)
    expect(parseReviewDraft('{"schemaVersion":"iching-line-review-draft-v1","items":{"1-1":{"text":true}}}')).toBeNull()
    expect(parseReviewDraft('{"schemaVersion":"iching-line-review-draft-v1","items":{"1-1":{"text":"舊草稿","status":"待校訂","note":""}}}')).toMatchObject({ items: { '1-1': { xiaoxiang: '', commentary: '' } } })
    expect(parseReviewDraft(null)).toBeNull()
  })
})
