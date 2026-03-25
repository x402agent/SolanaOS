package node

import (
	"fmt"
	"net"
	"strconv"
	"strings"
)

// StartMDNS advertises the node on the local network via Bonjour/mDNS.
// Returns a cleanup function to deregister the service, or nil on failure.
//
// NOTE: mDNS requires the github.com/grandcat/zeroconf dependency.
// For now this provides a stub implementation that logs intent but does
// not actually register — the full zeroconf dependency can be added when
// deploying to hardware nodes. This avoids pulling in CGO dependencies
// that may not compile on all platforms.
func StartMDNS(cfg NodeConfig, state *NodeState, logf func(string, ...any)) func() {
	if !cfg.MDNSEnabled {
		return nil
	}

	service := strings.TrimSpace(cfg.MDNSService)
	if service == "" {
		service = "_nanoclaw-node._tcp"
	}
	domain := strings.TrimSpace(cfg.MDNSDomain)
	if domain == "" {
		domain = "local."
	}
	name := strings.TrimSpace(cfg.MDNSName)
	if name == "" {
		name = strings.TrimSpace(state.DisplayName)
	}
	if name == "" {
		name = DefaultDisplayName()
	}

	bridgeHost, bridgePort := ParseBridgeAddr(cfg.BridgeAddr)
	txt := []string{
		fmt.Sprintf("role=%s", "node"),
		fmt.Sprintf("displayName=%s", name),
		fmt.Sprintf("nodeId=%s", state.NodeID),
		"transport=node",
		"runtime=solanaos-go",
	}
	if bridgeHost != "" {
		txt = append(txt, fmt.Sprintf("bridgeHost=%s", bridgeHost))
	}
	if bridgePort > 0 {
		txt = append(txt, fmt.Sprintf("bridgePort=%d", bridgePort))
	}
	if cfg.DeviceFamily != "" {
		txt = append(txt, fmt.Sprintf("deviceFamily=%s", cfg.DeviceFamily))
	}

	logf("mdns: would advertise %s on %s (%s) txt=%v", name, service, domain, txt)
	logf("mdns: stub mode — add github.com/grandcat/zeroconf for hardware deployment")

	return func() {
		logf("mdns: cleanup (stub)")
	}
}

// ParseBridgeAddr splits a host:port string.
func ParseBridgeAddr(addr string) (string, int) {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return "", 0
	}
	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return addr, 0
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return host, 0
	}
	return host, port
}
