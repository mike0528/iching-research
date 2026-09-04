import type { ReviewStatus } from '../../domain/iching/types'

export const REVIEW_STORAGE_KEY = 'iching-research:line-review-draft'

export interface ReviewDraftItem {
  text: string
  xiaoxiang: string
  commentary: string
  status: ReviewStatus
  note: string
}

export interface ReviewDraft {
  schemaVersion: 'iching-line-review-draft-v1'
  items: Record<string, ReviewDraftItem>
}

export function createReviewDraft(): ReviewDraft {
  return {
    schemaVersion: 'iching-line-review-draft-v1',
    items: {},
  }
}

export function updateReviewItem(draft: ReviewDraft, id: string, item: ReviewDraftItem): ReviewDraft {
  return {
    ...draft,
    items: {
      ...draft.items,
      [id]: item,
    },
  }
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === '待校訂' || value === '需複核' || value === '已校訂'
}

function isReviewDraftItem(value: unknown): value is ReviewDraftItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ReviewDraftItem>
  return typeof item.text === 'string'
    && (item.xiaoxiang === undefined || typeof item.xiaoxiang === 'string')
    && (item.commentary === undefined || typeof item.commentary === 'string')
    && isReviewStatus(item.status)
    && typeof item.note === 'string'
}

export function parseReviewDraft(raw: string | null): ReviewDraft | null {
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const draft = parsed as Partial<ReviewDraft>
    if (draft.schemaVersion !== 'iching-line-review-draft-v1' || !draft.items || typeof draft.items !== 'object') return null
    if (!Object.values(draft.items).every(isReviewDraftItem)) return null
    const items = Object.fromEntries(Object.entries(draft.items).map(([id, value]) => {
      const item = value as ReviewDraftItem
      return [id, { ...item, xiaoxiang: item.xiaoxiang ?? '', commentary: item.commentary ?? '' }]
    }))
    return {
      schemaVersion: draft.schemaVersion,
      items,
    }
  } catch {
    return null
  }
}

export function loadReviewDraft(storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage): ReviewDraft {
  try {
    return parseReviewDraft(storage?.getItem(REVIEW_STORAGE_KEY) ?? null) ?? createReviewDraft()
  } catch {
    return createReviewDraft()
  }
}

export function saveReviewDraft(draft: ReviewDraft, storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage): void {
  try {
    storage?.setItem(REVIEW_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // 儲存失敗時仍保留目前頁面的編輯狀態。
  }
}
