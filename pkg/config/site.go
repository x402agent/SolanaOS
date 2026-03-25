package config

import (
	"net/url"
	"strings"
)

const defaultPublicHubURL = "https://seeker.solanaos.net"

func PublicHubURL() string {
	return normalizePublicURL(
		firstNonEmptyEnv("SEEKER_SITE_URL", "NANOSOLANA_SITE_URL", "SOLANAOS_SITE_URL"),
		defaultPublicHubURL,
	)
}

func PublicDashboardURL() string {
	return joinPublicURL(PublicHubURL(), "/dashboard")
}

func PublicPairURL() string {
	return joinPublicURL(PublicHubURL(), "/pair")
}

func PublicRegistryDomains() []string {
	values := []string{PublicHubURL(), "https://solanaos.net"}
	seen := make(map[string]struct{})
	out := make([]string, 0, len(values))
	for _, raw := range values {
		host := normalizePublicHost(raw)
		if host == "" {
			continue
		}
		if _, ok := seen[host]; ok {
			continue
		}
		seen[host] = struct{}{}
		out = append(out, host)
	}
	return out
}

func normalizePublicURL(raw, fallback string) string {
	candidate := strings.TrimSpace(raw)
	if candidate == "" {
		candidate = strings.TrimSpace(fallback)
	}
	if candidate == "" {
		return ""
	}
	parsed, err := url.Parse(candidate)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return strings.TrimRight(candidate, "/")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/")
}

func normalizePublicHost(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" {
		return ""
	}
	return strings.ToLower(parsed.Host)
}

func joinPublicURL(base, path string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	path = "/" + strings.TrimLeft(strings.TrimSpace(path), "/")
	if base == "" {
		return ""
	}
	return base + path
}
