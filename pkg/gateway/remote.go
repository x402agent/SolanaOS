package gateway

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"net"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

type RemoteTunnelSpec struct {
	Alias            string
	Host             string
	User             string
	IdentityFile     string
	LocalPort        int
	RemotePort       int
	RemoteBindHost   string
	LaunchAgentLabel string
}

func RemoteTunnelSpecFromConfig(cfg *config.Config) RemoteTunnelSpec {
	spec := RemoteTunnelSpec{
		Alias:            "nanosolana-remote-gateway",
		LocalPort:        18790,
		RemotePort:       18790,
		RemoteBindHost:   "127.0.0.1",
		LaunchAgentLabel: "ai.nanosolana.ssh-tunnel",
	}
	if cfg == nil {
		return spec
	}
	spec.Alias = firstNonEmptyTrimmed(cfg.Gateway.Remote.SSH.Alias, spec.Alias)
	spec.Host = strings.TrimSpace(cfg.Gateway.Remote.SSH.Host)
	spec.User = strings.TrimSpace(cfg.Gateway.Remote.SSH.User)
	spec.IdentityFile = strings.TrimSpace(cfg.Gateway.Remote.SSH.IdentityFile)
	if cfg.Gateway.Remote.SSH.LocalPort > 0 {
		spec.LocalPort = cfg.Gateway.Remote.SSH.LocalPort
	}
	if cfg.Gateway.Remote.SSH.RemotePort > 0 {
		spec.RemotePort = cfg.Gateway.Remote.SSH.RemotePort
	}
	spec.RemoteBindHost = firstNonEmptyTrimmed(cfg.Gateway.Remote.SSH.RemoteBindHost, spec.RemoteBindHost)
	spec.LaunchAgentLabel = firstNonEmptyTrimmed(cfg.Gateway.Remote.SSH.LaunchAgentLabel, spec.LaunchAgentLabel)
	return spec
}

func (s RemoteTunnelSpec) SSHConfigEntry() string {
	var b strings.Builder
	alias := firstNonEmptyTrimmed(s.Alias, "nanosolana-remote-gateway")
	fmt.Fprintf(&b, "Host %s\n", alias)
	if host := strings.TrimSpace(s.Host); host != "" {
		fmt.Fprintf(&b, "    HostName %s\n", host)
	} else {
		fmt.Fprintf(&b, "    HostName <REMOTE_IP>\n")
	}
	if user := strings.TrimSpace(s.User); user != "" {
		fmt.Fprintf(&b, "    User %s\n", user)
	} else {
		fmt.Fprintf(&b, "    User <REMOTE_USER>\n")
	}
	fmt.Fprintf(&b, "    LocalForward %d %s:%d\n", normalizedPort(s.LocalPort, 18790), firstNonEmptyTrimmed(s.RemoteBindHost, "127.0.0.1"), normalizedPort(s.RemotePort, 18790))
	if identity := strings.TrimSpace(s.IdentityFile); identity != "" {
		fmt.Fprintf(&b, "    IdentityFile %s\n", identity)
	} else {
		fmt.Fprintf(&b, "    IdentityFile ~/.ssh/id_rsa\n")
	}
	return b.String()
}

func (s RemoteTunnelSpec) TunnelCommand() string {
	return fmt.Sprintf("ssh -N %s", firstNonEmptyTrimmed(s.Alias, "nanosolana-remote-gateway"))
}

func (s RemoteTunnelSpec) DirectTunnelCommand() string {
	host := firstNonEmptyTrimmed(s.Host, "<REMOTE_IP>")
	user := firstNonEmptyTrimmed(s.User, "<REMOTE_USER>")
	return fmt.Sprintf("ssh -N -L %d:%s:%d %s@%s",
		normalizedPort(s.LocalPort, 18790),
		firstNonEmptyTrimmed(s.RemoteBindHost, "127.0.0.1"),
		normalizedPort(s.RemotePort, 18790),
		user,
		host,
	)
}

func (s RemoteTunnelSpec) LocalForwardURL(scheme string) string {
	scheme = strings.ToLower(strings.TrimSpace(scheme))
	if scheme == "" {
		scheme = "ws"
	}
	return fmt.Sprintf("%s://%s", scheme, net.JoinHostPort("127.0.0.1", fmt.Sprintf("%d", normalizedPort(s.LocalPort, 18790))))
}

func (s RemoteTunnelSpec) LaunchAgentFilename() string {
	return firstNonEmptyTrimmed(s.LaunchAgentLabel, "ai.nanosolana.ssh-tunnel") + ".plist"
}

func (s RemoteTunnelSpec) LaunchAgentPlist() (string, error) {
	label := firstNonEmptyTrimmed(s.LaunchAgentLabel, "ai.nanosolana.ssh-tunnel")
	alias := firstNonEmptyTrimmed(s.Alias, "nanosolana-remote-gateway")
	type plistDict struct {
		XMLName          xml.Name `xml:"plist"`
		Version          string   `xml:"version,attr"`
		Label            string   `xml:"dict>string"`
		ProgramArguments []string `xml:"dict>array>string"`
	}
	_ = plistDict{}

	var buf bytes.Buffer
	buf.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	buf.WriteString(`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` + "\n")
	buf.WriteString("<plist version=\"1.0\">\n<dict>\n")
	buf.WriteString("    <key>Label</key>\n")
	fmt.Fprintf(&buf, "    <string>%s</string>\n", xmlEscape(label))
	buf.WriteString("    <key>ProgramArguments</key>\n")
	buf.WriteString("    <array>\n")
	buf.WriteString("        <string>/usr/bin/ssh</string>\n")
	buf.WriteString("        <string>-N</string>\n")
	fmt.Fprintf(&buf, "        <string>%s</string>\n", xmlEscape(alias))
	buf.WriteString("    </array>\n")
	buf.WriteString("    <key>KeepAlive</key>\n    <true/>\n")
	buf.WriteString("    <key>RunAtLoad</key>\n    <true/>\n")
	buf.WriteString("</dict>\n</plist>\n")
	return buf.String(), nil
}

func normalizedPort(value, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

func firstNonEmptyTrimmed(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func xmlEscape(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&apos;",
	)
	return replacer.Replace(value)
}
