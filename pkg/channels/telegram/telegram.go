// Package telegram provides the Telegram channel for SolanaOS.
// Uses github.com/mymmrac/telego for the bot API client.
// Features: long polling, typing indicators, placeholder edit, forum threads,
// markdown→HTML, allowlist, jitter retry for command registration.
package telegram

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mymmrac/telego"
	th "github.com/mymmrac/telego/telegohandler"
	tu "github.com/mymmrac/telego/telegoutil"
	"github.com/x402agent/Solana-Os-Go/pkg/autoreply"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/channels"
	"github.com/x402agent/Solana-Os-Go/pkg/commands"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

// ── Regex for markdown→HTML conversion ──────────────────────────────

var (
	reHeading    = regexp.MustCompile(`^#{1,6}\s+(.+)$`)
	reBlockquote = regexp.MustCompile(`^>\s*(.*)$`)
	reLink       = regexp.MustCompile(`\[([^\]]+)\]\(([^)]+)\)`)
	reBoldStar   = regexp.MustCompile(`\*\*(.+?)\*\*`)
	reBoldUnder  = regexp.MustCompile(`__(.+?)__`)
	reItalic     = regexp.MustCompile(`_([^_]+)_`)
	reStrike     = regexp.MustCompile(`~~(.+?)~~`)
	reListItem   = regexp.MustCompile(`^[-*]\s+`)
	reCodeBlock  = regexp.MustCompile("```[\\w]*\\n?([\\s\\S]*?)```")
	reInlineCode = regexp.MustCompile("`([^`]+)`")
)

const telegramMaxRegisteredCommands = 100

type quickAction struct {
	Label   string
	Command string
}

var telegramQuickActions = []quickAction{
	{Label: "Status", Command: "/status"},
	{Label: "Memory", Command: "/memory"},
	{Label: "Wallet", Command: "/wallet"},
	{Label: "Launch", Command: "/launch"},
	{Label: "Trending", Command: "/trending"},
	{Label: "Scanner", Command: "/scanner"},
	{Label: "Perps", Command: "/perps"},
	{Label: "Model", Command: "/model"},
	{Label: "Miner", Command: "/miner"},
	{Label: "Pet", Command: "/pet"},
	{Label: "Trades", Command: "/trades"},
	{Label: "Remote", Command: "/remote"},
	{Label: "Menu", Command: "/menu"},
	{Label: "Help", Command: "/help"},
	{Label: "Reset", Command: "/new"},
}

// ── TelegramChannel ──────────────────────────────────────────────────

type TelegramChannel struct {
	*channels.BaseChannel
	bot              *telego.Bot
	bh               *th.BotHandler
	cfg              *config.Config
	ctx              context.Context
	cancel           context.CancelFunc
	commandRegCancel context.CancelFunc
	mu               sync.RWMutex
}

// BotCommand mirrors the type used in bot command registration.
type BotCommand = telego.BotCommand

// NewTelegramChannel creates a Telegram channel from config.
func NewTelegramChannel(cfg *config.Config, msgBus *bus.MessageBus) (*TelegramChannel, error) {
	token := cfg.Channels.Telegram.Token
	if token == "" {
		token = os.Getenv("TELEGRAM_BOT_TOKEN")
	}
	if token == "" {
		return nil, fmt.Errorf("telegram: token not configured (set TELEGRAM_BOT_TOKEN)")
	}

	allowFrom := append([]string(nil), cfg.Channels.Telegram.AllowFrom...)
	if lockedID := strings.TrimSpace(firstNonEmpty("TELEGRAM_ID", "TELEGRAM_USER_ID")); lockedID != "" {
		allowFrom = []string{lockedID}
	} else if envAllow := os.Getenv("TELEGRAM_ALLOW_FROM"); envAllow != "" {
		for _, v := range strings.Split(envAllow, ",") {
			if v = strings.TrimSpace(v); v != "" {
				allowFrom = append(allowFrom, v)
			}
		}
	}

	var opts []telego.BotOption

	proxyAddr := strings.TrimSpace(cfg.Channels.Telegram.Proxy)
	if proxyAddr == "" {
		proxyAddr = strings.TrimSpace(os.Getenv("TELEGRAM_PROXY"))
	}
	if proxyAddr != "" {
		proxyURL, err := url.Parse(proxyAddr)
		if err != nil {
			return nil, fmt.Errorf("telegram: invalid proxy URL %q: %w", proxyAddr, err)
		}
		opts = append(opts, telego.WithHTTPClient(&http.Client{
			Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)},
		}))
	} else if os.Getenv("HTTP_PROXY") != "" || os.Getenv("HTTPS_PROXY") != "" {
		opts = append(opts, telego.WithHTTPClient(&http.Client{
			Transport: &http.Transport{Proxy: http.ProxyFromEnvironment},
		}))
	}

	if baseURL := strings.TrimRight(strings.TrimSpace(cfg.Channels.Telegram.BaseURL), "/"); baseURL != "" {
		opts = append(opts, telego.WithAPIServer(baseURL))
	}

	bot, err := telego.NewBot(token, opts...)
	if err != nil {
		return nil, fmt.Errorf("telegram: failed to create bot: %w", err)
	}

	base := channels.NewBaseChannel("telegram", msgBus, allowFrom)
	return &TelegramChannel{
		BaseChannel: base,
		bot:         bot,
		cfg:         cfg,
	}, nil
}

func firstNonEmpty(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

// ── Lifecycle ────────────────────────────────────────────────────────

func (c *TelegramChannel) Start(ctx context.Context) error {
	c.ctx, c.cancel = context.WithCancel(ctx)

	updates, err := c.bot.UpdatesViaLongPolling(c.ctx, &telego.GetUpdatesParams{Timeout: 30})
	if err != nil {
		c.cancel()
		return fmt.Errorf("telegram: start polling: %w", err)
	}

	bh, err := th.NewBotHandler(c.bot, updates)
	if err != nil {
		c.cancel()
		return fmt.Errorf("telegram: bot handler: %w", err)
	}
	c.bh = bh

	bh.HandleMessage(func(ctx *th.Context, msg telego.Message) error {
		return c.handleMessage(ctx, &msg)
	}, th.AnyMessage())
	bh.HandleCallbackQuery(func(ctx *th.Context, query telego.CallbackQuery) error {
		return c.handleCallbackQuery(ctx, &query)
	}, th.AnyCallbackQueryWithMessage())

	c.SetRunning(true)
	log.Printf("[TELEGRAM] 🤖 Bot connected: @%s", c.bot.Username())

	c.startCommandRegistration(c.ctx)

	go func() {
		if err := bh.Start(); err != nil {
			log.Printf("[TELEGRAM] ⚠️ Bot handler stopped: %v", err)
		}
	}()

	return nil
}

func (c *TelegramChannel) Stop(ctx context.Context) error {
	log.Printf("[TELEGRAM] Stopping @%s...", c.bot.Username())
	c.SetRunning(false)
	if c.bh != nil {
		_ = c.bh.StopWithContext(ctx)
	}
	if c.cancel != nil {
		c.cancel()
	}
	if c.commandRegCancel != nil {
		c.commandRegCancel()
	}
	return nil
}

// ── Message handling ─────────────────────────────────────────────────

func (c *TelegramChannel) handleMessage(ctx context.Context, msg *telego.Message) error {
	if msg == nil || msg.From == nil {
		return nil
	}

	senderID := fmt.Sprintf("%d", msg.From.ID)
	if !c.IsAllowed(senderID) && !c.IsAllowed(msg.From.Username) {
		return nil
	}

	// Extract photo URLs if present
	var mediaURLs []string
	if len(msg.Photo) > 0 {
		// Telegram sends multiple sizes; pick the largest (last in the slice)
		bestPhoto := msg.Photo[len(msg.Photo)-1]
		if photoURL := c.resolveFileURL(ctx, bestPhoto.FileID); photoURL != "" {
			mediaURLs = append(mediaURLs, photoURL)
		}
	}
	if msg.Document != nil && isImageMIME(msg.Document.MimeType) {
		if docURL := c.resolveFileURL(ctx, msg.Document.FileID); docURL != "" {
			mediaURLs = append(mediaURLs, docURL)
		}
	}

	content := msg.Text
	if content == "" {
		content = msg.Caption
	}
	// For photo messages with no text/caption, set a default prompt
	if content == "" && len(mediaURLs) > 0 {
		content = "/vision"
	}
	if content == "" {
		return nil
	}
	if msg.Chat.Type == telego.ChatTypePrivate {
		if normalized, ok := normalizeQuickAction(content); ok {
			content = normalized
		}
	}

	// In groups: only respond when mentioned
	if msg.Chat.Type != "private" {
		mention := "@" + c.bot.Username()
		if !strings.Contains(content, mention) {
			return nil
		}
		content = strings.TrimSpace(strings.ReplaceAll(content, mention, ""))
	}
	content = autoreply.SanitizeInboundUserText(content)
	if content == "" && len(mediaURLs) == 0 {
		return nil
	}
	if content == "" && len(mediaURLs) > 0 {
		content = "/vision"
	}
	if msg.Chat.Type == telego.ChatTypePrivate && shouldShowQuickActionMenu(content) {
		if err := c.sendQuickActionMenu(ctx, msg.Chat.ID, msg.MessageThreadID); err != nil {
			log.Printf("[TELEGRAM] ⚠️ Failed to send quick action menu: %v", err)
		}
	}

	log.Printf("[TELEGRAM] 📩 @%s: %s (media: %d)", msg.From.Username, truncate(content, 60), len(mediaURLs))
	c.publishInboundWithMedia(ctx, msg.From, msg.Chat, msg.MessageThreadID, msg.MessageID, content, mediaURLs, map[string]string{
		"telegram_entrypoint": "message",
	})
	return nil
}

// resolveFileURL calls Telegram's getFile and returns the full download URL.
func (c *TelegramChannel) resolveFileURL(ctx context.Context, fileID string) string {
	file, err := c.bot.GetFile(ctx, &telego.GetFileParams{FileID: fileID})
	if err != nil {
		log.Printf("[TELEGRAM] ⚠️ getFile failed for %s: %v", fileID, err)
		return ""
	}
	if file.FilePath == "" {
		return ""
	}
	return fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", c.bot.Token(), file.FilePath)
}

// isImageMIME returns true for JPEG and PNG MIME types.
func isImageMIME(mime string) bool {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "image/jpeg", "image/jpg", "image/png":
		return true
	default:
		return false
	}
}

func (c *TelegramChannel) handleCallbackQuery(ctx context.Context, query *telego.CallbackQuery) error {
	if query == nil {
		return nil
	}
	senderID := fmt.Sprintf("%d", query.From.ID)
	if !c.IsAllowed(senderID) && !c.IsAllowed(query.From.Username) {
		return nil
	}

	action, value, ok := parseTelegramCallbackData(query.Data)
	if !ok {
		_ = c.answerCallback(ctx, query.ID, "Unknown action", false)
		return nil
	}

	switch action {
	case telegramCallbackMenu:
		chat := query.Message.GetChat()
		if err := c.editInlineDashboard(ctx, chat.ID, query.Message.GetMessageID(), value); err != nil {
			if sendErr := c.sendInlineDashboard(ctx, chat.ID, 0, value); sendErr != nil {
				log.Printf("[TELEGRAM] ⚠️ Failed to render inline menu %q: %v", value, err)
				_ = c.answerCallback(ctx, query.ID, "Menu unavailable", false)
				return nil
			}
		}
		return c.answerCallback(ctx, query.ID, telegramCallbackAck(action, value), false)
	case telegramCallbackCmd:
		threadID := 0
		if msg := query.Message.Message(); msg != nil {
			threadID = msg.MessageThreadID
		}
		content := strings.TrimSpace(value)
		if !strings.HasPrefix(content, "/") {
			content = "/" + content
		}
		log.Printf("[TELEGRAM] 🔘 @%s tapped %s", query.From.Username, content)
		c.publishInboundText(ctx, &query.From, query.Message.GetChat(), threadID, query.Message.GetMessageID(), content, map[string]string{
			"telegram_entrypoint": "callback",
			"telegram_callback":   query.Data,
		})
		return c.answerCallback(ctx, query.ID, telegramCallbackAck(action, value), false)
	case telegramCallbackHint:
		return c.answerCallback(ctx, query.ID, value, true)
	default:
		return c.answerCallback(ctx, query.ID, "Unsupported action", false)
	}
}

func (c *TelegramChannel) publishInboundWithMedia(ctx context.Context, sender *telego.User, chat telego.Chat, threadID, messageID int, content string, media []string, metadata map[string]string) {
	if sender == nil {
		return
	}
	senderID := fmt.Sprintf("%d", sender.ID)
	chatIDStr := fmt.Sprintf("%d", chat.ID)
	if chat.IsForum && threadID != 0 {
		chatIDStr = fmt.Sprintf("%d/%d", chat.ID, threadID)
	}
	md := map[string]string{
		"telegram_chat_type": string(chat.Type),
		"telegram_username":  sender.Username,
	}
	for key, value := range metadata {
		if strings.TrimSpace(key) != "" && strings.TrimSpace(value) != "" {
			md[key] = value
		}
	}
	c.PublishInbound(ctx, bus.InboundMessage{
		Channel:  c.Name(),
		SenderID: senderID,
		Sender: bus.SenderInfo{
			CanonicalID: senderID,
			PlatformID:  senderID,
			Username:    sender.Username,
			DisplayName: telegramDisplayName(sender),
		},
		ChatID:    chatIDStr,
		Content:   content,
		Media:     media,
		MessageID: fmt.Sprintf("%d", messageID),
		Peer: bus.Peer{
			Kind: peerKindFromChatType(chat.Type),
			ID:   fmt.Sprintf("%d", chat.ID),
			Name: chat.Title,
		},
		Metadata: md,
	})
}

func (c *TelegramChannel) publishInboundText(ctx context.Context, sender *telego.User, chat telego.Chat, threadID, messageID int, content string, metadata map[string]string) {
	if sender == nil {
		return
	}
	senderID := fmt.Sprintf("%d", sender.ID)
	chatIDStr := fmt.Sprintf("%d", chat.ID)
	if chat.IsForum && threadID != 0 {
		chatIDStr = fmt.Sprintf("%d/%d", chat.ID, threadID)
	}
	md := map[string]string{
		"telegram_chat_type": string(chat.Type),
		"telegram_username":  sender.Username,
	}
	for key, value := range metadata {
		if strings.TrimSpace(key) != "" && strings.TrimSpace(value) != "" {
			md[key] = value
		}
	}
	c.PublishInbound(ctx, bus.InboundMessage{
		Channel:  c.Name(),
		SenderID: senderID,
		Sender: bus.SenderInfo{
			CanonicalID: senderID,
			PlatformID:  senderID,
			Username:    sender.Username,
			DisplayName: telegramDisplayName(sender),
		},
		ChatID:    chatIDStr,
		Content:   content,
		MessageID: fmt.Sprintf("%d", messageID),
		Peer: bus.Peer{
			Kind: peerKindFromChatType(chat.Type),
			ID:   fmt.Sprintf("%d", chat.ID),
			Name: chat.Title,
		},
		Metadata: md,
	})
}

func normalizeQuickAction(content string) (string, bool) {
	trimmed := strings.TrimSpace(content)
	for _, action := range telegramQuickActions {
		if trimmed == action.Label {
			return action.Command, true
		}
	}
	return content, false
}

func shouldShowQuickActionMenu(content string) bool {
	switch strings.ToLower(strings.TrimSpace(content)) {
	case "/start", "/help", "/menu":
		return true
	default:
		return false
	}
}

func quickActionReplyMarkup() *telego.ReplyKeyboardMarkup {
	return tu.Keyboard(
		tu.KeyboardRow(
			tu.KeyboardButton("Status"),
			tu.KeyboardButton("Memory"),
			tu.KeyboardButton("Wallet"),
		),
		tu.KeyboardRow(
			tu.KeyboardButton("Launch"),
			tu.KeyboardButton("Trending"),
			tu.KeyboardButton("Scanner"),
		),
		tu.KeyboardRow(
			tu.KeyboardButton("Perps"),
			tu.KeyboardButton("Miner"),
			tu.KeyboardButton("Pet"),
		),
		tu.KeyboardRow(
			tu.KeyboardButton("Model"),
			tu.KeyboardButton("Remote"),
			tu.KeyboardButton("Trades"),
		),
		tu.KeyboardRow(
			tu.KeyboardButton("Menu"),
			tu.KeyboardButton("Help"),
			tu.KeyboardButton("Reset"),
		),
	).WithResizeKeyboard().WithIsPersistent().WithInputFieldPlaceholder("Type a command or ask naturally")
}

func (c *TelegramChannel) sendQuickActionMenu(ctx context.Context, chatID int64, threadID int) error {
	msg := tu.Message(
		tu.ID(chatID),
		telegramDashboardIntro(),
	).WithReplyMarkup(quickActionReplyMarkup())
	msg.MessageThreadID = threadID
	if _, err := c.bot.SendMessage(ctx, msg); err != nil {
		return err
	}
	return c.sendInlineDashboard(ctx, chatID, threadID, "main")
}

// ── Send ─────────────────────────────────────────────────────────────

func (c *TelegramChannel) Send(ctx context.Context, msg bus.OutboundMessage) error {
	if !c.IsRunning() {
		return fmt.Errorf("telegram: not running")
	}
	if msg.Content == "" {
		return nil
	}
	msg.Content = autoreply.VisibleAssistantText(msg.Content)
	if msg.Content == "" {
		return nil
	}

	chatID, threadID, err := parseChatID(msg.ChatID)
	if err != nil {
		return fmt.Errorf("telegram: invalid chatID %s: %w", msg.ChatID, err)
	}

	for _, chunk := range splitMessage(msg.Content, 4000) {
		html := markdownToTelegramHTML(chunk)
		tgMsg := tu.Message(tu.ID(chatID), html)
		tgMsg.ParseMode = telego.ModeHTML
		tgMsg.MessageThreadID = threadID

		if _, err := c.bot.SendMessage(ctx, tgMsg); err != nil {
			// Fallback to plain text
			tgMsg.Text = chunk
			tgMsg.ParseMode = ""
			if _, err2 := c.bot.SendMessage(ctx, tgMsg); err2 != nil {
				return fmt.Errorf("telegram send: %w", err2)
			}
		}
	}
	return nil
}

// SendTyping sends a typing action and repeats every 3s until stopped.
// Faster interval ensures the indicator stays visible during longer LLM calls.
func (c *TelegramChannel) SendTyping(ctx context.Context, chatID string) (stop func(), err error) {
	cid, threadID, err := parseChatID(chatID)
	if err != nil {
		return func() {}, err
	}

	action := tu.ChatAction(tu.ID(cid), telego.ChatActionTyping)
	action.MessageThreadID = threadID
	_ = c.bot.SendChatAction(ctx, action)

	typingCtx, cancel := context.WithCancel(ctx)
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-typingCtx.Done():
				return
			case <-ticker.C:
				a := tu.ChatAction(tu.ID(cid), telego.ChatActionTyping)
				a.MessageThreadID = threadID
				_ = c.bot.SendChatAction(typingCtx, a)
			}
		}
	}()
	return cancel, nil
}

// placeholderPhrases are casual "thinking" messages shown while the LLM generates.
var placeholderPhrases = []string{
	"On it. Give me a second.",
	"Checking that now.",
	"Working through it.",
	"Pulling the live data.",
	"Looking into it now.",
	"Give me a moment.",
	"Putting that together.",
	"Running that down.",
}

func randomPlaceholder() string {
	return placeholderPhrases[time.Now().UnixNano()%int64(len(placeholderPhrases))]
}

// SendPlaceholder sends a casual thinking message, returns the message ID
// so callers can edit it with the actual response via EditMessage.
func (c *TelegramChannel) SendPlaceholder(ctx context.Context, chatID string) (string, error) {
	return c.SendPlaceholderText(ctx, chatID, randomPlaceholder())
}

// SendPlaceholderText sends a specific in-progress message, returns the message ID
// so callers can edit it with the actual response via EditMessage.
func (c *TelegramChannel) SendPlaceholderText(ctx context.Context, chatID, text string) (string, error) {
	cid, threadID, err := parseChatID(chatID)
	if err != nil {
		return "", err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		text = randomPlaceholder()
	}
	phMsg := tu.Message(tu.ID(cid), text)
	phMsg.MessageThreadID = threadID
	sent, err := c.bot.SendMessage(ctx, phMsg)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%d", sent.MessageID), nil
}

// EditMessage edits a previously sent message.
func (c *TelegramChannel) EditMessage(ctx context.Context, chatID, messageID, content string) error {
	content = autoreply.VisibleAssistantText(content)
	cid, _, err := parseChatID(chatID)
	if err != nil {
		return err
	}
	mid, err := strconv.Atoi(messageID)
	if err != nil {
		return err
	}
	html := markdownToTelegramHTML(content)
	edit := tu.EditMessageText(tu.ID(cid), mid, html)
	edit.ParseMode = telego.ModeHTML
	_, err = c.bot.EditMessageText(ctx, edit)
	return err
}

func (c *TelegramChannel) sendInlineDashboard(ctx context.Context, chatID int64, threadID int, page string) error {
	body, markup, ok := telegramDashboardPage(page)
	if !ok {
		return fmt.Errorf("telegram: unknown dashboard page %q", page)
	}
	msg := tu.Message(tu.ID(chatID), markdownToTelegramHTML(body)).WithReplyMarkup(markup)
	msg.ParseMode = telego.ModeHTML
	msg.MessageThreadID = threadID
	_, err := c.bot.SendMessage(ctx, msg)
	return err
}

func (c *TelegramChannel) editInlineDashboard(ctx context.Context, chatID int64, messageID int, page string) error {
	body, markup, ok := telegramDashboardPage(page)
	if !ok {
		return fmt.Errorf("telegram: unknown dashboard page %q", page)
	}
	edit := tu.EditMessageText(tu.ID(chatID), messageID, markdownToTelegramHTML(body))
	edit.ParseMode = telego.ModeHTML
	edit.ReplyMarkup = markup
	_, err := c.bot.EditMessageText(ctx, edit)
	return err
}

func (c *TelegramChannel) answerCallback(ctx context.Context, queryID, text string, alert bool) error {
	params := tu.CallbackQuery(queryID)
	if strings.TrimSpace(text) != "" {
		params.WithText(text)
	}
	if alert {
		params.WithShowAlert()
	}
	return c.bot.AnswerCallbackQuery(ctx, params)
}

func telegramDisplayName(user *telego.User) string {
	if user == nil {
		return ""
	}
	return strings.TrimSpace(strings.TrimSpace(user.FirstName + " " + user.LastName))
}

func peerKindFromChatType(chatType string) string {
	switch chatType {
	case telego.ChatTypePrivate:
		return "user"
	case telego.ChatTypeChannel:
		return "channel"
	default:
		return "group"
	}
}

// ── Command registration ─────────────────────────────────────────────

var commandRegistrationBackoff = []time.Duration{
	5 * time.Second,
	15 * time.Second,
	60 * time.Second,
	5 * time.Minute,
	10 * time.Minute,
}

func commandRegistrationDelay(attempt int) time.Duration {
	if len(commandRegistrationBackoff) == 0 {
		return 0
	}
	idx := attempt
	if idx >= len(commandRegistrationBackoff) {
		idx = len(commandRegistrationBackoff) - 1
	}
	base := commandRegistrationBackoff[idx]
	return time.Duration(float64(base) * (0.5 + rand.Float64()*0.5))
}

func (c *TelegramChannel) startCommandRegistration(ctx context.Context) {
	defs := commands.BuiltinDefinitions()
	if len(defs) == 0 {
		return
	}

	cmds := make([]telego.BotCommand, 0, len(defs))
	for _, d := range defs {
		if d.Name != "" && d.Description != "" {
			cmds = append(cmds, telego.BotCommand{Command: d.Name, Description: d.Description})
		}
	}
	if len(cmds) == 0 {
		return
	}
	if len(cmds) > telegramMaxRegisteredCommands {
		skipped := len(cmds) - telegramMaxRegisteredCommands
		log.Printf("[TELEGRAM] ℹ️ Trimming command registration from %d to %d to satisfy Bot API limits (%d skipped; commands still work if typed manually)", len(cmds), telegramMaxRegisteredCommands, skipped)
		cmds = cmds[:telegramMaxRegisteredCommands]
	}

	regCtx, cancel := context.WithCancel(ctx)
	c.commandRegCancel = cancel

	go func() {
		for attempt := 0; ; attempt++ {
			select {
			case <-regCtx.Done():
				return
			default:
			}

			err := c.bot.SetMyCommands(regCtx, &telego.SetMyCommandsParams{Commands: cmds})
			if err == nil {
				log.Printf("[TELEGRAM] ✅ %d commands registered", len(cmds))
				return
			}

			delay := commandRegistrationDelay(attempt)
			log.Printf("[TELEGRAM] ⚠️ Command registration failed (attempt %d): %v (retry in %s)", attempt+1, err, delay)

			select {
			case <-regCtx.Done():
				return
			case <-time.After(delay):
			}
		}
	}()
}

// ── Markdown → Telegram HTML ─────────────────────────────────────────

func markdownToTelegramHTML(text string) string {
	if text == "" {
		return ""
	}

	cb := extractCodeBlocks(text)
	text = cb.text
	ic := extractInlineCodes(text)
	text = ic.text

	// Headings → strip to plain bold
	text = reHeading.ReplaceAllString(text, "$1")
	// Blockquote → strip marker
	text = reBlockquote.ReplaceAllString(text, "$1")

	text = escapeHTML(text)

	text = reLink.ReplaceAllString(text, `<a href="$2">$1</a>`)
	text = reBoldStar.ReplaceAllString(text, "<b>$1</b>")
	text = reBoldUnder.ReplaceAllString(text, "<b>$1</b>")
	text = reItalic.ReplaceAllString(text, "<i>$1</i>")
	text = reStrike.ReplaceAllString(text, "<s>$1</s>")
	text = reListItem.ReplaceAllString(text, "• ")

	for i, code := range ic.codes {
		text = strings.ReplaceAll(text,
			fmt.Sprintf("\x00IC%d\x00", i),
			fmt.Sprintf("<code>%s</code>", escapeHTML(code)))
	}
	for i, code := range cb.codes {
		text = strings.ReplaceAll(text,
			fmt.Sprintf("\x00CB%d\x00", i),
			fmt.Sprintf("<pre><code>%s</code></pre>", escapeHTML(code)))
	}

	return text
}

type codeMatch struct {
	text  string
	codes []string
}

func extractCodeBlocks(text string) codeMatch {
	var codes []string
	for _, m := range reCodeBlock.FindAllStringSubmatch(text, -1) {
		codes = append(codes, m[1])
	}
	i := 0
	text = reCodeBlock.ReplaceAllStringFunc(text, func(string) string {
		p := fmt.Sprintf("\x00CB%d\x00", i)
		i++
		return p
	})
	return codeMatch{text, codes}
}

func extractInlineCodes(text string) codeMatch {
	var codes []string
	for _, m := range reInlineCode.FindAllStringSubmatch(text, -1) {
		codes = append(codes, m[1])
	}
	i := 0
	text = reInlineCode.ReplaceAllStringFunc(text, func(string) string {
		p := fmt.Sprintf("\x00IC%d\x00", i)
		i++
		return p
	})
	return codeMatch{text, codes}
}

func escapeHTML(text string) string {
	text = strings.ReplaceAll(text, "&", "&amp;")
	text = strings.ReplaceAll(text, "<", "&lt;")
	text = strings.ReplaceAll(text, ">", "&gt;")
	return text
}

// ── Helpers ──────────────────────────────────────────────────────────

// parseChatID splits "chatID/threadID" format used for forum topics.
func parseChatID(s string) (int64, int, error) {
	if idx := strings.Index(s, "/"); idx != -1 {
		cid, err := strconv.ParseInt(s[:idx], 10, 64)
		if err != nil {
			return 0, 0, err
		}
		tid, err := strconv.Atoi(s[idx+1:])
		if err != nil {
			return 0, 0, fmt.Errorf("invalid thread ID in %q: %w", s, err)
		}
		return cid, tid, nil
	}
	cid, err := strconv.ParseInt(s, 10, 64)
	return cid, 0, err
}

func splitMessage(text string, maxLen int) []string {
	if len(text) <= maxLen {
		return []string{text}
	}
	var chunks []string
	for len(text) > maxLen {
		splitAt := maxLen
		if idx := strings.LastIndex(text[:maxLen], "\n"); idx > maxLen/2 {
			splitAt = idx
		} else if idx := strings.LastIndex(text[:maxLen], ". "); idx > maxLen/2 {
			splitAt = idx + 1
		}
		chunks = append(chunks, text[:splitAt])
		text = text[splitAt:]
	}
	if text != "" {
		chunks = append(chunks, text)
	}
	return chunks
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-3] + "..."
}
