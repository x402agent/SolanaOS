package autoreply

import "testing"

func TestExtractThinkingContent(t *testing.T) {
	thinking, visible := ExtractThinkingContent("<thinking>secret plan</thinking>\nVisible answer")
	if thinking != "secret plan" {
		t.Fatalf("thinking = %q, want %q", thinking, "secret plan")
	}
	if visible != "Visible answer" {
		t.Fatalf("visible = %q, want %q", visible, "Visible answer")
	}
}

func TestStripInboundMetadata(t *testing.T) {
	input := "Sender: trader\nChat: 12345\n\nwhat is trending on aster?"
	got := StripInboundMetadata(input)
	if got != "what is trending on aster?" {
		t.Fatalf("StripInboundMetadata = %q", got)
	}
}

func TestVisibleAssistantText(t *testing.T) {
	input := `{"reply":"<analysis>internal</analysis>\nBias: long BTC"}`
	got := VisibleAssistantText(input)
	if got != "Bias: long BTC" {
		t.Fatalf("VisibleAssistantText = %q", got)
	}
}
