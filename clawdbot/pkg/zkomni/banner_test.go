package zkomni

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

func TestBannerContainsAgentID(t *testing.T) {
	t.Parallel()
	if !strings.Contains(Banner, AgentID) {
		t.Fatalf("Banner missing %q", AgentID)
	}
	if !strings.Contains(strings.ToLower(Banner), "shark of all streets") {
		t.Fatal("Banner missing shark of all streets")
	}
}

func TestFramesAligned(t *testing.T) {
	t.Parallel()
	if len(Frames) < 2 {
		t.Fatal("need a swim cycle")
	}
	want := strings.Count(Frames[0], "\n")
	if want < 8 {
		t.Fatalf("frame too short: %d lines", want)
	}
	for i, frame := range Frames {
		got := strings.Count(frame, "\n")
		if got != want {
			t.Fatalf("frame %d has %d newlines, want %d", i, got, want)
		}
		if !strings.Contains(frame, AgentID) {
			t.Fatalf("frame %d missing %q", i, AgentID)
		}
	}
}

func TestPlayStatic(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	if err := Play(&buf, 1, 0); err != nil {
		t.Fatal(err)
	}
	if buf.String() != Banner {
		t.Fatal("delay<=0 should write Banner")
	}
}

func TestPlayCycles(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	if err := Play(&buf, 1, time.Millisecond); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if !strings.Contains(out, AgentID) {
		t.Fatal("Play output missing agent id")
	}
	if strings.Count(out, AgentID) < len(Frames) {
		t.Fatalf("expected each frame once, got %q", out)
	}
}
