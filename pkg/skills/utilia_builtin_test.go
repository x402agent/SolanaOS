package skills

import (
	"path/filepath"
	"testing"
)

func TestBundledUtiliaTransactionDiagnosisSkill(t *testing.T) {
	t.Parallel()

	skillDir := filepath.Join("..", "..", "skills", "utilia-solana-transaction-diagnosis")
	skill, err := loadSkillFromDir(skillDir)
	if err != nil {
		t.Fatalf("load bundled Utilia skill: %v", err)
	}

	if skill.Name != "utilia-solana-transaction-diagnosis" {
		t.Fatalf("unexpected skill name %q", skill.Name)
	}
	if skill.Version != "1.0.0" {
		t.Fatalf("unexpected skill version %q", skill.Version)
	}
	if skill.URL != "https://utilia.ink/solana-transaction-support" {
		t.Fatalf("unexpected skill URL %q", skill.URL)
	}
	if len(skill.Requires.Bins) != 1 || skill.Requires.Bins[0] != "npx" {
		t.Fatalf("unexpected binary requirements %#v", skill.Requires.Bins)
	}
	if skill.Body == "" {
		t.Fatal("skill body should not be empty")
	}
}
