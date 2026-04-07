package gateway

import "strings"

type ClientInfo struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Platform string `json:"platform,omitempty"`
	Mode     string `json:"mode,omitempty"`
}

const (
	GatewayClientControlUI = "control-ui"
	GatewayClientCLI       = "cli"
	GatewayClientExtension = "extension"
	GatewayClientAPI       = "api"

	GatewayClientModeWebchat  = "webchat"
	GatewayClientModeEmbedded = "embedded"
	GatewayClientModeHeadless = "headless"
)

func ParseClientInfo(raw map[string]any) ClientInfo {
	info := ClientInfo{
		Name:    "solanaos-ui",
		Version: "1.0.0",
	}
	if raw == nil {
		return info
	}
	if value, ok := raw["name"].(string); ok && strings.TrimSpace(value) != "" {
		info.Name = strings.TrimSpace(value)
	}
	if value, ok := raw["version"].(string); ok && strings.TrimSpace(value) != "" {
		info.Version = strings.TrimSpace(value)
	}
	if value, ok := raw["platform"].(string); ok {
		info.Platform = strings.TrimSpace(value)
	}
	if value, ok := raw["mode"].(string); ok {
		info.Mode = strings.TrimSpace(value)
	}
	return info
}

type DeviceAuthPayload struct {
	DeviceID  string `json:"device_id"`
	Token     string `json:"token"`
	Signature string `json:"signature,omitempty"`
}

func BuildDeviceAuthPayload(deviceID, token, signature string) DeviceAuthPayload {
	return DeviceAuthPayload{
		DeviceID:  strings.TrimSpace(deviceID),
		Token:     strings.TrimSpace(token),
		Signature: strings.TrimSpace(signature),
	}
}

func ValidateDeviceAuth(payload DeviceAuthPayload) *DeviceAuthPayload {
	if strings.TrimSpace(payload.DeviceID) == "" || strings.TrimSpace(payload.Token) == "" {
		return nil
	}
	normalized := payload
	normalized.DeviceID = strings.TrimSpace(normalized.DeviceID)
	normalized.Token = strings.TrimSpace(normalized.Token)
	normalized.Signature = strings.TrimSpace(normalized.Signature)
	return &normalized
}

type DeviceAuthEntry struct {
	Token     string   `json:"token"`
	Role      string   `json:"role"`
	Scopes    []string `json:"scopes,omitempty"`
	CreatedAt int64    `json:"created_at"`
}

type DeviceAuthStoreData struct {
	Version  int                        `json:"version"`
	DeviceID string                     `json:"device_id"`
	Tokens   map[string]DeviceAuthEntry `json:"tokens"`
}

const (
	GatewayEventUpdateAvailable = "update.available"
	GatewayEventChatMessage     = "chat.message"
	GatewayEventChatStream      = "chat.stream"
	GatewayEventToolStream      = "tool.stream"
	GatewayEventSessionRefresh  = "session.refresh"
	GatewayEventExecApproval    = "exec.approval"

	ControlUIBootstrapConfigPath = "/__nanosolana/control-ui-config.json"
)

type ControlUIBootstrapConfig struct {
	BasePath         string `json:"base_path"`
	AssistantName    string `json:"assistant_name"`
	AssistantAvatar  string `json:"assistant_avatar"`
	AssistantAgentID string `json:"assistant_agent_id"`
}
