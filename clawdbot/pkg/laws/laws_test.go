package laws

import (
	"strings"
	"testing"
)

func TestValidateSixLawHarness(t *testing.T) {
	if err := Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if got := len(OnChain()); got != 3 {
		t.Fatalf("OnChain() len = %d, want 3", got)
	}
	if got := len(OffChain()); got != 3 {
		t.Fatalf("OffChain() len = %d, want 3", got)
	}
}

func TestMarkdownContainsAllLaws(t *testing.T) {
	markdown := Markdown()
	for _, law := range Six {
		if !strings.Contains(markdown, "Law "+law.ID) {
			t.Fatalf("Markdown() missing law %s", law.ID)
		}
	}
}
