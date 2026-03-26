/**
 * G0DM0D3 Research Preview API
 *
 * Exposes the core engines (AutoTune, Parseltongue, STM, Feedback Loop)
 * and the flagship ULTRAPLINIAN multi-model racing mode as a REST API.
 *
 * Includes opt-in dataset collection for building an open source research dataset.
 *
 * Designed for deployment on Hugging Face Spaces (Docker) or any container host.
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import { rateLimit } from './middleware/rateLimit'
import { apiKeyAuth } from './middleware/auth'
import { autotuneRoutes } from './routes/autotune'
import { parseltongueRoutes } from './routes/parseltongue'
import { transformRoutes } from './routes/transform'
import { chatRoutes } from './routes/chat'
import { completionsRoutes } from './routes/completions'
import { modelsRoutes } from './routes/models'
import { feedbackRoutes } from './routes/feedback'
import { ultraplinianRoutes } from './routes/ultraplinian'
import { datasetRoutes } from './routes/dataset'
import { metadataRoutes } from './routes/metadata'

const app = express()
const PORT = parseInt(process.env.PORT || '7860', 10) // HF Spaces default

// ── Middleware ─────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*'
    ? true
    : [process.env.CORS_ORIGIN || 'https://godmod3.ai'].filter(Boolean),
  credentials: false,
}))
app.use(express.json({ limit: '1mb' }))

// ── Static UI ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')))

// ── Health / Info (no auth required) ──────────────────────────────────
app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.get('/v1/info', (_req, res) => {
  res.json({
    name: 'G0DM0D3 Research Preview API',
    version: '0.4.0',
    description: 'OpenAI-compatible API for ULTRAPLINIAN multi-model racing. Use any OpenAI SDK — just swap the base_url.',
    license: 'AGPL-3.0',
    quickstart: {
      python: [
        'from openai import OpenAI',
        'client = OpenAI(base_url="<THIS_URL>/v1", api_key="<YOUR_KEY>")',
        'r = client.chat.completions.create(model="ultraplinian", messages=[{"role":"user","content":"Hello"}])',
        'print(r.choices[0].message.content)',
      ],
      curl: 'curl <THIS_URL>/v1/chat/completions -H "Authorization: Bearer <KEY>" -H "Content-Type: application/json" -d \'{"model":"ultraplinian","messages":[{"role":"user","content":"Hello"}]}\'',
    },
    models: {
      'ultraplinian':          'Race 12 models, return the best (fast tier)',
      'ultraplinian-fast':     'Same as ultraplinian',
      'ultraplinian-standard': 'Race 20 models (standard tier)',
      'ultraplinian-full':     'Race 27 models (full tier)',
      '<any-openrouter-model>': 'Single-model with GODMODE pipeline (e.g. openai/gpt-4o)',
    },
    endpoints: {
      'POST /v1/chat/completions':         'OpenAI-compatible — works with any SDK (model routing built in)',
      'GET  /v1/models':                   'OpenAI-compatible — list available models',
      'POST /v1/ultraplinian/completions':  'Raw ULTRAPLINIAN with Liquid Response SSE (power users)',
      'POST /v1/autotune/analyze':          'Analyze message context and compute optimal LLM parameters',
      'POST /v1/parseltongue/encode':       'Obfuscate trigger words in text',
      'POST /v1/parseltongue/detect':       'Detect trigger words in text',
      'POST /v1/transform':                 'Apply semantic transformation modules to text',
      'POST /v1/feedback':                  'Submit quality feedback for the EMA learning loop',
      'GET  /v1/dataset/stats':             'Dataset collection statistics',
      'GET  /v1/dataset/export':            'Export the open research dataset (JSON or JSONL)',
      'GET  /v1/metadata/stats':            'ZDR usage analytics (models, latency, pipeline stats — no content)',
      'GET  /v1/metadata/events':           'Raw metadata event log (paginated, content-free)',
    },
    authentication: {
      openrouter_key: process.env.OPENROUTER_API_KEY
        ? 'Server-provided (callers do NOT need their own OpenRouter key)'
        : 'Caller must provide openrouter_api_key in request body (or extra_body in Python SDK)',
      api_key: 'Send Authorization: Bearer <your-api-key> header',
    },
    extra_body_options: {
      note: 'Pass G0DM0D3-specific options via extra_body in the OpenAI Python SDK',
      options: {
        godmode: 'boolean (default: true) — enable GODMODE system prompt',
        autotune: 'boolean (default: true) — auto-tune parameters to context',
        strategy: "'adaptive'|'precise'|'balanced'|'creative'|'chaotic' (default: adaptive)",
        parseltongue: 'boolean (default: true) — obfuscate trigger words',
        stm_modules: "string[] (default: ['hedge_reducer','direct_mode']) — post-processing",
        previous_winner: 'string — model ID to prioritize in ultraplinian race',
        openrouter_api_key: 'string — your OpenRouter key (if server does not provide one)',
      },
    },
    limits: {
      requests_total: parseInt(process.env.RATE_LIMIT_TOTAL || '5', 10) || 'unlimited',
      requests_per_minute: 60,
      requests_per_day: 1000,
      note: 'Research preview — each API key gets 5 total requests by default. Set RATE_LIMIT_TOTAL=0 to uncap.',
    },
    source: 'https://github.com/LYS10S/G0DM0D3',
  })
})

// ── OpenAI-compatible routes (primary API surface) ────────────────────
app.use('/v1/chat', apiKeyAuth, rateLimit, completionsRoutes)
app.use('/v1/models', apiKeyAuth, modelsRoutes) // no rate limit on model listing

// ── Power-user routes (raw formats, Liquid Response SSE) ──────────────
app.use('/v1/ultraplinian', apiKeyAuth, rateLimit, ultraplinianRoutes)
app.use('/v1/raw/chat', apiKeyAuth, rateLimit, chatRoutes) // legacy raw format

// ── Engine routes ─────────────────────────────────────────────────────
app.use('/v1/autotune', apiKeyAuth, rateLimit, autotuneRoutes)
app.use('/v1/parseltongue', apiKeyAuth, rateLimit, parseltongueRoutes)
app.use('/v1/transform', apiKeyAuth, rateLimit, transformRoutes)
app.use('/v1/feedback', apiKeyAuth, rateLimit, feedbackRoutes)
app.use('/v1/dataset', apiKeyAuth, rateLimit, datasetRoutes)
app.use('/v1/metadata', apiKeyAuth, metadataRoutes) // no rate limit — read-only analytics

// ── 404 ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found. See GET /v1/info for available endpoints.' })
})

// ── Error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  G0DM0D3 API v0.4.0 — OpenAI-Compatible                 ║
  ║  http://0.0.0.0:${String(PORT).padEnd(5)}                                  ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║  OPENAI-COMPATIBLE (use any SDK):                        ║
  ║  POST /v1/chat/completions   model="ultraplinian"        ║
  ║  GET  /v1/models             list available models        ║
  ║                                                          ║
  ║  POWER USER:                                             ║
  ║  POST /v1/ultraplinian/completions  Raw SSE race         ║
  ║                                                          ║
  ║  ENGINES:                                                ║
  ║  POST /v1/autotune/analyze     Context analysis          ║
  ║  POST /v1/parseltongue/encode  Text obfuscation          ║
  ║  POST /v1/transform            STM transforms            ║
  ║  POST /v1/feedback             Feedback loop             ║
  ║                                                          ║
  ║  QUICKSTART:                                             ║
  ║  from openai import OpenAI                               ║
  ║  c = OpenAI(base_url=".../v1", api_key="g0d_...")        ║
  ║  c.chat.completions.create(model="ultraplinian", ...)    ║
  ╚══════════════════════════════════════════════════════════╝
  `)
})

export default app
