import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { changedLines, getHexagram, HEXAGRAMS, TRIGRAM_BITS, trigramLabel } from './domain/iching/hexagrams'
import { HEXAGRAM_LINE_RECORDS, HEXAGRAM_LINE_TEXTS } from './domain/iching/hexagramLineTexts'
import { HEXAGRAM_TEXTS } from './domain/iching/hexagramTexts'
import { isChangingLine, isYangLine, lineLabel, lineName } from './domain/iching/lines'
import { analyzeLines, POSITION_LABELS } from './domain/iching/relationships'
import { buildResearchProfile, findResearchMatches, valuesForHexagram } from './domain/iching/research'
import type { HexagramResearchProfile, ResearchFilter, ResearchRelationFilter } from './domain/iching/research'
import type { LineValue, Polarity, ReviewStatus, TrigramName, YarrowChange } from './domain/iching/types'
import { CAST_STORAGE_KEY, YARROW_CHANGE_COUNT, YARROW_OPERATION_COUNT, advanceCast, autoCompleteCast, clearCastState, completeCast, createCastState, loadCastState, saveCastState, undoCast } from './features/divination/castState'
import type { CastState } from './features/divination/castState'
import { loadReviewDraft, saveReviewDraft, updateReviewItem } from './features/contentReview/reviewState'
import type { ReviewDraft } from './features/contentReview/reviewState'

type View = 'home' | 'setup' | 'cast' | 'result' | 'hexagrams' | 'hexagram-detail' | 'review' | 'research'

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
        <button className={view === 'research' ? 'active' : ''} type="button" onClick={() => onNavigate('research')}>易理研究室</button>
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

function SetupView({ onStart, onComplete }: { onStart: (question: string) => void; onComplete: (question: string) => void }) {
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
          <p>每一變會依序經過四營。你可以逐步查看，也可以使用「自動完成本變」快速完成目前這一變；也可以在此直接選擇「六爻全部一次產生」。</p>
        </div>
        <div className="setup-actions"><PrimaryButton onClick={() => onStart(question)}>開始第 1 爻 <span aria-hidden="true">→</span></PrimaryButton><SecondaryButton onClick={() => onComplete(question)}>六爻全部一次產生</SecondaryButton></div>
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

function CastView({ state, onNext, onAuto, onBack, onRestart, onResult }: {
  state: CastState
  onNext: () => void
  onAuto: () => void
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
          </div>
          <div className="secondary-actions">
            <button type="button" onClick={onBack} disabled={state.history.length === 0}>← 返回上一步</button>
            <button type="button" onClick={onRestart}>重新開始</button>
          </div>
        </section>
        <aside className="panel cast-aside">
          <div className="panel-kicker">目前累積</div>
          <div className="mini-lines">
            {[...state.completedLines].reverse().map((line, index) => <StalkFigure key={`${state.completedLines.length - index}-${line.changes[0]?.initialStalks ?? index}`} value={line.value} position={state.completedLines.length - index} changing={line.isChanging} />)}
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
    ['注', text?.commentary],
  ] as const

  return (
    <section className="hexagram-text" aria-label="卦辭、彖辭、大象與注">
      <div className="hexagram-text-header"><span>經文閱讀</span><small>內容狀態：{text?.reviewStatus ?? '待校訂'}</small></div>
      {sections.map(([label, content]) => <div className="hexagram-text-row" key={label}><strong>{label}</strong><p>{content || '此段內容尚待人工校訂後匯入。'}</p></div>)}
    </section>
  )
}

function ResultView({ state, question, onRestart, onBrowse, onOpenDetail, onResearch }: { state: CastState; question: string; onRestart: () => void; onBrowse: () => void; onOpenDetail: (sequence: number) => void; onResearch: (hexagramSequence: number, linePosition: number, changedSequence: number, lineValue: 6 | 9) => void }) {
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
      <section className="result-section changing-section">
        <div className="section-heading"><div><div className="eyebrow">TEXT / 02</div><h2>變爻爻辭</h2></div><span>{changingCount ? `本卦第 ${changingPositions.map((position) => position + 1).join('、')} 爻` : '無變爻'}</span></div>
        {changingCount === 0 ? <div className="empty-result">本卦無變爻。經文內容會在完成人工校訂後，從本卦資料頁閱讀。</div> : <div className="changing-cards">{values.map((value, index) => { if (!isChangingLine(value)) return null; const line = HEXAGRAM_LINE_TEXTS[result.original.sequence]?.find((item) => item.position === index + 1); return <article className="changing-card" key={index}><div className="changing-card-top"><span>{lineName(value, index + 1)} · 第 {index + 1} 爻</span><StructureTag tone="moving">動爻</StructureTag></div><h3>本卦爻辭</h3><p>{line?.text || '此爻辭尚待人工校訂後匯入。'}</p><h3>小象</h3><p>{line?.xiaoxiang || '此小象尚待人工校訂後匯入。'}</p><h3>注</h3><p>{line?.commentary || '此注尚待人工校訂後匯入。'}</p><span className="review-status">內容狀態：{line?.reviewStatus ?? '待校訂'} · 來源第 {line?.sourceRef.sourceLine ?? '—'} 行</span><button className="text-button research-link" type="button" onClick={() => onResearch(result.original.sequence, index + 1, result.transformed.sequence, value as 6 | 9)}>研究此爻 ↗</button></article>})}</div>}
      </section>
      {changingCount >= 3 && <section className="changed-judgment"><div><div className="eyebrow">TEXT / 03</div><h2>之卦卦辭</h2><p>{result.transformed.name}卦 · 第 {result.transformed.sequence} 卦</p></div><div className="pending-copy changed-judgment-copy"><strong>卦辭</strong><p className="changed-judgment-quote">{HEXAGRAM_TEXTS[result.transformed.sequence]?.judgment || '之卦卦辭尚待人工校訂後匯入。'}</p><small>內容狀態：{HEXAGRAM_TEXTS[result.transformed.sequence]?.reviewStatus ?? '待校訂'}</small></div></section>}
      <div className="result-disclaimer">目前結果只提供可追溯的卦象結構與經文閱讀入口，不產生針對個人問題的吉凶或行動建議。</div>
    </main>
  )
}

type ResearchSeed = {
  hexagramSequence?: number
  linePosition?: number
  changedSequence?: number
  lineValue?: 6 | 9
}

const TRIGRAM_NAMES = Object.keys(TRIGRAM_BITS) as TrigramName[]

function researchRunLabel(run: HexagramResearchProfile['runs'][number]): string {
  const start = POSITION_LABELS[run.startPosition - 1]
  const end = POSITION_LABELS[run.endPosition - 1]
  return `${start}${start === end ? '' : `至${end}`}${run.polarity === 'yang' ? '陽' : '陰'}（${run.length}）`
}

function replaceResearchSelection(sequence: number, linePosition: number, seed?: ResearchSeed) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams({ hexagram: String(sequence), line: String(linePosition) })
  if (seed?.changedSequence) params.set('changed', String(seed.changedSequence))
  if (seed?.lineValue) params.set('value', String(seed.lineValue))
  window.history.replaceState(null, '', `#/research?${params.toString()}`)
}

function ResearchView({ seed, onOpenDetail }: { seed?: ResearchSeed; onOpenDetail: (sequence: number) => void }) {
  const [selectedSequence, setSelectedSequence] = useState(seed?.hexagramSequence ?? 1)
  const [selectedLinePosition, setSelectedLinePosition] = useState(seed?.linePosition ?? 1)
  const [filter, setFilter] = useState<ResearchFilter>({ selectedLinePosition: seed?.linePosition ?? 1, samePosition: true })
  const profiles = useMemo(() => HEXAGRAMS.map(buildResearchProfile), [])
  const hexagram = HEXAGRAMS.find((item) => item.sequence === selectedSequence) ?? HEXAGRAMS[0]
  const profile = profiles[selectedSequence - 1]
  const lines = HEXAGRAM_LINE_TEXTS[selectedSequence] ?? []
  const selectedLine = lines.find((line) => line.position === selectedLinePosition) ?? lines[0]
  const selectedStructure = profile.structures[selectedLinePosition - 1]
  const changedHexagram = seed?.changedSequence ? HEXAGRAMS.find((item) => item.sequence === seed.changedSequence) : undefined
  const matches = useMemo(() => findResearchMatches(profiles, HEXAGRAM_LINE_RECORDS, filter), [filter, profiles])

  const updateFilter = (patch: Partial<ResearchFilter>) => setFilter((previous) => ({ ...previous, ...patch }))
  const selectedValue = profile.values[selectedLinePosition - 1]
  const immediateNeighbours = [selectedStructure ? profile.values[selectedLinePosition - 2] : undefined, selectedStructure ? profile.values[selectedLinePosition] : undefined]
  const contextLine = seed?.lineValue ? `${lineName(seed.lineValue, selectedLinePosition)} · 動爻` : '直接選取的靜態爻結構'

  return (
    <main className="page research-page">
      <div className="page-heading">
        <div className="eyebrow">RESEARCH / LINE STUDY</div>
        <h1>易理研究室，<em>從一爻看環境。</em></h1>
        <p>選擇一卦一爻，觀察它在六爻結構中的陰陽、位置與鄰接關係，再用明確條件找出其他卦中的比較對象。這裡提供結構與經文資料，不自動下斷語。</p>
      </div>

      {changedHexagram && <section className="research-context panel"><div><span className="card-label">本次卜卦上下文</span><strong>本卦：第 {selectedSequence} 卦 {hexagram.name}卦</strong><span>{trigramLabel(hexagram.upper)}上{trigramLabel(hexagram.lower)}下 · 研究第 {selectedLinePosition} 爻</span><p>{HEXAGRAM_TEXTS[hexagram.sequence]?.judgment}</p></div><div><strong>之卦：第 {changedHexagram.sequence} 卦 {changedHexagram.name}卦</strong><span>{trigramLabel(changedHexagram.upper)}上{trigramLabel(changedHexagram.lower)}下 · {contextLine}</span><p>{HEXAGRAM_TEXTS[changedHexagram.sequence]?.judgment}</p></div></section>}

      <section className="research-selector panel">
        <div className="research-selector-field"><label htmlFor="research-hexagram">研究卦</label><select id="research-hexagram" value={selectedSequence} onChange={(event) => { const sequence = Number(event.target.value); setSelectedSequence(sequence); replaceResearchSelection(sequence, selectedLinePosition, seed) }}>{HEXAGRAMS.map((item) => <option value={item.sequence} key={item.sequence}>{String(item.sequence).padStart(2, '0')} · {item.name}卦 · {item.upper}上{item.lower}下</option>)}</select></div>
        <div className="research-selector-field"><label htmlFor="research-line">研究爻</label><select id="research-line" value={selectedLinePosition} onChange={(event) => { const position = Number(event.target.value); setSelectedLinePosition(position); updateFilter({ selectedLinePosition: position }); replaceResearchSelection(selectedSequence, position, seed) }}>{POSITION_LABELS.map((label, index) => <option value={index + 1} key={label}>第 {label}爻 · {lines[index]?.name ?? ''}</option>)}</select></div>
        <div className="research-selector-summary"><span>目前研究</span><strong>{hexagram.name}卦 · 第 {POSITION_LABELS[selectedLinePosition - 1]}爻</strong><small>一般六爻資料 · {profile.pattern}</small></div>
      </section>

      <section className="research-hexagram panel">
        <div className="section-heading"><div><div className="eyebrow">HEXAGRAM / SELECTED</div><h2>完整卦資料</h2></div><button className="text-button" type="button" onClick={() => onOpenDetail(hexagram.sequence)}>開啟卦詳細頁 ↗</button></div>
        <div className="research-hexagram-overview"><HexagramFigure values={profile.values} label={`${hexagram.name}卦象`} /><HexagramTextBlock sequence={hexagram.sequence} /></div>
        <div className="research-line-picker" aria-label="選擇研究爻">{lines.map((line) => <button className={line.position === selectedLinePosition ? 'selected' : ''} type="button" aria-pressed={line.position === selectedLinePosition} onClick={() => { setSelectedLinePosition(line.position); updateFilter({ selectedLinePosition: line.position }); replaceResearchSelection(selectedSequence, line.position, seed) }} key={line.position}><span>第 {POSITION_LABELS[line.position - 1]}爻</span><strong>{line.name}</strong><small>{profile.values[line.position - 1] === 7 ? '陽' : '陰'}</small></button>)}</div>
      </section>

      {selectedLine && selectedStructure && <section className="research-selected panel">
        <div className="section-heading"><div><div className="eyebrow">LINE / SELECTED</div><h2>{hexagram.name}卦 · {selectedLine.name}</h2></div><span className="change-badge">第 {selectedLinePosition} 爻</span></div>
        <div className="research-selected-grid"><div className="research-structure-summary"><div className="research-line-state"><strong>{selectedValue === 7 ? '陽爻' : '陰爻'}</strong><span>{contextLine}</span></div><div className="structure-tags"><StructureTag tone={selectedStructure.isCorrectPosition ? 'positive' : 'muted'}>{selectedStructure.isCorrectPosition ? '得位' : '失位'}</StructureTag><StructureTag tone={selectedStructure.isCentral ? 'positive' : 'muted'}>{selectedStructure.isCentral ? '得中' : '非中位'}</StructureTag><StructureTag>{selectedStructure.correspondenceStatus}（{POSITION_LABELS[selectedStructure.correspondingPosition - 1]}爻）</StructureTag>{selectedStructure.adjacentRelations.map((relation) => <StructureTag key={`${relation.kind}-${relation.adjacentPosition}`}>{relation.kind}（{POSITION_LABELS[relation.adjacentPosition - 1]}爻）</StructureTag>)}</div><div className="research-neighbours"><strong>立即鄰爻</strong><span>下方：{immediateNeighbours[0] === undefined ? '無' : `${POSITION_LABELS[selectedLinePosition - 2]}爻 · ${immediateNeighbours[0] === 7 ? '陽' : '陰'}`}</span><span>上方：{immediateNeighbours[1] === undefined ? '無' : `${POSITION_LABELS[selectedLinePosition]}爻 · ${immediateNeighbours[1] === 7 ? '陽' : '陰'}`}</span></div><div className="research-counts"><span>整卦：陽 {profile.totalCounts.yang} · 陰 {profile.totalCounts.yin}</span><span>下卦：陽 {profile.lowerCounts.yang} · 陰 {profile.lowerCounts.yin}</span><span>上卦：陽 {profile.upperCounts.yang} · 陰 {profile.upperCounts.yin}</span></div><div className="research-runs"><strong>連續區段</strong>{profile.runs.map((run) => <span key={`${run.startPosition}-${run.endPosition}`}>{researchRunLabel(run)}</span>)}</div></div><div className="research-line-text"><span className="card-label">本爻經文</span><p><strong>爻辭</strong>{selectedLine.text}</p><p><strong>小象</strong>{selectedLine.xiaoxiang || '尚待人工校訂。'}</p><p><strong>注</strong>{selectedLine.commentary || '尚待人工校訂。'}</p><small>內容狀態：{selectedLine.reviewStatus} · 來源第 {selectedLine.sourceRef.sourceLine} 行</small></div></div>
      </section>}

      <section className="research-filters panel">
        <div className="section-heading"><div><div className="eyebrow">FILTER / STRUCTURE</div><h2>找相似結構</h2></div><span>{matches.length} 筆比較資料</span></div>
        <div className="research-filter-grid"><label>上卦<select aria-label="上卦條件" value={filter.upperTrigram ?? ''} onChange={(event) => updateFilter({ upperTrigram: (event.target.value || undefined) as TrigramName | undefined })}><option value="">不限</option>{TRIGRAM_NAMES.map((name) => <option value={name} key={name}>{name}（{trigramLabel(name)}）</option>)}</select></label><label>下卦<select aria-label="下卦條件" value={filter.lowerTrigram ?? ''} onChange={(event) => updateFilter({ lowerTrigram: (event.target.value || undefined) as TrigramName | undefined })}><option value="">不限</option>{TRIGRAM_NAMES.map((name) => <option value={name} key={name}>{name}（{trigramLabel(name)}）</option>)}</select></label><label>陰陽<select aria-label="陰陽條件" value={filter.polarity ?? ''} onChange={(event) => updateFilter({ polarity: (event.target.value || undefined) as Polarity | undefined })}><option value="">不限</option><option value="yang">陽爻</option><option value="yin">陰爻</option></select></label><label>位<select aria-label="得位條件" value={filter.positionStatus ?? ''} onChange={(event) => updateFilter({ positionStatus: (event.target.value || undefined) as ResearchFilter['positionStatus'] })}><option value="">不限</option><option value="得位">得位</option><option value="失位">失位</option></select></label><label>中位<select aria-label="得中條件" value={filter.centralStatus ?? ''} onChange={(event) => updateFilter({ centralStatus: (event.target.value || undefined) as ResearchFilter['centralStatus'] })}><option value="">不限</option><option value="得中">得中</option><option value="不中">不中</option></select></label><label>應<select aria-label="應位條件" value={filter.correspondenceStatus ?? ''} onChange={(event) => updateFilter({ correspondenceStatus: (event.target.value || undefined) as ResearchFilter['correspondenceStatus'] })}><option value="">不限</option><option value="正應">正應</option><option value="無正應">無正應</option></select></label><label>承／乘<select aria-label="承乘條件" value={filter.adjacentRelation ?? ''} onChange={(event) => updateFilter({ adjacentRelation: (event.target.value || undefined) as ResearchRelationFilter | undefined })}><option value="">不限</option><option value="承陽">承陽</option><option value="乘剛">乘剛</option><option value="無承乘">無承乘</option></select></label><label>連續陰陽<select aria-label="連續陰陽長度" value={filter.minimumRunLength ?? ''} onChange={(event) => updateFilter({ minimumRunLength: (event.target.value || undefined) as ResearchFilter['minimumRunLength'] })}><option value="">不限</option><option value="2">至少 2 個</option><option value="3">至少 3 個</option><option value="4">至少 4 個</option></select></label></div>
        <div className="research-filter-options"><label><input type="checkbox" checked={filter.samePosition} onChange={(event) => updateFilter({ samePosition: event.target.checked })} /> 預設相同爻位</label><label><input type="checkbox" checked={filter.runIncludesSelectedLine ?? false} disabled={!filter.minimumRunLength} onChange={(event) => updateFilter({ runIncludesSelectedLine: event.target.checked })} /> 連續區段必須包含研究爻</label></div>
        <div className="research-filter-note">目前比較以明確條件篩選，結果依卦序、爻位排列；筆數多不代表意義較相近。</div>
      </section>

      <section className="research-results"><div className="section-heading"><div><div className="eyebrow">RESULTS / COMPARISON</div><h2>爻辭比較</h2></div><span>{matches.length} 筆</span></div><div className="research-match-list">{matches.map((match) => <article className="research-match-card" key={match.line.id}><div className="research-match-header"><div><span className="card-label">第 {match.profile.hexagram.sequence} 卦 · 第 {match.line.position} 爻</span><h3>{match.profile.hexagram.name}卦 · {match.line.name}</h3></div><span>{match.profile.hexagram.upper}上{match.profile.hexagram.lower}下</span></div><div className="research-match-meta"><span>{match.structure.polarity === 'yang' ? '陽爻' : '陰爻'}</span><span>{match.structure.isCorrectPosition ? '得位' : '失位'}</span><span>{match.structure.isCentral ? '得中' : '非中位'}</span><span>{match.structure.correspondenceStatus}</span>{match.structure.adjacentRelations.map((relation) => <span key={`${relation.kind}-${relation.adjacentPosition}`}>{relation.kind}</span>)}</div><p className="research-match-text">{match.line.text}</p><p><strong>小象</strong>{match.line.xiaoxiang || '尚待人工校訂。'}</p><p><strong>注</strong>{match.line.commentary || '尚待人工校訂。'}</p><div className="research-match-footer"><span>連續：{match.profile.runs.map(researchRunLabel).join('、')}</span><button className="text-button" type="button" onClick={() => onOpenDetail(match.profile.hexagram.sequence)}>開啟卦頁 ↗</button></div></article>)}</div></section>
      <div className="result-disclaimer">研究室只提供可追溯的結構條件與經文比較，不表示不同爻辭具有相同義理，也不產生個人化吉凶或行動建議。</div>
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
    const hexagram = HEXAGRAMS.find((item) => item.sequence === record.hexagramSequence)
    const hexagramText = HEXAGRAM_TEXTS[record.hexagramSequence]
    const trigramSearch = hexagram ? `${hexagram.upper}${hexagram.lower} ${trigramLabel(hexagram.upper)}${trigramLabel(hexagram.lower)} ${hexagram.upper}上${hexagram.lower}下 ${trigramLabel(hexagram.upper)}上${trigramLabel(hexagram.lower)}下` : ''
    const searchTarget = `${record.id} ${record.hexagramName} ${record.name} ${trigramSearch} ${hexagramText?.judgment ?? ''} ${hexagramText?.tuan ?? ''} ${hexagramText?.greatImage ?? ''} ${hexagramText?.commentary ?? ''} ${item?.text ?? record.text} ${item?.xiaoxiang ?? record.xiaoxiang} ${item?.commentary ?? record.commentary}`
    return matchesStatus && searchTarget.includes(query)
  })
  const reviewedCount = HEXAGRAM_LINE_RECORDS.filter((record) => (draft.items[record.id]?.status ?? record.reviewStatus) === '已校訂').length
  const visibleGroups = HEXAGRAMS.map((hexagram) => ({
    hexagram,
    records: visibleRecords.filter((record) => record.hexagramSequence === hexagram.sequence),
  })).filter((group) => group.records.length > 0)

  const updateItem = (id: string, fallbackText: string, fallbackXiaoxiang: string, fallbackCommentary: string, fallbackStatus: ReviewStatus, fallbackNote: string, patch: Partial<{ text: string; xiaoxiang: string; commentary: string; status: ReviewStatus; note: string }>) => {
    const current = draft.items[id] ?? { text: fallbackText, xiaoxiang: fallbackXiaoxiang, commentary: fallbackCommentary, status: fallbackStatus, note: fallbackNote }
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
      <div className="page-heading"><div className="eyebrow">CONTENT / REVIEW</div><h1>逐爻校訂，<em>保留來源。</em></h1><p>每卦先呈現卦辭、彖、大象與注，再依初爻至上爻編輯爻辭、小象與注。修改會先保存為瀏覽器校訂草稿，不會直接改寫來源初稿；完成後請匯出 JSON，再由人工審核並合併回正式資料。</p></div>
      <section className="review-toolbar panel">
        <label htmlFor="review-search">搜尋卦序、卦名、上下卦、爻辭、小象或注</label>
        <input id="review-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：乾、1-1、潛龍" />
        <label htmlFor="review-status">校訂狀態</label>
        <select id="review-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '全部' | ReviewStatus)}><option value="全部">全部</option><option value="待校訂">待校訂</option><option value="需複核">需複核</option><option value="已校訂">已校訂</option></select>
        <div className="review-summary"><strong>{reviewedCount}／384</strong><span>已校訂 · 顯示 {visibleRecords.length} 筆</span></div>
        <SecondaryButton onClick={exportDraft}>匯出校訂草稿</SecondaryButton>
      </section>
      <section className="review-list" aria-label="64 卦、384 爻校訂清單">
        {visibleGroups.map(({ hexagram, records }) => (
          <section className="review-hexagram" key={hexagram.sequence}>
            <div className="review-hexagram-header"><div><span className="card-label">第 {hexagram.sequence} 卦</span><h2>{hexagram.name}卦</h2></div><span>{trigramLabel(hexagram.upper)}上{trigramLabel(hexagram.lower)}下 · {records.length}／6 爻</span></div>
            <HexagramTextBlock sequence={hexagram.sequence} />
            <div className="review-lines">
              {records.map((record) => {
                const item = draft.items[record.id]
                const text = item?.text ?? record.text
                const xiaoxiang = item?.xiaoxiang ?? record.xiaoxiang
                const commentary = item?.commentary ?? record.commentary
                const status = item?.status ?? record.reviewStatus
                const note = item?.note ?? record.reviewNote ?? ''
                return <article className="review-record" key={record.id}>
                  <div className="review-record-header"><div><span className="card-label">第 {record.position} 爻 · {record.id}</span><h3>{record.name}</h3></div><span className="review-source">來源：{record.sourceRef.sourcePath} · 第 {record.sourceRef.sourceLine} 行</span></div>
                  <label htmlFor={`review-text-${record.id}`}>爻辭</label>
                  <textarea id={`review-text-${record.id}`} value={text} rows={2} onChange={(event) => updateItem(record.id, text, xiaoxiang, commentary, status, note, { text: event.target.value })} />
                  <label htmlFor={`review-xiaoxiang-${record.id}`}>小象</label>
                  <textarea id={`review-xiaoxiang-${record.id}`} value={xiaoxiang} rows={2} placeholder="輸入小象原文" onChange={(event) => updateItem(record.id, text, xiaoxiang, commentary, status, note, { xiaoxiang: event.target.value })} />
                  <label htmlFor={`review-commentary-${record.id}`}>注</label>
                  <textarea id={`review-commentary-${record.id}`} value={commentary} rows={3} placeholder="來源中的注內容" onChange={(event) => updateItem(record.id, text, xiaoxiang, commentary, status, note, { commentary: event.target.value })} />
                  <div className="review-fields"><label htmlFor={`review-status-${record.id}`}>狀態<select id={`review-status-${record.id}`} value={status} onChange={(event) => updateItem(record.id, text, xiaoxiang, commentary, status, note, { status: event.target.value as ReviewStatus })}><option value="待校訂">待校訂</option><option value="需複核">需複核</option><option value="已校訂">已校訂</option></select></label><label htmlFor={`review-note-${record.id}`}>備註<textarea id={`review-note-${record.id}`} value={note} rows={2} placeholder="記錄新見解、異體字、斷句或來源差異" onChange={(event) => updateItem(record.id, text, xiaoxiang, commentary, status, note, { note: event.target.value })} /></label></div>
                </article>
              })}
            </div>
          </section>
        ))}
      </section>
    </main>
  )
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
      <section className="detail-overview panel"><HexagramFigure values={valuesForHexagram(hexagram)} label={`${hexagram.name}卦象`} /><HexagramTextBlock sequence={sequence} /></section>
      <section className="result-section detail-lines-section"><div className="section-heading"><div><div className="eyebrow">TEXT / LINES</div><h2>六爻爻辭</h2></div><span>初爻至上爻</span></div><p className="section-intro">依初爻至上爻排列，方便按閱讀順序逐爻查看；內容狀態與來源定位均保留。</p><div className="detail-line-list">{lines.map((line) => <article className="detail-line-card" key={line.position}><div><span className="card-label">第 {line.position} 爻</span><h3>{line.name}</h3></div><div className="detail-line-copy"><p>{line.text}</p><p><strong>小象</strong>{line.xiaoxiang || '尚待人工校訂。'}</p><p><strong>注</strong>{line.commentary || '尚待人工校訂。'}</p></div><small>內容狀態：{line.reviewStatus} · 來源第 {line.sourceRef.sourceLine} 行</small></article>)}</div></section>
      <nav className="detail-pagination" aria-label="六十四卦前後導覽"><button className="button button-secondary" type="button" disabled={!previous} onClick={() => previous && onNavigate(previous.sequence)}>← {previous ? `${previous.sequence}. ${previous.name}卦` : '已是第一卦'}</button><span>第 {sequence}／64 卦</span><button className="button button-secondary" type="button" disabled={!next} onClick={() => next && onNavigate(next.sequence)}>{next ? `${next.sequence}. ${next.name}卦` : '已是最後一卦'} →</button></nav>
    </main>
  )
}

function HexagramsView({ onOpenDetail }: { onOpenDetail: (sequence: number) => void }) {
  const [query, setQuery] = useState('')
  const visible = HEXAGRAMS.filter((hexagram) => {
    const searchTarget = `${hexagram.sequence} ${hexagram.name} ${hexagram.upper}${hexagram.lower} ${trigramLabel(hexagram.upper)}${trigramLabel(hexagram.lower)} ${hexagram.upper}上${hexagram.lower}下 ${trigramLabel(hexagram.upper)}上${trigramLabel(hexagram.lower)}下`
    return searchTarget.includes(query)
  })

  return (
    <main className="page hexagrams-page">
      <div className="page-heading"><div className="eyebrow">REFERENCE / 64 HEXAGRAMS</div><h1>六十四卦，<em>由象入門。</em></h1><p>以卦序、卦名、上下卦名稱或卦象查找。完整經文內容會以人工校訂狀態逐步加入。</p></div>
      <div className="search-row"><label htmlFor="hexagram-search">搜尋卦序、卦名、上下卦或卦象</label><input id="hexagram-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：乾、雷風、震巽、19" /><span>{visible.length}／64</span></div>
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

type RouteState = { view: View; sequence?: number; research?: ResearchSeed }

function readHashRoute(): RouteState | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  const detailMatch = hash.match(/^#\/hexagrams\/(\d+)$/)
  if (detailMatch) {
    const sequence = Number(detailMatch[1])
    return HEXAGRAMS.some((hexagram) => hexagram.sequence === sequence) ? { view: 'hexagram-detail', sequence } : null
  }
  if (hash === '#/research' || hash.startsWith('#/research?')) {
    const query = hash.split('?')[1] ?? ''
    const params = new URLSearchParams(query)
    const hexagramSequence = Number(params.get('hexagram'))
    const linePosition = Number(params.get('line'))
    const changedSequence = Number(params.get('changed'))
    const lineValue = Number(params.get('value'))
    const research: ResearchSeed = {
      ...(HEXAGRAMS.some((hexagram) => hexagram.sequence === hexagramSequence) ? { hexagramSequence } : {}),
      ...(linePosition >= 1 && linePosition <= 6 ? { linePosition } : {}),
      ...(HEXAGRAMS.some((hexagram) => hexagram.sequence === changedSequence) ? { changedSequence } : {}),
      ...(lineValue === 6 || lineValue === 9 ? { lineValue } : {}),
    }
    return { view: 'research', research }
  }
  const routes: Record<string, View> = {
    '#/': 'home',
    '#/setup': 'setup',
    '#/cast': 'cast',
    '#/result': 'result',
    '#/hexagrams': 'hexagrams',
    '#/review': 'review',
    '#/research': 'research',
  }
  const view = routes[hash]
  return view ? { view } : null
}

function hashForRoute(view: View, sequence?: number, research?: ResearchSeed): string {
  if (view === 'hexagram-detail' && sequence) return `#/hexagrams/${sequence}`
  if (view === 'research') {
    const params = new URLSearchParams()
    if (research?.hexagramSequence) params.set('hexagram', String(research.hexagramSequence))
    if (research?.linePosition) params.set('line', String(research.linePosition))
    if (research?.changedSequence) params.set('changed', String(research.changedSequence))
    if (research?.lineValue) params.set('value', String(research.lineValue))
    const query = params.toString()
    return `#/research${query ? `?${query}` : ''}`
  }
  if (view === 'home') return '#/'
  return `#/${view}`
}

function App() {
  const initialCast = loadCastState()
  const initialRoute = readHashRoute()
  const [view, setView] = useState<View>(() => initialRoute?.view ?? (initialCast ? (initialCast.completed ? 'result' : 'cast') : 'home'))
  const [selectedSequence, setSelectedSequence] = useState<number | undefined>(() => initialRoute?.sequence)
  const [researchSeed, setResearchSeed] = useState<ResearchSeed | undefined>(() => initialRoute?.research)

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

  const navigate = (nextView: View, sequence?: number, research?: ResearchSeed) => {
    setView(nextView)
    setSelectedSequence(sequence)
    setResearchSeed(research)
    const nextHash = hashForRoute(nextView, sequence, research)
    if (typeof window !== 'undefined' && window.location.hash !== nextHash) window.history.pushState(null, '', nextHash)
  }

  useEffect(() => {
    const onHashChange = () => {
      const route = readHashRoute()
      if (!route) return
      setView(route.view)
      setSelectedSequence(route.sequence)
      setResearchSeed(route.research)
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

  const completeFromSetup = (nextQuestion = '') => {
    setQuestion(nextQuestion)
    setCast(completeCast(createCastState()))
    navigate('cast')
  }

  const openHexagram = (sequence: number) => navigate('hexagram-detail', sequence)
  const openResearch = (hexagramSequence: number, linePosition: number, changedSequence: number, lineValue: 6 | 9) => navigate('research', undefined, { hexagramSequence, linePosition, changedSequence, lineValue })

  const advance = () => {
    setCast((previous) => previous ? advanceCast(previous) : previous)
  }

  const autoComplete = () => {
    setCast((previous) => previous ? autoCompleteCast(previous) : previous)
  }

  const goBack = () => {
    setCast((previous) => previous ? undoCast(previous) : previous)
  }

  const restart = () => {
    clearCastState()
    try {
      window.sessionStorage.removeItem(`${CAST_STORAGE_KEY}:question`)
    } catch {
      // 清除失敗不應阻止重新起卦。
    }
    setQuestion('')
    setCast(null)
    navigate('setup')
  }

  return (
    <div className="app-shell">
      <Header view={view} onNavigate={navigate} />
      {view === 'home' && <HomeView onStart={() => navigate('setup')} onBrowse={() => navigate('hexagrams')} />}
      {view === 'setup' && <SetupView onStart={startCast} onComplete={completeFromSetup} />}
      {view === 'cast' && cast && <CastView state={cast} onNext={advance} onAuto={autoComplete} onBack={goBack} onRestart={restart} onResult={() => navigate('result')} />}
      {view === 'result' && cast?.completed && <ResultView state={cast} question={question} onRestart={restart} onBrowse={() => navigate('hexagrams')} onOpenDetail={openHexagram} onResearch={openResearch} />}
      {view === 'hexagrams' && <HexagramsView onOpenDetail={openHexagram} />}
      {view === 'hexagram-detail' && selectedSequence !== undefined && <HexagramDetailView sequence={selectedSequence} onBack={() => navigate('hexagrams')} onNavigate={openHexagram} />}
      {view === 'research' && <ResearchView key={JSON.stringify(researchSeed ?? {})} seed={researchSeed} onOpenDetail={openHexagram} />}
      {view === 'review' && <ContentReviewView />}
      <footer className="site-footer"><span>觀象／易經研究工具 v0.1</span><span>原文與解釋分層保存 · 未校訂內容不作定稿</span></footer>
    </div>
  )
}

export default App
