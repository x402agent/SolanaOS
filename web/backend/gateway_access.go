package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	gatewaypkg "github.com/x402agent/Solana-Os-Go/pkg/gateway"
)

const gatewayAuthCookieName = "nsgw_auth"

type gatewayRuntimeConfig struct {
	BindMode       string
	AuthMode       string
	Token          string
	Password       string
	AllowTailscale bool
	TailscaleMode  string
	ResetOnExit    bool
	TailscaleURL   string
}

func resolveGatewayRuntimeConfig(cfg *config.Config, bindMode, authMode, token, password, tailscaleMode string) (gatewayRuntimeConfig, error) {
	out := gatewayRuntimeConfig{
		BindMode:       "loopback",
		AllowTailscale: true,
		TailscaleMode:  gatewaypkg.TailscaleModeOff,
	}
	if cfg != nil {
		if v := strings.TrimSpace(cfg.Gateway.Bind); v != "" {
			out.BindMode = strings.ToLower(v)
		}
		if v := strings.TrimSpace(cfg.Gateway.Auth.Mode); v != "" {
			out.AuthMode = strings.ToLower(v)
		}
		if v := strings.TrimSpace(cfg.Gateway.Auth.Token); v != "" {
			out.Token = v
		}
		if v := strings.TrimSpace(cfg.Gateway.Auth.Password); v != "" {
			out.Password = v
		}
		out.AllowTailscale = cfg.Gateway.Auth.AllowTailscale
		if v := strings.TrimSpace(cfg.Gateway.Tailscale.Mode); v != "" {
			out.TailscaleMode = gatewaypkg.NormalizeTailscaleMode(v)
		}
		out.ResetOnExit = cfg.Gateway.Tailscale.ResetOnExit
	}

	if v := strings.TrimSpace(bindMode); v != "" {
		out.BindMode = strings.ToLower(v)
	}
	if v := strings.TrimSpace(authMode); v != "" {
		out.AuthMode = strings.ToLower(v)
	}
	if v := strings.TrimSpace(token); v != "" {
		out.Token = v
	}
	if v := strings.TrimSpace(password); v != "" {
		out.Password = v
	}
	if v := strings.TrimSpace(tailscaleMode); v != "" {
		out.TailscaleMode = gatewaypkg.NormalizeTailscaleMode(v)
	}

	out.BindMode = normalizeGatewayBind(out.BindMode)
	out.AuthMode = normalizeGatewayAuthMode(out.AuthMode, out.Token, out.Password)

	if out.AuthMode == "token" && out.Token == "" {
		out.Token = generateGatewaySecret("gtok-")
	}
	if out.AuthMode == "password" && strings.TrimSpace(out.Password) == "" {
		return out, fmt.Errorf("gateway auth mode password requires a configured password")
	}
	if out.TailscaleMode == gatewaypkg.TailscaleModeFunnel && out.AuthMode != "password" {
		return out, fmt.Errorf("tailscale funnel requires gateway auth mode password")
	}
	if (out.TailscaleMode == gatewaypkg.TailscaleModeServe || out.TailscaleMode == gatewaypkg.TailscaleModeFunnel) && out.BindMode != "loopback" {
		return out, fmt.Errorf("tailscale %s requires gateway.bind loopback", out.TailscaleMode)
	}
	return out, nil
}

func normalizeGatewayBind(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", "auto", "loopback":
		return "loopback"
	case "tailnet", "public":
		return strings.ToLower(strings.TrimSpace(mode))
	default:
		return "loopback"
	}
}

func normalizeGatewayAuthMode(mode, token, password string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", "auto":
		switch {
		case strings.TrimSpace(token) != "":
			return "token"
		case strings.TrimSpace(password) != "":
			return "password"
		default:
			return "none"
		}
	case "none", "token", "password":
		return strings.ToLower(strings.TrimSpace(mode))
	default:
		return "none"
	}
}

func generateGatewaySecret(prefix string) string {
	buf := make([]byte, 18)
	if _, err := rand.Read(buf); err != nil {
		return prefix + "local"
	}
	return prefix + hex.EncodeToString(buf)
}

func gatewayListenHost(runtime gatewayRuntimeConfig, publicFlag bool) (string, error) {
	switch runtime.BindMode {
	case "tailnet":
		return gatewaypkg.DetectTailscaleIP()
	case "public":
		return "0.0.0.0", nil
	case "loopback":
		return "127.0.0.1", nil
	default:
		if publicFlag {
			return "0.0.0.0", nil
		}
		return "127.0.0.1", nil
	}
}

func gatewayAccessMiddleware(runtime gatewayRuntimeConfig, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/__gateway_auth/login":
			handleGatewayLogin(runtime, w, r)
			return
		case "/__gateway_auth/logout":
			clearGatewayAuthCookie(w)
			if strings.HasPrefix(r.URL.Path, "/api/") {
				writeJSON(w, http.StatusOK, map[string]any{"ok": true})
				return
			}
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}

		if runtime.TailscaleMode == gatewaypkg.TailscaleModeServe &&
			runtime.AllowTailscale &&
			!strings.HasPrefix(r.URL.Path, "/api/") {
			if _, err := gatewaypkg.VerifyTailscaleServeIdentity(r); err == nil {
				if runtime.AuthMode == "token" || runtime.AuthMode == "password" {
					setGatewayAuthCookie(w, runtime)
				}
				next.ServeHTTP(w, r)
				return
			}
		}

		if runtime.AuthMode == "none" {
			next.ServeHTTP(w, r)
			return
		}

		if ok, shouldSetCookie := gatewayRequestAuthorized(runtime, r); ok {
			if shouldSetCookie {
				setGatewayAuthCookie(w, runtime)
			}
			next.ServeHTTP(w, r)
			return
		}

		if r.Method == http.MethodGet && acceptsHTML(r) && !strings.HasPrefix(r.URL.Path, "/api/") {
			renderGatewayLoginPage(w, runtime, r.URL.Path)
			return
		}

		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error":         "unauthorized",
			"auth_mode":     runtime.AuthMode,
			"tailscaleMode": runtime.TailscaleMode,
		})
	})
}

func gatewayRequestAuthorized(runtime gatewayRuntimeConfig, r *http.Request) (ok bool, shouldSetCookie bool) {
	if gatewayCookieAuthorized(runtime, r) {
		return true, false
	}

	if secret := gatewayBearerSecret(r); secret != "" && gatewaySecretMatches(runtime, secret) {
		return true, true
	}

	queryKey := "token"
	if runtime.AuthMode == "password" {
		queryKey = "password"
	}
	if secret := strings.TrimSpace(r.URL.Query().Get(queryKey)); secret != "" && gatewaySecretMatches(runtime, secret) {
		return true, true
	}

	return false, false
}

func gatewayBearerSecret(r *http.Request) string {
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	if value == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(value), "bearer ") {
		return strings.TrimSpace(value[7:])
	}
	return ""
}

func gatewayCookieAuthorized(runtime gatewayRuntimeConfig, r *http.Request) bool {
	cookie, err := r.Cookie(gatewayAuthCookieName)
	if err != nil {
		return false
	}
	expected := gatewayCookieValue(runtime)
	actual := strings.TrimSpace(cookie.Value)
	if len(expected) != len(actual) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) == 1
}

func gatewaySecretMatches(runtime gatewayRuntimeConfig, secret string) bool {
	expected := strings.TrimSpace(runtime.Token)
	if runtime.AuthMode == "password" {
		expected = strings.TrimSpace(runtime.Password)
	}
	if expected == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(strings.TrimSpace(secret))) == 1
}

func gatewayCookieValue(runtime gatewayRuntimeConfig) string {
	secret := runtime.Token
	if runtime.AuthMode == "password" {
		secret = runtime.Password
	}
	sum := sha256.Sum256([]byte(runtime.AuthMode + ":" + secret))
	return hex.EncodeToString(sum[:])
}

func setGatewayAuthCookie(w http.ResponseWriter, runtime gatewayRuntimeConfig) {
	http.SetCookie(w, &http.Cookie{
		Name:     gatewayAuthCookieName,
		Value:    gatewayCookieValue(runtime),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   runtime.TailscaleMode == gatewaypkg.TailscaleModeServe || runtime.TailscaleMode == gatewaypkg.TailscaleModeFunnel,
	})
}

func clearGatewayAuthCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     gatewayAuthCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func handleGatewayLogin(runtime gatewayRuntimeConfig, w http.ResponseWriter, r *http.Request) {
	if runtime.AuthMode == "none" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "gateway auth is disabled"})
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err := r.ParseForm(); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad login form"})
		return
	}
	secret := strings.TrimSpace(r.FormValue("secret"))
	if !gatewaySecretMatches(runtime, secret) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid credentials"})
		return
	}
	setGatewayAuthCookie(w, runtime)
	redirectTo := strings.TrimSpace(r.FormValue("redirect_to"))
	if redirectTo == "" {
		redirectTo = "/"
	}
	http.Redirect(w, r, redirectTo, http.StatusFound)
}

func acceptsHTML(r *http.Request) bool {
	accept := strings.ToLower(strings.TrimSpace(r.Header.Get("Accept")))
	return accept == "" || strings.Contains(accept, "text/html") || strings.Contains(accept, "*/*")
}

func renderGatewayLoginPage(w http.ResponseWriter, runtime gatewayRuntimeConfig, redirectTo string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	label := "Token"
	if runtime.AuthMode == "password" {
		label = "Password"
	}
	redirectTo = sanitizeRedirectTarget(redirectTo)
	page := strings.NewReplacer(
		"__LABEL__", html.EscapeString(label),
		"__REDIRECT_TO__", html.EscapeString(redirectTo),
	).Replace(gatewayLoginHTML)
	_, _ = w.Write([]byte(page))
}

func sanitizeRedirectTarget(target string) string {
	target = strings.TrimSpace(target)
	if target == "" || !strings.HasPrefix(target, "/") {
		return "/"
	}
	if parsed, err := url.Parse(target); err == nil && parsed.IsAbs() {
		return "/"
	}
	return target
}

func gatewayAccessStatus(runtime gatewayRuntimeConfig) map[string]any {
	return map[string]any{
		"bind":            runtime.BindMode,
		"auth_mode":       runtime.AuthMode,
		"auth_configured": runtime.AuthMode == "none" || strings.TrimSpace(runtime.Token) != "" || strings.TrimSpace(runtime.Password) != "",
		"allow_tailscale": runtime.AllowTailscale,
		"tailscale_mode":  runtime.TailscaleMode,
		"tailscale_url":   runtime.TailscaleURL,
		"tailscale_cli":   gatewaypkg.TailscaleBinaryAvailable(),
	}
}

const gatewayLoginHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SolanaOS Gateway Login</title>
<style>
body{margin:0;background:#060a12;color:#d7e2f0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;display:grid;min-height:100vh;place-items:center}
form{width:min(420px,92vw);padding:28px;border:1px solid rgba(120,170,255,.2);border-radius:20px;background:linear-gradient(180deg,#111827,#0b1220);box-shadow:0 20px 60px rgba(0,0,0,.35)}
h1{margin:0 0 10px;font-size:1.4rem}
p{margin:0 0 18px;color:#96a7c2;line-height:1.5}
label{display:block;margin-bottom:8px;color:#b8c9e0}
input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(120,170,255,.22);background:#050914;color:#eef4ff}
button{margin-top:14px;width:100%;padding:12px 14px;border:0;border-radius:999px;background:#14f195;color:#04120d;font-weight:700;cursor:pointer}
</style>
</head>
<body>
<form method="post" action="/__gateway_auth/login">
  <h1>SolanaOS Gateway</h1>
  <p>Enter the configured __LABEL__ to access the dashboard and API.</p>
  <input type="hidden" name="redirect_to" value="__REDIRECT_TO__">
  <label for="secret">Credential</label>
  <input id="secret" name="secret" type="password" autocomplete="current-password" required>
  <button type="submit">Unlock</button>
</form>
</body>
</html>`
