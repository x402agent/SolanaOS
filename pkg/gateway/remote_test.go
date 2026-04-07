package gateway

import (
	"strings"
	"testing"
)

func TestRemoteTunnelSpecSSHConfigEntry(t *testing.T) {
	spec := RemoteTunnelSpec{
		Alias:          "remote-gateway",
		Host:           "172.27.187.184",
		User:           "jefferson",
		IdentityFile:   "~/.ssh/id_rsa",
		LocalPort:      18789,
		RemotePort:     18789,
		RemoteBindHost: "127.0.0.1",
	}

	got := spec.SSHConfigEntry()
	for _, want := range []string{
		"Host remote-gateway",
		"HostName 172.27.187.184",
		"User jefferson",
		"LocalForward 18789 127.0.0.1:18789",
		"IdentityFile ~/.ssh/id_rsa",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("SSHConfigEntry missing %q:\n%s", want, got)
		}
	}
}

func TestRemoteTunnelSpecLaunchAgentPlist(t *testing.T) {
	spec := RemoteTunnelSpec{
		Alias:            "remote-gateway",
		LaunchAgentLabel: "ai.solanaos.ssh-tunnel",
	}
	got, err := spec.LaunchAgentPlist()
	if err != nil {
		t.Fatalf("LaunchAgentPlist error: %v", err)
	}
	for _, want := range []string{
		"<string>ai.solanaos.ssh-tunnel</string>",
		"<string>/usr/bin/ssh</string>",
		"<string>-N</string>",
		"<string>remote-gateway</string>",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("LaunchAgentPlist missing %q:\n%s", want, got)
		}
	}
}

func TestRemoteTunnelSpecLocalForwardURL(t *testing.T) {
	spec := RemoteTunnelSpec{LocalPort: 18789}
	if got := spec.LocalForwardURL("ws"); got != "ws://127.0.0.1:18789" {
		t.Fatalf("LocalForwardURL(ws) = %q", got)
	}
	if got := spec.LocalForwardURL("http"); got != "http://127.0.0.1:18789" {
		t.Fatalf("LocalForwardURL(http) = %q", got)
	}
}
