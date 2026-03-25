package gateway

import (
	"reflect"
	"testing"
)

func TestBuildClaudeArgs(t *testing.T) {
	args := buildClaudeArgs(
		"Review the auth module",
		"sonnet",
		"bypassPermissions",
		"abc123",
		[]string{"Read", "Edit", "Read", "Bash(git status *)"},
		"You are a security engineer.",
	)

	want := []string{
		"-p",
		"--output-format", "stream-json",
		"--verbose",
		"--include-partial-messages",
		"--permission-mode", "bypassPermissions",
		"--model", "sonnet",
		"--allowedTools", "Read,Edit,Bash(git status *)",
		"--append-system-prompt", "You are a security engineer.",
		"--resume", "abc123",
		"Review the auth module",
	}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("buildClaudeArgs() = %#v, want %#v", args, want)
	}
}

func TestNormalizeAllowedTools(t *testing.T) {
	got := normalizeAllowedTools([]string{" Read ", "", "Edit", "Read", "Bash"})
	want := []string{"Read", "Edit", "Bash"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeAllowedTools() = %#v, want %#v", got, want)
	}
}

func TestEffectiveAllowedToolsPrefersRunOptions(t *testing.T) {
	got := effectiveAllowedTools([]string{"Read", "Bash"}, []string{"Read", "Edit"})
	want := []string{"Read", "Bash"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("effectiveAllowedTools() = %#v, want %#v", got, want)
	}

	got = effectiveAllowedTools(nil, []string{"Read", "Edit"})
	want = []string{"Read", "Edit"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("effectiveAllowedTools(session) = %#v, want %#v", got, want)
	}
}
