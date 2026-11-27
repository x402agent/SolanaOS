package skills

import (
	"strings"
	"testing"
	"time"
)

func TestBuildBirthManifestIncludesDefaultSources(t *testing.T) {
	manifest := BuildBirthManifest(time.Unix(0, 0), nil)
	if len(manifest.Sources) != 2 {
		t.Fatalf("sources len = %d, want 2", len(manifest.Sources))
	}
	if len(manifest.Commands) != 2 {
		t.Fatalf("commands len = %d, want 2", len(manifest.Commands))
	}
	if got := strings.Join(manifest.Commands[0], " "); !strings.Contains(got, DefaultClawdSkillsRepo) || !strings.Contains(got, "--all") {
		t.Fatalf("unexpected first command: %s", got)
	}
}
