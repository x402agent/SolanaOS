package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	gatewaypkg "github.com/x402agent/Solana-Os-Go/pkg/gateway"
)

type githubRepoPlan struct {
	Owner       string
	Name        string
	Description string
	Private     bool
	Brief       string
}

type githubRepo struct {
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	HTMLURL  string `json:"html_url"`
	CloneURL string `json:"clone_url"`
	Owner    struct {
		Login string `json:"login"`
	} `json:"owner"`
	Private bool `json:"private"`
}

func (d *Daemon) githubResponse(msg bus.InboundMessage, args []string) string {
	if len(args) == 0 {
		return d.githubUsage()
	}

	switch strings.ToLower(strings.TrimSpace(args[0])) {
	case "help":
		return d.githubUsage()
	case "sessions":
		return d.githubSessionsResponse()
	case "log":
		return d.githubLogResponse(args[1:])
	case "continue", "resume":
		return d.githubContinueResponse(args[1:])
	default:
		return d.githubCreateRepoResponse(msg, strings.Join(args, " "))
	}
}

func (d *Daemon) githubUsage() string {
	return "Usage:\n" +
		"`/github <natural language brief>` — create a repo and start Claude Code\n" +
		"`/github sessions` — list active/recent GitHub coding sessions\n" +
		"`/github log <session_id>` — show the latest Claude log output\n" +
		"`/github continue <session_id> <prompt>` — continue a Claude repo session\n\n" +
		"Examples:\n" +
		"`/github build me a private Next.js SaaS starter with Stripe and Supabase`\n" +
		"`/github create public repo called lobster-arena for a multiplayer browser game`\n"
}

func (d *Daemon) githubCreateRepoResponse(msg bus.InboundMessage, raw string) string {
	brief := strings.TrimSpace(raw)
	if brief == "" {
		return d.githubUsage()
	}

	token := d.githubToken()
	if token == "" {
		return "🐙 GitHub token missing. Set `GITHUB_PAT` or `GH_TOKEN` and try again."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 90*time.Second)
	defer cancel()

	viewer, err := d.githubViewerLogin(ctx, token)
	if err != nil {
		return "🐙 GitHub auth failed: " + err.Error()
	}

	plan := inferGitHubRepoPlan(brief, viewer)
	repo, created, err := d.githubEnsureRepo(ctx, token, viewer, plan)
	if err != nil {
		return "🐙 GitHub repo setup failed: " + err.Error()
	}

	localPath, pushNote, err := d.prepareLocalGitHubRepo(ctx, repo, plan, token, created)
	if err != nil {
		return "🐙 Repo created, but local workspace setup failed: " + err.Error()
	}

	var sessionNote string
	if d.codingSessions != nil {
		prompt := buildGitHubClaudePrompt(repo, plan, localPath)
		session, err := d.codingSessions.Create(gatewaypkg.CreateCodingSessionRequest{
			Runtime:      "claude",
			Prompt:       prompt,
			Workdir:      localPath,
			Label:        "github:" + repo.FullName,
			AllowedTools: defaultClaudeAllowedTools(),
			SystemPrompt: defaultClaudeSystemPrompt("github"),
		})
		if err != nil {
			sessionNote = "Claude session not started: " + err.Error()
		} else {
			d.setActiveCodingSession(msg, session, "github")
			sessionNote = fmt.Sprintf("Claude session: `%s`", session.ID)
		}
	} else {
		sessionNote = "Claude session manager is not available in this daemon."
	}

	status := "created"
	if !created {
		status = "reused"
	}

	var b strings.Builder
	fmt.Fprintf(&b, "🐙 **GitHub Repo %s**\n\n", status)
	fmt.Fprintf(&b, "Repo: %s\n", repo.HTMLURL)
	fmt.Fprintf(&b, "Visibility: %s\n", githubVisibility(repo.Private))
	fmt.Fprintf(&b, "Local path: `%s`\n", localPath)
	if strings.TrimSpace(pushNote) != "" {
		fmt.Fprintf(&b, "Git: %s\n", pushNote)
	}
	fmt.Fprintf(&b, "%s\n", sessionNote)
	if strings.TrimSpace(plan.Description) != "" {
		fmt.Fprintf(&b, "\nDescription: %s\n", truncate(plan.Description, 140))
	}
	b.WriteString("\nUse `/github sessions` to list sessions or `/github log <session_id>` for output.")
	return b.String()
}

func (d *Daemon) githubSessionsResponse() string {
	if d.codingSessions == nil {
		return "🐙 Claude/GitHub session manager is not available."
	}

	root := filepath.Join(config.DefaultWorkspacePath(), "github")
	sessions := d.codingSessions.List()
	filtered := make([]*gatewaypkg.CodingSession, 0, len(sessions))
	for _, session := range sessions {
		if strings.HasPrefix(session.Workdir, root) || strings.HasPrefix(session.Label, "github:") {
			filtered = append(filtered, session)
		}
	}
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].UpdatedAt.After(filtered[j].UpdatedAt)
	})
	if len(filtered) == 0 {
		return "🐙 No GitHub coding sessions yet."
	}

	var b strings.Builder
	b.WriteString("🐙 **GitHub Sessions**\n\n")
	limit := len(filtered)
	if limit > 8 {
		limit = 8
	}
	for _, session := range filtered[:limit] {
		line := session.Label
		if strings.TrimSpace(line) == "" {
			line = filepath.Base(session.Workdir)
		}
		fmt.Fprintf(&b, "- `%s` · %s · %s\n", session.ID, line, session.Status)
	}
	b.WriteString("\nUse `/github log <session_id>` or `/github continue <session_id> <prompt>`.")
	return b.String()
}

func (d *Daemon) githubLogResponse(args []string) string {
	if d.codingSessions == nil {
		return "🐙 Claude/GitHub session manager is not available."
	}
	if len(args) == 0 {
		return "Usage: `/github log <session_id>`"
	}

	content, run, err := d.codingSessions.ReadLog(strings.TrimSpace(args[0]), "")
	if err != nil {
		return "🐙 Session log lookup failed: " + err.Error()
	}

	content = strings.TrimSpace(content)
	if content == "" {
		content = "(no log output yet)"
	}
	return fmt.Sprintf("🐙 **GitHub Session Log** `%s`\nStatus: %s\n\n```text\n%s\n```",
		run.ID,
		run.Status,
		tailText(content, 2800),
	)
}

func (d *Daemon) githubContinueResponse(args []string) string {
	if d.codingSessions == nil {
		return "🐙 Claude/GitHub session manager is not available."
	}
	if len(args) < 2 {
		return "Usage: `/github continue <session_id> <prompt>`"
	}
	sessionID := strings.TrimSpace(args[0])
	prompt := strings.TrimSpace(strings.Join(args[1:], " "))
	if prompt == "" {
		return "Usage: `/github continue <session_id> <prompt>`"
	}
	session, err := d.codingSessions.Continue(sessionID, prompt)
	if err != nil {
		return "🐙 Session continue failed: " + err.Error()
	}
	return fmt.Sprintf("🐙 Continuing `%s` in `%s`.\nStatus: %s\nUse `/github log %s` to inspect output.",
		session.ID,
		session.Workdir,
		session.Status,
		session.ID,
	)
}

func (d *Daemon) githubToken() string {
	for _, key := range []string{"GH_TOKEN", "GITHUB_PAT", "Github_PAT", "GITHUB_TOKEN"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func (d *Daemon) githubViewerLogin(ctx context.Context, token string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("github user lookup returned %d", resp.StatusCode)
	}
	var payload struct {
		Login string `json:"login"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.Login) == "" {
		return "", fmt.Errorf("github login missing in response")
	}
	return payload.Login, nil
}

func (d *Daemon) githubEnsureRepo(ctx context.Context, token, viewer string, plan githubRepoPlan) (*githubRepo, bool, error) {
	owner := strings.TrimSpace(plan.Owner)
	if owner == "" {
		owner = viewer
	}

	body := map[string]any{
		"name":        plan.Name,
		"description": plan.Description,
		"private":     plan.Private,
		"auto_init":   false,
	}
	payload, _ := json.Marshal(body)

	endpoint := "https://api.github.com/user/repos"
	if !strings.EqualFold(owner, viewer) {
		endpoint = "https://api.github.com/orgs/" + owner + "/repos"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, false, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, false, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		var repo githubRepo
		if err := json.Unmarshal(data, &repo); err != nil {
			return nil, false, err
		}
		return &repo, true, nil
	}
	if resp.StatusCode == http.StatusUnprocessableEntity {
		repo, err := d.githubFetchRepo(ctx, token, owner, plan.Name)
		if err == nil {
			return repo, false, nil
		}
	}
	return nil, false, fmt.Errorf("github repo create returned %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(data)), 220))
}

func (d *Daemon) githubFetchRepo(ctx context.Context, token, owner, name string) (*githubRepo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, name), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github repo fetch returned %d", resp.StatusCode)
	}
	var repo githubRepo
	if err := json.Unmarshal(data, &repo); err != nil {
		return nil, err
	}
	return &repo, nil
}

func (d *Daemon) prepareLocalGitHubRepo(ctx context.Context, repo *githubRepo, plan githubRepoPlan, token string, created bool) (string, string, error) {
	root := filepath.Join(config.DefaultWorkspacePath(), "github")
	if err := os.MkdirAll(root, 0o755); err != nil {
		return "", "", err
	}
	localPath := filepath.Join(root, safeGitHubLocalDir(repo.Owner.Login, repo.Name))
	if err := os.MkdirAll(localPath, 0o755); err != nil {
		return "", "", err
	}

	gitDir := filepath.Join(localPath, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		if err := runGit(ctx, localPath, nil, "init", "-b", "main"); err != nil {
			return "", "", err
		}
	}
	_ = runGit(ctx, localPath, nil, "config", "user.name", "SolanaOS")
	_ = runGit(ctx, localPath, nil, "config", "user.email", "solanaos@local")

	readmePath := filepath.Join(localPath, "README.md")
	if _, err := os.Stat(readmePath); os.IsNotExist(err) {
		readme := fmt.Sprintf("# %s\n\n%s\n\nGenerated from SolanaOS `/github`.\n", repo.Name, strings.TrimSpace(plan.Description))
		if err := os.WriteFile(readmePath, []byte(readme), 0o644); err != nil {
			return "", "", err
		}
	}

	if err := ensureGitRemote(ctx, localPath, "origin", repo.CloneURL); err != nil {
		return "", "", err
	}

	if err := runGit(ctx, localPath, nil, "add", "."); err != nil {
		return "", "", err
	}
	status, _ := gitOutput(ctx, localPath, nil, "status", "--porcelain")
	if strings.TrimSpace(status) != "" {
		if err := runGit(ctx, localPath, nil, "commit", "-m", "chore: initialize repository"); err != nil {
			return "", "", err
		}
	}

	if !created {
		return localPath, "remote already existed; local workspace attached without auto-push", nil
	}

	pushEnv, cleanup, err := githubGitAuthEnv(token)
	if err != nil {
		return "", "", err
	}
	defer cleanup()
	if err := runGit(ctx, localPath, pushEnv, "push", "-u", "origin", "main"); err != nil {
		return localPath, "initial local commit created, but push failed: " + err.Error(), nil
	}
	return localPath, "initial commit pushed to origin/main", nil
}

func inferGitHubRepoPlan(brief, defaultOwner string) githubRepoPlan {
	brief = strings.TrimSpace(brief)
	lower := strings.ToLower(brief)

	plan := githubRepoPlan{
		Owner:       "",
		Name:        "",
		Description: truncate(brief, 140),
		Private:     true,
		Brief:       brief,
	}
	if strings.Contains(lower, " public ") || strings.HasPrefix(lower, "public ") || strings.Contains(lower, "open source") {
		plan.Private = false
	}

	if owner, name := parseGitHubOwnerRepo(brief); owner != "" && name != "" {
		plan.Owner = owner
		plan.Name = normalizeRepoName(name)
	}
	if plan.Name == "" {
		if named := parseNamedRepo(brief); named != "" {
			plan.Name = normalizeRepoName(named)
		}
	}
	if plan.Name == "" {
		plan.Name = normalizeRepoName(slugFromBrief(brief))
	}
	if plan.Name == "" {
		plan.Name = fmt.Sprintf("nanosolana-%d", time.Now().Unix())
	}
	if plan.Owner == "" {
		plan.Owner = defaultOwner
	}
	return plan
}

func parseGitHubOwnerRepo(input string) (string, string) {
	re := regexp.MustCompile(`\b([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)\b`)
	match := re.FindStringSubmatch(input)
	if len(match) != 3 {
		return "", ""
	}
	return match[1], match[2]
}

func parseNamedRepo(input string) string {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:called|named)\s+["'` + "`" + `]?([A-Za-z0-9 _.-]+)["'` + "`" + `]?`),
		regexp.MustCompile(`(?i)repo(?:sitory)?\s+["'` + "`" + `]?([A-Za-z0-9 _.-]+)["'` + "`" + `]?`),
	}
	for _, pattern := range patterns {
		match := pattern.FindStringSubmatch(input)
		if len(match) == 2 {
			return strings.TrimSpace(match[1])
		}
	}
	return ""
}

func slugFromBrief(input string) string {
	stop := map[string]bool{
		"build": true, "make": true, "create": true, "repo": true, "repository": true,
		"private": true, "public": true, "for": true, "with": true, "and": true,
		"me": true, "a": true, "an": true, "the": true, "called": true, "named": true,
	}
	re := regexp.MustCompile(`[A-Za-z0-9]+`)
	parts := re.FindAllString(strings.ToLower(input), -1)
	filtered := make([]string, 0, len(parts))
	for _, part := range parts {
		if stop[part] {
			continue
		}
		filtered = append(filtered, part)
		if len(filtered) >= 5 {
			break
		}
	}
	return strings.Join(filtered, "-")
}

func normalizeRepoName(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	if input == "" {
		return ""
	}
	var b strings.Builder
	lastDash := false
	for _, r := range input {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case r == '-', r == '_', r == '.', unicode.IsSpace(r):
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 60 {
		out = strings.Trim(out[:60], "-")
	}
	return out
}

func safeGitHubLocalDir(owner, name string) string {
	owner = strings.TrimSpace(owner)
	name = strings.TrimSpace(name)
	if owner == "" {
		return name
	}
	return owner + "-" + name
}

func ensureGitRemote(ctx context.Context, workdir, remoteName, remoteURL string) error {
	output, err := gitOutput(ctx, workdir, nil, "remote", "get-url", remoteName)
	if err == nil {
		if strings.TrimSpace(output) == strings.TrimSpace(remoteURL) {
			return nil
		}
		return runGit(ctx, workdir, nil, "remote", "set-url", remoteName, remoteURL)
	}
	return runGit(ctx, workdir, nil, "remote", "add", remoteName, remoteURL)
}

func runGit(ctx context.Context, workdir string, extraEnv []string, args ...string) error {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = workdir
	cmd.Env = append(os.Environ(), extraEnv...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %s", strings.Join(args, " "), truncate(strings.TrimSpace(string(output)), 220))
	}
	return nil
}

func gitOutput(ctx context.Context, workdir string, extraEnv []string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = workdir
	cmd.Env = append(os.Environ(), extraEnv...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s: %s", strings.Join(args, " "), truncate(strings.TrimSpace(string(output)), 220))
	}
	return string(output), nil
}

func githubGitAuthEnv(token string) ([]string, func(), error) {
	f, err := os.CreateTemp("", "nanosolana-gh-askpass-*")
	if err != nil {
		return nil, nil, err
	}
	script := "#!/bin/sh\ncase \"$1\" in\n*Username*) echo \"x-access-token\" ;;\n*Password*) echo \"$GIT_PASSWORD\" ;;\n*) echo \"$GIT_PASSWORD\" ;;\nesac\n"
	if _, err := f.WriteString(script); err != nil {
		_ = f.Close()
		_ = os.Remove(f.Name())
		return nil, nil, err
	}
	_ = f.Close()
	if err := os.Chmod(f.Name(), 0o700); err != nil {
		_ = os.Remove(f.Name())
		return nil, nil, err
	}
	env := []string{
		"GIT_TERMINAL_PROMPT=0",
		"GIT_ASKPASS=" + f.Name(),
		"GIT_PASSWORD=" + token,
	}
	cleanup := func() { _ = os.Remove(f.Name()) }
	return env, cleanup, nil
}

func buildGitHubClaudePrompt(repo *githubRepo, plan githubRepoPlan, localPath string) string {
	return fmt.Sprintf(`A GitHub repository has already been created and prepared locally.

Repository:
- Name: %s
- Full name: %s
- URL: %s
- Local path: %s
- Visibility: %s

User brief:
%s

Your job:
1. Analyze the brief and scaffold the initial project in this repository.
2. Improve the README with setup and usage instructions.
3. Make sensible initial implementation choices without asking unnecessary questions.
4. Commit your work locally.
5. If GitHub auth is available, push to origin main.

Keep the repo coherent and production-oriented.`, repo.Name, repo.FullName, repo.HTMLURL, localPath, githubVisibility(repo.Private), plan.Brief)
}

func githubVisibility(isPrivate bool) string {
	if isPrivate {
		return "private"
	}
	return "public"
}

func tailText(input string, max int) string {
	input = strings.TrimSpace(input)
	if len(input) <= max {
		return input
	}
	return "...\n" + input[len(input)-max:]
}
