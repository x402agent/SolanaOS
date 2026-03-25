---
name: session-logs
description: Search local SolanaOS session logs for prior context and tool history.
homepage: https://seeker.solanaos.net/solanaos
---

# Session Logs

Use this skill when a user refers to an older conversation that is no longer in active context.

## Common queries

```bash
rg -l "phrase" ~/.nanosolana/agents/*/sessions/*.jsonl
jq -r 'select(.message.role == "user") | .message.content[]? | select(.type == "text") | .text' <session>.jsonl
jq -r '.message.content[]? | select(.type == "toolCall") | .name' <session>.jsonl | sort | uniq -c
```

Keep lookups narrow on mobile. Prefer `rg`, `jq`, and small excerpts over loading full session files.
