package x

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/autoreply"
	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/channels"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/routing"
)

const defaultAPIBase = "https://api.x.com/1.1"

type Channel struct {
	*channels.BaseChannel
	cfg               *config.Config
	client            *http.Client
	apiBase           string
	consumerKey       string
	consumerSecret    string
	accessToken       string
	accessTokenSecret string
	pollInterval      time.Duration
	statePath         string

	mu    sync.RWMutex
	state state

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

type state struct {
	Handle        string    `json:"handle"`
	SelfID        string    `json:"self_id"`
	LastMentionID string    `json:"last_mention_id"`
	LastPostID    string    `json:"last_post_id"`
	LastPollAt    time.Time `json:"last_poll_at"`
	LastError     string    `json:"last_error"`
}

type Snapshot struct {
	Running       bool      `json:"running"`
	Handle        string    `json:"handle"`
	SelfID        string    `json:"self_id"`
	LastMentionID string    `json:"last_mention_id"`
	LastPostID    string    `json:"last_post_id"`
	LastPollAt    time.Time `json:"last_poll_at"`
	LastError     string    `json:"last_error"`
	PollInterval  string    `json:"poll_interval"`
}

type verifyCredentialsResponse struct {
	IDStr      string `json:"id_str"`
	Name       string `json:"name"`
	ScreenName string `json:"screen_name"`
}

type mentionTweet struct {
	IDStr                string `json:"id_str"`
	FullText             string `json:"full_text"`
	Text                 string `json:"text"`
	InReplyToStatusIDStr string `json:"in_reply_to_status_id_str"`
	User                 struct {
		IDStr      string `json:"id_str"`
		Name       string `json:"name"`
		ScreenName string `json:"screen_name"`
	} `json:"user"`
}

type postStatusResponse struct {
	IDStr string `json:"id_str"`
}

func New(cfg *config.Config, msgBus *bus.MessageBus) (*Channel, error) {
	consumerKey := strings.TrimSpace(cfg.Channels.X.ConsumerKey)
	consumerSecret := strings.TrimSpace(cfg.Channels.X.ConsumerSecret)
	accessToken := strings.TrimSpace(cfg.Channels.X.AccessToken)
	accessTokenSecret := strings.TrimSpace(cfg.Channels.X.AccessTokenSecret)
	if consumerKey == "" || consumerSecret == "" || accessToken == "" || accessTokenSecret == "" {
		return nil, fmt.Errorf("x: credentials not configured")
	}

	apiBase := strings.TrimRight(strings.TrimSpace(cfg.Channels.X.APIBase), "/")
	if apiBase == "" {
		apiBase = defaultAPIBase
	}
	pollInterval := time.Duration(cfg.Channels.X.PollIntervalSec) * time.Second
	if pollInterval <= 0 {
		pollInterval = 45 * time.Second
	}

	ch := &Channel{
		BaseChannel:       channels.NewBaseChannel("x", msgBus, append([]string(nil), cfg.Channels.X.AllowFrom...)),
		cfg:               cfg,
		client:            &http.Client{Timeout: 30 * time.Second},
		apiBase:           apiBase,
		consumerKey:       consumerKey,
		consumerSecret:    consumerSecret,
		accessToken:       accessToken,
		accessTokenSecret: accessTokenSecret,
		pollInterval:      pollInterval,
		statePath:         filepath.Join(config.DefaultWorkspacePath(), "sessions", "x-channel.json"),
		state: state{
			Handle: strings.TrimPrefix(strings.TrimSpace(cfg.Channels.X.Handle), "@"),
		},
	}
	if err := ch.loadState(); err != nil {
		return nil, err
	}
	return ch, nil
}

func (c *Channel) Start(ctx context.Context) error {
	if c.IsRunning() {
		return nil
	}
	c.ctx, c.cancel = context.WithCancel(ctx)
	if err := c.verifyCredentials(c.ctx); err != nil {
		c.setError(err)
		c.cancel()
		return err
	}
	if err := c.bootstrapMentions(c.ctx); err != nil {
		log.Printf("[X] ⚠️ bootstrap mentions failed: %v", err)
	}
	c.SetRunning(true)
	c.wg.Add(1)
	go c.pollLoop()
	log.Printf("[X] 🐦 Connected: @%s", c.stateSnapshot().Handle)
	return nil
}

func (c *Channel) Stop(context.Context) error {
	if !c.IsRunning() {
		return nil
	}
	if c.cancel != nil {
		c.cancel()
	}
	c.wg.Wait()
	c.SetRunning(false)
	return nil
}

func (c *Channel) Send(ctx context.Context, msg bus.OutboundMessage) error {
	if !c.IsRunning() {
		return fmt.Errorf("x: not running")
	}
	if _, err := c.Post(ctx, msg.Content, strings.TrimSpace(msg.ChatID)); err != nil {
		return err
	}
	return nil
}

func (c *Channel) Post(ctx context.Context, content, replyToID string) (string, error) {
	parts := splitTweetThread(content, 280)
	if len(parts) == 0 {
		return "", nil
	}

	currentReplyTo := strings.TrimSpace(replyToID)
	lastID := ""
	for i, part := range parts {
		id, err := c.postStatus(ctx, part, currentReplyTo, i == 0 && currentReplyTo != "")
		if err != nil {
			c.setError(err)
			return lastID, err
		}
		lastID = id
		currentReplyTo = id
		c.updateState(func(s *state) {
			s.LastPostID = id
			s.LastError = ""
		})
	}
	return lastID, nil
}

func (c *Channel) Snapshot() Snapshot {
	s := c.stateSnapshot()
	return Snapshot{
		Running:       c.IsRunning(),
		Handle:        s.Handle,
		SelfID:        s.SelfID,
		LastMentionID: s.LastMentionID,
		LastPostID:    s.LastPostID,
		LastPollAt:    s.LastPollAt,
		LastError:     s.LastError,
		PollInterval:  c.pollInterval.String(),
	}
}

func (c *Channel) pollLoop() {
	defer c.wg.Done()
	ticker := time.NewTicker(c.pollInterval)
	defer ticker.Stop()

	for {
		if err := c.pollMentions(c.ctx); err != nil && c.ctx.Err() == nil {
			c.setError(err)
			log.Printf("[X] ⚠️ poll failed: %v", err)
		}
		select {
		case <-ticker.C:
		case <-c.ctx.Done():
			return
		}
	}
}

func (c *Channel) bootstrapMentions(ctx context.Context) error {
	s := c.stateSnapshot()
	if strings.TrimSpace(s.LastMentionID) != "" {
		return nil
	}
	mentions, err := c.fetchMentions(ctx, "", 1)
	if err != nil {
		return err
	}
	if len(mentions) == 0 {
		return nil
	}
	c.updateState(func(s *state) {
		s.LastMentionID = mentions[0].IDStr
		s.LastError = ""
	})
	return nil
}

func (c *Channel) pollMentions(ctx context.Context) error {
	s := c.stateSnapshot()
	mentions, err := c.fetchMentions(ctx, s.LastMentionID, 20)
	if err != nil {
		return err
	}
	if len(mentions) == 0 {
		c.updateState(func(s *state) {
			s.LastPollAt = time.Now().UTC()
			s.LastError = ""
		})
		return nil
	}

	sort.SliceStable(mentions, func(i, j int) bool {
		return parseSnowflake(mentions[i].IDStr) < parseSnowflake(mentions[j].IDStr)
	})

	maxID := s.LastMentionID
	for _, mention := range mentions {
		if parseSnowflake(mention.IDStr) > parseSnowflake(maxID) {
			maxID = mention.IDStr
		}
		if !c.isAllowedMention(mention) {
			continue
		}
		text := strings.TrimSpace(firstNonEmpty(mention.FullText, mention.Text))
		if text == "" {
			continue
		}
		c.PublishInbound(ctx, bus.InboundMessage{
			Channel:  c.Name(),
			SenderID: mention.User.IDStr,
			Sender: bus.SenderInfo{
				CanonicalID: mention.User.IDStr,
				PlatformID:  mention.User.IDStr,
				Username:    mention.User.ScreenName,
				DisplayName: mention.User.Name,
			},
			ChatID:     mention.IDStr,
			Content:    text,
			MessageID:  mention.IDStr,
			SessionKey: routing.BuildSessionKey("", c.Name(), mention.User.IDStr),
			Peer: bus.Peer{
				Kind: "user",
				ID:   mention.User.IDStr,
				Name: mention.User.ScreenName,
			},
			Metadata: map[string]string{
				"x_tweet_id":              mention.IDStr,
				"x_in_reply_to_status_id": mention.InReplyToStatusIDStr,
				"x_username":              mention.User.ScreenName,
				"x_handle":                c.stateSnapshot().Handle,
			},
		})
	}

	c.updateState(func(s *state) {
		s.LastMentionID = maxID
		s.LastPollAt = time.Now().UTC()
		s.LastError = ""
	})
	return nil
}

func (c *Channel) fetchMentions(ctx context.Context, sinceID string, count int) ([]mentionTweet, error) {
	query := url.Values{}
	query.Set("tweet_mode", "extended")
	if count > 0 {
		query.Set("count", strconv.Itoa(count))
	}
	if strings.TrimSpace(sinceID) != "" {
		query.Set("since_id", strings.TrimSpace(sinceID))
	}
	resp, err := c.doSigned(ctx, http.MethodGet, "/statuses/mentions_timeline.json", query, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("x mentions: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var payload []mentionTweet
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (c *Channel) verifyCredentials(ctx context.Context) error {
	query := url.Values{}
	query.Set("skip_status", "true")
	query.Set("include_entities", "false")
	resp, err := c.doSigned(ctx, http.MethodGet, "/account/verify_credentials.json", query, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("x verify_credentials: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var payload verifyCredentialsResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return err
	}
	c.updateState(func(s *state) {
		if strings.TrimSpace(payload.ScreenName) != "" {
			s.Handle = strings.TrimPrefix(payload.ScreenName, "@")
		}
		s.SelfID = payload.IDStr
		s.LastError = ""
	})
	return nil
}

func (c *Channel) postStatus(ctx context.Context, text, replyToID string, autoReplyMetadata bool) (string, error) {
	form := url.Values{}
	form.Set("status", text)
	if strings.TrimSpace(replyToID) != "" {
		form.Set("in_reply_to_status_id", strings.TrimSpace(replyToID))
		if autoReplyMetadata {
			form.Set("auto_populate_reply_metadata", "true")
		}
	}
	resp, err := c.doSigned(ctx, http.MethodPost, "/statuses/update.json", nil, form)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("x post: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var payload postStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	return strings.TrimSpace(payload.IDStr), nil
}

func (c *Channel) doSigned(ctx context.Context, method, endpoint string, query, form url.Values) (*http.Response, error) {
	baseURL := strings.TrimRight(c.apiBase, "/") + "/" + strings.TrimPrefix(endpoint, "/")
	oauthParams := map[string]string{
		"oauth_consumer_key":     c.consumerKey,
		"oauth_nonce":            randomNonce(),
		"oauth_signature_method": "HMAC-SHA1",
		"oauth_timestamp":        strconv.FormatInt(time.Now().Unix(), 10),
		"oauth_token":            c.accessToken,
		"oauth_version":          "1.0",
	}

	allParams := url.Values{}
	for key, values := range query {
		for _, value := range values {
			allParams.Add(key, value)
		}
	}
	for key, values := range form {
		for _, value := range values {
			allParams.Add(key, value)
		}
	}
	for key, value := range oauthParams {
		allParams.Add(key, value)
	}
	oauthParams["oauth_signature"] = c.oauthSignature(method, baseURL, allParams)

	reqURL := baseURL
	if len(query) > 0 {
		reqURL += "?" + query.Encode()
	}
	var body io.Reader
	if len(form) > 0 {
		body = strings.NewReader(form.Encode())
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, body)
	if err != nil {
		return nil, err
	}
	if len(form) > 0 {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	req.Header.Set("Authorization", buildOAuthHeader(oauthParams))
	req.Header.Set("Accept", "application/json")
	return c.client.Do(req)
}

func (c *Channel) oauthSignature(method, baseURL string, params url.Values) string {
	baseString := strings.ToUpper(method) + "&" + oauthEscape(baseURL) + "&" + oauthEscape(normalizeOAuthParams(params))
	key := oauthEscape(c.consumerSecret) + "&" + oauthEscape(c.accessTokenSecret)
	mac := hmac.New(sha1.New, []byte(key))
	_, _ = mac.Write([]byte(baseString))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func (c *Channel) isAllowedMention(mention mentionTweet) bool {
	if len(c.Snapshot().Handle) > 0 && strings.EqualFold(mention.User.ScreenName, c.Snapshot().Handle) {
		return false
	}
	return c.IsAllowed(mention.User.IDStr) || c.IsAllowed(mention.User.ScreenName)
}

func (c *Channel) stateSnapshot() state {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state
}

func (c *Channel) updateState(update func(*state)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	update(&c.state)
	_ = c.persistLocked()
}

func (c *Channel) setError(err error) {
	if err == nil {
		return
	}
	c.updateState(func(s *state) {
		s.LastError = err.Error()
		s.LastPollAt = time.Now().UTC()
	})
}

func (c *Channel) loadState() error {
	if err := os.MkdirAll(filepath.Dir(c.statePath), 0o755); err != nil {
		return err
	}
	data, err := os.ReadFile(c.statePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return json.Unmarshal(data, &c.state)
}

func (c *Channel) persistLocked() error {
	data, err := json.MarshalIndent(c.state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.statePath, data, 0o644)
}

func buildOAuthHeader(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=\"%s\"", oauthEscape(key), oauthEscape(params[key])))
	}
	return "OAuth " + strings.Join(parts, ", ")
}

func normalizeOAuthParams(values url.Values) string {
	type pair struct {
		key   string
		value string
	}
	pairs := make([]pair, 0)
	for key, vals := range values {
		escapedKey := oauthEscape(key)
		escapedVals := append([]string(nil), vals...)
		sort.Strings(escapedVals)
		for _, value := range escapedVals {
			pairs = append(pairs, pair{key: escapedKey, value: oauthEscape(value)})
		}
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].key == pairs[j].key {
			return pairs[i].value < pairs[j].value
		}
		return pairs[i].key < pairs[j].key
	})
	parts := make([]string, 0, len(pairs))
	for _, item := range pairs {
		parts = append(parts, item.key+"="+item.value)
	}
	return strings.Join(parts, "&")
}

func oauthEscape(raw string) string {
	escaped := url.QueryEscape(raw)
	escaped = strings.ReplaceAll(escaped, "+", "%20")
	escaped = strings.ReplaceAll(escaped, "*", "%2A")
	escaped = strings.ReplaceAll(escaped, "%7E", "~")
	return escaped
}

func randomNonce() string {
	var buf [12]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return hex.EncodeToString(buf[:])
}

func splitTweetThread(content string, maxRunes int) []string {
	text := sanitizeTweetText(content)
	if text == "" {
		return nil
	}
	if runeLen(text) <= maxRunes {
		return []string{text}
	}

	words := strings.Fields(text)
	parts := make([]string, 0, 4)
	var current strings.Builder
	for _, word := range words {
		word = strings.TrimSpace(word)
		if word == "" {
			continue
		}
		if current.Len() == 0 {
			current.WriteString(word)
			continue
		}
		candidate := current.String() + " " + word
		if runeLen(candidate) > maxRunes {
			parts = append(parts, current.String())
			current.Reset()
			if runeLen(word) > maxRunes {
				parts = append(parts, truncateRunes(word, maxRunes))
				continue
			}
			current.WriteString(word)
			continue
		}
		current.WriteByte(' ')
		current.WriteString(word)
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}

func sanitizeTweetText(content string) string {
	content = autoreply.VisibleAssistantText(content)
	replacer := strings.NewReplacer(
		"**", "",
		"__", "",
		"`", "",
		"\r", "\n",
		"\t", " ",
	)
	content = replacer.Replace(content)
	lines := strings.Split(content, "\n")
	trimmed := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			trimmed = append(trimmed, line)
		}
	}
	return strings.TrimSpace(strings.Join(trimmed, "\n"))
}

func truncateRunes(value string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	if maxRunes <= 1 {
		return string(runes[:maxRunes])
	}
	return string(runes[:maxRunes-1]) + "…"
}

func runeLen(value string) int {
	return len([]rune(value))
}

func parseSnowflake(raw string) int64 {
	n, _ := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	return n
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
