---
name: github
description: Operate GitHub PRs, issues, checks, and workflow runs with gh.
homepage: https://seeker.solanaos.net/solanaos
---

# GitHub

Use `gh` for repository state, CI checks, and issue or PR operations.

## Common commands

```bash
gh pr list --repo owner/repo
gh pr checks <number> --repo owner/repo
gh run list --repo owner/repo --limit 10
gh issue list --repo owner/repo --state open
```

If the task is code review or implementation, switch to the main coding workflow instead of trying to do everything through `gh`.
