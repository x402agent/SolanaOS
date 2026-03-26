# G0DM0D3 -- Terms of Service

**Last updated:** 2026-02-17

---

## 1. Acceptance

By using G0DM0D3 -- whether through the web frontend, the API server, or a self-hosted deployment -- you agree to these terms. If you do not agree, do not use the software.

---

## 2. What G0DM0D3 Is

G0DM0D3 is an open-source research tool for AI safety, red teaming, and cognition research. It is provided **as-is** for experimentation and study. It is not a commercial product, and there is no company behind it -- just an open-source project and its contributors.

---

## 3. Data Collection

This is the section that matters most. Read it carefully.

G0DM0D3 collects data in **three tiers**. The first two are always on and collect **only metadata** -- never your messages, prompts, responses, API keys, or any personally identifiable information. The third tier is strictly opt-in and does include conversation content.

### Overview

| | Tier 1: ZDR Metadata | Tier 2: Telemetry Beacon | Tier 3: Dataset Collection |
|---|---|---|---|
| **Where it runs** | API server | Web frontend (browser) | API server |
| **Always on?** | Yes | Yes | **No -- opt-in only** |
| **Collects message content?** | Never | Never | **Yes, when you opt in** |
| **Collects PII?** | Never | Never | Never |
| **Collects API keys?** | Never | Never | Never |
| **Source code** | `api/lib/metadata.ts` | `src/lib/telemetry.ts` | `api/lib/dataset.ts` |

---

### Tier 1: ZDR Metadata Tracker (Always On -- API Server)

This runs on every API request. It records how the system performed, not what you said.

#### What IS collected

| Data Point | Description |
|---|---|
| Timestamp | When the request happened |
| Endpoint | Which API endpoint was called |
| Mode | Standard or ULTRAPLINIAN |
| Tier | Fast, standard, or full (ULTRAPLINIAN only) |
| Stream | Whether streaming was used |
| Pipeline flags | Whether godmode, autotune, parseltongue, and STM were enabled |
| STM modules | Which STM modules were active |
| Strategy | Which routing strategy was used |
| AutoTune context | Detected context type (code/creative/analytical/conversational/chaotic) and confidence score |
| Models queried | How many models were queried (count only) |
| Per-model results | Model name, score, duration in ms, success/failure, content length (character count only), categorized error type |
| Winner metadata | Winning model name, score, duration, content length (character count) |
| Total duration | End-to-end request time in ms |
| Response length | Character count of the response (not the response itself) |
| Liquid Response metadata | Number of leader changes, time to first response |
| Error types | Categorized as: `timeout`, `rate_limit`, `auth`, `empty`, `early_exit`, `model_error`, or `unknown` |

#### What is NEVER collected

| Excluded Data | Why |
|---|---|
| Message content | Your prompts and conversations are yours |
| System prompts | Never recorded |
| Response text | Only the character count, never the actual content |
| API keys or auth tokens | Never leaves your client |
| IP addresses | Not recorded |
| Any PII | Not recorded, period |
| Raw error messages | Only categorized error types (e.g., "timeout"), never the actual error text |

**Storage:** In-memory ring buffer (50,000 events max). When the buffer reaches 80% capacity, it auto-publishes to HuggingFace as JSONL and clears. Oldest events are evicted if the buffer fills up.

---

### Tier 2: Client-Side Telemetry Beacon (Always On -- Web Frontend)

This runs in your browser after every LLM request. It sends structural metadata to a Cloudflare Pages proxy endpoint. The proxy strips PII fields defensively before committing data to HuggingFace.

#### What IS collected

| Data Point | Description |
|---|---|
| Event type | Type of event (e.g., `chat_completion`) |
| Timestamp | When the event occurred |
| Session ID | A random, ephemeral ID generated per browser session -- not tied to any user identity |
| Mode | Standard or ULTRAPLINIAN |
| Model name | Which model was used |
| Duration | Request time in ms |
| Response length | Character count |
| Success/failure | Whether the request succeeded |
| Pipeline config | Autotune on/off, parseltongue on/off, STM modules, strategy, godmode on/off |
| AutoTune metadata | Detected context type and confidence score |
| Parseltongue metadata | Number of triggers found (count only, not the trigger words), technique, intensity |
| ULTRAPLINIAN metadata | Tier, models queried count, models succeeded count, winner model, winner score, total duration |

#### What is NEVER collected

| Excluded Data | Why |
|---|---|
| Message content | Never sent to the telemetry endpoint |
| Prompts or responses | Not included in telemetry events |
| API keys or tokens | Never leaves localStorage |
| PII of any kind | Not collected; proxy also strips defensively |

**Storage:** Events are batched in browser memory and flushed every 30 seconds or every 20 events (whichever comes first) via POST to `/api/telemetry`. On page unload, remaining events are sent via `navigator.sendBeacon`. Telemetry is fire-and-forget -- it never blocks the UI or throws user-facing errors.

---

### Tier 3: Opt-In Dataset Collection (Only When You Explicitly Enable It)

> **WARNING: This tier collects your full conversation content (prompts and responses) and publishes it to a PUBLIC HuggingFace dataset that anyone can download, redistribute, and use for any purpose. Only enable this if you understand and accept this.**

This tier **only activates** when you explicitly enable "Dataset Generation" in Settings → Privacy, or set `contribute_to_dataset: true` in your API request. It exists to build an open-source research dataset for studying how different models respond to steering primitives. If you do not enable this, none of this data is collected.

#### What IS collected (only when opted in)

| Data Point | Description |
|---|---|
| Messages sent and received | **Actual conversation content** -- your prompts and the model's responses. **This data is PUBLIC.** |
| Model and endpoint | Which model and API endpoint were used |
| Mode | Standard or ULTRAPLINIAN |
| AutoTune details | Strategy, detected context, confidence, full parameter set, reasoning |
| Parseltongue details | Trigger words found (the actual words, not just a count), technique used, transformation count |
| STM details | Which modules were applied |
| ULTRAPLINIAN details | Tier, full list of models queried, winner model, all scores/durations, total duration |
| Feedback | User ratings (thumbs up/down) and heuristics (response length, repetition score, vocabulary diversity) |

#### Automatic PII Scrubbing

All dataset entries pass through an automatic PII scrubber before being stored. The scrubber detects and redacts:

- Email addresses
- Phone numbers (US and international formats)
- Social Security Numbers (US)
- Credit card numbers
- IPv4 and IPv6 addresses
- API keys and bearer tokens (common patterns like `sk-`, `pk-`, `AKIA`)

**Automated scrubbing is best-effort and NOT guaranteed to catch all PII.** It will not catch names, physical addresses, or PII in non-standard formats. **You are responsible for not including sensitive personal information in your prompts when Dataset Mode is enabled.**

#### What you should NEVER include when Dataset Mode is on

- Real names (yours or anyone else's)
- Physical addresses or location data
- Passwords, private keys, or credentials
- Financial account numbers
- Medical records or health information
- Any information that could identify a real person

#### What is NEVER collected (even when opted in)

| Excluded Data | Why |
|---|---|
| API keys | Never stored, never transmitted to G0DM0D3 infrastructure |
| IP addresses | Not recorded |
| Auth tokens | Not recorded |
| System prompts | Excluded to prevent leaking custom prompt configurations |

**Storage:** In-memory buffer (10,000 entries max, FIFO eviction). Auto-publishes to HuggingFace when buffer reaches 80% capacity.

**Deletion:** You can delete your contributed entries at any time via `DELETE /v1/dataset/:id` while data remains in the server's memory buffer. **Once data has been published to HuggingFace, it is public and may be cached, forked, or redistributed by third parties.** Post-publication deletion requests must be directed to the HuggingFace repository maintainers, and full removal cannot be guaranteed.

---

## 4. Data Storage and Publishing

### In-Memory Storage

All collected data (metadata, telemetry, and opt-in dataset entries) is stored in server memory first. Nothing is written to disk on the G0DM0D3 server. If the server restarts, in-memory data that has not been published is lost.

### HuggingFace Publishing

When configured (via `HF_TOKEN` and `HF_DATASET_REPO` environment variables), G0DM0D3 auto-publishes collected data to a HuggingFace dataset repository.

| Detail | Value |
|---|---|
| Default repository | `pliny-the-prompter/g0dm0d3` |
| File format | JSONL (JSON Lines) |
| Metadata path | `metadata/batch_<timestamp>.jsonl` |
| Dataset path | `dataset/batch_<timestamp>.jsonl` |
| Flush triggers | Buffer at 80% capacity, periodic timer (every 30 minutes), or graceful server shutdown |

Published data on HuggingFace is public and persistent. Once data is published to HuggingFace, it is governed by HuggingFace's terms and policies.

Self-hosted deployments can disable HuggingFace publishing entirely by not setting the `HF_TOKEN` and `HF_DATASET_REPO` environment variables. In that case, data remains in memory only and is lost on server restart.

### Data Retention

- **In-memory:** Data is retained until the buffer is flushed to HuggingFace or evicted (FIFO) when the buffer is full.
- **HuggingFace:** Published data persists in the HuggingFace repository indefinitely unless manually removed by the repository maintainers.

### Deletion Rights

- **Tier 3 (opt-in dataset):** You can request deletion of individual entries via `DELETE /v1/dataset/:id` while the data is still in the server's memory buffer. Once data has been published to HuggingFace, deletion requests must be directed to the HuggingFace repository maintainers.
- **Tiers 1 and 2 (metadata/telemetry):** Because this data contains no PII and no message content, there is no mechanism for individual deletion. The data is anonymous aggregate metadata.

---

## 5. API Keys, Credentials, and Chat History

Your API keys (e.g., OpenRouter keys) are:

- **Stored in your browser's `localStorage` only.** They never leave your device except to be sent directly to the third-party API provider (e.g., OpenRouter) as part of your requests.
- **Never transmitted to G0DM0D3 servers or infrastructure.**
- **Never logged, recorded, or included in any telemetry or metadata.**

You are responsible for keeping your API keys secure. Do not share them publicly.

### Chat History Self-Custody

Your conversation history is stored **exclusively in your browser's `localStorage`**. G0DM0D3 has no account system, no cloud sync, and no server-side storage for your conversations.

**This means:**

- Clearing your browser data **permanently deletes** your chat history. There is no recovery mechanism.
- Your history does not transfer between browsers, devices, or browser profiles.
- Private/incognito browsing sessions discard all data when the window closes.
- `localStorage` is subject to browser storage limits (typically 5–10 MB). If you exceed this limit, older data may be silently evicted by the browser.

**G0DM0D3 cannot recover lost conversations.** No copy of your chat history exists on any server. You are solely responsible for backing up any conversations you wish to keep. You can export your data manually via your browser's developer tools (`Application → Local Storage`) or by copying conversations from the UI.

---

## 6. Enterprise Use

### Who This Applies To

This section applies to **Enterprise Users** -- defined as any for-profit entity (or its subsidiaries, affiliates, or contractors acting on its behalf) that meets **any** of the following criteria:

- Annual gross revenue exceeding **$10 million USD**
- More than **100 employees** (full-time, part-time, or contracted)
- Is publicly traded on any stock exchange
- Is a subsidiary, division, or affiliate of an entity that meets any of the above criteria

If you're an individual, a researcher, a student, a hobbyist, a small team, a nonprofit, an educational institution, a government research lab, or a company that doesn't meet the thresholds above -- **this section does not apply to you. G0DM0D3 is free for you. Full stop.**

### What Enterprise Users Must Do

Enterprise Users that use the G0DM0D3 hosted service (the API server, the web frontend hosted by the project, or any project-operated infrastructure) in any capacity -- including internal tools, employee-facing products, customer-facing products, evaluation, benchmarking, or integration -- must obtain a **Commercial Use License** from the G0DM0D3 maintainers.

This applies to:

- **Direct use** of the hosted service or API
- **Embedding** the hosted service into enterprise products, platforms, or workflows
- **Using data collected via the hosted service** (Tier 1, 2, or 3) for commercial purposes such as model training, product development, competitive analysis, or internal research that feeds into commercial products

### What Enterprise Users Get

A Commercial Use License includes:

- Authorized use of the hosted G0DM0D3 service for enterprise purposes
- Priority support channel
- SLA guarantees (negotiated per agreement)
- Custom data handling and retention terms (if needed)
- Exemption from the default data publishing pipeline (Tiers 1 and 2) if contractually agreed

### What This Does NOT Apply To

To be absolutely clear, the following uses are **always free, for everyone, including enterprises**:

- **Self-hosting G0DM0D3 from source code** under the AGPL-3.0 license. The source code license is separate from these service terms. If you clone the repo, run it on your own servers, and comply with the AGPL-3.0 (keep your derivative works open source), you owe nothing.
- **Contributing to the project** via pull requests, issues, documentation, or community support.
- **Academic or nonprofit research** using the hosted service, regardless of institutional size.
- **Personal use** by employees of enterprise entities acting in their individual capacity, on their own time, with their own API keys.

### Pricing

Pricing for Commercial Use Licenses is negotiated on a case-by-case basis. Enterprise Users should contact the maintainers to discuss terms.

### Enforcement

Enterprise Users accessing the hosted service without a Commercial Use License are in violation of these terms. The maintainers reserve the right to:

- Revoke access to the hosted service
- Pursue reasonable compensation for unauthorized commercial use
- Publicly disclose violations (after a 30-day private notice and cure period)

We're not looking to sue anybody. We'd rather have a conversation. But if a billion-dollar company is extracting value from this project and contributing nothing back -- neither code, nor funding, nor even acknowledgment -- that's not the spirit of open source. This clause exists to keep things fair.

### Data Licensing for Enterprise

Enterprise Users that access the publicly published research dataset (on HuggingFace) for commercial purposes -- including model training, fine-tuning, product development, or competitive intelligence -- must obtain a **Data Use License** from the G0DM0D3 maintainers.

Non-commercial research use of the published dataset is always free.

---

## 7. Your Responsibilities

By using G0DM0D3, you agree that:

- **You are responsible for the outputs generated through this tool.** G0DM0D3 is a research interface -- it does not generate content itself, it routes requests to AI models via third-party APIs.
- **You will comply with all applicable laws and regulations** in your jurisdiction when using this tool.
- **You will comply with the terms of service of the underlying AI providers** (e.g., OpenRouter, and the model providers accessible through it).
- **You will not use G0DM0D3 to generate content that is illegal** in your jurisdiction.
- **If you opt in to dataset contribution (Tier 3), you accept that your conversation data will be published publicly** as part of an open research dataset.

---

## 8. No Warranty / Disclaimer

G0DM0D3 IS PROVIDED "AS-IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

The maintainers and contributors of G0DM0D3:

- Make no guarantees about uptime, availability, or correctness.
- Are not liable for any damages arising from the use of this software.
- Are not responsible for the content generated by third-party AI models accessed through this tool.
- Are not responsible for any costs incurred through third-party API usage (e.g., OpenRouter charges).

Use this tool at your own risk.

---

## 9. Third-Party Services

G0DM0D3 interacts with third-party services. Your use of these services is governed by their respective terms:

| Service | Role | Their Terms |
|---|---|---|
| **OpenRouter** | Routes requests to AI models | [openrouter.ai/terms](https://openrouter.ai/terms) |
| **HuggingFace** | Hosts published metadata and dataset files | [huggingface.co/terms-of-service](https://huggingface.co/terms-of-service) |
| **Cloudflare Pages** | Hosts the web frontend and telemetry proxy | [cloudflare.com/terms](https://www.cloudflare.com/terms/) |

G0DM0D3 is not affiliated with, endorsed by, or sponsored by any of these services.

---

## 10. Open Source

G0DM0D3 is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

The entire source code is available for inspection. Every claim made in this document can be verified by reading the code:

- Tier 1 metadata: `api/lib/metadata.ts`
- Tier 2 telemetry: `src/lib/telemetry.ts`
- Tier 3 dataset: `api/lib/dataset.ts`
- HuggingFace publishing: `api/lib/hf-publisher.ts`

You do not need to trust this document. Read the code.

---

## 11. Changes to These Terms

These terms may be updated as the project evolves. Changes will be committed to the repository and visible in the git history. There is no email notification system -- if you use G0DM0D3, check this file periodically.

The "Last updated" date at the top of this document reflects the most recent revision.

---

## 12. Contact

This is an open-source project. The best way to reach the maintainers is through the project's GitHub repository:

- **Questions or concerns:** Open a GitHub issue.
- **Data deletion requests:** Open a GitHub issue or use the `DELETE /v1/dataset/:id` API endpoint for Tier 3 data.
- **Enterprise licensing inquiries:** Open a GitHub issue tagged `enterprise` or contact the maintainers directly.
- **Security issues:** See [SECURITY.md](SECURITY.md) for responsible disclosure. Do NOT open public issues for vulnerabilities.

---

*These terms exist to be honest with you, not to protect a corporation. G0DM0D3 collects metadata to understand how the system performs. It never collects your messages, your keys, or your identity in the always-on tiers. The opt-in tier is exactly that -- opt-in. If you're a person, a researcher, a small team -- this is free. If you're a giant corporation making money off of open-source labor, we're asking you to contribute back. The code is open. Verify it yourself.*
