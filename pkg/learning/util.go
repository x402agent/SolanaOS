package learning

import (
	"strings"
	"unicode"
)

func HeuristicSummary(content string) string {
	content = strings.Join(strings.Fields(strings.TrimSpace(content)), " ")
	if content == "" {
		return ""
	}
	if len(content) <= 140 {
		return content
	}
	return strings.TrimSpace(content[:137]) + "..."
}

func safeSlug(raw string) string {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return "unknown"
	}

	var b strings.Builder
	lastDash := false
	for _, r := range raw {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			lastDash = false
		case r == '-' || r == '_' || unicode.IsSpace(r) || r == '/' || r == ':':
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}

	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "unknown"
	}
	return out
}

func limitStrings(items []string, n int) []string {
	if n <= 0 || len(items) <= n {
		return append([]string(nil), items...)
	}
	return append([]string(nil), items[:n]...)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
