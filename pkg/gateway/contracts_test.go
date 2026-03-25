package gateway

import "testing"

func TestParseClientInfo(t *testing.T) {
	info := ParseClientInfo(map[string]any{
		"name":     "telegram-ui",
		"version":  "2.0.0",
		"platform": "darwin/arm64",
		"mode":     GatewayClientModeWebchat,
	})
	if info.Name != "telegram-ui" || info.Version != "2.0.0" || info.Mode != GatewayClientModeWebchat {
		t.Fatalf("ParseClientInfo returned %#v", info)
	}
}

func TestValidateDeviceAuth(t *testing.T) {
	if got := ValidateDeviceAuth(DeviceAuthPayload{}); got != nil {
		t.Fatalf("expected nil for empty device auth, got %#v", got)
	}
	if got := ValidateDeviceAuth(BuildDeviceAuthPayload("device-1", "token-1", "")); got == nil {
		t.Fatalf("expected valid payload")
	}
}
