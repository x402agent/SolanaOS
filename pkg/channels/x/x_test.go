package x

import "testing"

func TestSplitTweetThread(t *testing.T) {
	parts := splitTweetThread("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau", 24)
	if len(parts) < 2 {
		t.Fatalf("expected multiple parts, got %#v", parts)
	}
	for _, part := range parts {
		if runeLen(part) > 24 {
			t.Fatalf("part too long: %q (%d)", part, runeLen(part))
		}
	}
}

func TestSanitizeTweetText(t *testing.T) {
	got := sanitizeTweetText("**SolanaOS**\n\n`status` ready")
	if got != "SolanaOS\nstatus ready" {
		t.Fatalf("sanitizeTweetText = %q", got)
	}
}
