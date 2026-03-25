package learning

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type TurnRecord struct {
	ID        string
	SessionID string
	UserID    string
	UserName  string
	Channel   string
	Role      string
	Content   string
	Summary   string
	Intent    string
	Metadata  map[string]string
	CreatedAt time.Time
}

type SearchResult struct {
	ID          string `json:"id"`
	SessionID   string `json:"session_id"`
	UserID      string `json:"user_id"`
	UserName    string `json:"user_name"`
	Channel     string `json:"channel"`
	Role        string `json:"role"`
	Content     string `json:"content"`
	Summary     string `json:"summary"`
	Intent      string `json:"intent"`
	CreatedAtMS int64  `json:"created_at_ms"`
}

type SearchOptions struct {
	UserID string
	Limit  int
}

type SessionSearchStore struct {
	dbPath string
	mu     sync.Mutex
}

func NewSessionSearchStore(dbPath string) *SessionSearchStore {
	return &SessionSearchStore{dbPath: dbPath}
}

func (s *SessionSearchStore) Init() error {
	if s == nil {
		return nil
	}
	if _, err := exec.LookPath("sqlite3"); err != nil {
		return fmt.Errorf("sqlite3 binary not found in PATH")
	}
	if err := os.MkdirAll(filepath.Dir(s.dbPath), 0o755); err != nil {
		return err
	}

	schema := `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS turns (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	user_id TEXT,
	user_name TEXT,
	channel TEXT,
	role TEXT NOT NULL,
	content TEXT NOT NULL,
	summary TEXT,
	intent TEXT,
	metadata_json TEXT,
	created_at_ms INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
	id UNINDEXED,
	content,
	summary,
	intent,
	user_name
);
CREATE INDEX IF NOT EXISTS idx_turns_created_at ON turns(created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_turns_user_created_at ON turns(user_id, created_at_ms DESC);
`
	_, err := s.runSQL(schema)
	return err
}

func (s *SessionSearchStore) IndexTurn(turn TurnRecord) error {
	if s == nil {
		return nil
	}
	if turn.CreatedAt.IsZero() {
		turn.CreatedAt = time.Now().UTC()
	}
	if strings.TrimSpace(turn.ID) == "" {
		turn.ID = buildTurnID(turn.SessionID, turn.Role, turn.Content, turn.CreatedAt)
	}
	if strings.TrimSpace(turn.Summary) == "" {
		turn.Summary = HeuristicSummary(turn.Content)
	}

	metadataJSON := "{}"
	if len(turn.Metadata) > 0 {
		if encoded, err := json.Marshal(turn.Metadata); err == nil {
			metadataJSON = string(encoded)
		}
	}

	sql := fmt.Sprintf(`
DELETE FROM turns WHERE id = '%s';
DELETE FROM turns_fts WHERE id = '%s';
INSERT INTO turns (
	id, session_id, user_id, user_name, channel, role, content, summary, intent, metadata_json, created_at_ms
) VALUES (
	'%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', %d
);
INSERT INTO turns_fts (id, content, summary, intent, user_name) VALUES (
	'%s', '%s', '%s', '%s', '%s'
);
`,
		sqliteQuote(turn.ID),
		sqliteQuote(turn.ID),
		sqliteQuote(turn.ID),
		sqliteQuote(turn.SessionID),
		sqliteQuote(turn.UserID),
		sqliteQuote(turn.UserName),
		sqliteQuote(turn.Channel),
		sqliteQuote(turn.Role),
		sqliteQuote(turn.Content),
		sqliteQuote(turn.Summary),
		sqliteQuote(turn.Intent),
		sqliteQuote(metadataJSON),
		turn.CreatedAt.UnixMilli(),
		sqliteQuote(turn.ID),
		sqliteQuote(turn.Content),
		sqliteQuote(turn.Summary),
		sqliteQuote(turn.Intent),
		sqliteQuote(turn.UserName),
	)

	_, err := s.runSQL(sql)
	return err
}

func (s *SessionSearchStore) Search(query string, opts SearchOptions) ([]SearchResult, error) {
	if s == nil {
		return nil, nil
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return []SearchResult{}, nil
	}
	limit := opts.Limit
	if limit <= 0 {
		limit = 5
	}

	whereUser := ""
	if strings.TrimSpace(opts.UserID) != "" {
		whereUser = fmt.Sprintf("AND t.user_id = '%s'", sqliteQuote(opts.UserID))
	}

	sql := fmt.Sprintf(`
SELECT COALESCE(json_group_array(json_object(
	'id', id,
	'session_id', session_id,
	'user_id', user_id,
	'user_name', user_name,
	'channel', channel,
	'role', role,
	'content', content,
	'summary', summary,
	'intent', intent,
	'created_at_ms', created_at_ms
)), '[]')
FROM (
	SELECT
		t.id,
		t.session_id,
		t.user_id,
		t.user_name,
		t.channel,
		t.role,
		t.content,
		t.summary,
		t.intent,
		t.created_at_ms
	FROM turns t
	JOIN turns_fts ON turns_fts.id = t.id
	WHERE turns_fts MATCH '%s'
	%s
	ORDER BY t.created_at_ms DESC
	LIMIT %d
);
`, sqliteQuote(ftsQuery(query)), whereUser, limit)

	raw, err := s.runSQL(sql)
	if err != nil {
		return nil, err
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []SearchResult{}, nil
	}

	var results []SearchResult
	if err := json.Unmarshal([]byte(raw), &results); err != nil {
		return nil, fmt.Errorf("decode search results: %w", err)
	}
	return results, nil
}

func (s *SessionSearchStore) Recent(limit int, userID string) ([]SearchResult, error) {
	if s == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 10
	}
	whereUser := ""
	if strings.TrimSpace(userID) != "" {
		whereUser = fmt.Sprintf("WHERE user_id = '%s'", sqliteQuote(userID))
	}
	sql := fmt.Sprintf(`
SELECT COALESCE(json_group_array(json_object(
	'id', id,
	'session_id', session_id,
	'user_id', user_id,
	'user_name', user_name,
	'channel', channel,
	'role', role,
	'content', content,
	'summary', summary,
	'intent', intent,
	'created_at_ms', created_at_ms
)), '[]')
FROM (
	SELECT id, session_id, user_id, user_name, channel, role, content, summary, intent, created_at_ms
	FROM turns
	%s
	ORDER BY created_at_ms DESC
	LIMIT %d
);
`, whereUser, limit)
	raw, err := s.runSQL(sql)
	if err != nil {
		return nil, err
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []SearchResult{}, nil
	}
	var results []SearchResult
	if err := json.Unmarshal([]byte(raw), &results); err != nil {
		return nil, fmt.Errorf("decode recent turns: %w", err)
	}
	return results, nil
}

func (r SearchResult) SummaryOrContent() string {
	if strings.TrimSpace(r.Summary) != "" {
		return r.Summary
	}
	return HeuristicSummary(r.Content)
}

func (r SearchResult) CreatedAt() time.Time {
	return time.UnixMilli(r.CreatedAtMS).UTC()
}

func (s *SessionSearchStore) runSQL(sql string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cmd := exec.Command("sqlite3", s.dbPath, sql)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("sqlite3: %v: %s", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

func sqliteQuote(v string) string {
	return strings.ReplaceAll(v, "'", "''")
}

func ftsQuery(query string) string {
	parts := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return !(r == '_' || r == '-' || unicodeLetterDigit(r))
	})
	if len(parts) == 0 {
		return `""`
	}
	clauses := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		clauses = append(clauses, fmt.Sprintf(`"%s"*`, strings.ReplaceAll(part, `"`, `""`)))
	}
	if len(clauses) == 0 {
		return `""`
	}
	return strings.Join(clauses, " OR ")
}

func buildTurnID(sessionID, role, content string, createdAt time.Time) string {
	h := fnv.New32a()
	_, _ = h.Write([]byte(sessionID))
	_, _ = h.Write([]byte(role))
	_, _ = h.Write([]byte(content))
	return fmt.Sprintf("%s-%s-%d-%08x", safeSlug(sessionID), safeSlug(role), createdAt.UnixMilli(), h.Sum32())
}

func unicodeLetterDigit(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || (r >= 'A' && r <= 'Z')
}
