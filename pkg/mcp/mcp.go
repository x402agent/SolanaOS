// Package mcp provides Model Context Protocol integration for MawdBot.
// Adapted from PicoClaw — manages MCP server connections and tool proxying.
package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

type MCPTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

type ServerConnection struct {
	Name    string    `json:"name"`
	URL     string    `json:"url"`
	Tools   []MCPTool `json:"tools"`
	Running bool      `json:"running"`
}

type MCPConfig struct {
	Enabled   bool                     `json:"enabled"`
	Servers   map[string]ServerConfig  `json:"servers"`
	Discovery DiscoveryConfig          `json:"discovery"`
}

type ServerConfig struct {
	Command string            `json:"command"`
	Args    []string          `json:"args"`
	Env     map[string]string `json:"env"`
	URL     string            `json:"url"`
}

type DiscoveryConfig struct {
	Enabled          bool `json:"enabled"`
	UseBM25          bool `json:"use_bm25"`
	UseRegex         bool `json:"use_regex"`
	TTL              int  `json:"ttl"`
	MaxSearchResults int  `json:"max_search_results"`
}

type Manager struct {
	mu      sync.RWMutex
	servers map[string]*ServerConnection
}

func NewManager() *Manager {
	return &Manager{servers: make(map[string]*ServerConnection)}
}

func (m *Manager) LoadFromConfig(ctx context.Context, cfg MCPConfig, workspace string) error {
	if !cfg.Enabled {
		return nil
	}

	for name, sc := range cfg.Servers {
		conn := &ServerConnection{
			Name: name,
			URL:  sc.URL,
		}
		// In production: start the MCP server process and discover tools
		m.mu.Lock()
		m.servers[name] = conn
		m.mu.Unlock()
	}

	return nil
}

func (m *Manager) GetServers() map[string]*ServerConnection {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]*ServerConnection, len(m.servers))
	for k, v := range m.servers {
		result[k] = v
	}
	return result
}

func (m *Manager) CallTool(ctx context.Context, server, tool string, input map[string]any) (string, error) {
	m.mu.RLock()
	_, ok := m.servers[server]
	m.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("MCP server not found: %s", server)
	}
	// In production: forward the tool call to the MCP server via stdio/SSE
	return fmt.Sprintf("[mcp] %s/%s called (stub)", server, tool), nil
}

func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// In production: stop all MCP server processes
	m.servers = make(map[string]*ServerConnection)
	return nil
}
