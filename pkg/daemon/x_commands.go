package daemon

import (
	"fmt"
	"os"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
)

func (d *Daemon) rewriteXCommand(msg bus.InboundMessage, cmd string, args []string) (bus.InboundMessage, string, bool) {
	if !strings.EqualFold(strings.TrimSpace(msg.Channel), "x") {
		return msg, "", false
	}

	content := trimLeadingMentions(strings.TrimSpace(msg.Content))
	if content == "" {
		return msg, "", false
	}
	msg.Content = content

	if !strings.HasPrefix(content, "!") {
		return msg, "", false
	}

	cmd, args = parseCommand(content)
	if cmd == "" {
		return msg, "", false
	}

	switch cmd {
	case "!help", "!commands":
		return msg, d.xHelpResponse(), true
	case "!start":
		msg.Content = "/start"
		return msg, "", true
	case "!status":
		msg.Content = "/status"
		return msg, "", true
	case "!wallet":
		if len(args) > 0 {
			msg.Content = "/wallet_basic " + strings.Join(args, " ")
		} else {
			msg.Content = "/wallet"
		}
		return msg, "", true
	case "!portfolio", "!hfolio", "!holdings":
		msg.Content = "/wallet_basic " + strings.Join(args, " ")
		return msg, "", true
	case "!transfers", "!xfers", "!txs":
		msg.Content = "/wallet_trades " + strings.Join(args, " ")
		return msg, "", true
	case "!txhistory", "!deephistory", "!deeptx":
		msg.Content = "/wallet_page " + strings.Join(args, " ")
		return msg, "", true
	case "!token", "!info", "!analyze", "!ca", "!contract", "!lookup":
		msg.Content = "/token_info " + strings.Join(args, " ")
		return msg, "", true
	case "!search", "!find":
		msg.Content = "/token_search " + strings.Join(args, " ")
		return msg, "", true
	case "!trending", "!hot", "!movers":
		if len(args) > 0 && isTrackerTimeframe(args[0]) {
			msg.Content = "/trending_tf " + strings.Join(args, " ")
		} else {
			msg.Content = "/trending"
		}
		return msg, "", true
	case "!price", "!p", "!jupprice":
		msg.Content = "/price " + strings.Join(args, " ")
		return msg, "", true
	case "!chart", "!history", "!ohlc", "!candles":
		msg.Content = "/chart " + strings.Join(args, " ")
		return msg, "", true
	case "!holders":
		msg.Content = "/holders " + strings.Join(args, " ")
		return msg, "", true
	case "!topholders":
		msg.Content = "/holders_top " + strings.Join(args, " ")
		return msg, "", true
	case "!supply", "!tokensupply":
		msg.Content = "/token_info " + strings.Join(args, " ")
		return msg, "", true
	case "!research", "!intel", "!jupintel", "!shield", "!rug", "!safety":
		msg.Content = "/research " + strings.Join(args, " ")
		return msg, "", true
	case "!web", "!websearch":
		if len(args) == 0 {
			msg.Content = "/web latest crypto market news"
		} else {
			msg.Content = "/web " + strings.Join(args, " ")
		}
		return msg, "", true
	case "!x", "!xsearch":
		msg.Content = "/xsearch " + strings.Join(args, " ")
		return msg, "", true
	case "!news", "!headlines":
		if len(args) == 0 {
			msg.Content = "/web top crypto headlines right now"
		} else {
			msg.Content = "/web latest news " + strings.Join(args, " ")
		}
		return msg, "", true
	case "!art", "!draw", "!imagine", "!grokart", "!generate":
		msg.Content = "/image " + strings.Join(args, " ")
		return msg, "", true
	case "!video", "!veo", "!refveo", "!falveo":
		msg.Content = "/video " + strings.Join(args, " ")
		return msg, "", true
	case "!skills":
		msg.Content = "/skills"
		return msg, "", true
	case "!skill":
		msg.Content = "/skill " + strings.Join(args, " ")
		return msg, "", true
	case "!claude":
		msg.Content = "/claude " + strings.Join(args, " ")
		return msg, "", true
	case "!perps", "!aster":
		msg.Content = "/perps " + strings.Join(args, " ")
		return msg, "", true
	case "!hl":
		msg.Content = "/hl"
		return msg, "", true
	case "!statusline":
		msg.Content = "/status"
		return msg, "", true
	case "!pet":
		msg.Content = "/pet"
		return msg, "", true
	case "!trades":
		msg.Content = "/trades"
		return msg, "", true
	case "!model":
		msg.Content = "/model " + strings.Join(args, " ")
		return msg, "", true
	case "!recall":
		msg.Content = "/memory_search " + strings.Join(args, " ")
		return msg, "", true
	case "!new", "!reset":
		msg.Content = "/new"
		return msg, "", true
	case "!buy", "!sell", "!launch", "!pump", "!balance":
		if !isXOwner(msg) {
			return msg, "Owner-only on X. Route that from the owner account or use Telegram operator control.", true
		}
		switch cmd {
		case "!buy":
			msg.Content = "/buy " + strings.Join(args, " ")
		case "!sell":
			msg.Content = "/sell " + strings.Join(args, " ")
		case "!launch", "!pump":
			msg.Content = "/launch " + strings.Join(args, " ")
		case "!balance":
			msg.Content = "/wallet"
		}
		return msg, "", true
	default:
		return msg, d.xUnsupportedCommandResponse(cmd), true
	}
}

func (d *Daemon) xHelpResponse() string {
	var b strings.Builder
	b.WriteString("🦞 X gateway live. Reply or mention with `!` commands.\n\n")
	b.WriteString("Live now:\n")
	b.WriteString("!status, !wallet [addr], !portfolio <wallet>, !token <mint|symbol>, !search <query>, !trending [1h|4h|24h], !price <mint|symbol>, !chart <mint> [days], !holders <mint>, !research <mint>\n")
	b.WriteString("!x <query>, !web <query>, !news [query], !art <prompt>, !video <prompt>\n")
	b.WriteString("!skills, !skill <name>, !claude <subcommand>, !perps, !hl, !model, !pet, !trades, !new\n\n")
	b.WriteString("Owner-only:\n")
	b.WriteString("!buy, !sell, !launch, !pump, !balance\n\n")
	b.WriteString("Aliases wired:\n")
	b.WriteString("!info/!analyze/!ca → !token · !find/!lookup → !search · !hot/!movers → !trending · !p → !price · !grokart/!draw → !art\n\n")
	b.WriteString("If a command family from the larger sheet isn’t wired yet, I’ll say so cleanly instead of faking it.")
	return b.String()
}

func (d *Daemon) xUnsupportedCommandResponse(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	if cmd == "" {
		cmd = "!help"
	}
	return fmt.Sprintf("%s isn’t wired on the X gateway yet. Use `!help` for the live command set, or send the request naturally and I’ll route it through SolanaOS.", cmd)
}

func trimLeadingMentions(content string) string {
	fields := strings.Fields(strings.TrimSpace(content))
	if len(fields) == 0 {
		return ""
	}

	cut := 0
	for cut < len(fields) {
		token := strings.TrimSpace(fields[cut])
		if !strings.HasPrefix(token, "@") {
			break
		}
		cut++
	}
	if cut == 0 {
		return strings.TrimSpace(content)
	}
	return strings.Join(fields[cut:], " ")
}

func isTrackerTimeframe(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "5m", "15m", "30m", "1h", "4h", "6h", "24h":
		return true
	default:
		return false
	}
}

func isXOwner(msg bus.InboundMessage) bool {
	owner := strings.TrimSpace(os.Getenv("BOT_OWNER_USERNAME"))
	if owner == "" {
		owner = strings.TrimSpace(os.Getenv("X_OWNER_USERNAME"))
	}
	if owner == "" {
		owner = "0rdlibrary"
	}
	owner = strings.TrimPrefix(strings.ToLower(owner), "@")

	candidates := []string{
		msg.Sender.Username,
		msg.Sender.DisplayName,
		msg.Sender.CanonicalID,
		msg.Sender.PlatformID,
		msg.SenderID,
		msg.Metadata["x_username"],
		msg.Metadata["twitter_username"],
	}
	for _, candidate := range candidates {
		candidate = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(candidate)), "@")
		if candidate != "" && candidate == owner {
			return true
		}
	}
	return false
}
