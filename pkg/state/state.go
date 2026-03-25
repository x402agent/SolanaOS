// Package state manages persistent agent state for MawdBot.
// Adapted from PicoClaw — atomic file writes for last-channel tracking.
package state

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type AgentState struct {
	LastChannel string `json:"last_channel"`
	LastChatID  string `json:"last_chat_id"`
}

type Manager struct {
	mu       sync.Mutex
	rootDir  string
	state    AgentState
	filePath string
}

func NewManager(workspaceDir string) *Manager {
	stateDir := filepath.Join(workspaceDir, "state")
	os.MkdirAll(stateDir, 0755)
	fp := filepath.Join(stateDir, "agent_state.json")

	m := &Manager{
		rootDir:  stateDir,
		filePath: fp,
	}
	m.load()
	return m
}

func (m *Manager) load() {
	data, err := os.ReadFile(m.filePath)
	if err != nil {
		return
	}
	json.Unmarshal(data, &m.state)
}

func (m *Manager) save() error {
	data, err := json.MarshalIndent(m.state, "", "  ")
	if err != nil {
		return err
	}
	tmpFile := m.filePath + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmpFile, m.filePath)
}

func (m *Manager) SetLastChannel(channel string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state.LastChannel = channel
	return m.save()
}

func (m *Manager) SetLastChatID(chatID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state.LastChatID = chatID
	return m.save()
}

func (m *Manager) GetLastChannel() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state.LastChannel
}

func (m *Manager) GetState() AgentState {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state
}
