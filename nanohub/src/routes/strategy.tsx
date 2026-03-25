import { createFileRoute } from '@tanstack/react-router'
import {
  ChevronDown,
  Copy,
  Download,
  FileText,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'

export const Route = createFileRoute('/strategy')({
  component: StrategyBuilder,
})

type Venue = 'solana-spot' | 'hyperliquid' | 'aster'

type StrategyMeta = {
  title: string
  lastUpdated: string
  version: string
  scope: string
  objective: string
  corePrinciples: string
  spotIntent: string
  hyperIntent: string
  asterIntent: string
  operationalNotes: string
  changeLog: string
}

type StrategyParams = Record<string, number>

const VENUES: Venue[] = ['solana-spot', 'hyperliquid', 'aster']

const VENUE_INFO: Record<Venue, { label: string; description: string }> = {
  'solana-spot': {
    label: 'Solana Meme Spot',
    description: 'Pump.fun launches, post-graduation Raydium flow, and liquid meme rotations.',
  },
  hyperliquid: {
    label: 'Hyperliquid Perps',
    description: 'Liquid directional expression, funding dislocations, and open-interest confirmation.',
  },
  aster: {
    label: 'Aster Perps',
    description: 'Solana-native perp exposure when wallet context and treasury continuity matter.',
  },
}

const DEFAULT_META: StrategyMeta = {
  title: 'SolanaOS Strategy',
  lastUpdated: '2026-03-21',
  version: 'v2.0',
  scope: 'Solana meme spot, Hyperliquid perps, Aster perps',
  objective:
    'SolanaOS trades three distinct venues with one shared risk engine. The system changes filters, stops, size, and exit behavior based on liquidity profile, leverage profile, and microstructure.',
  corePrinciples: [
    'Trade momentum only when liquidity, structure, and execution quality agree.',
    'Prefer no trade over low-quality trade.',
    'Size from confidence, not conviction.',
    'Spot meme trades are asymmetric and event-driven; perp trades are tighter and inventory-managed.',
    'The system must preserve capital through drawdown cascades before optimizing for upside.',
  ].join('\n'),
  spotIntent: [
    'Capture breakout continuation and recovery bounces in high-velocity meme tokens.',
    'Avoid low-liquidity traps, insider-heavy launches, and hopeless grind-down structures.',
    'Trade long-only unless the venue shifts to perps.',
  ].join('\n'),
  hyperIntent: [
    'Trade trend continuation and exhaustion reversals in liquid perps.',
    'Use funding and open interest as regime filters, not standalone triggers.',
    'Keep stops tighter than meme spot because leverage magnifies mistakes.',
  ].join('\n'),
  asterIntent: [
    'Express perp views while staying aligned with Solana-native treasury, research, and wallet flows.',
    'Manage perps alongside spot without starving the wallet of gas or reserve liquidity.',
    'Use Aster as a disciplined Solana-native expression layer, not a degen leverage venue.',
  ].join('\n'),
  operationalNotes: [
    'Spot meme tokens are allowed to be noisy; perps are not.',
    'Pump.fun setups must survive stricter distribution and execution checks.',
    'Hyperliquid is the default venue for clean long/short expression.',
    'Aster is the Solana-native execution layer when treasury and wallet alignment matter.',
  ].join('\n'),
  changeLog: [
    'Reframed the strategy from a single MawdBot meme setup into a SolanaOS venue-aware system.',
    'Added separate parameter profiles for Solana spot, Hyperliquid perps, and Aster perps.',
    'Added Pump.fun pre-graduation sizing and exit rules.',
    'Added unified confidence scoring and a drawdown cascade.',
    'Added companion-state risk modulation.',
    'Added professional optimizer bounds and anti-overfitting rules.',
  ].join('\n'),
}

const DEFAULTS: Record<Venue, StrategyParams> = {
  'solana-spot': {
    rsiOverbought: 72,
    rsiOversold: 28,
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    emaSlopeLookback: 5,
    atrPeriod: 14,
    minVolume24h: 200000,
    minLiquidityUsd: 50000,
    maxSlippage: 2,
    basePositionSizePct: 10,
    stopLossPct: 7,
    takeProfitPct: 25,
    atrStopMultiplier: 1.8,
    atrTakeProfitMultiplier: 3.5,
    holderConcentrationLimit: 20,
    devWalletMaxPct: 5,
  },
  hyperliquid: {
    rsiOverbought: 70,
    rsiOversold: 30,
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    atrPeriod: 14,
    basePositionSizePct: 8,
    stopLossPct: 5,
    takeProfitPct: 18,
    atrStopMultiplier: 1.5,
    atrTakeProfitMultiplier: 2.8,
    maxSlippage: 0.5,
    fundingRateThreshold: 0.03,
    minOpenInterestUsd: 5000000,
    minVolume24h: 10000000,
  },
  aster: {
    rsiOverbought: 70,
    rsiOversold: 30,
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    atrPeriod: 14,
    basePositionSizePct: 7,
    stopLossPct: 5,
    takeProfitPct: 16,
    atrStopMultiplier: 1.5,
    atrTakeProfitMultiplier: 2.5,
    maxSlippage: 0.75,
    fundingRateThreshold: 0.025,
    minVolume24h: 3000000,
    reserveSol: 0.05,
  },
}

const PARAM_META: Record<
  string,
  { label: string; min: number; max: number; step: number; unit: string }
> = {
  rsiOverbought: { label: 'RSI Overbought', min: 60, max: 90, step: 1, unit: '' },
  rsiOversold: { label: 'RSI Oversold', min: 10, max: 40, step: 1, unit: '' },
  emaFastPeriod: { label: 'EMA Fast', min: 3, max: 20, step: 1, unit: 'periods' },
  emaSlowPeriod: { label: 'EMA Slow', min: 10, max: 100, step: 1, unit: 'periods' },
  emaSlopeLookback: { label: 'EMA Slope Lookback', min: 3, max: 12, step: 1, unit: 'bars' },
  atrPeriod: { label: 'ATR Period', min: 7, max: 28, step: 1, unit: 'periods' },
  basePositionSizePct: { label: 'Base Position Size', min: 1, max: 25, step: 0.5, unit: '%' },
  stopLossPct: { label: 'Stop Loss', min: 2, max: 20, step: 0.5, unit: '%' },
  takeProfitPct: { label: 'Take Profit', min: 5, max: 100, step: 1, unit: '%' },
  atrStopMultiplier: { label: 'ATR Stop Multiplier', min: 0.5, max: 4, step: 0.1, unit: 'x' },
  atrTakeProfitMultiplier: { label: 'ATR Take-Profit Multiplier', min: 1, max: 8, step: 0.1, unit: 'x' },
  maxSlippage: { label: 'Max Slippage', min: 0.1, max: 5, step: 0.1, unit: '%' },
  minVolume24h: { label: 'Min 24h Volume', min: 10000, max: 50000000, step: 10000, unit: '$' },
  minLiquidityUsd: { label: 'Min Liquidity', min: 5000, max: 1000000, step: 5000, unit: '$' },
  holderConcentrationLimit: { label: 'Holder Concentration Limit', min: 5, max: 50, step: 1, unit: '%' },
  devWalletMaxPct: { label: 'Dev Wallet Max', min: 1, max: 20, step: 0.5, unit: '%' },
  fundingRateThreshold: { label: 'Funding Rate Threshold', min: 0.005, max: 0.1, step: 0.005, unit: '%' },
  minOpenInterestUsd: { label: 'Min Open Interest', min: 100000, max: 100000000, step: 100000, unit: '$' },
  reserveSol: { label: 'Reserved SOL', min: 0.01, max: 1, step: 0.01, unit: 'SOL' },
}

const DEFAULT_WEIGHTS = {
  trend: 25,
  momentum: 20,
  liquidity: 20,
  participation: 15,
  executionRisk: 20,
}

const DEFAULT_DRAWDOWN = { warning: 5, critical: 8, halt: 12 }

const FIXED_RISK_GATES = [
  'wallet reserve would fall below hard minimum',
  'venue connectivity is degraded',
  'slippage estimate exceeds venue cap',
  'drawdown cascade is active',
]

function parseList(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function formatDecimalPercent(value: number, digits = 2) {
  return (value / 100).toFixed(digits)
}

function formatWeight(value: number) {
  return (value / 100).toFixed(2)
}

function formatDisplayValue(value: number, unit: string) {
  if (!unit) return `${value}`
  if (unit === '$') return `$${value.toLocaleString()}`
  return `${value}${unit === '%' ? '%' : ` ${unit}`}`
}

function venueJson(venue: Venue, params: StrategyParams) {
  const jsonObj: Record<string, unknown> = { venue }

  for (const [key, value] of Object.entries(params)) {
    const unit = PARAM_META[key]?.unit
    jsonObj[key] = unit === '%' ? value / 100 : value
  }

  if (venue === 'solana-spot') jsonObj.allowShorts = false
  if (venue === 'hyperliquid' || venue === 'aster') jsonObj.marginMode = 'isolated'

  return JSON.stringify(jsonObj, null, 2)
}

function StrategyBuilder() {
  const [activeVenue, setActiveVenue] = useState<Venue>('solana-spot')
  const [meta, setMeta] = useState<StrategyMeta>(DEFAULT_META)
  const [params, setParams] = useState<Record<Venue, StrategyParams>>({ ...DEFAULTS })
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS })
  const [drawdown, setDrawdown] = useState({ ...DEFAULT_DRAWDOWN })
  const [minConfidence, setMinConfidence] = useState(60)
  const [copied, setCopied] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>('meta')

  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0)

  function updateMeta<K extends keyof StrategyMeta>(key: K, value: StrategyMeta[K]) {
    setMeta((prev) => ({ ...prev, [key]: value }))
  }

  function updateParam(venue: Venue, key: string, value: number) {
    setParams((prev) => ({
      ...prev,
      [venue]: { ...prev[venue], [key]: value },
    }))
  }

  function updateWeight(key: keyof typeof DEFAULT_WEIGHTS, value: number) {
    setWeights((prev) => ({ ...prev, [key]: value }))
  }

  function resetVenue(venue: Venue) {
    setParams((prev) => ({ ...prev, [venue]: { ...DEFAULTS[venue] } }))
  }

  function resetTemplate() {
    setMeta(DEFAULT_META)
    setParams({ ...DEFAULTS })
    setWeights({ ...DEFAULT_WEIGHTS })
    setDrawdown({ ...DEFAULT_DRAWDOWN })
    setMinConfidence(60)
  }

  function toggleSection(id: string) {
    setExpandedSection((prev) => (prev === id ? null : id))
  }

  const markdown = useMemo(() => {
    const spot = params['solana-spot']
    const hyper = params.hyperliquid
    const aster = params.aster
    const corePrinciples = parseList(meta.corePrinciples)
    const spotIntent = parseList(meta.spotIntent)
    const hyperIntent = parseList(meta.hyperIntent)
    const asterIntent = parseList(meta.asterIntent)
    const operationalNotes = parseList(meta.operationalNotes)
    const changeLog = parseList(meta.changeLog)

    const lines: string[] = [
      `# ${meta.title}`,
      '',
      `Last updated: ${meta.lastUpdated}`,
      `Version: ${meta.version}`,
      `Scope: ${meta.scope}`,
      '',
      '## Objective',
      '',
      meta.objective,
      '',
      '## Core Principles',
      '',
      ...corePrinciples.map((item) => `- ${item}`),
      '',
      '## Unified OODA Flow',
      '',
      '1. Observe',
      '   Gather price, volume, liquidity, volatility, funding, OI, social velocity, holder concentration, dev-wallet behavior, and venue-specific execution constraints.',
      '2. Orient',
      '   Score the setup across trend, momentum, liquidity, participation, and execution.',
      '3. Decide',
      '   Compare confidence against venue threshold, apply global risk caps, then choose spot long, perp long, perp short, reduce, close, or pass.',
      '4. Act',
      '   Route through the correct execution path: Solana spot via Jupiter or venue-specific flow, Hyperliquid via perp orders, Aster via Solana-native perp execution.',
      '5. Learn',
      '   Log outcome, slippage, realized volatility, and exit quality; feed results back into the auto-optimizer.',
      '',
      '## Global Execution Rules',
      '',
      `- Minimum confidence to enter: \`${formatDecimalPercent(minConfidence)}\``,
      '- Confidence bands:',
      `  - \`${formatDecimalPercent(minConfidence)}-0.69\`: half-size`,
      '  - `0.70-0.79`: base-size',
      '  - `0.80-0.89`: 1.25x size',
      '  - `0.90+`: 1.50x size, only if global drawdown is below warning level',
      '- New risk is blocked if:',
      ...FIXED_RISK_GATES.map((item) => `  - ${item}`),
      '',
      '## Confidence Model',
      '',
      'Each candidate trade receives a weighted score from 0.00 to 1.00.',
      '',
      '| Component | Weight | What it measures |',
      '| --- | ---: | --- |',
      `| Trend structure | ${formatWeight(weights.trend)} | EMA alignment, slope, higher-high or lower-low integrity |`,
      `| Momentum quality | ${formatWeight(weights.momentum)} | RSI regime, breakout velocity, candle expansion |`,
      `| Liquidity quality | ${formatWeight(weights.liquidity)} | Depth, spread, slippage estimate, executable size |`,
      `| Participation | ${formatWeight(weights.participation)} | Volume expansion, OI expansion, social/flow confirmation |`,
      `| Execution risk | ${formatWeight(weights.executionRisk)} | Funding, volatility shock risk, holder concentration, dev-wallet risk |`,
      '',
      'Execution risk is subtractive. A trade can fail despite strong momentum if liquidity or structure is weak.',
      '',
      '## Venue 1: Solana Meme Spot',
      '',
      'This venue covers Pump.fun launches, post-graduation Raydium flow, and liquid Solana meme rotations.',
      '',
      '### Intent',
      '',
      ...spotIntent.map((item) => `- ${item}`),
      '',
      '### Spot Parameters',
      '',
      '```json',
      venueJson('solana-spot', spot),
      '```',
      '',
      '### Spot Entry Logic',
      '',
      'LONG fires only when all are true:',
      '',
      `1. RSI is in recovery: \`${spot.rsiOversold} < RSI < ${spot.rsiOversold + 12}\``,
      `2. Fresh bullish EMA cross: \`EMA${spot.emaFastPeriod} crosses above EMA${spot.emaSlowPeriod}\``,
      '3. Price is above fast EMA and reclaim holds through the close',
      '4. Slow EMA slope is not materially negative',
      `5. 24h volume exceeds \`$${spot.minVolume24h.toLocaleString()}\` and liquidity exceeds \`$${spot.minLiquidityUsd.toLocaleString()}\``,
      `6. Estimated execution slippage is inside \`${formatDecimalPercent(spot.maxSlippage)}\``,
      '',
      '### Pump.fun Early Launch Overlay',
      '',
      '- Pre-graduation entries use `0.50x` normal size',
      '- Hard stop widens to `15%`',
      '- Profit target widens to `100%`',
      '- Entry only allowed when:',
      '  - bonding curve progress is constructive',
      '  - buyer flow is still net-expanding',
      '  - dev-wallet behavior is not hostile',
      '  - launch quality passes basic holder distribution checks',
      '',
      '### Spot Exits',
      '',
      `- Primary stop: \`max(price * ${formatDecimalPercent(spot.stopLossPct)}, ATR * ${spot.atrStopMultiplier})\``,
      `- Primary take profit: \`max(price * ${formatDecimalPercent(spot.takeProfitPct)}, ATR * ${spot.atrTakeProfitMultiplier})\``,
      '- Scale out on strength:',
      '  - take `25%` off at `1R`',
      '  - take `25%` off at `2R`',
      '  - trail remainder under fast EMA or recent swing low',
      '- Immediate exit conditions:',
      '  - dev-wallet dump or hostile insider distribution',
      '  - liquidity collapse',
      '  - failed breakout reclaim with expanding sell volume',
      '',
      '## Venue 2: Hyperliquid Perpetuals',
      '',
      'Hyperliquid is the cleanest venue for fast directional expression, especially when funding and OI are part of the thesis.',
      '',
      '### Intent',
      '',
      ...hyperIntent.map((item) => `- ${item}`),
      '',
      '### Hyperliquid Parameters',
      '',
      '```json',
      venueJson('hyperliquid', hyper),
      '```',
      '',
      '### Funding Bias Map',
      '',
      '| Funding state | Interpretation | Default bias |',
      '| --- | --- | --- |',
      '| Heavy positive | Crowded longs | Prefer shorts or long profit-taking |',
      '| Moderate positive | Mild long crowding | Longs allowed only with strong trend |',
      '| Neutral | Balanced | Follow structure |',
      '| Moderate negative | Mild short crowding | Shorts require stronger confirmation |',
      '| Heavy negative | Crowded shorts | Prefer longs or short profit-taking |',
      '',
      'Funding is used with OI and price direction:',
      '',
      '- Price up + OI up + heavy positive funding can still be a long, but size is reduced',
      '- Price down + OI up + heavy positive funding strengthens short bias',
      '- Funding flips against the position are exit signals when combined with momentum decay',
      '',
      '### Hyperliquid Entry Logic',
      '',
      'LONG requires:',
      '',
      '1. Trend alignment or strong reclaim structure',
      '2. RSI recovery or breakout continuation',
      `3. OI confirms, with open interest above \`$${hyper.minOpenInterestUsd.toLocaleString()}\``,
      `4. Funding is neutral-to-supportive or negative enough to support squeeze potential, using \`${formatDecimalPercent(hyper.fundingRateThreshold, 4)}\` as the crowding threshold`,
      `5. Spread and slippage remain inside \`${formatDecimalPercent(hyper.maxSlippage)}\``,
      '',
      'SHORT requires:',
      '',
      '1. Bearish EMA structure or breakdown reclaim failure',
      '2. RSI rollover',
      '3. OI expands with the move or trapped-long structure is visible',
      '4. Funding is positive enough to support short thesis',
      '5. Liquidation risk is acceptable under isolated margin',
      '',
      '### Hyperliquid Exits',
      '',
      `- Hard stop: \`max(price * ${formatDecimalPercent(hyper.stopLossPct)}, ATR * ${hyper.atrStopMultiplier})\``,
      `- Base take profit: \`max(price * ${formatDecimalPercent(hyper.takeProfitPct)}, ATR * ${hyper.atrTakeProfitMultiplier})\``,
      '- Close early if:',
      '  - funding flips sharply against the position',
      '  - OI diverges from price',
      '  - mark-price trigger fires against the trade and confidence collapses',
      '',
      '## Venue 3: Aster Perpetuals',
      '',
      'Aster is treated as the Solana-native perp venue inside the same operator wallet context.',
      '',
      '### Intent',
      '',
      ...asterIntent.map((item) => `- ${item}`),
      '',
      '### Aster Parameters',
      '',
      '```json',
      venueJson('aster', aster),
      '```',
      '',
      '### Aster Rules',
      '',
      `- Keep at least \`${aster.reserveSol.toFixed(2)} SOL\` reserved for gas and wallet continuity`,
      '- Do not allow Aster perp size to crowd out Solana spot opportunities',
      '- Favor Aster when:',
      '  - a Solana-native thesis already exists',
      '  - the wallet context matters',
      '  - the token or correlated asset is already on the Solana watchlist',
      '',
      '### Aster Entry and Exit',
      '',
      'The signal stack is similar to Hyperliquid, but sizing is slightly smaller and profit targets are tighter. Aster is used as a disciplined expression layer, not a degen leverage venue.',
      '',
      '## Global Risk Model',
      '',
      '### Drawdown Cascade',
      '',
      '| Drawdown | Action |',
      '| --- | --- |',
      `| \`${drawdown.warning}%\` | Reduce weakest exposure and block high-risk Pump.fun entries |`,
      `| \`${drawdown.critical}%\` | Close all perp positions and revert to spot-only or flat mode |`,
      `| \`${drawdown.halt}%\` | Full halt on new risk until manual or automated review clears it |`,
      '',
      '### Portfolio Rules',
      '',
      '- No more than one high-volatility new listing at full size',
      '- No correlated perp stacking across venues without explicit confirmation',
      '- Spot and perp books share one global risk budget',
      '- Venue-specific wins do not justify raising total exposure during drawdown recovery',
      '',
      '### TamaGOchi Modifier',
      '',
      '- Positive state: allow normal sizing',
      '- Neutral state: no adjustment',
      '- Degraded state: cut new risk by `25-50%`',
      '- Ghost or protection state: no new risk',
      '',
      '## Auto-Optimizer',
      '',
      'The optimizer can mutate parameters only inside bounded ranges.',
      '',
      '| Parameter | Min | Max |',
      '| --- | ---: | ---: |',
      '| `rsiOversold` | 20 | 40 |',
      '| `rsiOverbought` | 60 | 80 |',
      '| `emaFastPeriod` | 5 | 20 |',
      '| `emaSlowPeriod` | 15 | 60 |',
      '| `stopLossPct` | 0.03 | 0.15 |',
      '| `takeProfitPct` | 0.10 | 1.00 |',
      '| `positionSizePct` | 0.02 | 0.25 |',
      '| `fundingRateThreshold` | 0.0001 | 0.0010 |',
      '',
      '### Optimizer Tiers',
      '',
      '| Win rate / outcome state | Action |',
      '| --- | --- |',
      '| `< 35%` | Defensive mode: widen stop modestly, tighten RSI filters, cut size |',
      '| `< 45%` | Tighten entry filters only |',
      '| `55-65%` | Hold baseline unless sample quality is high |',
      '| `> 65%` | Slight size increase, capped by drawdown state |',
      '| `> 72%` with positive expectancy and adequate sample | Allow very small size increase or wider TP |',
      '',
      'Overfitting protection:',
      '',
      '- minimum trade sample required before promotion',
      '- no single-parameter jump larger than approved mutation step',
      '- optimizer cannot bypass global drawdown rules',
      '',
      '## Venue Selection Matrix',
      '',
      '| Condition | Preferred venue |',
      '| --- | --- |',
      '| Early viral launch, asymmetric upside, no borrow/short need | Solana spot |',
      '| Liquid directional trend with funding/OI edge | Hyperliquid |',
      '| Solana-native perp thesis with wallet-context priority | Aster |',
      '| Liquidity poor, spread wide, signals mixed | No trade |',
      '',
      '## Operational Notes',
      '',
      ...operationalNotes.map((item) => `- ${item}`),
      '',
      '## Change Log',
      '',
      `### ${meta.lastUpdated} — ${meta.version} ${meta.title}`,
      '',
      ...changeLog.map((item) => `- ${item}`),
      '',
      '---',
      '',
      '*Generated with the SolanaOS Strategy Builder — [seeker.solanaos.net/strategy](https://seeker.solanaos.net/strategy)*',
    ]

    return lines.join('\n')
  }, [drawdown, meta, minConfidence, params, weights])

  const activeParams = params[activeVenue]

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'strategy.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="section">
      <div className="setup-hero">
        <div className="setup-hero-copy">
          <span className="hero-badge">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Strategy Builder
          </span>
          <h1 className="section-title">Build your own SolanaOS strategy.md</h1>
          <p className="hero-subtitle">
            Start from the SolanaOS multi-venue template, tune the risk engine, and export a
            professional <code>strategy.md</code> for your runtime, team, or public trading playbook.
          </p>
        </div>
      </div>

      <section className="strategy-stats">
        <div className="strategy-stat-card">
          <span className="strategy-stat-label">Minimum confidence</span>
          <strong className="strategy-stat-value">{formatDecimalPercent(minConfidence)}</strong>
        </div>
        <div className="strategy-stat-card">
          <span className="strategy-stat-label">Drawdown halt</span>
          <strong className="strategy-stat-value">{drawdown.halt}%</strong>
        </div>
        <div className="strategy-stat-card">
          <span className="strategy-stat-label">Weight total</span>
          <strong className="strategy-stat-value">{weightTotal}%</strong>
        </div>
      </section>

      <section className="card strategy-card-stack">
        <div className="gallery-panel-header">
          <div>
            <h2>Export Strategy</h2>
            <p>Download, copy, or fork the generated markdown into your own runtime.</p>
          </div>
          <Zap className="gallery-panel-icon" aria-hidden="true" />
        </div>
        <div className="strategy-actions">
          <button type="button" className="btn btn-primary" onClick={handleDownload}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download strategy.md
          </button>
          <button type="button" className="btn" onClick={() => void handleCopy()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button type="button" className="btn" onClick={resetTemplate}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset Template
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <button type="button" className="strategy-section-toggle" onClick={() => toggleSection('meta')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Strategy Identity</h2>
          </div>
          <ChevronDown className={`h-4 w-4 strategy-chevron ${expandedSection === 'meta' ? 'open' : ''}`} />
        </button>

        {expandedSection === 'meta' ? (
          <div className="strategy-form-grid">
            <label className="strategy-field">
              <span className="strategy-field-label">Title</span>
              <input
                className="strategy-text-input"
                value={meta.title}
                onChange={(event) => updateMeta('title', event.target.value)}
              />
            </label>
            <label className="strategy-field">
              <span className="strategy-field-label">Last updated</span>
              <input
                className="strategy-text-input"
                value={meta.lastUpdated}
                onChange={(event) => updateMeta('lastUpdated', event.target.value)}
              />
            </label>
            <label className="strategy-field">
              <span className="strategy-field-label">Version</span>
              <input
                className="strategy-text-input"
                value={meta.version}
                onChange={(event) => updateMeta('version', event.target.value)}
              />
            </label>
            <label className="strategy-field">
              <span className="strategy-field-label">Scope</span>
              <input
                className="strategy-text-input"
                value={meta.scope}
                onChange={(event) => updateMeta('scope', event.target.value)}
              />
            </label>
            <label className="strategy-field strategy-field-wide">
              <span className="strategy-field-label">Objective</span>
              <textarea
                className="strategy-textarea"
                value={meta.objective}
                onChange={(event) => updateMeta('objective', event.target.value)}
                rows={4}
              />
            </label>
            <label className="strategy-field strategy-field-wide">
              <span className="strategy-field-label">Core principles</span>
              <textarea
                className="strategy-textarea"
                value={meta.corePrinciples}
                onChange={(event) => updateMeta('corePrinciples', event.target.value)}
                rows={6}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <button type="button" className="strategy-section-toggle" onClick={() => toggleSection('risk')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield className="h-4 w-4" aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Risk Engine</h2>
          </div>
          <ChevronDown className={`h-4 w-4 strategy-chevron ${expandedSection === 'risk' ? 'open' : ''}`} />
        </button>

        {expandedSection === 'risk' ? (
          <div className="strategy-params-grid">
            <label className="strategy-param">
              <div className="strategy-param-header">
                <span className="strategy-param-label">Minimum Confidence</span>
                <span className="strategy-param-value">{formatDecimalPercent(minConfidence)}</span>
              </div>
              <input
                type="range"
                min={50}
                max={80}
                step={1}
                value={minConfidence}
                onChange={(event) => setMinConfidence(Number(event.target.value))}
                className="strategy-slider"
              />
              <div className="strategy-param-range">
                <span>0.50</span>
                <span>0.80</span>
              </div>
            </label>

            <label className="strategy-param">
              <div className="strategy-param-header">
                <span className="strategy-param-label">Warning Drawdown</span>
                <span className="strategy-param-value">{drawdown.warning}%</span>
              </div>
              <input
                type="range"
                min={2}
                max={15}
                step={0.5}
                value={drawdown.warning}
                onChange={(event) =>
                  setDrawdown((prev) => ({ ...prev, warning: Number(event.target.value) }))
                }
                className="strategy-slider"
              />
            </label>

            <label className="strategy-param">
              <div className="strategy-param-header">
                <span className="strategy-param-label">Critical Drawdown</span>
                <span className="strategy-param-value">{drawdown.critical}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={25}
                step={0.5}
                value={drawdown.critical}
                onChange={(event) =>
                  setDrawdown((prev) => ({ ...prev, critical: Number(event.target.value) }))
                }
                className="strategy-slider"
              />
            </label>

            <label className="strategy-param">
              <div className="strategy-param-header">
                <span className="strategy-param-label">Full Halt Drawdown</span>
                <span className="strategy-param-value">{drawdown.halt}%</span>
              </div>
              <input
                type="range"
                min={8}
                max={40}
                step={1}
                value={drawdown.halt}
                onChange={(event) =>
                  setDrawdown((prev) => ({ ...prev, halt: Number(event.target.value) }))
                }
                className="strategy-slider"
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <button type="button" className="strategy-section-toggle" onClick={() => toggleSection('weights')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Confidence Weights</h2>
          </div>
          <ChevronDown className={`h-4 w-4 strategy-chevron ${expandedSection === 'weights' ? 'open' : ''}`} />
        </button>

        {expandedSection === 'weights' ? (
          <>
            <p className="strategy-note">
              Keep the total close to 100% so the score remains interpretable. Execution risk stays
              subtractive in the generated markdown.
            </p>
            <div className="strategy-params-grid">
              {([
                ['trend', 'Trend structure'],
                ['momentum', 'Momentum quality'],
                ['liquidity', 'Liquidity quality'],
                ['participation', 'Participation'],
                ['executionRisk', 'Execution risk'],
              ] as const).map(([key, label]) => (
                <label key={key} className="strategy-param">
                  <div className="strategy-param-header">
                    <span className="strategy-param-label">{label}</span>
                    <span className="strategy-param-value">{weights[key]}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    step={1}
                    value={weights[key]}
                    onChange={(event) => updateWeight(key, Number(event.target.value))}
                    className="strategy-slider"
                  />
                </label>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <button type="button" className="strategy-section-toggle" onClick={() => toggleSection('venues')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Venue Profiles</h2>
          </div>
          <ChevronDown className={`h-4 w-4 strategy-chevron ${expandedSection === 'venues' ? 'open' : ''}`} />
        </button>

        {expandedSection === 'venues' ? (
          <>
            <div className="strategy-venue-tabs">
              {VENUES.map((venue) => (
                <button
                  key={venue}
                  type="button"
                  className={`strategy-venue-tab ${activeVenue === venue ? 'active' : ''}`}
                  onClick={() => setActiveVenue(venue)}
                >
                  {VENUE_INFO[venue].label}
                </button>
              ))}
            </div>

            <p className="strategy-note">{VENUE_INFO[activeVenue].description}</p>

            <div className="strategy-form-grid">
              <label className="strategy-field strategy-field-wide">
                <span className="strategy-field-label">Intent for {VENUE_INFO[activeVenue].label}</span>
                <textarea
                  className="strategy-textarea"
                  rows={5}
                  value={
                    activeVenue === 'solana-spot'
                      ? meta.spotIntent
                      : activeVenue === 'hyperliquid'
                        ? meta.hyperIntent
                        : meta.asterIntent
                  }
                  onChange={(event) => {
                    if (activeVenue === 'solana-spot') updateMeta('spotIntent', event.target.value)
                    if (activeVenue === 'hyperliquid') updateMeta('hyperIntent', event.target.value)
                    if (activeVenue === 'aster') updateMeta('asterIntent', event.target.value)
                  }}
                />
              </label>
            </div>

            <div className="strategy-params-grid">
              {Object.entries(activeParams).map(([key, value]) => {
                const metaForParam = PARAM_META[key]
                if (!metaForParam) return null

                return (
                  <label key={key} className="strategy-param">
                    <div className="strategy-param-header">
                      <span className="strategy-param-label">{metaForParam.label}</span>
                      <span className="strategy-param-value">
                        {formatDisplayValue(value, metaForParam.unit)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={metaForParam.min}
                      max={metaForParam.max}
                      step={metaForParam.step}
                      value={value}
                      onChange={(event) =>
                        updateParam(activeVenue, key, Number(event.target.value))
                      }
                      className="strategy-slider"
                    />
                    <div className="strategy-param-range">
                      <span>{formatDisplayValue(metaForParam.min, metaForParam.unit)}</span>
                      <span>{formatDisplayValue(metaForParam.max, metaForParam.unit)}</span>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="strategy-actions">
              <button type="button" className="btn" onClick={() => resetVenue(activeVenue)}>
                Reset {VENUE_INFO[activeVenue].label}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <button type="button" className="strategy-section-toggle" onClick={() => toggleSection('notes')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap className="h-4 w-4" aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Operator Notes</h2>
          </div>
          <ChevronDown className={`h-4 w-4 strategy-chevron ${expandedSection === 'notes' ? 'open' : ''}`} />
        </button>

        {expandedSection === 'notes' ? (
          <div className="strategy-form-grid">
            <label className="strategy-field strategy-field-wide">
              <span className="strategy-field-label">Operational notes</span>
              <textarea
                className="strategy-textarea"
                rows={5}
                value={meta.operationalNotes}
                onChange={(event) => updateMeta('operationalNotes', event.target.value)}
              />
            </label>
            <label className="strategy-field strategy-field-wide">
              <span className="strategy-field-label">Change log bullets</span>
              <textarea
                className="strategy-textarea"
                rows={6}
                value={meta.changeLog}
                onChange={(event) => updateMeta('changeLog', event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="gallery-panel-header">
          <div>
            <h2>Live Markdown Preview</h2>
            <p>Your exported file updates as you tune the strategy.</p>
          </div>
          <FileText className="gallery-panel-icon" aria-hidden="true" />
        </div>
        <pre className="strategy-preview">{markdown}</pre>
      </section>
    </main>
  )
}
