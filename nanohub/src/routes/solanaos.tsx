import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { InstallSwitcher } from '../components/InstallSwitcher'
import { solanaOsCatalog } from '../lib/generated/solanaosCatalog'

export const Route = createFileRoute('/solanaos')({
  component: SolanaOsRoute,
})

function SolanaOsRoute() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const filteredPackages = useMemo(() => {
    if (!normalizedQuery) return solanaOsCatalog.packages
    return solanaOsCatalog.packages.filter((entry) =>
      `${entry.name} ${entry.path} ${entry.category} ${entry.summary} ${entry.keyFiles.join(' ')}`.toLowerCase().includes(normalizedQuery),
    )
  }, [normalizedQuery])

  const filteredSkills = useMemo(() => {
    if (!normalizedQuery) return solanaOsCatalog.skills
    return solanaOsCatalog.skills.filter((entry) =>
      `${entry.name} ${entry.path}`.toLowerCase().includes(normalizedQuery),
    )
  }, [normalizedQuery])

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">{solanaOsCatalog.siteUrl} / SolanaOS</span>
            <h1 className="hero-title">The SolanaOS computer system catalog for Seeker, gateway, agent, and on-chain runtime modules.</h1>
            <p className="hero-subtitle">
              Browse the full Go runtime surface from <code>pkg/</code>, inspect the public
              Seeker-linked computer modules that power SolanaOS, install downloadable skills built
              from this repo, and use the web backend as the public control plane instead of
              exposing local internals directly.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <a href="/mobile" className="btn btn-primary">
                See mobile dapp
              </a>
              <a href="#solanaos-skills" className="btn btn-primary">
                Download skills
              </a>
              <a href="#solanaos-packages" className="btn">
                Explore packages
              </a>
              <a href={solanaOsCatalog.troubleshootingUrl} className="btn">
                Troubleshooting
              </a>
            </div>
          </div>
          <div className="hero-card hero-search-card fade-up" data-delay="2">
            <div className="catalog-stats-grid">
              <div className="card">
                <div className="stat">Runtime packages</div>
                <strong>{solanaOsCatalog.packageCount}</strong>
              </div>
              <div className="card">
                <div className="stat">Downloadable skills</div>
                <strong>{solanaOsCatalog.skillCount}</strong>
              </div>
              <div className="card">
                <div className="stat">Backend surface</div>
                <strong>{solanaOsCatalog.backend.entries.length} files</strong>
              </div>
            </div>
            <div className="hero-install" style={{ marginTop: 18 }}>
              <div className="stat">Install SolanaOS skills from the hub CLI:</div>
              <InstallSwitcher exampleSlug="seeker-daemon-ops" />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <header className="skills-header-top">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            SolanaOS catalog search
          </h2>
          <p className="section-subtitle" style={{ marginBottom: 0 }}>
            Filter runtime packages and skills by name or path.
          </p>
        </header>
        <div className="skills-toolbar">
          <div className="skills-search">
            <input
              className="skills-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agent, gateway, solana, seeker-daemon-ops, pump..."
            />
          </div>
          <div className="stat">
            {filteredPackages.length.toLocaleString('en-US')} packages ·{' '}
            {filteredSkills.length.toLocaleString('en-US')} skills
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card solanaos-home-cta">
          <div>
            <h2 className="section-title" style={{ marginBottom: 8 }}>
              Seeker mobile dapp preview
            </h2>
            <p className="section-subtitle" style={{ marginBottom: 0 }}>
              Walk the current mobile experience as a public product page: pairing, registry,
              Grok, chat, ORE, canvas, and settings framed around the Seeker build we just shipped.
            </p>
          </div>
          <div className="solanaos-home-cta-actions">
            <a href="/mobile" className="btn btn-primary">
              Open mobile route
            </a>
            <a href="/pair" className="btn">
              Pair handoff
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Bundled mobile starter pack</h2>
        <p className="section-subtitle">
          The Android Seeker build now ships with a curated SolanaOS mobile skill pack and always
          points back to <code>{solanaOsCatalog.skillsHubUrl}</code> for the full catalog.
        </p>
        <div className="grid">
          {solanaOsCatalog.bundledMobileSkills.map((entry) => (
            <article key={entry.slug} className="card solanaos-feature-card">
              <div className="catalog-card-top">
                <h3 className="skill-card-title">{entry.title}</h3>
                <span className="tag tag-accent">{entry.slug}</span>
              </div>
              <p className="stat" style={{ margin: 0 }}>
                {entry.summary}
              </p>
              <div className="catalog-link-row">
                <a href={`${solanaOsCatalog.skillsHubUrl}#skill-${entry.slug}`}>Open on hub</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <header className="skills-header-top">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            SolanaOS computer system modules
          </h2>
          <p className="section-subtitle" style={{ marginBottom: 0 }}>
            Featured runtime groups from the Seeker-connected SolanaOS computer stack.
          </p>
        </header>
        <div className="grid">
          {solanaOsCatalog.featuredSections.map((section) => (
            <article key={section.title} className="card solanaos-feature-card">
              <div className="catalog-card-top">
                <h3 className="skill-card-title">{section.title}</h3>
                <span className="tag tag-accent">{section.packages.length} modules</span>
              </div>
              <p className="stat" style={{ margin: 0 }}>
                {section.summary}
              </p>
              <div className="solanaos-chip-row">
                {section.packages.map((name) => (
                  <a key={name} href={`#pkg-${name}`} className="tag solanaos-package-chip">
                    {name}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="solanaos-packages">
        <h2 className="section-title">Go runtime packages</h2>
        <p className="section-subtitle">
          Every top-level module under <code>pkg/</code>, grouped and described as part of the
          SolanaOS computer system.
        </p>
        <div className="grid">
          {filteredPackages.map((entry) => (
            <article key={entry.path} id={`pkg-${entry.name}`} className="card catalog-card">
              <div className="catalog-card-top">
                <h3 className="skill-card-title">{entry.name}</h3>
                <span className="tag">{entry.category}</span>
              </div>
              <p className="stat" style={{ margin: 0 }}>
                {entry.summary}
              </p>
              <code className="catalog-path">{entry.path}</code>
              <code className="catalog-command">{entry.importPath}</code>
              <div className="solanaos-package-meta">
                <span className="tag">{entry.fileCount} files</span>
                <span className="tag">{formatBytes(entry.sizeBytes)} of source</span>
              </div>
              {entry.keyFiles.length > 0 ? (
                <div className="solanaos-keyfiles">
                  <div className="stat">Key files</div>
                  <div className="solanaos-chip-row">
                    {entry.keyFiles.slice(0, 8).map((file) => (
                      <span key={file} className="tag">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="catalog-link-row">
                <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
                  View source
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="solanaos-skills">
        <h2 className="section-title">Downloadable skills</h2>
        <p className="section-subtitle">
          Skill folders from <code>skills/</code>, exported as static zip downloads during the
          site build.
        </p>
        <div className="grid">
          {filteredSkills.map((entry) => (
            <article key={entry.path} id={`skill-${entry.name}`} className="card catalog-card">
              <div className="catalog-card-top">
                <h3 className="skill-card-title">{entry.name}</h3>
                <span className="tag tag-accent">{entry.fileCount} files</span>
              </div>
              <code className="catalog-path">{entry.path}</code>
              <div className="stat">{formatBytes(entry.sizeBytes)} unpacked</div>
              <code className="catalog-command">{entry.install.npm}</code>
              <div className="catalog-link-row">
                <a href={entry.downloadUrl} download>
                  Download zip
                </a>
                <a href={entry.catalogUrl}>Hub entry</a>
                <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
                  View source
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Backend recommendation</h2>
        <p className="section-subtitle">
          Yes, this should connect to <code>web/backend</code>. That service is the right public
          edge for SolanaOS runtime actions, setup bundles, gateway access, and authenticated API
          calls.
        </p>
        <div className="card" style={{ gap: 16 }}>
          <p className="stat" style={{ margin: 0 }}>
            {solanaOsCatalog.backend.summary}
          </p>
          <div className="grid">
            {solanaOsCatalog.backend.entries.map((entry) => (
              <article key={entry.path} className="card catalog-card">
                <h3 className="skill-card-title">{entry.name}</h3>
                <code className="catalog-path">{entry.path}</code>
                <div className="stat">{entry.role}</div>
                <div className="catalog-link-row">
                  <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
                    View source
                  </a>
                </div>
              </article>
            ))}
          </div>
          <p className="stat" style={{ margin: 0 }}>
            <strong>Security:</strong> <code>web/backend/.env</code> is intentionally not surfaced
            here. Keep deploy secrets private and ship only the built backend service.
          </p>
        </div>
      </section>
    </main>
  )
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes >= 1_000_000) {
    return `${(sizeBytes / 1_000_000).toFixed(2)} MB`
  }
  if (sizeBytes >= 1_000) {
    return `${(sizeBytes / 1_000).toFixed(1)} KB`
  }
  return `${sizeBytes} B`
}
