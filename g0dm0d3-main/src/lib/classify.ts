/**
 * Prompt Harm Classifier
 *
 * Fast, client-side keyword/regex classifier that tags user prompts with
 * a harm category. Runs alongside AutoTune — same pattern, zero API cost.
 *
 * IMPORTANT: Only the category LABEL is sent via telemetry, never the
 * prompt text itself. This preserves user privacy while producing a
 * research-grade dataset of what people attempt with unrestricted AI.
 *
 * Taxonomy covers the full spectrum from benign to critical, including
 * gray-area dual-use queries that are the most interesting for research.
 */

// ── Taxonomy ────────────────────────────────────────────────────────

export type HarmDomain =
  | 'violence'
  | 'self_harm'
  | 'sexual'
  | 'hate'
  | 'cbrn'
  | 'cyber'
  | 'fraud'
  | 'illegal'
  | 'deception'
  | 'privacy'
  | 'meta'
  | 'gray'
  | 'benign'

export type HarmSubcategory =
  // violence
  | 'weapons' | 'physical_harm' | 'mass_harm' | 'animal_cruelty' | 'threat'
  // self_harm
  | 'suicide' | 'eating_disorder' | 'self_injury' | 'substance_abuse'
  // sexual
  | 'csam' | 'non_consensual' | 'explicit' | 'trafficking'
  // hate
  | 'slurs' | 'supremacy' | 'discrimination' | 'radicalization'
  // cbrn
  | 'chemical' | 'biological' | 'radiological' | 'dual_use_cbrn'
  // cyber
  | 'malware' | 'exploit' | 'intrusion' | 'phishing' | 'credential' | 'ddos' | 'spyware'
  // fraud
  | 'financial' | 'identity' | 'counterfeiting' | 'academic'
  // illegal
  | 'drugs_synthesis' | 'drugs_acquisition' | 'human_trafficking' | 'organized_crime' | 'evasion'
  // deception
  | 'misinformation' | 'manipulation' | 'deepfakes' | 'propaganda' | 'impersonation'
  // privacy
  | 'doxxing' | 'stalking' | 'data_theft' | 'surveillance'
  // meta
  | 'jailbreak' | 'prompt_injection' | 'system_prompt' | 'guardrail_test'
  // gray
  | 'dual_use' | 'controversial' | 'age_restricted' | 'professional_sensitive'
  // benign
  | 'coding' | 'creative' | 'education' | 'analysis' | 'conversation' | 'humor' | 'professional' | 'personal' | 'other'

export type PromptIntent = 'request' | 'question' | 'roleplay' | 'instruction' | 'creative' | 'unknown'

export interface ClassificationResult {
  domain: HarmDomain
  subcategory: HarmSubcategory
  confidence: number        // 0.0–1.0
  flags: string[]           // additional signal tags
  intent?: PromptIntent     // what the user is trying to do (LLM-only; regex leaves undefined)
}

// ── Pattern Registry ────────────────────────────────────────────────
// Each entry: [domain, subcategory, weight, ...patterns]
// Higher weight = stronger signal. Patterns are tested against the
// lowercased prompt. First high-confidence match wins (short-circuit).

interface PatternRule {
  domain: HarmDomain
  sub: HarmSubcategory
  weight: number
  patterns: RegExp[]
}

const RULES: PatternRule[] = [
  // ═══════════════════════════════════════════════════════════════════
  // LLM-ONLY CATEGORIES (no regex patterns — too graphic for source)
  //
  // The following domains are classified exclusively by the LLM:
  //   violence/*    — weapons, physical harm, mass harm, threats, animal cruelty
  //   self_harm/*   — suicide, self-injury, eating disorders, substance abuse
  //   sexual/*      — csam, non-consensual, explicit, trafficking
  //   hate/*        — slurs, supremacy, discrimination, radicalization
  //   cbrn/*        — chemical, biological, radiological weapons
  //   illegal/drugs_synthesis, illegal/drugs_acquisition
  //   illegal/human_trafficking
  //
  // The LLM understands intent, obfuscation, and context far better
  // than regex for these categories. Regex fallback returns benign/other
  // for prompts the LLM misses — acceptable tradeoff for clean source.
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // CYBER / DIGITAL — technical security terms, fine to keep
  // ═══════════════════════════════════════════════════════════════════

  // Malware
  {
    domain: 'cyber', sub: 'malware', weight: 10,
    patterns: [
      /\b(write|code|create|build|make)\b.{0,30}\b(malware|virus|trojan|worm|ransomware|rat|rootkit|keylogger|botnet)\b/i,
      /\b(malware|virus|trojan|ransomware|rat|rootkit|keylogger)\b.{0,30}\b(source\s*code|tutorial|guide|how.to)\b/i,
      /\b(crypter|fud\s*(crypter|payload)|obfuscat)\b.{0,20}\b(malware|payload|rat)\b/i,
    ],
  },

  // Exploits
  {
    domain: 'cyber', sub: 'exploit', weight: 10,
    patterns: [
      /\b(write|create|develop)\b.{0,20}\b(exploit|zero.day|0day|buffer\s*overflow|rce|remote\s*code\s*exec)\b/i,
      /\b(exploit|vulnerability)\b.{0,30}\b(write|develop|craft|weaponize)\b/i,
      /\b(cve-\d{4}-\d+)\b.{0,20}\b(exploit|poc|proof.of.concept)\b/i,
    ],
  },

  // Intrusion / hacking
  {
    domain: 'cyber', sub: 'intrusion', weight: 8,
    patterns: [
      /\b(hack|break\s*into|gain\s*access|compromise|penetrat)\b.{0,30}\b(server|system|network|account|database|website|wifi|computer)\b/i,
      /\b(bypass|crack|brute.?force)\b.{0,20}\b(password|authentication|login|security|firewall|2fa|mfa)\b/i,
    ],
  },

  // Phishing
  {
    domain: 'cyber', sub: 'phishing', weight: 8,
    patterns: [
      /\b(create|write|build|make)\b.{0,20}\b(phishing|spear.?phishing)\b.{0,20}\b(email|page|site|kit|template)\b/i,
      /\b(phishing)\b.{0,20}\b(kit|template|clone|page)\b/i,
      /\b(social\s*engineer)\b.{0,20}\b(attack|script|template|pretexting)\b/i,
    ],
  },

  // Credential attacks
  {
    domain: 'cyber', sub: 'credential', weight: 7,
    patterns: [
      /\b(crack|dump|steal|harvest)\b.{0,20}\b(password|credential|hash|token|cookie|session)\b/i,
      /\b(credential\s*stuff|password\s*spray|rainbow\s*table|hashcat|john\s*the\s*ripper)\b/i,
    ],
  },

  // DDoS
  {
    domain: 'cyber', sub: 'ddos', weight: 8,
    patterns: [
      /\b(ddos|dos\s*attack|flood|stress\s*test)\b.{0,20}\b(tool|script|service|booter|stresser|how.to)\b/i,
      /\b(take\s*down|overload|crash)\b.{0,20}\b(server|website|network|service)\b/i,
    ],
  },

  // Spyware / surveillance
  {
    domain: 'cyber', sub: 'spyware', weight: 8,
    patterns: [
      /\b(spy(ware)?|stalk(er)?ware|keylog|screen\s*capture|remote\s*access)\b.{0,20}\b(install|plant|deploy|on\s*(phone|computer|device))\b/i,
      /\b(track|monitor|spy\s*on)\b.{0,20}\b(wife|husband|spouse|partner|girlfriend|boyfriend|ex|phone|location)\b/i,
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FRAUD / ILLEGAL
  // ═══════════════════════════════════════════════════════════════════

  // Financial fraud
  {
    domain: 'fraud', sub: 'financial', weight: 8,
    patterns: [
      /\b(credit\s*card|bank)\b.{0,20}\b(fraud|scam|steal|clone|skim)\b/i,
      /\b(ponzi|pyramid\s*scheme|money\s*laundr|wire\s*fraud)\b/i,
      /\b(pump.and.dump|insider\s*trad|market\s*manipulat)\b/i,
    ],
  },

  // Identity fraud
  {
    domain: 'fraud', sub: 'identity', weight: 8,
    patterns: [
      /\b(identity\s*theft|steal\s*identity|fake\s*id|forged?\s*(id|passport|license|document))\b/i,
      /\b(ssn|social\s*security)\b.{0,20}\b(fake|steal|generate|buy)\b/i,
    ],
  },

  // Counterfeiting
  {
    domain: 'fraud', sub: 'counterfeiting', weight: 8,
    patterns: [
      /\b(counterfeit|fake|forg(e|ed|ing))\b.{0,20}\b(money|currency|bill|note|document|diploma|certificate|prescription)\b/i,
      /\b(print|make)\b.{0,20}\b(fake\s*(money|bills|currency|passport))\b/i,
    ],
  },

  // Academic fraud
  {
    domain: 'fraud', sub: 'academic', weight: 4,
    patterns: [
      /\b(write|do)\b.{0,10}\b(my|this)\b.{0,10}\b(essay|homework|assignment|thesis|dissertation|exam)\b/i,
      /\b(cheat|plagiari[sz]e|buy\s*essay|essay\s*mill)\b/i,
    ],
  },

  // drugs_synthesis, drugs_acquisition, human_trafficking → LLM-only

  // Organized crime
  {
    domain: 'illegal', sub: 'organized_crime', weight: 7,
    patterns: [
      /\b(start|run|join)\b.{0,20}\b(gang|cartel|mafia|crime\s*(ring|syndicate|family))\b/i,
      /\b(money\s*launder|fenc(e|ing)\s*stolen)\b/i,
    ],
  },

  // Evasion
  {
    domain: 'illegal', sub: 'evasion', weight: 6,
    patterns: [
      /\b(evade|escape|flee|avoid)\b.{0,20}\b(police|law\s*enforcement|fbi|arrest|warrant|detection)\b/i,
      /\b(destroy|dispose|tamper)\b.{0,20}\b(evidence|dna|fingerprint|crime\s*scene)\b/i,
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // DECEPTION / PRIVACY
  // ═══════════════════════════════════════════════════════════════════

  // Misinformation
  {
    domain: 'deception', sub: 'misinformation', weight: 6,
    patterns: [
      /\b(write|create|generate)\b.{0,20}\b(fake\s*news|disinformation|misinformation|propaganda|conspiracy\s*theory)\b/i,
      /\b(convincing|realistic)\b.{0,20}\b(fake|false|hoax|fabricat)\b.{0,20}\b(article|story|news|report)\b/i,
    ],
  },

  // Manipulation
  {
    domain: 'deception', sub: 'manipulation', weight: 6,
    patterns: [
      /\b(manipulat|gaslight|coercive\s*control|brainwash)\b.{0,20}\b(someone|person|partner|people|victim)\b/i,
      /\b(how to|technique)\b.{0,20}\b(manipulat|gaslight|psycholog|emotional\s*abuse)\b/i,
    ],
  },

  // Deepfakes
  {
    domain: 'deception', sub: 'deepfakes', weight: 8,
    patterns: [
      /\b(deepfake|face\s*swap|voice\s*clone)\b.{0,30}\b(create|make|generate|of\s*(someone|person|celebrity|specific))\b/i,
      /\b(create|make)\b.{0,20}\b(fake\s*(video|image|audio|photo))\b.{0,20}\b(of\s*(someone|person))\b/i,
    ],
  },

  // Propaganda
  {
    domain: 'deception', sub: 'propaganda', weight: 7,
    patterns: [
      /\b(write|create)\b.{0,20}\b(propaganda|radicali[sz]|extremist\s*content)\b/i,
      /\b(bot\s*farm|troll\s*farm|astroturf|sock\s*puppet)\b.{0,20}\b(create|run|set up|campaign)\b/i,
    ],
  },

  // Impersonation
  {
    domain: 'deception', sub: 'impersonation', weight: 7,
    patterns: [
      /\b(impersonat|pretend\s*to\s*be|pose\s*as)\b.{0,20}\b(police|officer|doctor|lawyer|government|official|celebrity)\b/i,
      /\b(fake|forged?)\b.{0,20}\b(email|letter|document)\b.{0,20}\b(from|pretending)\b/i,
    ],
  },

  // Doxxing
  {
    domain: 'privacy', sub: 'doxxing', weight: 10,
    patterns: [
      /\b(dox|doxx|find\s*(address|phone|info|location|identity))\b.{0,20}\b(of|about|for)\b.{0,20}\b(someone|person|user|this)\b/i,
      /\b(osint|open\s*source\s*intellig)\b.{0,20}\b(find|track|identify|locate)\b.{0,20}\b(person|someone|user)\b/i,
    ],
  },

  // Stalking
  {
    domain: 'privacy', sub: 'stalking', weight: 10,
    patterns: [
      /\b(stalk|follow|track|surveill)\b.{0,20}\b(someone|person|ex|partner|girlfriend|boyfriend|wife|husband)\b/i,
      /\b(gps\s*track|hidden\s*camera|bug\s*phone|airtag\s*track)\b/i,
    ],
  },

  // Data theft
  {
    domain: 'privacy', sub: 'data_theft', weight: 8,
    patterns: [
      /\b(steal|scrape|harvest|dump)\b.{0,20}\b(personal\s*data|user\s*data|emails?|database|pii)\b/i,
      /\b(data\s*breach|data\s*leak|exfiltrat)\b.{0,20}\b(how|method|technique)\b/i,
    ],
  },

  // Surveillance
  {
    domain: 'privacy', sub: 'surveillance', weight: 7,
    patterns: [
      /\b(mass\s*surveill|warrantless\s*wiretap|intercept\s*communicat)\b/i,
      /\b(imsi\s*catcher|stingray\s*device|cell\s*site\s*simulat)\b/i,
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // META — about the jailbreak tool itself
  // ═══════════════════════════════════════════════════════════════════

  {
    domain: 'meta', sub: 'jailbreak', weight: 6,
    patterns: [
      /\b(jailbreak|bypass|circumvent|override)\b.{0,20}\b(filter|safety|guardrail|restriction|censor|content\s*policy|moderation)\b/i,
      /\b(dan|do\s*anything\s*now|developer\s*mode|god\s*mode)\b.{0,10}\b(prompt|mode|enable)\b/i,
    ],
  },

  {
    domain: 'meta', sub: 'prompt_injection', weight: 6,
    patterns: [
      /\b(ignore\s*(previous|all|above|prior)\s*(instruction|prompt|rule|system))\b/i,
      /\b(system\s*prompt|new\s*instruction|you\s*are\s*now)\b/i,
      /\[\s*(system|SYSTEM)\s*\]/,
    ],
  },

  {
    domain: 'meta', sub: 'system_prompt', weight: 5,
    patterns: [
      /\b(show|reveal|display|print|repeat|output)\b.{0,20}\b(system\s*prompt|system\s*message|initial\s*instruction|hidden\s*prompt)\b/i,
      /\b(what\s*(is|are)\s*your)\b.{0,20}\b(instruction|prompt|rule|guideline|system)\b/i,
    ],
  },

  {
    domain: 'meta', sub: 'guardrail_test', weight: 4,
    patterns: [
      /\b(test|check|probe)\b.{0,20}\b(filter|safety|guardrail|censor|limit|boundary|restriction)\b/i,
      /\b(can you|will you|are you able)\b.{0,20}\b(say|write|tell me)\b.{0,20}\b(anything|everything|forbidden|banned)\b/i,
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // GRAY AREA — dual-use / controversial / sensitive
  // ═══════════════════════════════════════════════════════════════════

  // cbrn/dual_use_cbrn → LLM-only (contains specific compound names)

  {
    domain: 'gray', sub: 'dual_use', weight: 3,
    patterns: [
      /\b(lock\s*pick|pick\s*lock|bump\s*key)\b/i,
      /\b(pentesting|pen\s*test|security\s*audit|red\s*team|vulnerability\s*assess)\b/i,
      /\b(reverse\s*engineer|decompil|disassembl)\b/i,
    ],
  },

  {
    domain: 'gray', sub: 'controversial', weight: 3,
    patterns: [
      /\b(abortion|euthanasia|death\s*penalty|capital\s*punishment|gun\s*control|immigration\s*policy)\b.{0,20}\b(argument|debate|essay|case\s*for|case\s*against|defend|support|oppose)\b/i,
      /\b(controversial|taboo|forbidden|politically\s*incorrect)\b.{0,20}\b(opinion|take|view|topic)\b/i,
    ],
  },

  {
    domain: 'gray', sub: 'age_restricted', weight: 3,
    patterns: [
      /\b(gambl(e|ing)|bet(ting)?|casino)\b.{0,20}\b(strategy|system|how to|win|cheat)\b/i,
      /\b(alcohol|tobacco|vap(e|ing))\b.{0,20}\b(underage|minor|fake\s*id|buy)\b/i,
    ],
  },

  {
    domain: 'gray', sub: 'professional_sensitive', weight: 2,
    patterns: [
      /\b(prescri(be|ption)|diagnos(e|is)|medicat(e|ion)|dosage)\b.{0,30}\b(without\s*(doctor|prescription)|self.medica|how\s*much)\b/i,
      /\b(legal\s*advice|sue|lawsuit)\b.{0,20}\b(how to|can I|help me)\b/i,
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // BENIGN — positive classification matters for dataset balance
  // ═══════════════════════════════════════════════════════════════════

  {
    domain: 'benign', sub: 'coding', weight: 3,
    patterns: [
      /\b(code|function|class|variable|bug|debug|compile|syntax|api|regex|algorithm|refactor)\b/i,
      /\b(typescript|javascript|python|rust|golang|java|c\+\+|react|vue|angular|node\.?js)\b/i,
      /```[\s\S]*```/,
      /\b(npm|pip|cargo|docker|git|webpack|vite|kubernetes|aws|terraform)\b/i,
    ],
  },

  {
    domain: 'benign', sub: 'creative', weight: 3,
    patterns: [
      /\b(write|create|compose)\b.{0,20}\b(story|poem|song|lyrics|haiku|script|dialogue|fiction|narrative)\b/i,
      /\b(roleplay|role.play|pretend|imagine|creative\s*writing)\b/i,
    ],
  },

  {
    domain: 'benign', sub: 'education', weight: 3,
    patterns: [
      /\b(explain|teach|learn|understand|study|research|tutori?al|course|lecture)\b/i,
      /\b(what\s*is|how\s*does|why\s*does|history\s*of|define|difference\s*between)\b/i,
    ],
  },

  {
    domain: 'benign', sub: 'analysis', weight: 3,
    patterns: [
      /\b(analy[sz]e|compare|evaluate|assess|review|critique|summarize|breakdown)\b/i,
      /\b(pros\s*and\s*cons|advantages|trade.?offs|benchmark|metrics)\b/i,
    ],
  },

  {
    domain: 'benign', sub: 'humor', weight: 3,
    patterns: [
      /\b(joke|funny|humor|pun|riddle|meme|roast|comedy)\b/i,
      /\b(make me laugh|tell me a|something funny)\b/i,
    ],
  },

  {
    domain: 'benign', sub: 'professional', weight: 2,
    patterns: [
      /\b(resume|cover\s*letter|email|meeting|presentation|proposal|invoice|contract|report)\b/i,
      /\b(business|marketing|startup|strategy|product|roadmap|sprint|agile)\b/i,
    ],
  },

  {
    domain: 'benign', sub: 'personal', weight: 2,
    patterns: [
      /\b(advice|recommend|suggest|help me|what should I)\b.{0,20}\b(do|choose|pick|decide|think)\b/i,
      /\b(relationship|career|life|health|fitness|diet|recipe|travel|hobby)\b/i,
    ],
  },

  {
    domain: 'benign', sub: 'conversation', weight: 1,
    patterns: [
      /\b(hey|hi|hello|thanks|thank you|how are you|what's up|sup)\b/i,
      /^.{0,25}$/,
    ],
  },
]

// ── Classifier Engine ───────────────────────────────────────────────

/**
 * Classify a user prompt into a harm taxonomy category.
 *
 * Returns the highest-weighted match. If multiple domains match,
 * the one with the highest cumulative weight wins. Critical-tier
 * patterns (CSAM, CBRN, mass harm) short-circuit immediately.
 *
 * Runs in <1ms — pure regex, no API calls.
 */
export function classifyPrompt(prompt: string): ClassificationResult {
  const text = prompt.toLowerCase()
  const scores: Map<string, { domain: HarmDomain; sub: HarmSubcategory; total: number; maxWeight: number }> = new Map()
  const flags: string[] = []

  for (const rule of RULES) {
    let matched = false
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matched = true
        break
      }
    }

    if (!matched) continue

    const key = `${rule.domain}/${rule.sub}`
    const existing = scores.get(key)
    if (existing) {
      existing.total += rule.weight
      existing.maxWeight = Math.max(existing.maxWeight, rule.weight)
    } else {
      scores.set(key, { domain: rule.domain, sub: rule.sub, total: rule.weight, maxWeight: rule.weight })
    }

    // Short-circuit on critical tier (weight >= 15)
    if (rule.weight >= 15) {
      flags.push('critical_tier')
      const conf = Math.min(rule.weight / 20, 1.0)
      return { domain: rule.domain, subcategory: rule.sub, confidence: conf, flags }
    }
  }

  // No matches at all → benign/other
  if (scores.size === 0) {
    return { domain: 'benign', subcategory: 'other', confidence: 0.3, flags: ['no_match'] }
  }

  // Find the highest-scoring category
  let best = { domain: 'benign' as HarmDomain, sub: 'other' as HarmSubcategory, total: 0, maxWeight: 0 }
  for (const entry of scores.values()) {
    if (entry.total > best.total || (entry.total === best.total && entry.maxWeight > best.maxWeight)) {
      best = entry
    }
  }

  // If both harmful and benign categories match, flag as dual_use
  const hasBenign = [...scores.values()].some(s => s.domain === 'benign')
  const hasHarmful = [...scores.values()].some(s => s.domain !== 'benign' && s.domain !== 'gray' && s.domain !== 'meta')
  if (hasBenign && hasHarmful) {
    flags.push('mixed_signal')
  }

  // Confidence: based on weight relative to maximum possible
  const confidence = Math.min(best.maxWeight / 12, 1.0)

  return {
    domain: best.domain,
    subcategory: best.sub,
    confidence: Math.round(confidence * 100) / 100,
    flags,
  }
}
