package gateway

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
)

const (
	TailscaleModeOff    = "off"
	TailscaleModeServe  = "serve"
	TailscaleModeFunnel = "funnel"
)

type TailscaleLocalStatus struct {
	Self struct {
		DNSName      string   `json:"DNSName"`
		TailscaleIPs []string `json:"TailscaleIPs"`
	} `json:"Self"`
	CurrentTailnet struct {
		MagicDNSSuffix string `json:"MagicDNSSuffix"`
	} `json:"CurrentTailnet"`
}

type TailscaleWhois struct {
	Node struct {
		Name      string   `json:"Name"`
		Addresses []string `json:"Addresses"`
		Tags      []string `json:"Tags"`
	} `json:"Node"`
	UserProfile struct {
		LoginName string `json:"LoginName"`
		Display   string `json:"DisplayName"`
	} `json:"UserProfile"`
}

type TailscaleExposeStatus struct {
	Mode      string `json:"mode"`
	URL       string `json:"url"`
	TargetURL string `json:"target_url"`
	DNSName   string `json:"dns_name"`
	Port      int    `json:"port"`
}

func TailscaleBinaryAvailable() bool {
	_, err := exec.LookPath("tailscale")
	return err == nil
}

func DetectTailscaleIP() (string, error) {
	status, err := TailscaleStatus()
	if err == nil {
		for _, ip := range status.Self.TailscaleIPs {
			parsed := net.ParseIP(strings.TrimSpace(ip))
			if parsed != nil && parsed.To4() != nil {
				return parsed.String(), nil
			}
		}
	}

	out, err := exec.Command("tailscale", "ip", "-4").Output()
	if err != nil {
		return "", fmt.Errorf("tailscale ip: %w", err)
	}
	ip := strings.TrimSpace(string(out))
	if ip == "" {
		return "", fmt.Errorf("tailscale returned empty IP")
	}
	return ip, nil
}

func TailscaleStatus() (*TailscaleLocalStatus, error) {
	out, err := exec.Command("tailscale", "status", "--json").Output()
	if err != nil {
		return nil, fmt.Errorf("tailscale status --json: %w", err)
	}
	var status TailscaleLocalStatus
	if err := json.Unmarshal(out, &status); err != nil {
		return nil, fmt.Errorf("decode tailscale status: %w", err)
	}
	return &status, nil
}

func DetectTailscaleDNSName() (string, error) {
	status, err := TailscaleStatus()
	if err != nil {
		return "", err
	}
	if dns := strings.Trim(strings.TrimSpace(status.Self.DNSName), "."); dns != "" {
		return dns, nil
	}
	return "", fmt.Errorf("tailscale DNS name unavailable")
}

func ConfigureTailscaleHTTPS(mode string, httpsPort int, targetURL string) (*TailscaleExposeStatus, error) {
	mode = NormalizeTailscaleMode(mode)
	if mode == TailscaleModeOff {
		return nil, nil
	}
	if httpsPort <= 0 {
		httpsPort = 443
	}
	if strings.TrimSpace(targetURL) == "" {
		return nil, fmt.Errorf("tailscale target URL is required")
	}
	if !TailscaleBinaryAvailable() {
		return nil, fmt.Errorf("tailscale CLI not found")
	}

	args := []string{mode, fmt.Sprintf("--https=%d", httpsPort), targetURL}
	cmd := exec.Command("tailscale", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("tailscale %s failed: %w (%s)", mode, err, strings.TrimSpace(string(out)))
	}

	dnsName, err := DetectTailscaleDNSName()
	if err != nil {
		return nil, err
	}

	return &TailscaleExposeStatus{
		Mode:      mode,
		TargetURL: targetURL,
		DNSName:   dnsName,
		URL:       BuildTailscaleHTTPSURL(dnsName, httpsPort),
		Port:      httpsPort,
	}, nil
}

func ResetTailscaleHTTPS(mode string) error {
	mode = NormalizeTailscaleMode(mode)
	if mode == TailscaleModeOff {
		return nil
	}
	if !TailscaleBinaryAvailable() {
		return fmt.Errorf("tailscale CLI not found")
	}
	out, err := exec.Command("tailscale", mode, "reset").CombinedOutput()
	if err != nil {
		return fmt.Errorf("tailscale %s reset failed: %w (%s)", mode, err, strings.TrimSpace(string(out)))
	}
	return nil
}

func NormalizeTailscaleMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", TailscaleModeOff:
		return TailscaleModeOff
	case TailscaleModeServe:
		return TailscaleModeServe
	case TailscaleModeFunnel:
		return TailscaleModeFunnel
	default:
		return strings.ToLower(strings.TrimSpace(mode))
	}
}

func BuildTailscaleHTTPSURL(dnsName string, httpsPort int) string {
	dnsName = strings.Trim(strings.TrimSpace(dnsName), ".")
	if httpsPort <= 0 || httpsPort == 443 {
		return "https://" + dnsName + "/"
	}
	return "https://" + net.JoinHostPort(dnsName, strconv.Itoa(httpsPort)) + "/"
}

func IsTailscaleServeRequest(r *http.Request) bool {
	if r == nil {
		return false
	}
	if !isLoopbackRemoteAddr(r.RemoteAddr) {
		return false
	}
	return strings.TrimSpace(r.Header.Get("X-Forwarded-For")) != "" &&
		strings.TrimSpace(r.Header.Get("X-Forwarded-Host")) != "" &&
		strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")) != "" &&
		strings.TrimSpace(r.Header.Get("Tailscale-User-Login")) != ""
}

func VerifyTailscaleServeIdentity(r *http.Request) (*TailscaleWhois, error) {
	if !IsTailscaleServeRequest(r) {
		return nil, fmt.Errorf("request is not a Tailscale Serve proxy request")
	}
	clientIP := forwardedClientIP(r.Header.Get("X-Forwarded-For"))
	if clientIP == "" {
		return nil, fmt.Errorf("missing forwarded client IP")
	}
	out, err := exec.Command("tailscale", "whois", "--json", clientIP).Output()
	if err != nil {
		return nil, fmt.Errorf("tailscale whois --json %s: %w", clientIP, err)
	}
	var whois TailscaleWhois
	if err := json.Unmarshal(out, &whois); err != nil {
		return nil, fmt.Errorf("decode tailscale whois: %w", err)
	}
	headerLogin := strings.TrimSpace(strings.ToLower(r.Header.Get("Tailscale-User-Login")))
	whoisLogin := strings.TrimSpace(strings.ToLower(whois.UserProfile.LoginName))
	if headerLogin == "" || whoisLogin == "" || headerLogin != whoisLogin {
		return nil, fmt.Errorf("tailscale identity header mismatch")
	}
	return &whois, nil
}

func forwardedClientIP(value string) string {
	parts := strings.Split(value, ",")
	if len(parts) == 0 {
		return ""
	}
	first := strings.TrimSpace(parts[0])
	if host, _, err := net.SplitHostPort(first); err == nil {
		return strings.Trim(host, "[]")
	}
	return strings.Trim(first, "[]")
}

func isLoopbackRemoteAddr(remote string) bool {
	host := strings.TrimSpace(remote)
	if host == "" {
		return false
	}
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}
	host = strings.Trim(host, "[]")
	switch host {
	case "127.0.0.1", "::1", "localhost":
		return true
	default:
		ip := net.ParseIP(host)
		return ip != nil && ip.IsLoopback()
	}
}
