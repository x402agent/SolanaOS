package daemon

import (
	"context"
	"fmt"
	"strings"
	"time"

	browserusepkg "github.com/x402agent/Solana-Os-Go/pkg/browseruse"
)

func (d *Daemon) browserUseStatusLine() string {
	if d == nil || d.cfg == nil {
		return "`unavailable`"
	}
	status := browserusepkg.Inspect(d.cfg.Tools.BrowserUse)
	if !status.Enabled && !status.APIKeyConfigured {
		if !status.ProviderReady {
			return "`disabled`"
		}
	}
	if !status.Enabled && !status.ProviderReady && !status.APIKeyConfigured {
		return "`disabled`"
	}
	if !status.Installed {
		return "`configured` · CLI missing"
	}
	if !status.ProviderReady && !status.APIKeyConfigured {
		return "`installed` · provider missing"
	}
	return fmt.Sprintf("`ready` · session `%s` · provider `%s`", status.Session, status.CloudProvider)
}

func (d *Daemon) browserUseResponse(content string, args []string) string {
	if d == nil || d.cfg == nil {
		return "🌐 Browser Use is unavailable because daemon config is missing."
	}

	tail := strings.TrimSpace(commandTail(content))
	if tail == "" {
		return d.browserUseStatusMarkdown()
	}

	tokens, err := shellSplit(tail)
	if err != nil {
		return fmt.Sprintf("❌ Browser Use command parse error: %v", err)
	}
	if len(tokens) == 0 {
		return d.browserUseStatusMarkdown()
	}

	action := strings.ToLower(strings.TrimSpace(tokens[0]))
	switch action {
	case "status":
		return d.browserUseStatusMarkdown()
	case "activate", "login", "on", "enable":
		return d.browserUseActivate()
	case "connect":
		return d.browserUseConnect()
	case "profiles", "profile_list":
		return d.browserUseRun([]string{"profile", "list"})
	case "profile":
		if len(tokens) == 1 {
			return d.browserUseRun([]string{"profile", "list"})
		}
		return d.browserUseRun(tokens)
	case "cloud":
		if len(tokens) == 1 {
			return d.browserUseRun([]string{"cloud", "connect"})
		}
		return d.browserUseRun(tokens)
	case "tunnel":
		if len(tokens) == 1 {
			return d.browserUseRun([]string{"tunnel", "list"})
		}
		return d.browserUseRun(tokens)
	case "close":
		if len(tokens) == 1 {
			return d.browserUseClose("", false)
		}
		if len(tokens) == 2 {
			switch strings.ToLower(strings.TrimSpace(tokens[1])) {
			case "all":
				return d.browserUseClose("", true)
			case "--all":
				return d.browserUseClose("", true)
			default:
				return d.browserUseClose(tokens[1], false)
			}
		}
		return d.browserUseRun(tokens)
	case "session":
		if len(tokens) < 3 {
			return "🌐 Usage: `/browseruse session <name> <command ...>`\n\nExample:\n`/browseruse session work open https://example.com`"
		}
		finalArgs := append([]string{"--session", tokens[1]}, tokens[2:]...)
		return d.browserUseRun(finalArgs)
	case "help":
		return d.browserUseHelp()
	default:
		return d.browserUseRun(tokens)
	}
}

func (d *Daemon) browserUseActivate() string {
	ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
	defer cancel()

	result, err := browserusepkg.Activate(ctx, d.cfg.Tools.BrowserUse)
	if err != nil {
		if result != nil && !result.Status.Installed {
			return "🌐 Browser Use CLI is not installed.\n\nInstall it with:\n`curl -fsSL https://browser-use.com/cli/install.sh | bash`\n\nThen run `/browseruse activate` again."
		}
	if result != nil && !result.Status.APIKeyConfigured {
		return "🌐 Browser Use is not configured.\n\nSet `BROWSERUSE_API_KEY` or `BROWSER_USE_API_KEY` in your `.env`, restart the daemon, then run `/browseruse activate`."
	}
		return fmt.Sprintf("❌ Browser Use activation failed.\n\n%s", strings.TrimSpace(err.Error()))
	}

	reply := "✅ Browser Use activated.\n\nSaved the cloud login with `browser-use cloud login`."
	if strings.TrimSpace(result.Output) != "" {
		reply += "\n\nCLI output:\n```text\n" + result.Output + "\n```"
	}
	reply += "\nUse `/browseruse sessions` to inspect live sessions."
	return reply
}

func (d *Daemon) browserUseConnect() string {
	ctx, cancel := context.WithTimeout(d.ctx, 90*time.Second)
	defer cancel()

	result, err := browserusepkg.Connect(ctx, d.cfg.Tools.BrowserUse)
	if err != nil {
		if result != nil && !result.Status.Installed {
			return "🌐 Browser Use CLI is not installed.\n\nInstall it with:\n`curl -fsSL https://browser-use.com/cli/install.sh | bash`"
		}
		return fmt.Sprintf("❌ Browser Use connect failed.\n\n%s", strings.TrimSpace(err.Error()))
	}

	var b strings.Builder
	b.WriteString("✅ **Browser Use Connected**\n\n")
	b.WriteString("Provider: `" + result.Status.CloudProvider + "`\n")
	if result.Session.SessionName != "" {
		b.WriteString("Session: `" + result.Session.SessionName + "`\n")
	}
	if result.Session.ProviderSessionID != "" {
		b.WriteString("Cloud ID: `" + result.Session.ProviderSessionID + "`\n")
	}
	if strings.TrimSpace(result.Session.CDPURL) != "" {
		b.WriteString("CDP URL: `" + result.Session.CDPURL + "`\n")
	}
	if strings.TrimSpace(result.Output) != "" {
		b.WriteString("\n```text\n")
		b.WriteString(result.Output)
		b.WriteString("\n```")
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) browserUseRun(args []string) string {
	ctx, cancel := context.WithTimeout(d.ctx, 90*time.Second)
	defer cancel()

	result, err := browserusepkg.Run(ctx, d.cfg.Tools.BrowserUse, args...)
	if err != nil {
		if result != nil && !result.Status.Installed {
			return "🌐 Browser Use CLI is not installed.\n\nInstall it with:\n`curl -fsSL https://browser-use.com/cli/install.sh | bash`"
		}
		return fmt.Sprintf("❌ Browser Use command failed.\n\nCommand: `%s`\n\n%s",
			strings.Join(result.Args, " "),
			strings.TrimSpace(err.Error()),
		)
	}

	var b strings.Builder
	b.WriteString("🌐 **Browser Use Result**\n\n")
	b.WriteString("Command: `" + strings.Join(result.Args, " ") + "`\n")
	if result.Status.Session != "" {
		b.WriteString("Default session: `" + result.Status.Session + "`\n")
	}
	if strings.TrimSpace(result.Output) != "" {
		b.WriteString("\n```text\n")
		b.WriteString(result.Output)
		b.WriteString("\n```")
	} else {
		b.WriteString("\n✅ Command completed with no output.")
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) browserUseClose(sessionName string, all bool) string {
	ctx, cancel := context.WithTimeout(d.ctx, 90*time.Second)
	defer cancel()

	result, err := browserusepkg.Close(ctx, d.cfg.Tools.BrowserUse, sessionName, all)
	if err != nil {
		return fmt.Sprintf("❌ Browser Use close failed.\n\n%s", strings.TrimSpace(err.Error()))
	}

	var b strings.Builder
	b.WriteString("🌐 **Browser Use Close**\n\n")
	b.WriteString("Provider: `" + result.Status.CloudProvider + "`\n")
	if all {
		b.WriteString("Scope: `all`\n")
	} else if result.SessionName != "" {
		b.WriteString("Session: `" + result.SessionName + "`\n")
	}
	if len(result.Closed) > 0 {
		b.WriteString("Closed: `" + strings.Join(result.Closed, ", ") + "`\n")
	}
	if len(result.Failed) > 0 {
		b.WriteString("Failed: `" + strings.Join(result.Failed, ", ") + "`\n")
	}
	if strings.TrimSpace(result.Output) != "" {
		b.WriteString("\n```text\n")
		b.WriteString(result.Output)
		b.WriteString("\n```")
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) browserUseStatusMarkdown() string {
	if d == nil || d.cfg == nil {
		return "🌐 Browser Use is unavailable because daemon config is missing."
	}
	status := browserusepkg.Inspect(d.cfg.Tools.BrowserUse)

	var b strings.Builder
	b.WriteString("🌐 **Browser Use**\n\n")
	b.WriteString(fmt.Sprintf("Enabled: `%t`\n", status.Enabled))
	if status.Installed {
		b.WriteString(fmt.Sprintf("CLI: `installed` · `%s`\n", status.BinaryPath))
	} else {
		b.WriteString("CLI: `missing`\n")
	}
	if status.APIKeyConfigured {
		b.WriteString("API key: `configured`\n")
	} else {
		b.WriteString("API key: `missing`\n")
	}
	b.WriteString(fmt.Sprintf("Provider: `%s`\n", status.CloudProvider))
	b.WriteString(fmt.Sprintf("Provider ready: `%t`\n", status.ProviderReady))
	b.WriteString(fmt.Sprintf("Session: `%s`\n", status.Session))
	if strings.TrimSpace(status.Profile) != "" {
		b.WriteString(fmt.Sprintf("Profile: `%s`\n", status.Profile))
	}
	if status.Connect {
		b.WriteString("Connect: `true`\n")
	}
	if strings.TrimSpace(status.CDPURL) != "" {
		b.WriteString(fmt.Sprintf("CDP URL: `%s`\n", status.CDPURL))
	}
	if strings.TrimSpace(status.BrowserbaseProjectID) != "" {
		b.WriteString(fmt.Sprintf("Browserbase project: `%s`\n", status.BrowserbaseProjectID))
	}
	b.WriteString(fmt.Sprintf("Headed: `%t`\n", status.Headed))
	b.WriteString(fmt.Sprintf("Cloud mode: `%t`\n", status.Cloud))
	if strings.TrimSpace(status.CloudProfileID) != "" {
		b.WriteString(fmt.Sprintf("Cloud profile: `%s`\n", status.CloudProfileID))
	}
	if strings.TrimSpace(status.CloudProxy) != "" {
		b.WriteString(fmt.Sprintf("Cloud proxy: `%s`\n", status.CloudProxy))
	}
	if status.CloudTimeoutMin > 0 {
		b.WriteString(fmt.Sprintf("Cloud timeout: `%d min`\n", status.CloudTimeoutMin))
	}
	if strings.TrimSpace(status.Home) != "" {
		b.WriteString(fmt.Sprintf("Home: `%s`\n", status.Home))
	}

	b.WriteString("\nQuick use:\n")
	b.WriteString("`/browseruse sessions`\n")
	b.WriteString("`/browseruse connect`\n")
	b.WriteString("`/browseruse profile list`\n")
	b.WriteString("`/browseruse session work open https://example.com`\n")
	b.WriteString("`/browseruse --session work open https://example.com`\n")
	b.WriteString("`/browseruse --session work state`\n")
	b.WriteString("`/browseruse --session work click 5`\n")
	b.WriteString("`/browseruse --session work input 1 \"hello@example.com\"`\n")
	b.WriteString("`/browseruse close --all`\n")
	b.WriteString("`/browseruse cloud v2 GET /browsers`\n")

	if !status.Installed {
		b.WriteString("\nInstall:\n`curl -fsSL https://browser-use.com/cli/install.sh | bash`")
	}
	if !status.APIKeyConfigured {
		b.WriteString("\n\nSet `BROWSERUSE_API_KEY` or `BROWSER_USE_API_KEY` in your `.env` to enable Browser Use cloud login.")
	}
	if !status.ProviderReady {
		b.WriteString("\nSet `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` or configure Browser Use cloud credentials to enable `/browseruse connect`.")
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) browserUseHelp() string {
	return "🌐 **Browser Use Telegram Bridge**\n\n" +
		"`/browseruse status` — inspect config and CLI readiness\n" +
		"`/browseruse activate` — run `browser-use cloud login`\n" +
		"`/browseruse sessions` — list live browser sessions\n" +
		"`/browseruse connect` — provision a cloud browser with Browser Use or Browserbase and attach the current session\n" +
		"`/browseruse profile list` — list Chrome/browser profiles\n" +
		"`/browseruse session work open https://example.com`\n" +
		"`/browseruse session work state`\n" +
		"`/browseruse --session work open https://example.com`\n" +
		"`/browseruse --session work state`\n" +
		"`/browseruse --session work click 5`\n" +
		"`/browseruse --session work input 1 \"john@example.com\"`\n" +
		"`/browseruse --session work type \"Hello world\"`\n" +
		"`/browseruse --session work screenshot`\n" +
		"`/browseruse close --all`\n" +
		"`/browseruse cloud connect`\n" +
		"`/browseruse cloud v2 GET /browsers`\n\n" +
		"Anything after `/browseruse` is passed through to the Browser Use CLI with your configured defaults."
}

func commandTail(content string) string {
	raw := strings.TrimSpace(content)
	if raw == "" {
		return ""
	}
	firstSpace := strings.IndexFunc(raw, func(r rune) bool {
		return r == ' ' || r == '\t' || r == '\n' || r == '\r'
	})
	if firstSpace < 0 {
		return ""
	}
	return strings.TrimSpace(raw[firstSpace+1:])
}

func shellSplit(input string) ([]string, error) {
	var (
		args      []string
		current   strings.Builder
		quote     rune
		escaping  bool
		tokenOpen bool
	)

	flush := func() {
		if tokenOpen {
			args = append(args, current.String())
			current.Reset()
			tokenOpen = false
		}
	}

	for _, r := range input {
		switch {
		case escaping:
			current.WriteRune(r)
			tokenOpen = true
			escaping = false
		case r == '\\':
			escaping = true
		case quote != 0:
			if r == quote {
				quote = 0
			} else {
				current.WriteRune(r)
				tokenOpen = true
			}
		case r == '"' || r == '\'':
			quote = r
			tokenOpen = true
		case r == ' ' || r == '\t' || r == '\n' || r == '\r':
			flush()
		default:
			current.WriteRune(r)
			tokenOpen = true
		}
	}

	if escaping {
		return nil, fmt.Errorf("dangling escape")
	}
	if quote != 0 {
		return nil, fmt.Errorf("unterminated quote")
	}
	flush()
	return args, nil
}
