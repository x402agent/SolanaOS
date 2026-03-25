import { defineEventHandler, createError, setHeader } from 'h3'
import { solanaOsCatalog } from '../../../../../src/lib/generated/solanaosCatalog'

type CatalogSkill = (typeof solanaOsCatalog.skills)[number]

const COLLECTION_IMAGE = 'https://solanaos.net/og.png'
const SITE_URL = 'https://solanaos.net'

function buildSkillMetadata(skill: CatalogSkill) {
  return {
    name: `SolanaOS: ${skill.name}`,
    symbol: 'SKILL',
    description: `${skill.name} — an AI agent skill from the SolanaOS ecosystem. Install with: ${skill.install.bun}`,
    image: COLLECTION_IMAGE,
    external_url: skill.catalogUrl,
    attributes: [
      { trait_type: 'Category', value: 'AI Agent Skill' },
      { trait_type: 'Skill Name', value: skill.name },
      { trait_type: 'File Count', value: String(skill.fileCount) },
      { trait_type: 'Size Bytes', value: String(skill.sizeBytes) },
      { trait_type: 'Source', value: skill.sourceUrl },
    ],
    properties: {
      files: [
        { uri: skill.downloadUrl, type: 'application/zip' },
      ],
      category: 'other',
    },
  }
}

export default defineEventHandler((event) => {
  const name = (event.context.params as Record<string, string>)?.name
  if (!name) {
    throw createError({ statusCode: 400, message: 'Missing skill name' })
  }

  const skill = solanaOsCatalog.skills.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  )
  if (!skill) {
    throw createError({ statusCode: 404, message: `Skill "${name}" not found` })
  }

  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
  setHeader(event, 'Access-Control-Allow-Origin', '*')

  return buildSkillMetadata(skill)
})
