// Package constants defines MawdBot system constants.
// Adapted from PicoClaw's constants package.
package constants

const (
	AppName    = "MawdBot"
	AppVersion = "1.0.0"
	AppTagline = "Sentient Solana Trading Intelligence"

	// Channel names
	ChannelCLI       = "cli"
	ChannelDiscord   = "discord"
	ChannelTelegram  = "telegram"
	ChannelWebSocket = "websocket"
	ChannelSystem    = "system"
	ChannelCron      = "cron"
	ChannelHeartbeat = "heartbeat"

	// Internal channels (not user-facing)
	ChannelSubagent = "subagent"
)

// InternalChannels lists channels that are internal (not user-facing).
var InternalChannels = map[string]bool{
	ChannelSystem:    true,
	ChannelCron:      true,
	ChannelHeartbeat: true,
	ChannelSubagent:  true,
}

// IsInternalChannel checks if a channel is internal (not user-facing).
func IsInternalChannel(channel string) bool {
	return InternalChannels[channel]
}

// Default system paths
const (
	DefaultConfigName   = "config.json"
	DefaultWorkspaceDir = "workspace"
	DefaultVaultDir     = "vault"
	DefaultSessionsDir  = "sessions"
)
