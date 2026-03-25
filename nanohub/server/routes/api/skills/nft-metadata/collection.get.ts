import { defineEventHandler, setHeader } from 'h3'
import { solanaOsCatalog } from '../../../../../src/lib/generated/solanaosCatalog'

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
  setHeader(event, 'Access-Control-Allow-Origin', '*')

  return {
    name: 'SolanaOS Skills',
    symbol: 'SKILLS',
    description: `${solanaOsCatalog.skillCount} AI agent skills from the SolanaOS ecosystem. Each NFT represents an installable skill for SolanaOS-compatible agents.`,
    image: 'https://solanaos.net/og.png',
    external_url: solanaOsCatalog.skillsHubUrl,
    attributes: [
      { trait_type: 'Total Skills', value: String(solanaOsCatalog.skillCount) },
      { trait_type: 'Total Packages', value: String(solanaOsCatalog.packageCount) },
      { trait_type: 'Repository', value: solanaOsCatalog.repositoryUrl },
    ],
  }
})
