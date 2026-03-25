package gateway

import (
	"net/http/httptest"
	"testing"
)

func TestNormalizeTailscaleMode(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{in: "", want: TailscaleModeOff},
		{in: "OFF", want: TailscaleModeOff},
		{in: "serve", want: TailscaleModeServe},
		{in: "FUNNEL", want: TailscaleModeFunnel},
		{in: "weird", want: "weird"},
	}

	for _, tc := range tests {
		if got := NormalizeTailscaleMode(tc.in); got != tc.want {
			t.Fatalf("NormalizeTailscaleMode(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestBuildTailscaleHTTPSURL(t *testing.T) {
	if got := BuildTailscaleHTTPSURL("device.tail123.ts.net", 443); got != "https://device.tail123.ts.net/" {
		t.Fatalf("unexpected default HTTPS URL: %s", got)
	}
	if got := BuildTailscaleHTTPSURL("device.tail123.ts.net", 8443); got != "https://device.tail123.ts.net:8443/" {
		t.Fatalf("unexpected alternate HTTPS URL: %s", got)
	}
}

func TestIsTailscaleServeRequest(t *testing.T) {
	req := httptest.NewRequest("GET", "http://example/", nil)
	req.RemoteAddr = "127.0.0.1:45000"
	req.Header.Set("X-Forwarded-For", "100.64.0.10")
	req.Header.Set("X-Forwarded-Host", "device.tail123.ts.net")
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("Tailscale-User-Login", "user@example.com")
	if !IsTailscaleServeRequest(req) {
		t.Fatal("expected Tailscale Serve request to be detected")
	}

	req.RemoteAddr = "100.64.0.20:45000"
	if IsTailscaleServeRequest(req) {
		t.Fatal("expected non-loopback remote address to be rejected")
	}
}

func TestForwardedClientIP(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{in: "100.64.0.10", want: "100.64.0.10"},
		{in: "100.64.0.10:12345", want: "100.64.0.10"},
		{in: "100.64.0.10, 100.64.0.11", want: "100.64.0.10"},
		{in: "[fd7a:115c:a1e0::1]:12345", want: "fd7a:115c:a1e0::1"},
	}

	for _, tc := range tests {
		if got := forwardedClientIP(tc.in); got != tc.want {
			t.Fatalf("forwardedClientIP(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
