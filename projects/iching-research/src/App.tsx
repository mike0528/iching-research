import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { changedLines, getHexagram, HEXAGRAMS, TRIGRAM_BITS, trigramLabel } from './domain/iching/hexagrams'
import { HEXAGRAM_LINE_RECORDS, HEXAGRAM_LINE_TEXTS } from './domain/iching/hexagramLineTexts'
import { HEXAGRAM_TEXTS } from './domain/iching/hexagramTexts'
import { isChangingLine, isYangLine, lineLabel, lineName } from './domain/iching/lines'
import { analyzeLines, POSITION_LABELS } from './domain/iching/relationships'
import type { HexagramDefinition, LineValue, ReviewStatus, YarrowChange } from './domain/iching/types'
import { CAST_STORAGE_KEY, YARROW_CHANGE_COUNT, YARROW_OPERATION_COUNT, advanceCast, autoCompleteCast, clearCastState, completeCast, createCastState, loadCastState, saveCastState, undoCast } from './features/divination/castState'
import type { CastState } from './features/divination/castState'
import { loadReviewDraft, saveReviewDraft, updateReviewItem } from './features/contentReview/reviewState'
import type { ReviewDraft } from './features/contentReview/reviewState'

type View = 'home' | 'setup' | 'cast' | 'result' | 'hexagrams' | 'hexagram-detail' | 'review'

const OPERATION_LABELS = ['分二', '掛一', '揲四', '歸奇']
function currentOperationText(change: YarrowChange, stage: number): string {
  if (stage === 0) return `左手 ${change.leftStalks} 根，右手 ${change.rightStalks} 根。`
  if (stage === 1) return `從右手掛一根，右手計數 ${change.rightAfterHangingOne} 根。`
  if (stage === 2) return `左餘 ${change.leftRemainder}，右餘 ${change.rightRemainder}。`
  return `過揲之數 ${change.overCount}，下一步留下 ${change.remainingStalks} 根。`
}

function PrimaryButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="button button-primary" type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="button button-secondary" type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function Header({ view, onNavigate }: { view: View; onNavigate: (nextView: View) => void }) {
  return (
    <header className="site-header">
      <button className="brand" type="button" onClick={() => onNavigate('home')}>
        <span className="brand-mark" aria-hidden="true">☰</span>
        <span>
          <strong>觀象</strong>
          <small>易經研究工具</small>
        </span>
      </button>
      <nav className="main-nav" aria-label="主要導覽">
        <button className={view === 'setup' || view === 'cast' || view === 'result' ? 'active' : ''} type="button" onClick={() => onNavigate('setup')}>開始卜卦</button>
        <button className={view === 'hexagrams' || view === 'hexagram-detail' ? 'active' : ''} type="button" onClick={() => onNavigate('hexagrams')}>六十四卦</button>
        <button className={view === 'review' ? 'active' : ''} type="button" onClick={() => onNavigate('review')}>資料校訂</button>
        <button type="button" onClick={() => onNavigate('home')}>使用說明</button>
      </nav>
    </header>
  )
}

function HomeView({ onStart, onBrowse }: { onStart: () => void; onBrowse: () => void }) {
  return (
    <main className="page home-page">
      <section className="hero-section">
        <div className="eyebrow">ICHING / RESEARCH TOOL</div>
        <h1>先觀其象，<br /><em>再讀其辭。</em></h1>
        <p className="hero-copy">透過逐步互動的揲蓍法，完成六爻十八變。從本卦、變爻與之卦開始，建立一條可以回到原文的閱讀路徑。</p>
        <div className="hero-actions">
          <PrimaryButton onClick={onStart}>開始揲蓍法 <span aria-hidden="true">↗</span></PrimaryButton>
          <SecondaryButton onClick={onBrowse}>瀏覽六十四卦</SecondaryButton>
        </div>
        <p className="quiet-note"><span className="status-dot" aria-hidden="true" />第一版：結構分析與經文查閱，不產生個人化吉凶結論。</p>
      </section>
      <section className="feature-grid" aria-label="功能特色">
        <article className="feature-card">
          <span className="feature-number">01</span>
          <h2>逐步揲蓍</h2>
          <p>看見分二、掛一、揲四、歸奇，理解三變成一爻。</p>
        </article>
        <article className="feature-card feature-card-accent">
          <span className="feature-number">02</span>
          <h2>辨識變化</h2>
          <p>清楚分辨本卦、變爻與之卦，從下往上讀六爻。</p>
        </article>
        <article className="feature-card">
          <span className="feature-number">03</span>
          <h2>回到經文</h2>
          <p>所有變爻集中呈現，保留原文、注釋與來源校訂狀態。</p>
        </article>
      </section>
    </main>
  )
}

function SetupView({ onStart }: { onStart: (question: string) => void }) {
  const [question, setQuestion] = useState('')

  return (
    <main className="page narrow-page">
      <div className="page-heading">
        <div className="eyebrow">01 / SETUP</div>
        <h1>開始一次卦象研究</h1>
        <p>問題可以留白。它只會保存在本次瀏覽結果中，不會被送往第三方服務，也不會用來產生自動占斷。</p>
      </div>
      <section className="panel setup-panel">
        <label className="field-label" htmlFor="question">這次想研究的問題 <span>可選</span></label>
        <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：我想理解這項計畫目前的結構……" rows={4} />
        <div className="method-card">
          <div>
            <span className="field-label">起卦方式</span>
            <strong>揲蓍法</strong>
          </div>
          <span className="method-count">50 → 49 根<br />3 變／爻 · 18 變／卦</span>
        </div>
        <div className="info-callout">
          <strong>這會怎麼進行？</strong>
          <p>每一變會依序經過四營。你可以逐步查看，也可以使用「自動完成本變」快速完成目前這一變。</p>
        </div>
        <PrimaryButton onClick={() => onStart(question)}>開始第 1 爻 <span aria-hidden="true">→</span></PrimaryButton>
      </section>
    </main>
  )
}

function StalkFigure({ value, position, changing = false }: { value: LineValue; position: number; changing?: boolean }) {
  const yang = isYangLine(value)
  return (
    <div className={`line-row ${changing ? 'is-changing' : ''}`}>
      <span className="line-position">{position === 1 ? '初' : position === 6 ? '上' : position}</span>
      <span className="line-name">{lineName(value, position)}</span>
      <span className={`line-shape ${yang ? 'yang' : 'yin'}`} aria-hidden="true">
        {yang ? <i /> : <><i /><i /></>}
      </span>
      <span className="line-state">{lineLabel(value)}{changing ? ' · 動' : ''}</span>
    </div>
  )
}

function HexagramFigure({ values, label }: { values: readonly LineValue[]; label: string }) {
  return (
    <div className="figure-card">
      <div className="figure-title"><span>{label}</span><small>上爻在上</small></div>
      <div className="line-stack" aria-label={`${label}，上爻在上，初爻在下`}>
        {[...values].reverse().map((value, index) => {
          const position = 6 - index
          return <StalkFigure key={position} value={value} position={position} changing={isChangingLine(value)} />
        })}
      </div>
    </div>
  )
}

function CastProgress({ state }: { state: CastState }) {
  const completedOperations = state.completedLines.length * 3 * YARROW_OPERATION_COUNT + state.lineChanges.length * YARROW_OPERATION_COUNT + (state.activeChange ? state.stage + 1 : 0)
  const completedChanges = state.completedLines.length * 3 + state.lineChanges.length
  const progress = Math.round((completedOperations / (YARROW_CHANGE_COUNT * YARROW_OPERATION_COUNT)) * 100)
  return (
    <div className="progress-block">
      <div className="progress-meta"><span>起卦進度</span><strong>{state.completed ? '完成' : `${state.lineIndex + 1}／6 爻 · ${Math.min(state.changeIndex + 1, 3)}／3 變`}</strong></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="progress-foot"><span>{completedOperations}／{YARROW_CHANGE_COUNT * YARROW_OPERATION_COUNT} 步驟 · {completedChanges}／{YARROW_CHANGE_COUNT} 變</span><span>{state.stalks} 根蓍草待演算</span></div>
    </div>
  )
}

function CastView({ state, onNext, onAuto, onComplete, onBack, onRestart, onResult }: {
  state: CastState
  onNext: () => void
  onAuto: () => void
  onComplete: () => void
  onBack: () => void
  onRestart: () => void
  onResult: () => void
}) {
  const active = state.activeChange
  const displayedStage = active ? Math.max(state.stage, 0) : 0
  const operationTitle = active ? OPERATION_LABELS[displayedStage] : OPERATION_LABELS[0]
  const completedLine = state.lastCompletedLine
  const linePosition = Math.min(state.lineIndex + 1, 6)

  return (
    <main className="page cast-page">
      <div className="page-heading cast-heading">
        <div className="eyebrow">02 / CASTING</div>
        <h1>一變一變，<em>把卦畫出來。</em></h1>
        <p>目前採數位模擬。每個結果在操作開始時決定，不會因動畫或點擊速度改變。</p>
      </div>
      <CastProgress state={state} />
      <div className="cast-layout">
        <section className="panel operation-panel">
          <div className="panel-kicker">第 {linePosition} 爻 · 第 {Math.min(state.changeIndex + 1, 3)} 變</div>
          <div className="operation-header">
            <div>
              <span className="operation-index">0{displayedStage + 1}</span>
              <h2>{operationTitle}</h2>
            </div>
            <span className="stalk-count">{active?.initialStalks ?? state.stalks} 根</span>
          </div>
          <div className="operation-steps" aria-label="四營步驟">
            {OPERATION_LABELS.map((label, index) => (
              <div className={`operation-step ${active && index <= state.stage ? 'is-done' : ''} ${active && index === displayedStage ? 'is-current' : ''}`} key={label}>
                <span>{index + 1}</span>{label}
              </div>
            ))}
          </div>
          <div className="operation-visual">
            <div className="stalk-pile" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
            <div>
              <strong>{active ? currentOperationText(active, displayedStage) : '準備進行這一變。'}</strong>
              <p>「分二、掛一、揲四、歸奇」完成後，才會得到本變的過揲之數。</p>
            </div>
          </div>
          <div className="operation-actions">
            <PrimaryButton onClick={onNext}>{!active ? '執行分二' : state.stage === 3 ? '完成本變' : `執行${OPERATION_LABELS[state.stage + 1]}`} <span aria-hidden="true">→</span></PrimaryButton>
            <SecondaryButton onClick={onAuto}>自動完成本變</SecondaryButton>
            <SecondaryButton onClick={onComplete}>六爻全部一次產生</SecondaryButton>
          </div>
          <div className="secondary-actions">
            <button type="button" onClick={onBack} disabled={state.history.length === 0}>← 返回上一步</button>
            <button type="button" onClick={onRestart}>重新開始</button>
          </div>
        </section>
        <aside className="panel cast-aside">
          <div className="panel-kicker">目前累積</div>
          <div className="mini-lines">
            {state.completedLines.map((line, index) => <StalkFigure key={index} value={line.value} position={index + 1} changing={line.isChanging} />)}
            {state.lineChanges.length > 0 && <div className="mini-pending">第 {linePosition} 爻已完成 {state.lineChanges.length}／3 變</div>}
            {state.completedLines.length === 0 && state.lineChanges.length === 0 && <div className="empty-state">第一爻尚未完成<br />爻由下往上排列</div>}
          </div>
          {completedLine && (
            <div className="line-complete-card">
              <span>最近完成 · {lineName(completedLine.value, state.completedLines.length)}</span>
              <strong>{completedLine.value} · {lineLabel(completedLine.value)}</strong>
              <small>{completedLine.isChanging ? '這是動爻' : '這是不變爻'}</small>
            </div>
          )}
          {state.completed && <PrimaryButton onClick={onResult}>查看卦象結果 <span aria-hidden="true">↗</span></PrimaryButton>}
        </aside>
      </div>
    </main>
  )
}

function StructureTag({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`structure-tag ${tone}`}>{children}</span>
}

function HexagramTextBlock({ sequence }: { sequence: number }) {
  const text = HEXAGRAM_TEXTS[sequence]
  const sections = [
    ['卦辭', text?.judgment],
    ['彖辭', text?.tuan],
    ['大象', text?.greatImage],
  ] as const

  return (
    <section className="hexagram-text" aria-label="卦辭、彖辭與大象">
      <div className="hexagram-text-header"><span>經文閱讀</span><small>內容狀態：{text?.reviewStatus ?? '待校訂'}</small></div>
      {sections.map(([label, content]) => <div className="hexagram-text-row" key={label}><strong>{label}</strong><p>{content || '此段內容尚待人工校訂後匯入。'}</p></div>)}
    </section>
  )
}

function LineTextSection({ sequence }: { sequence: number }) {
  const lines = HEXAGRAM_LINE_TEXTS[sequence] ?? []

  return (
    <section className="result-section line-text-section">
      <div className="section-heading"><div><div className="eyebrow">STRUCTURE / 01</div><h2>各爻爻辭</h2></div><span>本卦六爻</span></div>
      <p className="section-intro">依初爻至上爻列出本卦爻辭；內容目前仍以來源初稿保存。</p>
      <div className="line-text-list">
        {[...lines].reverse().map((line) => <article className="line-text-row" key={line.position}><div className="line-text-meta"><strong>{line.name}</strong><span>第 {line.position} 爻</span></div><p>{line.text}</p><small>內容狀態：{line.reviewStatus}</small></article>)}
      </div>
    </section>
  )
}

function ResultView({ state, question, onRestart, onBrowse, onOpenDetail }: { state: CastState; question: string; onRestart: () => void; onBrowse: () => void; onOpenDetail: (sequence: number) => void }) {
  const values = state.completedLines.map((line) => line.value) as LineValue[]
  const result = useMemo(() => {
    const original = getHexagram(values)
    const transformedValues = changedLines(values)
    const transformed = getHexagram(transformedValues)
    const structures = analyzeLines(values)
    const changing = values.filter(isChangingLine)
    return { original, transformed, transformedValues, structures, changing }
  }, [values])

  const changingPositions = values.map((value, index) => isChangingLine(value) ? index + 1 : null).filter((position): position is number => position !== null)
  const changingCount = changingPositions.length

  return (
    <main className="page result-page">
      <div className="result-topline">
        <div><div className="eyebrow">03 / RESULT</div><h1>這一卦，先從結構看起。</h1></div>
        <div className="result-actions"><SecondaryButton onClick={onRestart}>重新起卦</SecondaryButton><button className="text-button" type="button" onClick={onBrowse}>瀏覽六十四卦 ↗</button></div>
      </div>
      <section className="result-context"><span>研究問題</span><strong>{question || '未填寫問題'}</strong><span>揲蓍法 · 六爻十八變完成</span></section>
      <section className="overview-grid">
        <article className="overview-card original-card">
          <div className="card-label">本卦 · 遇卦</div>
          <div className="hexagram-number">{String(result.original.sequence).padStart(2, '0')}</div>
          <h2>{result.original.name}卦</h2>
          <p>{trigramLabel(result.original.upper)}上{trigramLabel(result.original.lower)}下 · {result.original.upper}／{result.original.lower}</p>
          <HexagramFigure values={values} label="本卦卦象" />
          <HexagramTextBlock sequence={result.original.sequence} />
          <button className="text-button detail-link" type="button" onClick={() => onOpenDetail(result.original.sequence)}>開啟本卦詳細頁 ↗</button>
        </article>
        <div className="transition-mark" aria-hidden="true">→</div>
        <article className="overview-card changed-card">
          <div className="card-label">之卦 · 變卦</div>
          <div className="hexagram-number">{String(result.transformed.sequence).padStart(2, '0')}</div>
          <h2>{result.transformed.name}卦</h2>
          <p>{trigramLabel(result.transformed.upper)}上{trigramLabel(result.transformed.lower)}下 · {result.transformed.upper}／{result.transformed.lower}</p>
          <HexagramFigure values={result.transformedValues} label="之卦卦象" />
          <HexagramTextBlock sequence={result.transformed.sequence} />
          <button className="text-button detail-link" type="button" onClick={() => onOpenDetail(result.transformed.sequence)}>開啟之卦詳細頁 ↗</button>
        </article>
      </section>
      <div className="result-detail-grid">
      <section className="result-section structure-section">
        <div className="section-heading"><div><div className="eyebrow">STRUCTURE / 01</div><h2>六爻結構</h2></div><span className="change-badge">{changingCount} 個變爻</span></div>
        <p className="section-intro">本卦由下往上讀。變爻以「動」標示；以下標籤是結構描述，不是個人化判斷。</p>
        <div className="structure-list">
          {values.map((value, index) => {
            const structure = result.structures[index]
            return (
              <div className={`structure-row ${isChangingLine(value) ? 'is-changing' : ''}`} key={structure.position}>
                <div className="structure-line"><StalkFigure value={value} position={structure.position} changing={isChangingLine(value)} /></div>
                <div className="structure-tags">
                  <StructureTag tone={structure.isCorrectPosition ? 'positive' : 'muted'}>{structure.isCorrectPosition ? '得位' : '失位'}</StructureTag>
                  <StructureTag tone={structure.isCentral ? 'positive' : 'muted'}>{structure.isCentral ? '得中' : '非中位'}</StructureTag>
                  <StructureTag>{structure.correspondenceStatus}（{POSITION_LABELS[structure.correspondingPosition - 1]}爻）</StructureTag>
                  {structure.adjacentRelations.map((relation) => <StructureTag key={`${relation.kind}-${relation.adjacentPosition}`}>{relation.kind}（{POSITION_LABELS[relation.adjacentPosition - 1]}爻）</StructureTag>)}
                </div>
              </div>
            )
          }).reverse()}
        </div>
        <details className="rule-details"><summary>這些結構標籤代表什麼？</summary><div className="rule-copy"><p><strong>得位／失位</strong>：初、三、五為陽位；二、四、上為陰位，依爻的陰陽判斷是否相合。</p><p><strong>得中</strong>：二爻與五爻是上下卦的中位，與得位分開計算。</p><p><strong>正應</strong>：初／四、二／五、三／上為對應位置；本版先顯示陰陽相異的正應。</p><p><strong>承陽／乘剛</strong>：一般相鄰陰陽規則 v1 中，陰爻下方的陽爻為乘剛，陰爻上方的陽爻為承陽；卦例特殊取象尚待另行研究。</p></div></details>
      </section>
      <LineTextSection sequence={result.original.sequence} />
      </div>
      <section className="result-section changing-section">
        <div className="section-heading"><div><div className="eyebrow">TEXT / 02</div><h2>變爻爻辭</h2></div><span>{changingCount ? `本卦第 ${changingPositions.map((position) => position + 1).join('、')} 爻` : '無變爻'}</span></div>
        {changingCount === 0 ? <div className="empty-result">本卦無變爻。經文內容會在完成人工校訂後，從本卦資料頁閱讀。</div> : <div className="changing-cards">{values.map((value, index) => { if (!isChangingLine(value)) return null; const line = HEXAGRAM_LINE_TEXTS[result.original.sequence]?.find((item) => item.position === index + 1); return <article className="changing-card" key={index}><div className="changing-card-top"><span>{lineName(value, index + 1)} · 第 {index + 1} 爻</span><StructureTag tone="moving">動爻</StructureTag></div><h3>本卦爻辭</h3><p>{line?.text || '此爻辭尚待人工校訂後匯入。'}</p><h3>小象</h3><p>{line?.xiaoxiang || '此小象尚待人工校訂後匯入。'}</p><span className="review-status">內容狀態：{line?.reviewStatus ?? '待校訂'} · 來源第 {line?.sourceRef.sourceLine ?? '—'} 行</span></article>})}</div>}
      </section>
      {changingCount >= 3 && <section className="changed-judgment"><div><div className="eyebrow">TEXT / 03</div><h2>之卦卦辭</h2><p>{result.transformed.name}卦 · 第 {result.transformed.sequence} 卦</p></div><div className="pending-copy">之卦卦辭尚待人工校訂後匯入。這裡會與本卦卦辭分開顯示。</div></section>}
      <div className="result-disclaimer">目前結果只提供可追溯的卦象結構與經文閱讀入口，不產生針對個人問題的吉凶或行動建議。</div>
    </main>
  )
}

function ContentReviewView() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'全部' | ReviewStatus>('全部')
  const [draft, setDraft] = useState<ReviewDraft>(() => loadReviewDraft())

  useEffect(() => {
    saveReviewDraft(draft)
  }, [draft])

  const visibleRecords = HEXAGRAM_LINE_RECORDS.filter((record) => {
    const item = draft.items[record.id]
    const status = item?.status ?? record.reviewStatus
    const matchesStatus = statusFilter === '全部' || status === statusFilter
    const searchTarget = `${record.id} ${record.hexagramName} ${record.name} ${item?.text ?? record.text} ${item?.xiaoxiang ?? record.xiaoxiang}`
    return matchesStatus && searchTarget.includes(query)
  })
  const reviewedCount = HEXAGRAM_LINE_RECORDS.filter((record) => (draft.items[record.id]?.status ?? record.reviewStatus) === '已校訂').length

  const updateItem = (id: string, fallbackText: string, fallbackXiaoxiang: string, fallbackStatus: ReviewStatus, fallbackNote: string, patch: Partial<{ text: string; xiaoxiang: string; status: ReviewStatus; note: string }>) => {
    const current = draft.items[id] ?? { text: fallbackText, xiaoxiang: fallbackXiaoxiang, status: fallbackStatus, note: fallbackNote }
    setDraft(updateReviewItem(draft, id, { ...current, ...patch }))
  }

  const exportDraft = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'iching-line-review-draft.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page review-page">
      <div className="page-heading"><div className="eyebrow">CONTENT / REVIEW</div><h1>逐爻校訂，<em>保留來源。</em></h1><p>這裡可分別編輯爻辭與小象；修改會先保存為瀏覽器校訂草稿，不會直接改寫來源初稿。完成後請匯出 JSON，再由人工審核並合併回正式資料。</p></div>
      <section className="review-toolbar panel">
        <label htmlFor="review-search">搜尋卦序、卦名、爻辭或小象</label>
        <input id="review-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：乾、1-1、潛龍" />
        <label htmlFor="review-status">校訂狀態</label>
        <select id="review-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '全部' | ReviewStatus)}><option value="全部">全部</option><option value="待校訂">待校訂</option><option value="需複核">需複核</option><option value="已校訂">已校訂</option></select>
        <div className="review-summary"><strong>{reviewedCount}／384</strong><span>已校訂 · 顯示 {visibleRecords.length} 筆</span></div>
        <SecondaryButton onClick={exportDraft}>匯出校訂草稿</SecondaryButton>
      </section>
      <section className="review-list" aria-label="384 爻校訂清單">
        {visibleRecords.map((record) => {
          const item = draft.items[record.id]
          const text = item?.text ?? record.text
          const xiaoxiang = item?.xiaoxiang ?? record.xiaoxiang
          const status = item?.status ?? record.reviewStatus
          const note = item?.note ?? ''
          return <article className="review-record" key={record.id}>
            <div className="review-record-header"><div><span className="card-label">{record.id} · {record.hexagramName}卦</span><h2>{record.name}</h2></div><span className="review-source">來源：{record.sourceRef.sourcePath} · 第 {record.sourceRef.sourceLine} 行</span></div>
            <label htmlFor={`review-text-${record.id}`}>爻辭</label>
            <textarea id={`review-text-${record.id}`} value={text} rows={2} onChange={(event) => updateItem(record.id, text, xiaoxiang, status, note, { text: event.target.value })} />
            <label htmlFor={`review-xiaoxiang-${record.id}`}>小象</label>
            <textarea id={`review-xiaoxiang-${record.id}`} value={xiaoxiang} rows={2} placeholder="輸入小象原文" onChange={(event) => updateItem(record.id, text, xiaoxiang, status, note, { xiaoxiang: event.target.value })} />
            <div className="review-fields"><label htmlFor={`review-status-${record.id}`}>狀態<select id={`review-status-${record.id}`} value={status} onChange={(event) => updateItem(record.id, text, xiaoxiang, status, note, { status: event.target.value as ReviewStatus })}><option value="待校訂">待校訂</option><option value="需複核">需複核</option><option value="已校訂">已校訂</option></select></label><label htmlFor={`review-note-${record.id}`}>備註<textarea id={`review-note-${record.id}`} value={note} rows={2} placeholder="記錄異體字、斷句或來源差異" onChange={(event) => updateItem(record.id, text, xiaoxiang, status, note, { note: event.target.value })} /></label></div>
          </article>
        })}
      </section>
    </main>
  )
}

function hexagramValues(hexagram: HexagramDefinition): LineValue[] {
  return `${TRIGRAM_BITS[hexagram.lower]}${TRIGRAM_BITS[hexagram.upper]}`.split('').map((bit) => bit === '1' ? 7 : 8) as LineValue[]
}

function HexagramDetailView({ sequence, onBack, onNavigate }: { sequence: number; onBack: () => void; onNavigate: (sequence: number) => void }) {
  const hexagram = HEXAGRAMS.find((item) => item.sequence === sequence)
  if (!hexagram) return <main className="page"><h1>找不到這一卦</h1><SecondaryButton onClick={onBack}>返回六十四卦</SecondaryButton></main>
  const lines = HEXAGRAM_LINE_TEXTS[sequence] ?? []
  const previous = HEXAGRAMS.find((item) => item.sequence === sequence - 1)
  const next = HEXAGRAMS.find((item) => item.sequence === sequence + 1)

  return (
    <main className="page hexagram-detail-page">
      <div className="detail-back"><button className="text-button" type="button" onClick={onBack}>← 返回六十四卦</button></div>
      <div className="page-heading"><div className="eyebrow">HEXAGRAM {String(hexagram.sequence).padStart(2, '0')}</div><h1>{hexagram.name}卦，<em>由象入門。</em></h1><p>{trigramLabel(hexagram.upper)}上{trigramLabel(hexagram.lower)}下 · 上卦 {hexagram.upper}／下卦 {hexagram.lower}</p></div>
      <section className="detail-overview panel"><HexagramFigure values={hexagramValues(hexagram)} label={`${hexagram.name}卦象`} /><HexagramTextBlock sequence={sequence} /></section>
      <section className="result-section detail-lines-section"><div className="section-heading"><div><div className="eyebrow">TEXT / LINES</div><h2>六爻爻辭</h2></div><span>初爻至上爻</span></div><p className="section-intro">由下往上保存，畫面由上爻排列至初爻；內容狀態與來源定位均保留。</p><div className="detail-line-list">{[...lines].reverse().map((line) => <article className="detail-line-card" key={line.position}><div><span className="card-label">第 {line.position} 爻</span><h3>{line.name}</h3></div><div className="detail-line-copy"><p>{line.text}</p><p><strong>小象</strong>{line.xiaoxiang || '尚待人工校訂。'}</p></div><small>內容狀態：{line.reviewStatus} · 來源第 {line.sourceRef.sourceLine} 行</small></article>)}</div></section>
      <nav className="detail-pagination" aria-label="六十四卦前後導覽"><button className="button button-secondary" type="button" disabled={!previous} onClick={() => previous && onNavigate(previous.sequence)}>← {previous ? `${previous.sequence}. ${previous.name}卦` : '已是第一卦'}</button><span>第 {sequence}／64 卦</span><button className="button button-secondary" type="button" disabled={!next} onClick={() => next && onNavigate(next.sequence)}>{next ? `${next.sequence}. ${next.name}卦` : '已是最後一卦'} →</button></nav>
    </main>
  )
}

function HexagramsView({ onOpenDetail }: { onOpenDetail: (sequence: number) => void }) {
  const [query, setQuery] = useState('')
  const visible = HEXAGRAMS.filter((hexagram) => hexagram.name.includes(query) || String(hexagram.sequence).includes(query))

  return (
    <main className="page hexagrams-page">
      <div className="page-heading"><div className="eyebrow">REFERENCE / 64 HEXAGRAMS</div><h1>六十四卦，<em>由象入門。</em></h1><p>以卦序、卦名或上下卦查找。完整經文內容會以人工校訂狀態逐步加入。</p></div>
      <div className="search-row"><label htmlFor="hexagram-search">搜尋卦序或卦名</label><input id="hexagram-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：乾、19" /><span>{visible.length}／64</span></div>
      <div className="hexagram-grid">{visible.map((hexagram) => <button className="hexagram-tile" type="button" key={hexagram.sequence} onClick={() => onOpenDetail(hexagram.sequence)}><span>{String(hexagram.sequence).padStart(2, '0')}</span><strong>{hexagram.name}</strong><small>{hexagram.upper}上{hexagram.lower}下</small></button>)}</div>

    </main>
  )
}

function readStoredQuestion(): string {
  if (typeof window === 'undefined') return ''

  try {
    return window.sessionStorage.getItem(`${CAST_STORAGE_KEY}:question`) ?? ''
  } catch {
    return ''
  }
}

type RouteState = { view: View; sequence?: number }

function readHashRoute(): RouteState | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  const detailMatch = hash.match(/^#\/hexagrams\/(\d+)$/)
  if (detailMatch) {
    const sequence = Number(detailMatch[1])
    return HEXAGRAMS.some((hexagram) => hexagram.sequence === sequence) ? { view: 'hexagram-detail', sequence } : null
  }
  const routes: Record<string, View> = {
    '#/': 'home',
    '#/setup': 'setup',
    '#/cast': 'cast',
    '#/result': 'result',
    '#/hexagrams': 'hexagrams',
    '#/review': 'review',
  }
  const view = routes[hash]
  return view ? { view } : null
}

function hashForRoute(view: View, sequence?: number): string {
  if (view === 'hexagram-detail' && sequence) return `#/hexagrams/${sequence}`
  if (view === 'home') return '#/'
  return `#/${view}`
}

function App() {
  const initialCast = loadCastState()
  const initialRoute = readHashRoute()
  const [view, setView] = useState<View>(() => initialRoute?.view ?? (initialCast ? (initialCast.completed ? 'result' : 'cast') : 'home'))
  const [selectedSequence, setSelectedSequence] = useState<number | undefined>(() => initialRoute?.sequence)

  const [question, setQuestion] = useState(() => readStoredQuestion())
  const [cast, setCast] = useState<CastState | null>(initialCast)

  useEffect(() => {
    if (!cast) return
    saveCastState(cast)
    try {
      window.sessionStorage.setItem(`${CAST_STORAGE_KEY}:question`, question)
    } catch {
      // 私密瀏覽或儲存空間不足時，仍可繼續使用目前頁面。
    }
  }, [cast, question])

  const navigate = (nextView: View, sequence?: number) => {
    setView(nextView)
    setSelectedSequence(sequence)
    const nextHash = hashForRoute(nextView, sequence)
    if (typeof window !== 'undefined' && window.location.hash !== nextHash) window.history.pushState(null, '', nextHash)
  }

  useEffect(() => {
    const onHashChange = () => {
      const route = readHashRoute()
      if (!route) return
      setView(route.view)
      setSelectedSequence(route.sequence)
    }
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('popstate', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('popstate', onHashChange)
    }
  }, [])

  const startCast = (nextQuestion = '') => {
    setQuestion(nextQuestion)
    setCast(createCastState())
    navigate('cast')
  }

  const openHexagram = (sequence: number) => navigate('hexagram-detail', sequence)

  const advance = () => {
    setCast((previous) => previous ? advanceCast(previous) : previous)
  }

  const autoComplete = () => {
    setCast((previous) => previous ? autoCompleteCast(previous) : previous)
  }

  const complete = () => {
    setCast((previous) => previous ? completeCast(previous) : previous)
  }

  const goBack = () => {
    setCast((previous) => previous ? undoCast(previous) : previous)
  }

  const restart = () => {
    if (window.confirm('重新開始會捨棄目前的揲蓍結果，確定要繼續嗎？')) {
      clearCastState()
      try {
        window.sessionStorage.removeItem(`${CAST_STORAGE_KEY}:question`)
      } catch {
        // 清除失敗不應阻止重新起卦。
      }
      setQuestion('')
      setCast(createCastState())
      navigate('cast')
    }
  }

  return (
    <div className="app-shell">
      <Header view={view} onNavigate={navigate} />
      {view === 'home' && <HomeView onStart={() => navigate('setup')} onBrowse={() => navigate('hexagrams')} />}
      {view === 'setup' && <SetupView onStart={startCast} />}
      {view === 'cast' && cast && <CastView state={cast} onNext={advance} onAuto={autoComplete} onComplete={complete} onBack={goBack} onRestart={restart} onResult={() => navigate('result')} />}
      {view === 'result' && cast?.completed && <ResultView state={cast} question={question} onRestart={restart} onBrowse={() => navigate('hexagrams')} onOpenDetail={openHexagram} />}
      {view === 'hexagrams' && <HexagramsView onOpenDetail={openHexagram} />}
      {view === 'hexagram-detail' && selectedSequence !== undefined && <HexagramDetailView sequence={selectedSequence} onBack={() => navigate('hexagrams')} onNavigate={openHexagram} />}
      {view === 'review' && <ContentReviewView />}
      <footer className="site-footer"><span>觀象／易經研究工具 v0.1</span><span>原文與解釋分層保存 · 未校訂內容不作定稿</span></footer>
    </div>
  )
}

export default App
