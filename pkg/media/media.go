// Package media provides media file lifecycle management for MawdBot.
// Adapted from PicoClaw — stores, resolves, and releases media refs.
package media

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type FileMeta struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	StoredAt    time.Time `json:"stored_at"`
}

// MediaStore manages temporary media files.
type MediaStore interface {
	Store(scope, filename, contentType string, r io.Reader) (ref string, err error)
	Resolve(ref string) (path string, err error)
	ResolveWithMeta(ref string) (path string, meta FileMeta, err error)
	ReleaseAll(scope string) error
}

// DiskStore is a filesystem-backed MediaStore.
type DiskStore struct {
	mu      sync.RWMutex
	rootDir string
	refs    map[string]refEntry
}

type refEntry struct {
	path  string
	scope string
	meta  FileMeta
}

func NewDiskStore(rootDir string) *DiskStore {
	os.MkdirAll(rootDir, 0755)
	return &DiskStore{
		rootDir: rootDir,
		refs:    make(map[string]refEntry),
	}
}

func (s *DiskStore) Store(scope, filename, contentType string, r io.Reader) (string, error) {
	scopeDir := filepath.Join(s.rootDir, scope)
	if err := os.MkdirAll(scopeDir, 0755); err != nil {
		return "", err
	}

	filePath := filepath.Join(scopeDir, filename)
	f, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	n, err := io.Copy(f, r)
	if err != nil {
		return "", err
	}

	ref := fmt.Sprintf("media://%s/%s", scope, filename)

	s.mu.Lock()
	s.refs[ref] = refEntry{
		path:  filePath,
		scope: scope,
		meta: FileMeta{
			Filename:    filename,
			ContentType: contentType,
			Size:        n,
			StoredAt:    time.Now(),
		},
	}
	s.mu.Unlock()

	return ref, nil
}

func (s *DiskStore) Resolve(ref string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.refs[ref]
	if !ok {
		return "", fmt.Errorf("media ref not found: %s", ref)
	}
	return entry.path, nil
}

func (s *DiskStore) ResolveWithMeta(ref string) (string, FileMeta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.refs[ref]
	if !ok {
		return "", FileMeta{}, fmt.Errorf("media ref not found: %s", ref)
	}
	return entry.path, entry.meta, nil
}

func (s *DiskStore) ReleaseAll(scope string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for ref, entry := range s.refs {
		if entry.scope == scope {
			os.Remove(entry.path)
			delete(s.refs, ref)
		}
	}

	scopeDir := filepath.Join(s.rootDir, scope)
	os.RemoveAll(scopeDir)
	return nil
}
