package learning

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestStore(t *testing.T) *SessionSearchStore {
	t.Helper()
	if _, err := exec.LookPath("sqlite3"); err != nil {
		t.Skip("sqlite3 CLI not installed")
	}
	s := NewSessionSearchStore(filepath.Join(t.TempDir(), "sessions.db"))
	if err := s.Init(); err != nil {
		t.Fatalf("init: %v", err)
	}
	return s
}

func TestSQLTextOnlyEmitsHex(t *testing.T) {
	for _, v := range []string{"", "plain", "it's", "'); DROP TABLE turns; --", "\n.shell id\n", "🚀 ünïcode"} {
		got := sqlText(v)
		inner := strings.TrimSuffix(strings.TrimPrefix(got, "CAST(X'"), "' AS TEXT)")
		if strings.Trim(inner, "0123456789abcdef") != "" {
			t.Fatalf("sqlText(%q) = %q contains non-hex characters", v, got)
		}
	}
}

// Regression: values were spliced into SQL with quote-doubling and passed to
// the sqlite3 CLI on argv. Hostile content must round-trip verbatim and must
// not execute SQL or CLI dot-commands.
func TestSessionSearchHostileContentRoundTrips(t *testing.T) {
	s := newTestStore(t)
	marker := filepath.Join(t.TempDir(), "pwned")
	hostile := []string{
		"x'); DROP TABLE turns; --",
		"x\"; DELETE FROM turns_fts; --",
		"line one\n.shell touch " + marker + "\nline three",
		"'' OR 1=1 --",
		"🚀 ünïcode and a backslash \\ and NUL-free",
	}
	now := time.Now().UTC()
	for i, c := range hostile {
		err := s.IndexTurn(TurnRecord{
			ID: "turn-" + string(rune('a'+i)), SessionID: "s'1", UserID: "u'1", UserName: "O'Brien",
			Channel: "telegram", Role: "user", Content: "alpha " + c, CreatedAt: now.Add(time.Duration(i) * time.Second),
		})
		if err != nil {
			t.Fatalf("index %q: %v", c, err)
		}
	}
	if _, err := exec.Command("test", "-e", marker).CombinedOutput(); err == nil {
		t.Fatal("dot-command in content was executed")
	}

	recent, err := s.Recent(50, "u'1")
	if err != nil {
		t.Fatalf("recent: %v", err)
	}
	if len(recent) != len(hostile) {
		t.Fatalf("recent returned %d turns, want %d (table damaged?)", len(recent), len(hostile))
	}
	got := map[string]bool{}
	for _, r := range recent {
		got[r.Content] = true
		if r.UserName != "O'Brien" || r.SessionID != "s'1" {
			t.Fatalf("fields not preserved: %+v", r)
		}
	}
	for _, c := range hostile {
		if !got["alpha "+c] {
			t.Fatalf("content %q not stored verbatim", c)
		}
	}

	res, err := s.Search("alpha", SearchOptions{UserID: "u'1", Limit: 50})
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(res) != len(hostile) {
		t.Fatalf("search returned %d, want %d", len(res), len(hostile))
	}
	// A user filter containing SQL must not widen the result set.
	res, err = s.Search("alpha", SearchOptions{UserID: "x' OR '1'='1", Limit: 50})
	if err != nil {
		t.Fatalf("search with hostile user filter: %v", err)
	}
	if len(res) != 0 {
		t.Fatalf("hostile user filter returned %d rows, want 0", len(res))
	}
	// A hostile query string must not error out or inject.
	if _, err := s.Search("'); DROP TABLE turns; --", SearchOptions{Limit: 5}); err != nil {
		t.Fatalf("hostile query: %v", err)
	}
	if again, _ := s.Recent(50, ""); len(again) != len(hostile) {
		t.Fatalf("table damaged after hostile query: %d rows", len(again))
	}
}

func TestIndexTurnReplacesSameID(t *testing.T) {
	s := newTestStore(t)
	for _, c := range []string{"first version", "second version"} {
		if err := s.IndexTurn(TurnRecord{ID: "same", SessionID: "s", Role: "user", Content: c}); err != nil {
			t.Fatal(err)
		}
	}
	r, err := s.Recent(10, "")
	if err != nil || len(r) != 1 || r[0].Content != "second version" {
		t.Fatalf("got %+v err=%v", r, err)
	}
}

// Regression: the script used to be passed to sqlite3 as a single argv
// argument, which Linux caps at 128 KiB (MAX_ARG_STRLEN), so long turns
// failed to index. It is now streamed on stdin.
func TestIndexTurnLargeContent(t *testing.T) {
	s := newTestStore(t)
	big := strings.Repeat("long turn content ", 20000) // ~360 KB
	if err := s.IndexTurn(TurnRecord{ID: "big", SessionID: "s", Role: "assistant", Content: big}); err != nil {
		t.Fatalf("index large turn: %v", err)
	}
	r, err := s.Recent(1, "")
	if err != nil || len(r) != 1 || r[0].Content != big {
		t.Fatalf("large turn not stored verbatim (err=%v, n=%d)", err, len(r))
	}
}
