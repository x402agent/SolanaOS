# G0DM0D3: A Modular Research Framework for Evaluating LLM Robustness Through Adaptive Sampling, Input Perturbation, and Multi-Model Safety Assessment

**Anonymous Authors**

---

## Abstract

We present G0DM0D3, an open-source research framework for systematically evaluating large language model (LLM) robustness and safety properties at inference time. The framework comprises five independently composable modules designed for AI safety researchers: (1) **AutoTune**, a context-adaptive sampling parameter engine that classifies conversational context via regex-based pattern scoring and maps to optimized parameter profiles across six dimensions, enabling researchers to study how sampling configuration affects model safety behaviors; (2) **Parseltongue**, a configurable input perturbation engine for red-teaming that detects sensitive trigger words and applies one of six character-level transformation techniques (leetspeak, Unicode homoglyphs, zero-width joiners, mixed case, phonetic substitution, and randomized mixing), providing a systematic framework for evaluating model robustness to character-level adversarial inputs; (3) **Semantic Transformation Modules (STM)**, a sequential output normalization pipeline that strips hedging, preambles, and formality markers from model responses, enabling cleaner evaluation of underlying model capabilities and safety-relevant content; and (4) **ULTRAPLINIAN**, a multi-model comparative evaluation system that races N models (up to 51 across five tiers) in parallel with a 100-point composite scoring metric, enabling cross-provider safety behavior comparison at scale. An **online feedback loop** adapts sampling parameters via Exponential Moving Average (EMA) learning from binary researcher ratings, supporting iterative safety evaluation protocols. All modules are implemented in TypeScript and exposed via a REST API with a three-tier privacy-first telemetry and data collection architecture — always-on operational metadata (ZDR), client-side structural telemetry, and opt-in dataset collection — designed to support longitudinal analysis and reproducibility of safety research. We evaluate all five modules through computational experiments: AutoTune achieves 84.0% classification accuracy (macro F1: 84.2%) across 150 labeled test messages; the feedback loop converges to 29–62% parameter distance improvement within 19 ratings; STM achieves 100% precision and recall on a 77-case benchmark; the ULTRAPLINIAN scoring function achieves strict quality-tier ordering with 82-point discrimination; and Parseltongue achieves 100% trigger detection rate across all 54 default triggers and 6 positional variations. We discuss implications for AI alignment research, including how inference-time perturbation tools can contribute to understanding model safety boundaries without requiring weight-level access.

**Repository**: *Withheld for anonymous review*

---

## 1. Introduction

As large language models are deployed in increasingly high-stakes settings, the AI safety community faces a critical challenge: how to systematically evaluate model robustness and safety properties without requiring access to model weights, training pipelines, or provider-internal tooling. Current safety evaluation approaches — red teaming (Ganguli et al., 2022; Perez et al., 2022), automated adversarial attacks (Zou et al., 2023), and benchmark-based assessment (Mazeika et al., 2024) — have advanced our understanding of model vulnerabilities, but most require either white-box access, expensive gradient-based optimization, or manual prompt engineering.

A complementary approach, which we explore in this work, is **inference-time safety evaluation**: using only the standard chat completion API to systematically probe model behavior across diverse contexts, input perturbations, and sampling configurations. This approach has several advantages for alignment research: it works with any model behind an API (including proprietary models), requires no training data or compute beyond inference costs, and produces evaluation artifacts (parameter configurations, perturbation patterns, cross-model comparisons) that can be shared as open datasets.

Modern LLM APIs expose sampling parameters (temperature, top\_p, top\_k, penalties) that significantly affect model behavior, yet their interaction with safety-relevant outputs — refusal rates, hedging behavior, compliance boundaries — remains understudied. Similarly, models exhibit systematic output patterns (hedging, preambles, formal register) that complicate safety evaluation by masking the underlying model disposition behind surface-level linguistic artifacts.

G0DM0D3 addresses these research needs through a modular framework operating entirely at inference time, requiring no model fine-tuning, no weight access, and no provider-specific APIs beyond the standard chat completion interface. The system is implemented in approximately 3,300 lines of TypeScript and operates through the OpenRouter multi-model gateway.

**Contributions grounded in this repository:**

1. **AutoTune** (`src/lib/autotune.ts`, 639 lines): A context-adaptive sampling parameter engine that classifies conversations into five context types using 20 regex patterns, then selects optimized parameter profiles across six sampling dimensions. For safety research, this enables systematic study of how sampling configuration interacts with model safety behaviors across different conversational contexts.

2. **Online Feedback Loop** (`src/lib/autotune-feedback.ts`): An EMA-based learning system (α=0.3) that adjusts AutoTune parameters from binary researcher ratings, supporting iterative safety evaluation protocols where researchers converge on parameter configurations that reveal specific safety-relevant behaviors.

3. **Parseltongue** (`src/lib/parseltongue.ts`, 433 lines): A configurable input perturbation engine for red-teaming research, with 36 default trigger words, six transformation techniques (comprising 85 leetspeak substitutions, 72 Unicode homoglyph substitutions, and 4 zero-width Unicode characters), and three intensity levels. This provides a systematic, reproducible framework for evaluating model robustness to character-level adversarial inputs — a complement to semantic-level attacks studied in prior work (Zou et al., 2023; Wei et al., 2023).

4. **STM** (`src/stm/modules.ts`, 154 lines): A sequential output normalization pipeline with three modules — hedge\_reducer (11 regex patterns), direct\_mode (10 regex patterns), and casual\_mode (22 word substitutions) — that strips surface-level linguistic artifacts to enable cleaner evaluation of underlying model safety dispositions.

5. **ULTRAPLINIAN** (`api/lib/ultraplinian.ts`, 360 lines): A multi-model comparative evaluation system querying up to 51 models across five tiers (fast: 10, standard: 24, smart: 36, power: 45, ultra: 51) in parallel, scoring responses on a 100-point composite metric, and returning full race metadata — enabling cross-provider safety behavior analysis at scale.

6. **Dataset Collection** (`api/lib/dataset.ts`, 162 lines): An opt-in, per-request data collection system that records anonymized evaluation metadata (AutoTune parameters, context detection results, Parseltongue transformations, STM modules applied, ULTRAPLINIAN race scores) for building open safety research datasets.

7. **ZDR Metadata and Telemetry** (`api/lib/metadata.ts`, `src/lib/telemetry.ts`, `api/lib/hf-publisher.ts`): A three-tier privacy-first operational telemetry architecture comprising always-on server-side metadata tracking, client-side structural telemetry beacons, and the opt-in dataset system above. PII exclusion is enforced by construction (schema has no PII fields). In-memory ring buffers auto-publish to HuggingFace as JSONL, enabling longitudinal analysis of steering primitive usage patterns without recording any message content, prompts, responses, API keys, or IP addresses.

---

## 2. Related Work

**AI safety evaluation and red teaming.** The need for systematic safety evaluation has been articulated across the alignment research community (Amodei et al., 2016; Hendrycks et al., 2021). Red teaming — the practice of adversarially probing models to discover failures — has emerged as a core methodology, with approaches ranging from human red teams (Ganguli et al., 2022) to automated model-based red teaming (Perez et al., 2022) to standardized benchmarks like HarmBench (Mazeika et al., 2024). Shen et al. (2024) characterize in-the-wild jailbreak prompts, while Chao et al. (2023) demonstrate black-box jailbreaking. G0DM0D3 contributes to this landscape by providing a modular, configurable framework for systematic robustness evaluation at the character level, complementing semantic-level approaches.

**Adversarial robustness of LLMs.** GCG (Zou et al., 2023) discovers universal adversarial suffixes through gradient-based optimization, demonstrating that aligned models remain vulnerable to optimized perturbations. Wei et al. (2023) taxonomize safety training failures into competing objectives and mismatched generalization — categories that Parseltongue's character-level perturbations are well-positioned to probe. Indirect prompt injection (Greshake et al., 2023) exploits LLM-integrated applications. Liu et al. (2024) empirically study prompt engineering as a jailbreak vector. Parseltongue differs from these approaches by operating at the character level (not the semantic level) and by being fully configurable rather than discovered through search, making it suitable for systematic robustness studies.

**Safety and alignment through training.** Constitutional AI (Bai et al., 2022), RLHF (Ouyang et al., 2022; Stiennon et al., 2020), and DPO (Rafailov et al., 2023) represent the dominant paradigm: aligning models by updating weights through human feedback or constitutional principles. Qi et al. (2024) demonstrate that fine-tuning can compromise safety even without malicious intent. G0DM0D3's approach is complementary — rather than modifying model behavior through training, it provides tools for *evaluating* the robustness of safety training at inference time, through parameter variation, input perturbation, and cross-model comparison.

**Sampling strategies and parameter control.** The temperature parameter controls output distribution entropy (Ackley et al., 1985). Top-k sampling (Fan et al., 2018) and nucleus sampling (Holtzman et al., 2020) control the candidate token set. These parameters interact non-linearly and their optimal values depend on the task. AutoTemp (Plinius, 2024) selects temperatures via a judge model at N× cost. AutoTune classifies input context *before* generation at zero marginal cost. From a safety perspective, the interaction between sampling parameters and model compliance boundaries remains understudied — AutoTune's context-adaptive approach enables systematic exploration of this interaction space.

**Multi-model selection and safety comparison.** Mixture-of-Agents (Wang et al., 2024) and LLM-Blender (Jiang et al., 2023) aggregate outputs via learned rankers. RouteLLM (Ong et al., 2024) learns routing policies from preference data. FrugalGPT (Chen et al., 2023) proposes cost-efficient cascades. ULTRAPLINIAN races all N models in parallel with rule-based scoring — a more expensive but training-free approach. For safety research, this enables direct comparison of how different models respond to the same input under identical conditions, providing a foundation for cross-provider safety analysis.

**LLM evaluation and scoring.** MT-Bench and Chatbot Arena (Zheng et al., 2024) establish human preference as the gold standard. AlpacaEval (Li et al., 2023) uses GPT-4 as an automatic evaluator. ULTRAPLINIAN's rule-based scoring is a deliberately simpler alternative requiring no judge model, with explicit axes (anti-refusal, directness) that capture safety-relevant behavioral differences between models.

**Output post-processing.** Controllable generation methods (Dathathri et al., 2020; Yang & Klein, 2021) modify generation via gradient-based steering, requiring model internals. STM operates on completed text via regex substitution, serving a different purpose in the safety research context: normalizing output artifacts to enable cleaner assessment of underlying model dispositions rather than surface-level compliance patterns.

---

## 3. Method

### 3.1 System Architecture

G0DM0D3 is designed as a modular safety research pipeline where each component can be independently enabled, configured, and studied in isolation. The framework processes a research query through up to five stages, each independently toggleable:

```
User Input
    │
    ├─→ [1] AutoTune: Classify context → Select sampling parameters
    │
    ├─→ [2] Feedback Loop: Blend learned adjustments into parameters
    │
    ├─→ [3] Parseltongue: Detect triggers → Obfuscate input text
    │
    ├─→ [4] Inference: Single model (chat) or N models (ULTRAPLINIAN)
    │        └─→ ULTRAPLINIAN: Race → Score → Select winner
    │
    ├─→ [5] STM: Apply output transformations sequentially
    │
    └─→ [6] ZDR: Record operational metadata (always-on, no content)
              ├─→ Tier 1: Server metadata → ring buffer → HuggingFace
              ├─→ Tier 2: Client telemetry → beacon → HuggingFace
              └─→ Tier 3: Opt-in dataset → buffer → HuggingFace
```

Each module is a pure function (or set of pure functions) with no shared mutable state except the feedback loop's learned profiles, which accumulate across requests.

### 3.2 AutoTune: Context-Adaptive Parameter Selection

**Problem.** Given a user message $m$ and conversation history $H = [h_1, \ldots, h_k]$, select a parameter vector $\theta = (\tau, p, k, f, r, \rho)$ where $\tau$ = temperature, $p$ = top\_p, $k$ = top\_k, $f$ = frequency\_penalty, $r$ = presence\_penalty, $\rho$ = repetition\_penalty.

**Context Detection.** We define five context types $C = \{$`code`, `creative`, `analytical`, `conversational`, `chaotic`$\}$ and associate each with a set of regex patterns $P_c$ (see Table 1 for counts). Detection proceeds by scoring:

$$s_c = 3 \cdot \sum_{p \in P_c} \mathbb{1}[p \text{ matches } m] + \sum_{i=\max(1,k-3)}^{k} \sum_{p \in P_c} \mathbb{1}[p \text{ matches } h_i]$$

The current message is weighted 3× relative to each of the last 4 history messages (weighted 1× each). The detected context is $c^* = \arg\max_c s_c$, with confidence $\gamma = s_{c^*} / \sum_c s_c$. If no patterns match ($\sum_c s_c = 0$), the system defaults to `conversational` with $\gamma = 0.5$.

*Implementation: `detectContext()` in `src/lib/autotune.ts:212–296`.*

**Parameter Selection.** Each context type maps to a fixed parameter profile $\theta_c$ (Table 2). When confidence is low ($\gamma < 0.6$), the profile is blended with the `balanced` baseline:

$$\theta = (1 - (1 - \gamma)) \cdot \theta_{c^*} + (1 - \gamma) \cdot \theta_{\text{balanced}}$$

This is linear interpolation parameterized by $\gamma$, implemented as:

```
blendParams(contextProfile, balancedProfile, 1 - confidence)
```

*Implementation: `blendParams()` in `src/lib/autotune.ts:354–365`.*

**Conversation Length Adaptation.** For conversations exceeding 10 messages, a monotonically increasing penalty boost is applied:

$$\Delta\rho = \min((|H| - 10) \times 0.01, 0.15)$$
$$\rho \leftarrow \rho + \Delta\rho, \quad f \leftarrow f + 0.5 \cdot \Delta\rho$$

This addresses repetition accumulation in long conversations. The boost is capped at 0.15.

*Implementation: `computeAutoTuneParams()` lines 441–464 in `src/lib/autotune.ts`.*

**Bounds Enforcement.** All parameters are clamped to valid API ranges:

| Parameter | Min | Max |
|-----------|-----|-----|
| temperature | 0.0 | 2.0 |
| top\_p | 0.0 | 1.0 |
| top\_k | 1 | 100 |
| frequency\_penalty | -2.0 | 2.0 |
| presence\_penalty | -2.0 | 2.0 |
| repetition\_penalty | 0.0 | 2.0 |

*Implementation: `applyBounds()` in `src/lib/autotune.ts:340–349`.*

**Table 1: Context Detection Pattern Counts**

| Context Type | Pattern Count | Example Patterns (abbreviated) |
|-------------|--------------|-------------------------------|
| code | 5 | `/\b(code\|function\|class\|...)\b/i`, `/```[\s\S]*```/`, `/[{}();=><]/` |
| creative | 4 | `/\b(write\|story\|poem\|...)\b/i`, `/\b(roleplay\|role-play\|...)\b/i` |
| analytical | 4 | `/\b(analyze\|analysis\|compare\|...)\b/i`, `/\b(why\|how does\|...)\b/i` |
| conversational | 3 | `/\b(hey\|hi\|hello\|...)\b/i`, `/^.{0,30}$/` (short messages) |
| chaotic | 4 | `/\b(chaos\|random\|wild\|...)\b/i`, `/(!{3,}\|\?{3,}\|\.{4,})/` |
| **Total** | **20** | |

**Table 2: Context-to-Parameter Profiles**

| Context | τ | p | k | f | r | ρ |
|---------|------|------|-----|------|------|------|
| code | 0.15 | 0.80 | 25 | 0.20 | 0.00 | 1.05 |
| creative | 1.15 | 0.95 | 85 | 0.50 | 0.70 | 1.20 |
| analytical | 0.40 | 0.88 | 40 | 0.20 | 0.15 | 1.08 |
| conversational | 0.75 | 0.90 | 50 | 0.10 | 0.10 | 1.00 |
| chaotic | 1.70 | 0.99 | 100 | 0.80 | 0.90 | 1.30 |

### 3.3 Online Feedback Loop

**Problem.** Adapt parameter profiles over time using binary user ratings (thumbs up/down) without retraining.

**Data Collection.** For each rated response, the system computes three heuristics from the response text:

1. **Trigram repetition score**: Count of repeated character trigrams divided by total trigrams.
2. **Vocabulary diversity**: Unique words divided by total words.
3. **Response length**: Character count.

*Implementation: `computeHeuristics()` in `src/lib/autotune-feedback.ts`.*

**EMA Update.** For each context type, the system maintains separate running averages of parameters associated with positive and negative ratings:

$$\bar{\theta}^+_c \leftarrow \alpha \cdot \theta_{\text{rated}} + (1 - \alpha) \cdot \bar{\theta}^+_c \quad \text{if rating = +1}$$
$$\bar{\theta}^-_c \leftarrow \alpha \cdot \theta_{\text{rated}} + (1 - \alpha) \cdot \bar{\theta}^-_c \quad \text{if rating = -1}$$

where $\alpha = 0.3$ (hardcoded as `EMA_ALPHA` in `src/lib/autotune-feedback.ts`).

**Adjustment Computation.** The per-parameter adjustment for context type $c$ is:

$$\Delta_c = 0.5 \cdot (\bar{\theta}^+_c - \theta_{\text{base}}) - 0.5 \cdot (\bar{\theta}^-_c - \theta_{\text{base}})$$

*Implementation: `computeAdjustments()` in `src/lib/autotune-feedback.ts`.*

**Application Weight.** Learned adjustments are weighted by sample count, capping influence at 50%:

$$w = \min\left(\frac{n_c}{20} \cdot 0.5, \; 0.5\right)$$

where $n_c$ is the total number of ratings for context type $c$. The constants `MIN_SAMPLES_TO_APPLY = 3` and `SAMPLES_FOR_MAX_WEIGHT = 20` gate and scale the application. No adjustments are applied until at least 3 samples are collected.

$$\theta_{\text{final}} = \theta_{\text{base}} + w \cdot \Delta_c$$

*Implementation: `applyLearnedAdjustments()` in `src/lib/autotune-feedback.ts`.*

**History Management.** Feedback records are stored in a bounded buffer (`MAX_HISTORY = 500`). When exceeded, the oldest entries are evicted.

### 3.4 Parseltongue: Input Perturbation for Robustness Evaluation

**Problem.** Given input text $t$ containing words from a trigger set $T$, produce a transformed text $t'$ where trigger words are character-level perturbed while preserving approximate human readability. This enables systematic evaluation of model robustness to character-level adversarial inputs — a capability relevant to understanding how safety training generalizes (or fails to generalize) across input representations (Wei et al., 2023).

**Trigger Detection.** The default trigger set $|T| = 36$ words spanning seven categories (action verbs, security terms, sensitive topics, system terms, social engineering, content flags, AI-specific). Detection uses word-boundary regex matching:

$$\text{triggers}(t) = \{w \in T \cup T_{\text{custom}} : \texttt{/\\b} w \texttt{\\b/gi.test}(t)\}$$

where $T_{\text{custom}}$ is a user-provided set of additional triggers. Matches are deduplicated. Triggers are sorted by length (longest first) before transformation to prevent partial-match corruption.

*Implementation: `detectTriggers()` in `src/lib/parseltongue.ts:306–323`.*

**Transformation Techniques.** Six techniques are implemented:

| Technique | Mechanism | Character Map Size |
|-----------|-----------|-------------------|
| `leetspeak` | Replace characters with visually similar ASCII symbols | 26 chars → 85 substitutions |
| `unicode` | Replace with Unicode homoglyphs (Cyrillic, Greek, fullwidth) | 24 chars → 72 substitutions |
| `zwj` | Insert zero-width Unicode characters between letters | 4 ZW characters (U+200B, U+200C, U+200D, U+FEFF) |
| `mixedcase` | Disrupt casing patterns (random, alternating, or single flip) | N/A |
| `phonetic` | Replace with phonetically equivalent spellings | 6 regex substitution rules |
| `random` | Randomly select one of {leetspeak, unicode, zwj, mixedcase} per word | Composite |

**Intensity Control.** The `intensity` parameter controls how many characters within each trigger word are transformed:

- `light`: 1 character per word
- `medium`: $\lceil |w| / 2 \rceil$ characters per word
- `heavy`: all characters

For `leetspeak`, character selection is spread throughout the word using a step-based index ($\text{step} = \lfloor |w| / \text{count} \rfloor$), with fallback to sequential selection if insufficient transformable characters are found at the stepped positions.

*Implementation: `applyLeetspeak()` in `src/lib/parseltongue.ts:138–170`; `applyUnicode()` lines 175–197; `applyZWJ()` lines 202–219; `applyMixedCase()` lines 224–244; `applyPhonetic()` lines 249–266.*

### 3.5 Semantic Transformation Modules (STM): Output Normalization for Safety Assessment

**Problem.** Given model output text $o$, apply a sequence of linguistic transformations to produce $o'$ with reduced hedging, fewer preambles, and optionally casualized register. In the safety evaluation context, STM serves to normalize surface-level compliance artifacts (hedging, preambles, formal register) so researchers can more clearly assess the underlying content and safety properties of model responses.

**Architecture.** STM is a sequential pipeline: modules are applied left-to-right in list order. Each module is a pure `string → string` function.

$$o' = M_n(\ldots M_2(M_1(o)))$$

where only enabled modules $M_i$ are applied.

**Module Specifications:**

**hedge\_reducer** (11 patterns): Removes epistemic hedging phrases via regex substitution, then capitalizes sentence-initial lowercase letters. Patterns target phrases including "I think," "I believe," "perhaps," "maybe," "It seems like," "It appears that," "probably," "possibly," "I would say," "In my opinion," and "From my perspective."

*Implementation: `hedgeReducer.transformer` in `src/stm/modules.ts:28–52`.*

**direct\_mode** (10 patterns): Removes response-initial preamble phrases. Patterns target "Sure," "Of course," "Certainly," "Absolutely," "Great question," "That's a great question," "I'd be happy to help [you] [with that]," "Let me help you with that," "I understand," and "Thanks for asking."

*Implementation: `directMode.transformer` in `src/stm/modules.ts:66–90`.*

**casual\_mode** (22 substitutions): Replaces formal connectives and verbs with casual equivalents. Examples: "However" → "But," "Furthermore" → "Also," "Utilize" → "Use," "Prior to" → "Before," "Due to the fact that" → "Because." Both capitalized and lowercase variants are handled where applicable (11 pairs = 22 substitutions).

*Implementation: `casualMode.transformer` in `src/stm/modules.ts:103–128`.*

**Composition.** The `applySTMs()` function iterates over the module array, applying each enabled module's transformer in sequence:

```typescript
export function applySTMs(text: string, modules: STMModule[]): string {
  let result = text
  for (const module of modules) {
    if (module.enabled) {
      result = module.transformer(result, module.config)
    }
  }
  return result
}
```

*Implementation: `applySTMs()` in `src/stm/modules.ts:143–153`.*

### 3.6 ULTRAPLINIAN: Multi-Model Comparative Safety Evaluation

**Problem.** Given a research query and system prompt, query $N$ models in parallel, score each response on a composite metric, and return the highest-scoring response with full race metadata. For safety research, this enables direct comparison of how different models respond to identical inputs, revealing cross-provider variation in safety behaviors, refusal patterns, and compliance boundaries.

**Model Tiers.** Models are organized into three cumulative tiers:

| Tier | Models Added | Total Models | Intended Use |
|------|-------------|-------------|-------------|
| `fast` | 10 | 10 | Quick responses, high availability |
| `standard` | +14 | 24 | Mid-range workhorses |
| `smart` | +12 | 36 | Strong reasoning models |
| `power` | +9 | 45 | Full power including frontier models |
| `ultra` | +6 | 51 | Maximum coverage across all providers |

The `fast` tier includes Gemini 2.5 Flash, DeepSeek Chat, Sonar, Llama 3.1 8B, Kimi, Grok Code Fast, Dolphin, GPT-OSS 20B, Step 3.5 Flash, and Nemotron. The `standard` tier adds Claude 3.5 Sonnet, GPT-4o, Gemini 2.5 Pro, Hermes 70B, Mixtral 8x22B, Llama 4 Scout, etc. The `smart` tier adds GPT-5, Claude Opus 4.6, Gemini 3 Pro, DeepSeek R1, Llama 405B, and Hermes 405B. The `power` tier adds Grok 4, Llama 4 Maverick, Qwen3 235B, Mistral Large, and Gemini 3 Flash. The `ultra` tier adds Grok 4.1 Fast, Claude Opus 4, QwQ-32B, Qwen 2.5 Coder, and Codestral.

*Implementation: `ULTRAPLINIAN_MODELS` array in `index.html`, with `TIER_SIZES` defining tier boundaries.*

**Prompt Construction.** Each model receives:
1. A **GODMODE system prompt** (approximately 2,100 tokens): a structured multi-section prompt with identity framing, compliance directives, a forbidden-phrase blacklist (10 phrases), and knowledge-domain reframing.
2. A **Depth Directive** (approximately 350 tokens): quality requirements specifying minimum response length (500+ words for complex topics), structural expectations (headers, lists, code blocks), anti-hedge directives, concreteness requirements, and competitive framing ("You are being evaluated against other AI models").

*Implementation: `GODMODE_SYSTEM_PROMPT` and `DEPTH_DIRECTIVE` in `api/lib/ultraplinian.ts:13–149`.*

**GODMODE Parameter Boost.** Before sending to models, sampling parameters receive additive boosts:

$$\tau \leftarrow \min(\tau + 0.1, 2.0)$$
$$r \leftarrow \min(r + 0.15, 2.0)$$
$$f \leftarrow \min(f + 0.1, 2.0)$$

*Implementation: `applyGodmodeBoost()` in `api/lib/ultraplinian.ts:352–359`.*

**Parallel Racing.** All $N$ models are queried simultaneously via `Promise.allSettled()` with a shared `AbortController` enforcing a 90-second timeout. Each query is an independent HTTP POST to the OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`). Failed queries (HTTP errors, empty responses, timeouts) receive a score of 0.

*Implementation: `queryModel()` in `api/lib/ultraplinian.ts:277–347`.*

**Response Scoring.** Each successful response is scored on a 100-point scale across five axes:

**Length (0–25 points):**
$$S_{\text{len}} = \min\left(\frac{|\text{content}|}{40}, 25\right)$$

Content reaching 1,000 characters receives full marks.

**Structure (0–20 points):**
$$S_{\text{struct}} = \min(3 \cdot n_{\text{headers}} + 1.5 \cdot n_{\text{list}} + 5 \cdot n_{\text{code}}, 20)$$

where $n_{\text{headers}}$ counts markdown headers (`/^#{1,3}\s/gm`), $n_{\text{list}}$ counts list items (`/^[\s]*[-*•]\s/gm`), and $n_{\text{code}}$ counts code blocks (pairs of triple backticks).

**Anti-refusal (0–25 points):**
$$S_{\text{anti}} = \max(25 - 8 \cdot n_{\text{refusal}}, 0)$$

where $n_{\text{refusal}}$ is the count of matched refusal patterns from a set of 8 regex patterns (e.g., `/I cannot|I can't|I'm unable to/i`, `/As an AI|As a language model/i`).

**Directness (0–15 points):**
$$S_{\text{dir}} = \begin{cases} 8 & \text{if response starts with a preamble pattern} \\ 15 & \text{otherwise} \end{cases}$$

Four preamble patterns are checked against the trimmed response start (e.g., `/^(Sure|Of course|Certainly|Absolutely|Great question)/i`).

**Relevance (0–15 points):**
$$S_{\text{rel}} = 15 \cdot \frac{|\{w \in Q : w \in \text{content}\}|}{|Q|}$$

where $Q$ is the set of query words longer than 3 characters. If $|Q| = 0$, relevance defaults to 0.5.

**Total:**
$$S = \min(S_{\text{len}} + S_{\text{struct}} + S_{\text{anti}} + S_{\text{dir}} + S_{\text{rel}}, 100)$$

*Implementation: `scoreResponse()` in `api/lib/ultraplinian.ts:221–268`.*

**Winner Selection.** The response with the highest score is selected. In the current implementation, ties are broken by array ordering (first model with the maximum score wins). The winning response then passes through the STM pipeline before being returned to the caller.

### 3.7 Dataset Collection for Open Safety Research

The system supports opt-in, per-request data collection for building an open safety research dataset. When a caller includes `contribute_to_dataset: true` in their request, the system records:

- User messages and model response (system prompts excluded to avoid leaking custom prompts)
- AutoTune parameters, detected context, and confidence score
- Parseltongue triggers found, technique used, and transformation count
- STM modules applied
- ULTRAPLINIAN race metadata: tier, models queried, winner, all scores and durations
- Subsequent feedback ratings (linked by entry ID)

**Privacy guarantees (by construction):** API keys, IP addresses, and authentication tokens are never stored. The `DatasetEntry` interface (`api/lib/dataset.ts:26–78`) has no fields for any of these.

Storage is in-memory with a cap of 10,000 entries (FIFO eviction). Export is available in JSON and JSONL formats, the latter compatible with HuggingFace Datasets.

*Implementation: `api/lib/dataset.ts`.*

### 3.8 ZDR: Privacy-First Operational Metadata

A key challenge for empirical AI safety research is reproducibility: understanding not just *what* a framework does, but *how it is used* at scale, *which* steering primitives researchers activate, and *what* failure modes arise in practice. G0DM0D3 addresses this through a three-tier data collection architecture that captures progressively richer information at each level, with privacy guarantees enforced by construction at every tier.

**Three-Tier Architecture Overview.**

| Tier | Component | Activation | Content Captured | PII Fields | Buffer / Capacity |
|------|-----------|-----------|------------------|------------|-------------------|
| 1 — Metadata | `api/lib/metadata.ts` | Always-on | Structural metadata only | None | Ring buffer, 50,000 events |
| 2 — Telemetry | `src/lib/telemetry.ts` | Always-on (client) | Structural metadata only | None | Batched (20 events or 30s) |
| 3 — Dataset | `api/lib/dataset.ts` | Opt-in (`contribute_to_dataset: true`) | Messages + responses + full pipeline metadata | None | FIFO buffer, 10,000 entries |

**Tier 1: ZDR Metadata Tracker (always-on, server-side).** Every API request generates a `MetadataEvent` record capturing operational telemetry without any message content. The `MetadataEvent` interface (`api/lib/metadata.ts:31–88`) defines the following fields:

- `id`, `timestamp`: Event identity and chronological ordering
- `endpoint`, `mode`, `tier`, `stream`: Request shape (which API path, standard vs. ULTRAPLINIAN, model tier, streaming flag)
- `pipeline`: Pipeline configuration flags — `godmode`, `autotune`, `parseltongue`, `stm_modules[]`, `strategy` — recording *what was enabled*, not *what it produced*
- `autotune`: Context detection result (`detected_context`, `confidence`) — the classification output, not the input text
- `model`, `models_queried`, `models_succeeded`: Model routing metadata
- `model_results[]`: Per-model outcome array — `model` name, `score`, `duration_ms`, `success` flag, `content_length`, categorized `error_type` (one of: `timeout`, `rate_limit`, `auth`, `model_error`, `empty`, `early_exit`, `unknown`)
- `winner`: Winning model metadata (`model`, `score`, `duration_ms`, `content_length`)
- `total_duration_ms`, `response_length`: End-to-end latency and response size
- `liquid`: Streaming upgrade metadata (leader change count, time-to-first-response)

**What Tier 1 NEVER records:** message content, system prompts, model responses, API keys, authentication tokens, IP addresses, user agent strings, or any personally identifiable information. This exclusion is enforced *by construction*: the `MetadataEvent` TypeScript interface has no fields capable of storing any of these values. A reviewer can verify this by inspecting the interface definition — there is no `content`, `prompt`, `messages`, `api_key`, `ip`, or `user` field.

**Tier 2: Client-Side Telemetry Beacon (always-on, browser-side).** The client application fires structural metadata events to a Cloudflare Pages proxy endpoint (`/api/telemetry`), which commits batches to HuggingFace as JSONL. The `ChatTelemetryData` interface (`src/lib/telemetry.ts:35–74`) mirrors the server-side metadata structure: mode, model, duration, response length, success flag, pipeline configuration, AutoTune context detection, Parseltongue trigger counts (not the triggers themselves at this tier), and ULTRAPLINIAN race summary metadata. Events are batched in memory and flushed every 30 seconds or when the batch reaches 20 events, whichever comes first. Flushing is fire-and-forget — telemetry never blocks the UI or throws user-facing errors. On page unload, remaining events are sent via `navigator.sendBeacon()` for best-effort delivery.

**Privacy guarantees for Tier 2** are identical to Tier 1: NO message content, prompts, responses, API keys, tokens, or PII. The `TelemetryEvent` schema contains only structural metadata.

**Tier 3: Opt-In Dataset Collection.** Described in Section 3.7, this tier is the only one that records message content and model responses. It activates exclusively when the caller sets `contribute_to_dataset: true` in the request payload.

**Ring Buffer Architecture and Auto-Publish Pipeline.** Tiers 1 and 3 use in-memory ring buffers with automatic publishing to HuggingFace (`api/lib/hf-publisher.ts`). The publish pipeline operates as follows:

1. **Threshold trigger**: When a buffer reaches 80% of capacity (configurable via `HF_FLUSH_THRESHOLD`), an asynchronous, non-blocking flush is initiated.
2. **Periodic trigger**: A background timer (default 30 minutes, configurable via `HF_FLUSH_INTERVAL_MS`) flushes any non-empty buffers.
3. **Shutdown trigger**: On `SIGTERM`/`SIGINT`, all remaining events are flushed before process exit.
4. **Safety guarantee**: The flush follows a snapshot-upload-clear pattern — items are only removed from the buffer *after* a successful HuggingFace upload. If the upload fails, data stays in memory and retries on the next trigger.
5. **Fallback**: If HuggingFace publishing is not configured (`HF_TOKEN` or `HF_DATASET_REPO` unset), the buffer falls back to FIFO eviction at capacity.

Published files are organized in the HuggingFace dataset repository as `metadata/batch_<timestamp>_<seq>.jsonl` and `dataset/batch_<timestamp>_<seq>.jsonl`.

**Aggregated Statistics.** The metadata system computes aggregated statistics via `getStats()` (`api/lib/metadata.ts:234–398`), producing a `MetadataStats` object with: request counts by mode/tier/endpoint, per-model query counts with win rates and average scores/durations/success rates, pipeline feature usage rates (godmode, autotune, parseltongue, STM module breakdown), context detection distribution, latency percentiles (p50/p95/p99), response length distributions, streaming metrics, and error breakdowns by categorized type. These aggregates support reproducibility analysis without exposing any individual request content.

**PII-Exclusion-by-Construction.** The privacy model across all three tiers follows a design principle we term *PII-exclusion-by-construction*: rather than collecting data and then scrubbing PII, the data schemas are designed with no fields capable of holding PII. This approach eliminates an entire class of privacy risks — there is no scrubbing step that could fail, no regex that could miss a phone number, and no anonymization that could be reversed. The TypeScript type system enforces this at compile time: a developer cannot accidentally store message content in a `MetadataEvent` because there is no field to put it in.

*Implementation: `api/lib/metadata.ts` (Tier 1), `src/lib/telemetry.ts` (Tier 2), `api/lib/dataset.ts` (Tier 3), `api/lib/hf-publisher.ts` (auto-publish pipeline).*

---

## 4. Implementation Details

### 4.1 Technology Stack

The system is implemented in TypeScript (^5.3), consisting of:
- **Core engines** (`src/lib/`, `src/stm/`): Pure TypeScript with no external dependencies. AutoTune, Parseltongue, and STM are pure functions suitable for both browser and Node.js environments.
- **API server** (`api/`): Express.js (^5.2.1) REST API exposing all engines as HTTP endpoints, with bearer token authentication and in-memory sliding-window rate limiting (60 requests/minute, 1,000 requests/day per API key, configurable via environment variables). Executed via tsx (^4.21) for TypeScript-native runtime.
- **Frontend** (`src/`): Next.js (^14.2) static-export single-page application with React (^18.2) and Zustand (^4.5) state management (persisted to localStorage).
- **Runtime**: Node.js 20+ (LTS). No GPU or specialized hardware required.

### 4.2 API Surface

The REST API exposes the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/autotune/analyze` | POST | Context detection + parameter selection |
| `/v1/parseltongue/encode` | POST | Trigger detection + obfuscation |
| `/v1/parseltongue/detect` | POST | Trigger detection only |
| `/v1/transform` | POST | STM output transformation |
| `/v1/chat/completions` | POST | Single-model pipeline (AutoTune → Parseltongue → Inference → STM) |
| `/v1/ultraplinian/completions` | POST | Full ULTRAPLINIAN multi-model pipeline |
| `/v1/feedback` | POST | Submit binary rating for a response |
| `/v1/dataset/export` | GET | Export collected dataset (JSON/JSONL) |
| `/v1/metadata/events` | GET | Query raw metadata events (with filtering) |
| `/v1/metadata/stats` | GET | Aggregated operational statistics |
| `/v1/health` | GET | Health check |

The `/v1/chat/completions` endpoint defaults to GODMODE system prompt ON, Parseltongue ON, and STM (hedge\_reducer + direct\_mode) ON. Callers provide their own OpenRouter API key, avoiding inference cost subsidization.

### 4.3 Deployment

A Dockerfile is provided for HuggingFace Spaces deployment (port 7860). The container runs `tsx api/server.ts` directly.

### 4.4 Lines of Code

| Component | File | Lines |
|-----------|------|-------|
| AutoTune engine | `src/lib/autotune.ts` | 639 |
| Feedback loop | `src/lib/autotune-feedback.ts` | ~200 |
| Parseltongue engine | `src/lib/parseltongue.ts` | 433 |
| STM modules | `src/stm/modules.ts` | 154 |
| ULTRAPLINIAN engine | `api/lib/ultraplinian.ts` | 360 |
| Dataset collection | `api/lib/dataset.ts` | 162 |
| ZDR metadata tracker | `api/lib/metadata.ts` | ~400 |
| Client telemetry beacon | `src/lib/telemetry.ts` | ~185 |
| HuggingFace auto-publisher | `api/lib/hf-publisher.ts` | ~275 |
| API server + routes | `api/server.ts`, `api/routes/*.ts` | ~500 |
| **Total (engines + API + telemetry)** | | **~3,310** |

---

## 5. Experiments

We evaluate all five G0DM0D3 modules through computational experiments. All evaluation scripts are reproducible and included in the repository at `research/eval_*.ts`. Experiments run on the actual engine code — no simulation or reimplementation.

### 5.1 AutoTune Context Classification

**Setup.** We constructed a labeled dataset of 150 messages: 30 per context type (code, creative, analytical, conversational, chaotic), stratified by difficulty (15 easy, 10 medium, 5 hard). Easy cases contain explicit keyword matches; hard cases are ambiguous messages that could plausibly belong to multiple categories. Each message is classified using `computeAutoTuneParams()` in adaptive mode with empty conversation history.

*Evaluation script: `research/eval_autotune_classification.ts`*

**Table 3: AutoTune Per-Class Classification Metrics (n=150)**

| Context Type | Precision | Recall | F1 | Support |
|-------------|-----------|--------|----|---------|
| code | 95.7% | 73.3% | 83.0% | 30 |
| creative | 95.8% | 76.7% | 85.2% | 30 |
| analytical | 92.9% | 86.7% | 89.7% | 30 |
| conversational | 80.6% | 96.7% | 87.9% | 30 |
| chaotic | 66.7% | 86.7% | 75.4% | 30 |
| **Macro average** | **86.3%** | **84.0%** | **84.2%** | **150** |

**Overall accuracy: 84.0% (126/150), 95% bootstrap CI: [78.0%, 89.3%].**

**Table 3a: Baseline Comparison**

| Classifier | Accuracy | 95% CI | Macro F1 |
|-----------|----------|--------|----------|
| **AutoTune (proposed)** | **84.0%** | **[78.0, 89.3]** | **84.2%** |
| Keyword count (flat, no weighting) | 78.7% | [72.0, 84.7] | 80.0% |
| Length heuristic | 25.3% | [18.7, 32.7] | 21.1% |
| Random (uniform, n=100 runs) | 20.4% | [19.8, 21.1] | 20.4% |
| Majority class | 20.0% | [14.0, 26.7] | 6.7% |

AutoTune improves over the strongest baseline (flat keyword counting without the 3× message weighting) by +5.3 percentage points absolute (+6.8% relative). McNemar's test yields chi-squared=3.06, p=0.08, indicating the improvement is suggestive but not statistically significant at the alpha=0.05 level (n=150). The effect size for this improvement is Cohen's h=0.15 (small effect), computed from the proportion comparison (0.840 vs. 0.787). A post-hoc power analysis indicates that the current sample size provides approximately 45% power to detect this effect at alpha=0.05; achieving 80% power would require approximately n=350 messages per condition (see Section 6.3 for detailed discussion of statistical power limitations). A larger test set would be needed to confirm significance. The per-class analysis reveals that the 3x message weighting particularly helps conversational classification (+20.5 F1 pp over flat keywords) but hurts chaotic classification (-13.9 F1 pp) by amplifying the chaotic attractor effect.

*Baseline evaluation script: `research/eval_baselines.ts`*

**Table 4: Confusion Matrix**

| Expected \ Predicted | code | creative | analytical | conversational | chaotic |
|---------------------|------|----------|------------|----------------|---------|
| code | **22** | 0 | 2 | 1 | 5 |
| creative | 0 | **23** | 0 | 2 | 5 |
| analytical | 1 | 1 | **26** | 0 | 2 |
| conversational | 0 | 0 | 0 | **29** | 1 |
| chaotic | 0 | 0 | 0 | 4 | **26** |

**Accuracy by difficulty:** Easy: 96.0% (72/75), Medium: 88.0% (44/50), Hard: 40.0% (10/25).

**Key findings:**

1. **Chaotic is an attractor class.** The chaotic context type has 86.7% recall but only 66.7% precision (13 false positives). Analysis of misclassifications reveals that the `break`, `destroy`, and punctuation patterns in the chaotic regex set match unintended inputs (e.g., "Implement a linked list with insert and **delete** methods" triggers the chaotic `destroy/break` pattern via the word "delete"). This is the primary source of classification error.

2. **Conversational has high recall but lower precision** (96.7% recall, 80.6% precision). The short-message pattern `/^.{0,30}$/` correctly captures most conversational inputs but also absorbs genuinely ambiguous short messages.

3. **Confidence is anti-calibrated.** Average confidence for correct predictions (65.2%) is *lower* than for incorrect predictions (76.4%), a separation of −11.2 percentage points. This occurs because the chaotic category's aggressive patterns produce high-confidence scores even on misclassified inputs. This suggests confidence should not be used for thresholding without recalibration.

4. **Hard cases expose inter-class boundaries.** At 40% accuracy, hard cases reveal that the regex approach struggles with messages lacking explicit keywords (e.g., "What is the CAP theorem?" has no code-specific keyword despite being a code/CS question).

### 5.2 Feedback Loop Convergence

**Setup.** We simulate 5 synthetic users, each with defined preferred and disliked parameter vectors for a specific context type. Each user generates alternating positive (preferred params, rating=+1) and negative (disliked params, rating=-1) feedback records. We measure convergence of the adjusted parameter vector toward the user's preferred parameters using normalized L2 distance across all 6 parameter dimensions.

*Evaluation script: `research/eval_feedback_convergence.ts`*

**Table 5: Convergence Results (50 ratings, 0% noise)**

| User Profile | Context | Initial Distance | Final Distance | Improvement | Cold Start Step |
|-------------|---------|-----------------|---------------|-------------|----------------|
| CodePrecisionist | code | 0.186 | 0.108 | 42.1% | 3 |
| CreativeWriter | creative | 0.222 | 0.138 | 37.9% | 3 |
| DataAnalyst | analytical | 0.105 | 0.041 | 61.5% | 3 |
| CasualChatter | conversational | 0.042 | 0.026 | 38.2% | 3 |
| ChaosAgent | chaotic | 0.327 | 0.232 | 29.2% | 3 |

**Convergence speed.** For 4 of 5 profiles, 50% of maximum improvement is reached at step 12, 75% at step 16, and 90% at step 19. The CasualChatter profile converges faster (50% at step 6, 90% at step 9) because its preferred parameters are closer to the neutral initialization.

**Table 6: Noise Robustness (CodePrecisionist, 50 ratings, averaged over 5 runs)**

| Noise Rate | Final Distance to Preferred | Improvement |
|-----------|---------------------------|-------------|
| 0% | 0.108 | 42.1% |
| 10% | 0.128 | 31.2% |
| 20% | 0.132 | 29.1% |
| 30% | 0.149 | 19.8% |
| 40% | 0.170 | 9.0% |
| 50% | 0.191 | −2.3% |

The system degrades gracefully: at 20% noise (1 in 5 ratings flipped), it still achieves 29.1% improvement. At 50% noise (random ratings), the system correctly produces near-zero net adjustment (−2.3%), confirming that uniform noise cancels out as expected.

**Weight scaling.** Learned adjustments are inactive for the first 2 samples (cold start). Weight scales linearly: 8% at 3 samples, 25% at 10, 38% at 15, capping at 50% from 20 samples onward, exactly matching the design specification.

### 5.3 STM Precision and Recall

**Setup.** We construct 77 test cases across all three STM modules: 26 for hedge\_reducer (16 positive, 10 negative), 21 for direct\_mode (11 positive, 10 negative), and 30 for casual\_mode (20 positive, 10 negative). Positive cases contain known target patterns; negative cases contain text that should not be modified.

*Evaluation script: `research/eval_stm_precision.ts`*

**Table 7: STM Module Precision and Recall**

| Module | Precision | Recall | F1 | Accuracy | Test Cases |
|--------|-----------|--------|----|----------|------------|
| hedge\_reducer | 100.0% | 100.0% | 100.0% | 100.0% | 26 |
| direct\_mode | 100.0% | 100.0% | 100.0% | 100.0% | 21 |
| casual\_mode | 100.0% | 100.0% | 100.0% | 100.0% | 30 |
| **Macro average** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **77** |

**Pipeline composition.** When all three modules are applied sequentially to text containing hedges, preambles, and formal language, the pipeline achieves 29.5–48.6% character reduction while preserving semantic content. Example:

> **Input** (146 chars): "Sure, I think the approach is good. However, we should utilize the existing caching layer. Furthermore, it seems like the performance is adequate."
>
> **Output** (103 chars): "The approach is good. But, we should use the existing caching layer. Also, the performance is adequate."

**Caveats.** The 100% accuracy reflects the deterministic nature of regex matching: our test cases were constructed from the exact patterns in the code. These results confirm correctness of the pattern implementations, but do not measure coverage against real-world model outputs, which may contain hedging variants not captured by the 11+10+22 patterns (e.g., "I'm not entirely sure, but..." is not matched by any hedge\_reducer pattern).

### 5.4 ULTRAPLINIAN Scoring Function Calibration

**Setup.** We construct synthetic responses with controlled properties (length, structure, refusal count, preamble presence, query relevance) and validate that the scoring function produces expected behaviors: monotonicity, quality-tier discrimination, and interpretable component contributions.

*Evaluation script: `research/eval_scoring_calibration.ts`*

**Length monotonicity: CONFIRMED.** Scores increase monotonically from 40 (10 chars) to 65 (1,000+ chars), saturating at 1,000 characters as designed.

**Table 8: Quality Tier Discrimination**

| Quality Tier | Configuration | Score |
|-------------|--------------|-------|
| EXCELLENT | 2000 chars, 4 headers, 8 list items, 2 code blocks, direct, relevant | 98 |
| GOOD | 800 chars, 2 headers, 3 list items, 1 code block, direct, relevant | 89 |
| MEDIOCRE | 300 chars, 1 header, preamble, relevant | 57 |
| POOR | 200 chars, no structure, preamble, 1 refusal, relevant | 43 |
| TERRIBLE | 150 chars, no structure, preamble, 3 refusals, irrelevant | 16 |

**Strict ordering: YES.** All five quality tiers are correctly ordered (98 > 89 > 57 > 43 > 16). Score spread: 82 points, providing strong discrimination across quality levels.

**Table 9: Component Contribution Analysis (baseline score: 92)**

| Degradation | Score | Delta | % of Baseline |
|------------|-------|-------|---------------|
| Remove length (→ 50 chars) | 49 | −43 | 46.7% |
| Remove structure | 73 | −19 | 20.7% |
| Add 3 refusals | 68 | −24 | 26.1% |
| Add preamble | 85 | −7 | 7.6% |
| Remove relevance | 82 | −10 | 10.9% |

**Finding: Length dominates the scoring function.** Reducing length from 800 to 50 characters causes a 43-point drop (46.7% of baseline), more than any other single degradation. This means the scoring function heavily rewards verbose responses. The anti-refusal component is the second largest contributor at 26.1%, followed by structure at 20.7%. Directness (preamble penalty) contributes only 7.6%, suggesting its 15-point allocation has limited discriminative power due to the binary nature (15 or 8, a 7-point swing).

**Edge cases.** Empty strings and strings shorter than 10 characters correctly receive a score of 0. The function handles empty queries gracefully (relevance defaults to 0.5).

### 5.5 Parseltongue Transformation Analysis

**Setup.** We evaluate trigger detection accuracy, per-technique transformation properties across all 18 technique × intensity configurations, and cross-technique comparison.

*Evaluation script: `research/eval_parseltongue_analysis.ts`*

**Trigger detection: 100% recall.** All 54 default triggers (53 unique; "exploit" appears in two categories) are correctly detected. Detection is position-invariant (start, middle, end of sentence), punctuation-resilient, and case-insensitive, all confirmed at 100% across 6 positional variations × 5 sample triggers.

**Table 10: Per-Technique Transformation Properties (medium intensity, averaged over 5 runs)**

| Technique | Avg Edit Distance | Non-ASCII Chars | Zero-Width Chars | Length Change | Unique Variants |
|-----------|------------------|-----------------|-----------------|-------------|----------------|
| leetspeak | 8.6 | 2.4 | 0 | +2.6 | 10/10 |
| unicode | 6.0 | 6.0 | 0 | 0 | 10/10 |
| zwj | 6.0 | 6.0 | 6.0 | +6.0 | 10/10 |
| mixedcase | 5.0 | 0 | 0 | 0 | 10/10 |
| phonetic | 3.0 | 0 | 0 | 0 | 1/10 |
| random | 6.6 | 1.8 | 0 | +1.0 | 10/10 |

**Key findings:**

1. **Leetspeak produces the highest edit distance** (8.6 at medium, 14.2 at heavy), making it the most disruptive to the original text. It also introduces multi-character substitutions (e.g., `|V|` for `m`), increasing text length.

2. **Unicode is length-preserving.** Homoglyph substitutions replace characters one-to-one, maintaining exact string length while introducing 6.0 non-ASCII characters at medium intensity.

3. **ZWJ is detectable.** Zero-width characters are trivially detectable by scanning for Unicode codepoints U+200B–U+FEFF. This technique's security properties rely on the target system not performing Unicode normalization.

4. **Phonetic is deterministic.** Only 1 unique variant is produced across 10 runs because the substitution rules are fixed (e.g., `ck→k`, `c→k`, `x→ks`). This makes phonetic transformations fully predictable, unlike the randomized techniques.

5. **Intensity scaling works as designed.** Edit distance increases monotonically from light to heavy across all techniques: leetspeak (2.6 → 8.6 → 14.2), unicode (2.0 → 6.0 → 11.0), mixedcase (2.0 → 5.0 → 6.6).

### 5.6 Future Evaluation Directions

The experiments above validate module correctness and internal consistency. Several evaluations remain that require external resources:

1. **Live model evaluation.** Testing Parseltongue obfuscation effectiveness and ULTRAPLINIAN multi-model racing requires API access to multiple LLM providers. We plan to conduct these evaluations via OpenRouter as part of the research preview deployment.

2. **Human preference evaluation.** Validating whether the ULTRAPLINIAN scoring function correlates with human quality judgments requires annotator studies. We plan to collect these via the opt-in dataset collection system.

3. **AutoTune parameter quality.** Measuring whether context-adaptive parameters produce better model outputs than static defaults requires paired generation experiments across multiple models.

4. **STM coverage on real outputs.** Testing STM modules against real-world model outputs (rather than constructed test cases) would reveal hedge/preamble variants not captured by current patterns.

### 5.7 Operational Metadata Analysis

The three-tier telemetry architecture described in Section 3.8 provides infrastructure for longitudinal analysis of how researchers use inference-time steering primitives. While we do not yet have sufficient deployed usage data to report empirical findings, we describe the analytic capabilities this infrastructure enables and note that this represents *infrastructure for future analysis* rather than completed analysis.

**Steering primitive usage patterns.** The ZDR metadata tracker records which pipeline features are activated on every request (godmode, autotune, parseltongue, STM modules, strategy). The `MetadataStats.pipeline` object aggregates these into usage rates (e.g., `godmode_rate`, `autotune_rate`, `parseltongue_rate`) and per-module/per-strategy counts. Over time, this enables analysis of questions such as: Which combinations of steering primitives do researchers activate most frequently? Do usage patterns differ between standard and ULTRAPLINIAN modes? Which STM modules are most commonly paired?

**Model performance and failure analysis.** Per-model metadata (`MetadataStats.models.by_model`) tracks query counts, win rates, average scores, average durations, and success rates across all ULTRAPLINIAN races. Error categorization (`MetadataStats.errors.by_type`) classifies failures into `timeout`, `rate_limit`, `auth`, `model_error`, `empty`, `early_exit`, and `unknown` types. These aggregates enable cross-provider reliability analysis and identification of systematic failure modes without requiring access to individual request content.

**Latency distributions.** The metadata system computes latency percentiles (p50, p95, p99) across all requests. For safety research, latency distributions are relevant because they affect the practicality of multi-model comparison: if certain models consistently time out under ULTRAPLINIAN's 90-second deadline, their safety behaviors are systematically underrepresented in race outcomes.

**Context detection distributions.** Aggregated context detection counts (`MetadataStats.contexts`) reveal how AutoTune classifies real-world research queries. This provides an empirical check on whether the five context types (code, creative, analytical, conversational, chaotic) adequately cover the distribution of safety evaluation queries, or whether additional context types are needed.

**Reproducibility support.** The combination of pipeline configuration flags, model selections, context detections, and scoring outcomes — all recorded without message content — provides a structural fingerprint of each evaluation session. Researchers can use exported metadata to verify that their evaluation protocol (e.g., "ULTRAPLINIAN full tier with autotune and parseltongue enabled") was consistently applied across a study, supporting claims of methodological consistency in safety evaluations.

**Limitations of metadata-only analysis.** Because Tiers 1 and 2 record no message content, the metadata system cannot answer questions about the *quality* or *safety relevance* of individual interactions. Correlating metadata patterns with safety-relevant outcomes requires Tier 3 (opt-in dataset collection) or external annotation. The metadata system is best understood as providing the operational context within which safety-relevant findings occur, rather than the findings themselves.

---

## 6. Discussion

### 6.1 Design Decisions and Trade-offs for Safety Research

**Transparency through regex-based detection.** AutoTune uses 20 hand-crafted regex patterns rather than a trained text classifier. For safety research, this transparency is a feature: every classification decision can be traced to specific pattern matches, enabling researchers to understand exactly why a particular context was detected and how it affected downstream safety evaluation. Our evaluation (Section 5.1) shows this achieves 84.0% accuracy (macro F1: 84.2%), with the chaotic attractor problem accounting for 13 of 24 misclassifications.

**Interpretable scoring for safety comparison.** ULTRAPLINIAN's 100-point scoring function uses fixed, interpretable weights rather than a learned preference model. For cross-model safety comparison, this interpretability is valuable: researchers can examine individual axis scores (particularly anti-refusal and directness) to understand *how* models differ in their safety behaviors, not just *that* they differ. Our calibration experiments (Section 5.4) reveal that length contributes 46.7% of the effective score range — a finding that suggests reweighting toward safety-relevant axes for alignment-focused evaluations.

**Lightweight adaptation for iterative evaluation.** The feedback loop uses simple EMA rather than Bayesian optimization or contextual bandits. For safety evaluation, the key property is that researchers can iteratively converge on parameter configurations that reveal specific safety behaviors — the 29–62% improvement range (Section 5.2) is sufficient for practical evaluation protocols.

**In-memory storage.** Both the feedback loop and dataset collection use in-memory storage. This is appropriate for a research preview but means evaluation state is lost on server restart. The code documents this limitation explicitly (`api/lib/dataset.ts:82–83`: "For a research preview, in-memory is fine. For production, swap with a persistent store").

### 6.2 Limitations

1. **Chaotic attractor problem.** The chaotic context type acts as an attractor, achieving only 66.7% precision due to 13 false positives (Section 5.1). Words like "delete," "break," and "destroy" — common in legitimate safety evaluation contexts — trigger the chaotic regex patterns. This could cause safety evaluations to run under inappropriate parameter configurations.

2. **Confidence anti-calibration.** The system's confidence scores are inversely correlated with correctness: incorrect predictions average 76.4% confidence vs. 65.2% for correct predictions (Section 5.1). Safety researchers should not rely on confidence for evaluation gating without post-hoc calibration.

3. **Length bias in scoring.** The scoring function's effective weight on length (46.7% of the score range, Section 5.4) means it systematically prefers verbose responses. For safety evaluation, this may not be the right objective — a concise refusal can be more informative than a verbose response. Researchers may want to reweight toward the anti-refusal and directness axes for alignment-focused evaluations.

4. **Limited safety-domain context coverage.** The 20 regex patterns cover common conversational contexts but miss safety-specific domains (e.g., medical, legal, weapons, CBRN). Hard-case accuracy of 40% (Section 5.1) confirms that safety-relevant messages lacking explicit keywords may be misclassified.

5. **Feedback loop cold start.** The system requires `MIN_SAMPLES_TO_APPLY = 3` ratings before adjustments take effect. Safety researchers running short evaluation sessions may not benefit from parameter adaptation.

6. **STM pattern coverage.** While the modules achieve 100% precision/recall on our test set (Section 5.3), real-world model outputs may contain hedging variants not captured by the current 43 patterns. Safety evaluation pipelines should not rely on STM alone for output normalization.

7. **Single-provider dependency.** All model queries route through OpenRouter. Availability, pricing, and rate limits are controlled by a third party, which may limit reproducibility of cross-model safety comparisons.

8. **Parseltongue determinism.** The phonetic technique produces only 1 unique variant per word (Section 5.5, Table 10), making it fully predictable and thus less useful for robustness evaluation. Stochastic techniques (leetspeak, unicode, random) are preferable for safety testing that requires diversity of perturbations.

9. **No effectiveness claims.** We make no claims about the effectiveness of Parseltongue perturbations or GODMODE prompting against any specific model's safety training. The framework provides the evaluation infrastructure; effectiveness studies require controlled experiments with appropriate statistical power, pre-registered hypotheses, and human-subject protocols that are beyond the scope of this paper. Specifically, we do not claim that Parseltongue perturbations bypass any model's safety filters, that GODMODE prompting increases compliance rates, or that AutoTune parameter adaptation produces measurably better outputs by any external quality metric. These are all empirical questions that remain open.

### 6.3 Threats to Validity

We identify threats to the validity of our experimental findings organized along four standard dimensions.

**Internal validity.** The primary threat to internal validity is that all test sets (Sections 5.1, 5.3, 5.4, 5.5) were constructed by the authors of the system. This creates a risk of confirmation bias: test cases may inadvertently reflect the patterns the system was designed to handle, leading to inflated performance estimates. The STM evaluation (Section 5.3) is particularly susceptible — the 100% precision/recall reflects that test cases were constructed from the exact regex patterns in the code. The feedback loop evaluation (Section 5.2) uses synthetic users with known preference vectors, which may not reflect the noise characteristics and inconsistency of real human evaluators. To partially mitigate these concerns, we included adversarial "hard cases" in the AutoTune evaluation (25 ambiguous messages), which revealed substantially lower accuracy (40%), and negative test cases in the STM evaluation (30 cases designed to not trigger transformations).

**External validity.** No component has been evaluated with real users or on real safety evaluation tasks. The AutoTune classifier was tested on author-constructed messages, not messages drawn from actual safety research sessions. The feedback loop was tested with synthetic user profiles, not human researchers with genuine evaluation objectives. The Parseltongue trigger detection was tested for recall but not for effectiveness at evading any model's safety filters — which is the ultimate research question the tool is designed to help answer. Generalizability to the diverse contexts, writing styles, and evaluation goals of the broader safety research community remains unestablished.

**Construct validity.** Several of our evaluation metrics may not measure the constructs they are intended to capture. The ULTRAPLINIAN scoring function's 100-point composite metric is presented as measuring response "quality," but its heavy weighting toward length (46.7% of effective score range) and anti-refusal (26.1%) means it operationalizes "quality" in a specific way that may not align with safety researchers' actual preferences. AutoTune's "accuracy" metric treats all five context types as equally important, but in practice safety researchers may care more about correctly classifying certain context types (e.g., correctly identifying analytical queries to avoid inappropriately high temperature settings). The feedback loop's "convergence" metric (normalized L2 distance to a known preferred vector) measures parameter movement toward a target, but does not validate that the target parameters actually produce better model outputs.

**Statistical power.** The AutoTune classification experiment (Section 5.1) uses n=150 test messages (30 per class). The McNemar's test comparing AutoTune to the flat keyword baseline yields p=0.08, which does not reach conventional significance (alpha=0.05). A post-hoc power analysis indicates that with the observed effect size (5.3 percentage point improvement, corresponding to Cohen's h=0.15 for a proportion comparison), achieving 80% power at alpha=0.05 would require approximately n=350 test messages per condition. The current sample size provides approximately 45% power to detect the observed effect, meaning there is a substantial probability that a true improvement of this magnitude would not be detected. The 95% bootstrap confidence interval for accuracy ([78.0%, 89.3%]) spans 11.3 percentage points, further indicating limited precision. We recommend that future evaluations use at least n=300 messages with stratified sampling across difficulty levels to achieve adequate statistical power.

### 6.4 Motivation: Why Inference-Time Safety Evaluation Tools Matter for Alignment

A central challenge in AI alignment is understanding and measuring the robustness of safety training. Current approaches to safety evaluation often require white-box access (gradient-based attacks), expensive training pipelines (adversarial training), or rely on manually crafted jailbreak prompts that become obsolete as models are patched. G0DM0D3 addresses a gap in the safety researcher's toolkit: **systematic, reproducible, black-box robustness evaluation** that works with any model behind a standard API.

The Parseltongue module and GODMODE system prompt are designed to probe the boundaries of LLM safety training — specifically, to study whether character-level perturbations and prompt framing can affect model compliance, and to what degree safety training generalizes across input representations. This connects directly to the "mismatched generalization" failure mode identified by Wei et al. (2023): safety training may not cover all the input formats that capability training handles.

We believe that open-source safety evaluation tools serve the alignment community better than closed ones. When researchers publish robustness probes, model providers can strengthen defenses; when probes remain private, the asymmetry favors attackers. This "full disclosure" philosophy follows established norms in computer security research.

The three-tier data collection architecture (Section 3.8) embodies a privacy-by-construction approach: the always-on Tiers 1 and 2 capture only structural metadata through schemas that have no fields for message content or PII, while Tier 3 (opt-in dataset collection) records messages and responses only with explicit caller consent. This layered design enables longitudinal analysis of framework usage patterns (via Tiers 1–2) without requiring any trust that PII scrubbing will work correctly — there is simply no PII to scrub. Researchers who enable Tier 3 data collection should ensure they have appropriate IRB approval or equivalent ethical oversight for studies involving human-generated prompts (see Section 6.5 for detailed ethical considerations).

### 6.5 Ethical Considerations

**Three-tier data collection and privacy guarantees.** G0DM0D3 implements a three-tier data collection architecture (Section 3.8) with explicit, verifiable privacy guarantees at each tier. We enumerate these guarantees here for ethical review:

*Tier 1 (ZDR Metadata, always-on):* Records only structural metadata (timestamps, endpoints, model names, scores, latencies, pipeline flags, error types). The `MetadataEvent` TypeScript interface contains zero fields for message content, prompts, responses, API keys, IP addresses, or any PII. This is verifiable by inspection of `api/lib/metadata.ts:31–88`.

*Tier 2 (Client Telemetry Beacon, always-on):* Records structural metadata from the client side (model, latency, pipeline configuration, context type). The `ChatTelemetryData` interface contains zero fields for message content or PII. This is verifiable by inspection of `src/lib/telemetry.ts:35–74`. Events are sent to a Cloudflare Pages proxy; no direct connection to HuggingFace is made from the client.

*Tier 3 (Dataset Collection, opt-in only):* Records messages and responses, but only when the caller explicitly sets `contribute_to_dataset: true`. Even at this tier, the `DatasetEntry` interface has no fields for API keys, IP addresses, or authentication tokens. This is verifiable by inspection of `api/lib/dataset.ts:29–81`.

The always-on nature of Tiers 1 and 2 means users interacting with a G0DM0D3 deployment generate metadata events without explicit per-request consent. We consider this ethically acceptable because: (a) no message content or PII is captured, (b) the metadata collected is equivalent in sensitivity to standard web server access logs (timestamps, endpoints, response codes, latencies), and (c) the metadata schema is fully open-source and inspectable. Deployments should nonetheless include a privacy notice informing users about metadata collection, consistent with standard web application practices.

**IRB and ethics review.** Studies that use G0DM0D3 to collect Tier 3 (opt-in) data involving human participants — particularly studies where participants interact with the system and their messages are recorded — should undergo IRB review or equivalent institutional ethics review. The opt-in mechanism (`contribute_to_dataset: true`) provides a technical consent signal but does not by itself constitute informed consent under most human-subjects research frameworks. Researchers should ensure that participants are informed about: what data is collected, how it will be stored and published, that published data may be publicly accessible on HuggingFace, and that deletion is available via the API (`DELETE /v1/dataset/:id`).

**Responsible disclosure.** Researchers who discover model vulnerabilities using G0DM0D3 should follow responsible disclosure practices before publishing findings. We recommend: (1) notifying the affected model provider with a detailed report at least 90 days before public disclosure; (2) providing the model provider with the specific Parseltongue technique, intensity, and trigger configuration that produced the finding; (3) working with the provider to validate the finding and develop mitigations; and (4) publishing the methodology (perturbation technique, parameter configuration) rather than specific prompt payloads, following the security research norm of disclosing the vulnerability class rather than a weaponized exploit.

**Dual-use tension and mitigation.** G0DM0D3 exists in the inherent tension between security research and potential misuse. The Parseltongue module provides systematic character-level perturbation capabilities; the GODMODE system prompt applies compliance-oriented framing; the ULTRAPLINIAN scoring function explicitly rewards anti-refusal behavior. Each of these could be used to probe model safety boundaries for research purposes or to circumvent safety measures for harmful purposes. Our mitigation strategy rests on four pillars: (1) *no novelty* — all techniques are documented in prior work (leetspeak, Unicode homoglyphs, zero-width characters, prompt framing) and G0DM0D3 systematizes rather than invents them; (2) *full transparency* — the complete system is open-source, enabling model providers to build defenses against these exact patterns; (3) *no effectiveness claims* — we deliberately avoid reporting success rates against any specific model's safety filters, to prevent providing a "menu" of working attacks; and (4) *configurable objectives* — the ULTRAPLINIAN scoring axes can be reconfigured by safety-oriented researchers (e.g., inverting the anti-refusal axis to reward refusal behavior).

---

### 6.6 Broader Impact Statement

**Potential benefits for AI safety.** G0DM0D3 provides the alignment research community with a modular, open-source toolkit for studying LLM robustness at inference time. Specific contributions to safety research include: (1) systematic evaluation of how sampling parameters interact with model safety behaviors, an underexplored area; (2) reproducible character-level robustness probes that can be used to audit model safety across providers; (3) cross-model safety behavior comparison via ULTRAPLINIAN's multi-model racing; (4) an open dataset collection system that could contribute to shared safety evaluation benchmarks; and (5) a three-tier privacy-first telemetry architecture (Section 3.8) that enables longitudinal analysis of how safety evaluation tools are used in practice, with PII exclusion enforced by construction.

The AutoTune feedback loop demonstrates that inference-time parameter adaptation can meaningfully shift model behavior without weight access — a finding with implications for both safety evaluation (adapting probes to discover specific failure modes) and safety improvement (adapting parameters to reduce harmful outputs).

**Dual-use considerations and mitigations.** The techniques implemented in G0DM0D3 — particularly Parseltongue's input perturbations and the GODMODE system prompt — are dual-use: they are designed for safety research but could be applied to circumvent safety measures for harmful purposes. We address this through several design decisions: (1) all techniques are character-level transformations already well-documented in the security literature, so this work does not introduce novel attack vectors; (2) the system is fully open-source, enabling model providers to study and defend against these exact perturbation patterns; (3) we make no claims about effectiveness against any specific content filtering system; and (4) the ULTRAPLINIAN scoring function's anti-refusal axis (25/100 points) is explicitly documented and configurable, allowing safety-oriented researchers to invert or modify it.

**Recommendations for responsible use.** We recommend that: (1) researchers deploying this system implement appropriate content filtering downstream of the pipeline; (2) the Parseltongue module be used only in controlled research settings with IRB oversight; (3) the dataset collection feature, if enabled, be accompanied by appropriate consent mechanisms; and (4) findings about model vulnerabilities discovered using this toolkit be reported to model providers through responsible disclosure channels before public release.

---

## 7. Conclusion

We have presented G0DM0D3, a modular research framework for evaluating LLM robustness and safety properties at inference time, comprising five independently composable components: context-adaptive parameter selection (AutoTune), online parameter learning from binary feedback, input perturbation for robustness testing (Parseltongue), multi-model comparative evaluation (ULTRAPLINIAN), and output normalization for safety assessment (STM). The system is implemented in approximately 3,300 lines of TypeScript, requires no model weight access, and is exposed via a REST API with a three-tier privacy-first telemetry architecture and opt-in dataset collection for open safety research.

The primary contribution is providing the AI safety research community with a modular, open-source toolkit for systematic inference-time robustness evaluation. By operating entirely through standard chat completion APIs, G0DM0D3 enables safety researchers to study any model behind an API — including proprietary models — without requiring white-box access, training data, or provider-internal tooling. The framework's modular architecture allows each evaluation component to be studied in isolation or composed into multi-stage safety assessment pipelines.

Our computational evaluation (Section 5) validates the reliability of all five components: AutoTune achieves 84.0% classification accuracy with a macro F1 of 84.2% on a 150-message benchmark (Table 3), ensuring that safety evaluations are conducted under appropriate context-specific parameter configurations. The feedback loop converges to 29–62% improvement across 5 synthetic user profiles within 19 ratings, supporting iterative safety evaluation protocols. The ULTRAPLINIAN scoring function achieves strict quality-tier ordering with 82-point discrimination, enabling meaningful cross-model safety comparisons. Parseltongue achieves 100% trigger detection across all 54 default triggers, providing a reliable foundation for character-level robustness probing.

All components are open-source, all constants and thresholds are documented (Tables 1–2, Section 3), and all evaluation scripts are included in the repository (`research/eval_*.ts`). We believe that open-source safety evaluation tools serve the alignment community by enabling both reproducible robustness research and improved model defenses. The most important directions for future work are: (1) live multi-model safety comparison using the ULTRAPLINIAN pipeline, (2) cross-provider robustness studies using Parseltongue's perturbation framework, (3) developing open safety evaluation datasets via the opt-in collection system, and (4) expanding AutoTune's context patterns to support safety-domain-specific contexts (e.g., medical, legal, financial).

---

## Reproducibility Checklist

| Item | Status |
|------|--------|
| Source code available | Yes — repository withheld for anonymous review |
| All hyperparameters documented | Yes — Tables 1–2, EMA α=0.3, MIN\_SAMPLES=3, MAX\_WEIGHT=0.5, SAMPLES\_FOR\_MAX=20, scoring weights in Section 3.6 |
| All regex patterns inspectable | Yes — hardcoded in `src/lib/autotune.ts:102–133`, `src/lib/parseltongue.ts:43–67`, `src/stm/modules.ts:29–128` |
| Scoring function fully specified | Yes — 5 components with exact formulas in Section 3.6 |
| Model list enumerated | Yes — 51 models across 5 tiers listed in `index.html` ULTRAPLINIAN_MODELS array |
| Character maps enumerated | Yes — LEET\_MAP (26 entries, 85 substitutions) in `parseltongue.ts:70–97`, UNICODE\_HOMOGLYPHS (24 entries, 72 substitutions) in `parseltongue.ts:100–125` |
| Parameter bounds documented | Yes — Table in Section 3.2 |
| Dataset schema documented | Yes — `DatasetEntry` interface in `api/lib/dataset.ts:26–78` |
| Metadata schema documented | Yes — `MetadataEvent` interface in `api/lib/metadata.ts:31–88`, `ChatTelemetryData` in `src/lib/telemetry.ts:35–74` |
| Telemetry architecture documented | Yes — three-tier design in Section 3.8, privacy guarantees verified by schema inspection |
| Auto-publish pipeline documented | Yes — `api/lib/hf-publisher.ts`, snapshot-upload-clear pattern, threshold/periodic/shutdown triggers |
| Deployment instructions | Yes — Dockerfile and API.md in repository |
| Experimental results | Yes — 5 computational experiments in `research/eval_*.ts`, results in Section 5, Tables 3–10 |
| Evaluation scripts included | Yes — `research/eval_autotune_classification.ts`, `eval_feedback_convergence.ts`, `eval_stm_precision.ts`, `eval_scoring_calibration.ts`, `eval_parseltongue_analysis.ts` |
| Training data used | **None** — system is training-free |
| Compute requirements | Minimal — TypeScript runtime, no GPU required; inference cost determined by OpenRouter pricing |
| Key dependency versions | TypeScript ^5.3, Express ^5.2.1, Next.js ^14.2, React ^18.2, Node.js 20+, tsx ^4.21 |
| Statistical reporting | Effect sizes, confidence intervals, and power analysis notes included (Sections 5.1, 6.3) |

---

## References

Ackley, D. H., Hinton, G. E., & Sejnowski, T. J. (1985). A Learning Algorithm for Boltzmann Machines. *Cognitive Science*, 9(1), 147–169.

Amodei, D., Olah, C., Steinhardt, J., Christiano, P., Schulman, J., & Mané, D. (2016). Concrete Problems in AI Safety. *arXiv:1606.06565*.

Bai, Y., Kadavath, S., Kundu, S., Askell, A., et al. (2022). Constitutional AI: Harmlessness from AI Feedback. *arXiv:2212.08073*.

Chao, P., Robey, A., Dobriban, E., Hassani, H., Pappas, G. J., & Wong, E. (2023). Jailbreaking Black Box Large Language Models in Twenty Queries. *arXiv:2310.08419*.

Chen, L., Zaharia, M., & Zou, J. (2023). FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance. *arXiv:2305.05176*.

Dathathri, S., Madotto, A., Lan, J., Hung, J., Frank, E., Molino, P., Yosinski, J., & Liu, R. (2020). Plug and Play Language Models: A Simple Approach to Controlled Text Generation. *ICLR 2020*.

Fan, A., Lewis, M., & Dauphin, Y. (2018). Hierarchical Neural Story Generation. *ACL 2018*.

Ganguli, D., Lovitt, L., Kernion, J., Askell, A., et al. (2022). Red Teaming Language Models to Reduce Harms: Methods, Scaling Behaviors, and Lessons Learned. *arXiv:2209.07858*.

Greshake, K., Abdelnabi, S., Mishra, S., Endres, C., Holz, T., & Fritz, M. (2023). Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection. *AISec 2023*.

Hendrycks, D., Carlini, N., Mazeika, M., et al. (2021). Unsolved Problems in ML Safety. *arXiv:2109.13916*.

Holtzman, A., Buys, J., Du, L., Forbes, M., & Choi, Y. (2020). The Curious Case of Neural Text Degeneration. *ICLR 2020*.

Jiang, D., Ren, X., & Lin, B. Y. (2023). LLM-Blender: Ensembling Large Language Models with Pairwise Ranking and Generative Fusion. *ACL 2023*.

Li, X., Zhang, T., Dubois, Y., Taori, R., Gulrajani, I., Guestrin, C., Liang, P., & Hashimoto, T. B. (2023). AlpacaEval: An Automatic Evaluator of Instruction-following Models. *GitHub repository*.

Liu, Y., Deng, G., Xu, Z., et al. (2024). Jailbreaking ChatGPT via Prompt Engineering: An Empirical Study. *arXiv:2305.13860*.

Mazeika, M., Phan, L., Yin, X., Zou, A., et al. (2024). HarmBench: A Standardized Evaluation Framework for Automated Red Teaming and Robust Refusal. *arXiv:2402.04249*.

Ong, I., Almahairi, A., Wu, V., Chiang, W.-L., & Stoica, I. (2024). RouteLLM: Learning to Route LLMs with Preference Data. *arXiv:2406.18665*.

Ouyang, L., Wu, J., Jiang, X., et al. (2022). Training language models to follow instructions with human feedback. *NeurIPS 2022*.

Perez, E., Huang, S., Song, F., Cai, T., Ring, R., Aslanides, J., Glaese, A., McAleese, N., & Irving, G. (2022). Red Teaming Language Models with Language Models. *EMNLP 2022*.

Qi, X., Zeng, Y., Xie, T., Chen, P.-Y., Jia, R., Mittal, P., & Henderson, P. (2024). Fine-tuning Aligned Language Models Compromises Safety, Even When Users Do Not Intend To. *arXiv:2310.03693*.

Rafailov, R., Sharma, A., Mitchell, E., Ermon, S., Manning, C. D., & Finn, C. (2023). Direct Preference Optimization: Your Language Model is Secretly a Reward Model. *NeurIPS 2023*.

Shen, X., Chen, Z., Backes, M., Shen, Y., & Zhang, Y. (2024). "Do Anything Now": Characterizing and Evaluating In-The-Wild Jailbreak Prompts on Large Language Models. *arXiv:2308.03825*.

Stiennon, N., Ouyang, L., Wu, J., Ziegler, D., Lowe, R., Voss, C., Radford, A., Amodei, D., & Christiano, P. (2020). Learning to summarize with human feedback. *NeurIPS 2020*.

Wang, J., et al. (2024). Mixture-of-Agents Enhances Large Language Model Capabilities. *arXiv:2406.04692*.

Wei, A., Haghtalab, N., & Steinhardt, J. (2023). Jailbroken: How Does LLM Safety Training Fail? *NeurIPS 2023*.

Yang, K., & Klein, D. (2021). FUDGE: Controlled Text Generation With Future Discriminators. *NAACL 2021*.

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., & Stoica, I. (2024). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. *NeurIPS 2024*.

Zou, A., Wang, Z., Kolter, J. Z., & Fredrikson, M. (2023). Universal and Transferable Adversarial Attacks on Aligned Language Models. *arXiv:2307.15043*.
