import { createFileRoute, Link } from '@tanstack/react-router'
import { Copy, Download, FileText, Package, Plus, Upload } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/create')({
  component: SkillCreator,
})

const STRUCTURE_OPTIONS = [
  { value: 'workflow', label: 'Workflow-Based', description: 'Sequential step-by-step processes' },
  { value: 'task', label: 'Task-Based', description: 'Different operations and capabilities' },
  { value: 'reference', label: 'Reference/Guidelines', description: 'Standards, specs, or documentation' },
] as const

type ResourceType = 'scripts' | 'references' | 'assets'

function SkillCreator() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [structure, setStructure] = useState<'workflow' | 'task' | 'reference'>('workflow')
  const [resources, setResources] = useState<Set<ResourceType>>(new Set())
  const [overview, setOverview] = useState('')
  const [sections, setSections] = useState<Array<{ title: string; content: string }>>([
    { title: '', content: '' },
  ])
  const [copied, setCopied] = useState(false)

  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64)

  function toggleResource(r: ResourceType) {
    setResources((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  function addSection() {
    setSections((prev) => [...prev, { title: '', content: '' }])
  }

  function updateSection(index: number, field: 'title' | 'content', value: string) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index))
  }

  function generateSkillMd(): string {
    const lines: string[] = []
    lines.push('---')
    lines.push(`name: ${slug || 'my-skill'}`)
    lines.push(`description: ${description || 'TODO: Add a description of what this skill does and when to use it.'}`)
    lines.push('---\n')

    const title = name || 'My Skill'
    lines.push(`# ${title}\n`)

    if (overview) {
      lines.push(`## Overview\n`)
      lines.push(`${overview}\n`)
    }

    for (const section of sections) {
      if (section.title) {
        lines.push(`## ${section.title}\n`)
        if (section.content) {
          lines.push(`${section.content}\n`)
        }
      }
    }

    if (resources.has('scripts')) {
      lines.push(`## Scripts\n`)
      lines.push(`Scripts in \`scripts/\` can be executed directly without loading into context.\n`)
    }

    if (resources.has('references')) {
      lines.push(`## References\n`)
      lines.push(`Additional documentation in \`references/\` is loaded as needed.\n`)
    }

    if (resources.has('assets')) {
      lines.push(`## Assets\n`)
      lines.push(`Template files and resources in \`assets/\` for use in output.\n`)
    }

    return lines.join('\n')
  }

  function generateTreePreview(): string {
    const lines: string[] = []
    lines.push(`${slug || 'my-skill'}/`)
    lines.push(`├── SKILL.md`)
    if (resources.has('scripts')) lines.push(`├── scripts/`)
    if (resources.has('references')) lines.push(`├── references/`)
    if (resources.has('assets')) lines.push(`├── assets/`)
    return lines.join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generateSkillMd())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }

  function handleDownload() {
    const blob = new Blob([generateSkillMd()], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'SKILL.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="section">
      <div className="setup-hero">
        <div className="setup-hero-copy">
          <span className="hero-badge">
            <Package className="h-4 w-4" aria-hidden="true" />
            Skill Creator
          </span>
          <h1 className="section-title">Create an Agent Skill</h1>
          <p className="hero-subtitle">
            Build a SKILL.md for Claude Code, Cursor, Copilot, or any AI agent. Configure, preview, and publish to the SolanaOS Hub.
          </p>
        </div>
      </div>

      <div className="strategy-venue-tabs" style={{ marginBottom: 16 }}>
        <Link to="/create" className="strategy-venue-tab active">Create New</Link>
        <Link to="/upload" search={{ updateSlug: undefined }} className="strategy-venue-tab">Upload Existing</Link>
        <Link to="/import" className="strategy-venue-tab">Import from GitHub</Link>
      </div>

      {/* Step 1: Identity */}
      <section className="card">
        <div className="gallery-panel-header">
          <div>
            <h2>1. Skill Identity</h2>
            <p>Name and describe your skill. The description determines when AI agents activate it.</p>
          </div>
          <FileText className="gallery-panel-icon" aria-hidden="true" />
        </div>
        <div className="gallery-form" style={{ marginTop: 12 }}>
          <label className="gallery-field">
            <span>Skill Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. solana-token-analyzer"
              maxLength={64}
            />
          </label>
          {slug ? <p className="gallery-locked" style={{ fontSize: '0.82rem' }}>Slug: <code>{slug}</code></p> : null}
          <label className="gallery-field">
            <span>Description (triggers the skill)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Analyze Solana token metrics, holder distribution, and on-chain activity. Use when asked to research a token, check holder concentration, or evaluate launch quality."
              rows={3}
              maxLength={500}
            />
          </label>
        </div>
      </section>

      {/* Step 2: Structure */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 style={{ margin: '0 0 12px' }}>2. Structure</h2>
        <div className="setup-info-grid">
          {STRUCTURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`setup-info-card ${structure === opt.value ? 'strategy-venue-tab active' : ''}`}
              onClick={() => setStructure(opt.value)}
              style={{ cursor: 'pointer', textAlign: 'left', border: structure === opt.value ? '1px solid var(--accent)' : undefined }}
            >
              <span className="setup-info-label">{opt.label}</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{opt.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Step 3: Resources */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 style={{ margin: '0 0 12px' }}>3. Bundled Resources (optional)</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['scripts', 'references', 'assets'] as ResourceType[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`strategy-venue-tab ${resources.has(r) ? 'active' : ''}`}
              onClick={() => toggleResource(r)}
            >
              {r === 'scripts' ? 'Scripts' : r === 'references' ? 'References' : 'Assets'}
            </button>
          ))}
        </div>
        <pre className="setup-terminal" style={{ marginTop: 12, fontSize: '0.82rem' }}>
          <code>{generateTreePreview()}</code>
        </pre>
      </section>

      {/* Step 4: Content */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 style={{ margin: '0 0 12px' }}>4. Content</h2>
        <div className="gallery-form">
          <label className="gallery-field">
            <span>Overview</span>
            <textarea
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="1-2 sentences explaining what this skill enables."
              rows={2}
            />
          </label>
          {sections.map((section, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="gallery-field"
                  value={section.title}
                  onChange={(e) => updateSection(index, 'title', e.target.value)}
                  placeholder={`Section ${index + 1} title`}
                  style={{ flex: 1 }}
                />
                {sections.length > 1 ? (
                  <button type="button" className="btn" onClick={() => removeSection(index)} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                    Remove
                  </button>
                ) : null}
              </div>
              <textarea
                value={section.content}
                onChange={(e) => updateSection(index, 'content', e.target.value)}
                placeholder="Section content (markdown)"
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>
          ))}
          <button type="button" className="btn" onClick={addSection} style={{ alignSelf: 'flex-start' }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Section
          </button>
        </div>
      </section>

      {/* Step 5: Preview & Export */}
      <section className="card" style={{ marginTop: 12 }}>
        <div className="gallery-panel-header">
          <div>
            <h2>5. Export & Publish</h2>
            <p>Download your SKILL.md, then upload it to the Hub or install via CLI.</p>
          </div>
          <Upload className="gallery-panel-icon" aria-hidden="true" />
        </div>

        <div className="setup-code-block" style={{ marginTop: 12, maxHeight: 300, overflow: 'auto' }}>
          <pre><code>{generateSkillMd()}</code></pre>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={handleDownload}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download SKILL.md
          </button>
          <button type="button" className="btn" onClick={() => void handleCopy()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <Link to="/upload" search={{ updateSlug: undefined }} className="btn">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload to Hub
          </Link>
        </div>

        <div className="setup-callout" style={{ marginTop: 16 }}>
          <strong>CLI Upload:</strong> You can also publish directly from your terminal:
          <pre style={{ margin: '8px 0 0', background: 'transparent', padding: 0, fontSize: '0.85rem' }}>
            <code>{`npx @nanosolana/nanohub publish ./${slug || 'my-skill'} --slug ${slug || 'my-skill'} --version 1.0.0`}</code>
          </pre>
        </div>
      </section>
    </main>
  )
}
