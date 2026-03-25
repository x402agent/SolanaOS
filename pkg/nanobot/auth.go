// Package nanobot :: auth.go
// Telegram Login Widget verification + session management for the web dashboard.
//
// Flow:
//   GET  /login              → serve login page with Telegram widget
//   GET  /auth/telegram      → widget callback (query params)
//   POST /auth/logout        → clear session
//   All other routes check for valid session cookie when auth is enabled.
package nanobot

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ── Session store ─────────────────────────────────────────────────────

type session struct {
	UserID    int64
	Username  string
	FirstName string
	ExpiresAt time.Time
}

var (
	sessionsMu sync.RWMutex
	sessions   = map[string]*session{}
)

const sessionCookie = "nb_session"
const sessionTTL = 7 * 24 * time.Hour // 1 week

func newSessionToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func setSession(w http.ResponseWriter, s *session) string {
	token := newSessionToken()
	sessionsMu.Lock()
	sessions[token] = s
	sessionsMu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		Expires:  s.ExpiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return token
}

func getSession(r *http.Request) *session {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil {
		return nil
	}
	sessionsMu.RLock()
	s := sessions[cookie.Value]
	sessionsMu.RUnlock()
	if s == nil || time.Now().After(s.ExpiresAt) {
		return nil
	}
	return s
}

func clearSession(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookie)
	if err == nil {
		sessionsMu.Lock()
		delete(sessions, cookie.Value)
		sessionsMu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:    sessionCookie,
		Value:   "",
		Path:    "/",
		Expires: time.Unix(0, 0),
		MaxAge:  -1,
	})
}

// ── Telegram Login Widget verification ────────────────────────────────

// verifyTelegramAuth validates the hash from the Telegram Login Widget.
// See: https://core.telegram.org/widgets/login#checking-authorization
func verifyTelegramAuth(params map[string]string, botToken string) error {
	hash := params["hash"]
	if hash == "" {
		return fmt.Errorf("missing hash")
	}

	// Build sorted data-check string (all fields except hash)
	keys := make([]string, 0, len(params))
	for k := range params {
		if k != "hash" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	checkStr := strings.Join(parts, "\n")

	// secret = SHA256(bot_token), then HMAC-SHA256(secret, data_check_string)
	tokenHash := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, tokenHash[:])
	mac.Write([]byte(checkStr))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(hash), []byte(expected)) {
		return fmt.Errorf("invalid hash — data may be tampered")
	}

	// Reject stale auth (> 1 day old)
	authDate, _ := strconv.ParseInt(params["auth_date"], 10, 64)
	if time.Now().Unix()-authDate > 86400 {
		return fmt.Errorf("auth data expired")
	}

	return nil
}

// ── Auth middleware ───────────────────────────────────────────────────

// authEnabled returns true when a bot token is configured (auth is optional).
func authEnabled() bool {
	return strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")) != ""
}

// isLocalRequest returns true when the request originates from localhost.
// The server only binds to 127.0.0.1 by default, but --public mode exposes
// it externally, so we still enforce auth for remote callers.
func isLocalRequest(r *http.Request) bool {
	host := r.RemoteAddr
	// RemoteAddr is "ip:port"
	if idx := strings.LastIndex(host, ":"); idx >= 0 {
		host = host[:idx]
	}
	host = strings.Trim(host, "[]") // strip IPv6 brackets
	return host == "127.0.0.1" || host == "::1" || host == "localhost"
}

// requireAuth wraps a handler to enforce Telegram login when auth is enabled.
// Local requests (127.0.0.1 / ::1) are always allowed so the Chrome extension
// and local tools work without a browser login session.
func requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Always allow: auth endpoints, local requests, or auth disabled
		if !authEnabled() ||
			isLocalRequest(r) ||
			path == "/login" ||
			path == "/auth/telegram" ||
			path == "/auth/logout" {
			next.ServeHTTP(w, r)
			return
		}

		if getSession(r) == nil {
			if strings.HasPrefix(path, "/api/") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
				return
			}
			http.Redirect(w, r, "/login", http.StatusFound)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ── Auth handlers ─────────────────────────────────────────────────────

// handleLogin serves the Telegram Login Widget page.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !authEnabled() {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}

	// Already logged in
	if getSession(r) != nil {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}

	// Extract bot username from token (format: 123456:ABC...)
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	botName := os.Getenv("TELEGRAM_BOT_USERNAME")
	if botName == "" {
		// Fallback: use the numeric ID portion — user should set TELEGRAM_BOT_USERNAME
		parts := strings.SplitN(botToken, ":", 2)
		if len(parts) > 0 {
			botName = parts[0]
		}
	}

	callbackURL := os.Getenv("NANOBOT_PUBLIC_URL")
	if callbackURL == "" {
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		callbackURL = fmt.Sprintf("%s://%s", scheme, r.Host)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, loginPageHTML, botName, callbackURL+"/auth/telegram")
}

// handleTelegramAuth handles the Telegram Login Widget callback.
func (s *Server) handleTelegramAuth(w http.ResponseWriter, r *http.Request) {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		http.Error(w, "auth not configured", http.StatusServiceUnavailable)
		return
	}

	// Collect all query params into a map
	params := make(map[string]string)
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}

	if err := verifyTelegramAuth(params, botToken); err != nil {
		http.Error(w, "auth failed: "+err.Error(), http.StatusForbidden)
		return
	}

	userID, _ := strconv.ParseInt(params["id"], 10, 64)
	sess := &session{
		UserID:    userID,
		Username:  params["username"],
		FirstName: params["first_name"],
		ExpiresAt: time.Now().Add(sessionTTL),
	}
	setSession(w, sess)

	http.Redirect(w, r, "/", http.StatusFound)
}

// handleLogout clears the session.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	clearSession(w, r)
	http.Redirect(w, r, "/login", http.StatusFound)
}

// ── Login page HTML ───────────────────────────────────────────────────

// loginPageHTML: %s = botUsername, %s = callbackURL
const loginPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SolanaOS — Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0f;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #e0e0e0;
  }
  .card {
    background: #12121a;
    border: 1px solid #2a2a3a;
    border-radius: 16px;
    padding: 48px 40px;
    text-align: center;
    max-width: 380px;
    width: 100%%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .logo { font-size: 56px; margin-bottom: 16px }
  h1 { font-size: 22px; color: #a78bfa; margin-bottom: 8px }
  .sub { font-size: 12px; color: #666; margin-bottom: 32px }
  .widget-wrap { display: flex; justify-content: center }
  .note { margin-top: 24px; font-size: 11px; color: #444 }
</style>
</head>
<body>
<div class="card">
  <div class="logo">🦞</div>
  <h1>SolanaOS</h1>
  <div class="sub">Solana Trading Intelligence</div>
  <div class="widget-wrap">
    <script async
      src="https://telegram.org/js/telegram-widget.js?22"
      data-telegram-login="%s"
      data-size="large"
      data-auth-url="%s"
      data-request-access="write">
    </script>
  </div>
  <div class="note">Login with your Telegram account to access the dashboard</div>
</div>
</body>
</html>`
