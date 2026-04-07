package main

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeGatewaySetupCode(t *testing.T) {
	raw := base64.RawURLEncoding.EncodeToString([]byte(`{"url":"wss://gateway.example:18789","token":"token-1"}`))
	decoded, err := decodeGatewaySetupCode(raw)
	if err != nil {
		t.Fatalf("decodeGatewaySetupCode returned error: %v", err)
	}
	if decoded.URL != "wss://gateway.example:18789" {
		t.Fatalf("unexpected URL: %s", decoded.URL)
	}
	if decoded.Token != "token-1" {
		t.Fatalf("unexpected token: %s", decoded.Token)
	}
}

func TestParseGatewayEndpoint(t *testing.T) {
	httpEndpoint, err := parseGatewayEndpoint("http://gateway.example:18790")
	if err != nil {
		t.Fatalf("parseGatewayEndpoint(http) returned error: %v", err)
	}
	if httpEndpoint.Transport != transportNativeJSONTCP || httpEndpoint.TLS {
		t.Fatalf("unexpected http endpoint: %+v", httpEndpoint)
	}

	wsEndpoint, err := parseGatewayEndpoint("wss://gateway.example:18790")
	if err != nil {
		t.Fatalf("parseGatewayEndpoint(wss) returned error: %v", err)
	}
	if wsEndpoint.Transport != transportWebSocketRPC || !wsEndpoint.TLS {
		t.Fatalf("unexpected wss endpoint: %+v", wsEndpoint)
	}
}

func TestComposeGatewayManualURL(t *testing.T) {
	if got := composeGatewayManualURL(" gateway.example ", "18790", true); got != "https://gateway.example:18790" {
		t.Fatalf("unexpected composed URL: %s", got)
	}
	if got := composeGatewayManualURL("gateway.example", "0", true); got != "" {
		t.Fatalf("expected invalid port to return empty string, got %q", got)
	}
}

func TestBuildAuthV3(t *testing.T) {
	payload := buildAuthV3(authPayloadV3{
		DeviceID:     "device",
		ClientID:     "solanaos-seeker",
		ClientMode:   "companion",
		Role:         "operator",
		Scopes:       []string{"chat", "invoke", "chat"},
		SignedAtMs:   123,
		Token:        "abc",
		Nonce:        "nonce",
		Platform:     "Android",
		DeviceFamily: "Seeker",
	})
	want := "v3|device|solanaos-seeker|companion|operator|chat,invoke|123|abc|nonce|android|seeker"
	if payload != want {
		t.Fatalf("unexpected auth payload:\n got %q\nwant %q", payload, want)
	}
}

func TestBonjourDecode(t *testing.T) {
	if got := bonjourDecode(`Solana\032OS`); got != "Solana OS" {
		t.Fatalf("unexpected decode result: %q", got)
	}
}

func TestParseInvokeErrorMessage(t *testing.T) {
	parsed := parseInvokeErrorMessage("CAMERA_DISABLED: enable Camera in Settings")
	if parsed.Code != "CAMERA_DISABLED" || parsed.Message != "enable Camera in Settings" || !parsed.HadExplicitCode {
		t.Fatalf("unexpected parsed error: %+v", parsed)
	}
}

func TestAPIV1Routes(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	cfg := config{
		port:            "18790",
		setupHost:       "127.0.0.1",
		setupPort:       "18790",
		setupTLS:        true,
		network:         "mainnet-beta",
		heliusRPC:       "https://mainnet.helius-rpc.com",
		openRouterModel: "anthropic/claude-sonnet-4-20250514",
	}
	fleet := newFleetStore()
	mux := http.NewServeMux()
	if _, err := registerMobileAPIRoutes(mux, cfg, fleet); err != nil {
		t.Fatalf("registerMobileAPIRoutes: %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/setup-code", nil)
	mux.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status for setup-code: %d", recorder.Code)
	}

	var setup map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &setup); err != nil {
		t.Fatalf("failed to decode setup response: %v", err)
	}
	if setup["protocol"].(float64) != gatewayProtocolVersion {
		t.Fatalf("unexpected protocol: %v", setup["protocol"])
	}

	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/api/v1/invoke", strings.NewReader(`{"command":"device.status","params":{}}`))
	mux.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status for invoke: %d", recorder.Code)
	}
	var invoke invokeResult
	if err := json.Unmarshal(recorder.Body.Bytes(), &invoke); err != nil {
		t.Fatalf("failed to decode invoke result: %v", err)
	}
	if !invoke.OK {
		t.Fatalf("expected invoke OK, got %+v", invoke)
	}
}
