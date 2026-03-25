// Package acp implements the Agent Client Protocol (ACP) server for SolanaOS.
// This allows VS Code, Cursor, Zed, and other editors to use SolanaOS as a coding agent.
//
// ACP spec: https://github.com/anysphere/acp
//
// The server reads JSON-RPC requests on stdin and writes responses to stdout,
// following the same protocol that Hermes Agent uses for editor integration.
package acp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"
)

// Server implements the ACP JSON-RPC server.
type Server struct {
	tools   []ToolDef
	handler ToolHandler
	mu      sync.Mutex
	ctx     context.Context
	cancel  context.CancelFunc
}

// ToolDef describes a tool available to the editor.
type ToolDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Schema      map[string]any `json:"inputSchema,omitempty"`
}

// ToolHandler is called when the editor invokes a tool.
type ToolHandler func(ctx context.Context, name string, args map[string]any) (string, error)

// JSONRPCRequest is an incoming ACP request.
type JSONRPCRequest struct {
	JSONRPC string         `json:"jsonrpc"`
	ID      any            `json:"id"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params,omitempty"`
}

// JSONRPCResponse is an outgoing ACP response.
type JSONRPCResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id"`
	Result  any    `json:"result,omitempty"`
	Error   *Error `json:"error,omitempty"`
}

// Error is a JSON-RPC error.
type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// NewServer creates a new ACP server with the given tools and handler.
func NewServer(tools []ToolDef, handler ToolHandler) *Server {
	ctx, cancel := context.WithCancel(context.Background())
	return &Server{
		tools:   tools,
		handler: handler,
		ctx:     ctx,
		cancel:  cancel,
	}
}

// Run starts the ACP server, reading from stdin and writing to stdout.
func (s *Server) Run() error {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var req JSONRPCRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.writeError(nil, -32700, "Parse error")
			continue
		}

		s.handleRequest(&req)
	}

	return scanner.Err()
}

// Stop shuts down the server.
func (s *Server) Stop() {
	s.cancel()
}

func (s *Server) handleRequest(req *JSONRPCRequest) {
	switch req.Method {
	case "initialize":
		s.writeResult(req.ID, map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
			"serverInfo": map[string]any{
				"name":    "solanaos-agent",
				"version": "2.0.0",
			},
		})

	case "tools/list":
		toolList := make([]map[string]any, 0, len(s.tools))
		for _, t := range s.tools {
			tool := map[string]any{
				"name":        t.Name,
				"description": t.Description,
			}
			if t.Schema != nil {
				tool["inputSchema"] = t.Schema
			}
			toolList = append(toolList, tool)
		}
		s.writeResult(req.ID, map[string]any{"tools": toolList})

	case "tools/call":
		name, _ := req.Params["name"].(string)
		args, _ := req.Params["arguments"].(map[string]any)

		ctx, cancel := context.WithTimeout(s.ctx, 120*time.Second)
		defer cancel()

		result, err := s.handler(ctx, name, args)
		if err != nil {
			s.writeResult(req.ID, map[string]any{
				"content": []map[string]any{
					{"type": "text", "text": fmt.Sprintf("Error: %s", err.Error())},
				},
				"isError": true,
			})
			return
		}

		s.writeResult(req.ID, map[string]any{
			"content": []map[string]any{
				{"type": "text", "text": result},
			},
		})

	case "notifications/initialized":
		// Client ack — no response needed

	default:
		s.writeError(req.ID, -32601, fmt.Sprintf("Method not found: %s", req.Method))
	}
}

func (s *Server) writeResult(id any, result any) {
	s.write(JSONRPCResponse{JSONRPC: "2.0", ID: id, Result: result})
}

func (s *Server) writeError(id any, code int, message string) {
	s.write(JSONRPCResponse{JSONRPC: "2.0", ID: id, Error: &Error{Code: code, Message: message}})
}

func (s *Server) write(resp JSONRPCResponse) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, _ := json.Marshal(resp)
	fmt.Fprintln(os.Stdout, string(data))
}

// DefaultSolanaOSTools returns the standard ACP toolset for SolanaOS.
func DefaultSolanaOSTools() []ToolDef {
	return []ToolDef{
		{
			Name:        "terminal",
			Description: "Execute a shell command on the operator's machine",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"command": map[string]any{"type": "string", "description": "Shell command to execute"},
				},
				"required": []string{"command"},
			},
		},
		{
			Name:        "read_file",
			Description: "Read the contents of a file",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path": map[string]any{"type": "string", "description": "File path to read"},
				},
				"required": []string{"path"},
			},
		},
		{
			Name:        "write_file",
			Description: "Write content to a file",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path":    map[string]any{"type": "string", "description": "File path to write"},
					"content": map[string]any{"type": "string", "description": "Content to write"},
				},
				"required": []string{"path", "content"},
			},
		},
		{
			Name:        "search_files",
			Description: "Search for files matching a pattern",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"pattern": map[string]any{"type": "string", "description": "Glob or regex pattern"},
					"path":    map[string]any{"type": "string", "description": "Directory to search"},
				},
				"required": []string{"pattern"},
			},
		},
		{
			Name:        "solana_wallet",
			Description: "Get Solana wallet info (address, balance, recent transactions)",
			Schema: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
		{
			Name:        "solana_trending",
			Description: "Get trending Solana tokens from SolanaTracker",
			Schema: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
		{
			Name:        "solana_research",
			Description: "Deep research a Solana token by mint address",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"mint": map[string]any{"type": "string", "description": "Token mint address"},
				},
				"required": []string{"mint"},
			},
		},
		{
			Name:        "honcho_recall",
			Description: "Recall information from Honcho persistent memory",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{"type": "string", "description": "What to recall"},
				},
				"required": []string{"query"},
			},
		},
		{
			Name:        "honcho_remember",
			Description: "Save a durable fact to Honcho memory",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"fact": map[string]any{"type": "string", "description": "Fact to remember"},
				},
				"required": []string{"fact"},
			},
		},
		{
			Name:        "web_search",
			Description: "Search the web",
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{"type": "string", "description": "Search query"},
				},
				"required": []string{"query"},
			},
		},
		{
			Name:        "ooda_status",
			Description: "Get the current OODA trading loop status",
			Schema: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
		{
			Name:        "gateway_status",
			Description: "Get gateway connection status and paired devices",
			Schema: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
	}
}

// ReadInput reads from the given reader (for testing).
func (s *Server) ReadInput(r io.Reader) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var req JSONRPCRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.writeError(nil, -32700, "Parse error")
			continue
		}

		s.handleRequest(&req)
	}

	return scanner.Err()
}
