package gateway

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/pinata"
)

// ── Mesh IPFS Sync Endpoint ─────────────────────────────────────────
// HTTP handler mounted on the gateway for receiving IPFS file sync
// notifications from other Tailscale/BLE mesh nodes.

// MeshIPFSConfig configures the mesh IPFS HTTP handler.
type MeshIPFSConfig struct {
	Hub       *pinata.Hub
	MeshSync  *pinata.MeshSync
	AuthToken string // Must match the gateway auth token
	Wallet    string // Local node's wallet address
	DeviceID  string // Local node's device ID
}

// MeshIPFSHandler handles mesh IPFS sync requests from peer nodes.
type MeshIPFSHandler struct {
	cfg MeshIPFSConfig
}

// NewMeshIPFSHandler creates the mesh IPFS handler.
func NewMeshIPFSHandler(cfg MeshIPFSConfig) *MeshIPFSHandler {
	return &MeshIPFSHandler{cfg: cfg}
}

// meshReceiveRequest is the payload from a peer node pushing a file.
type meshReceiveRequest struct {
	Type      string `json:"type"`
	FileID    string `json:"file_id"`
	CID       string `json:"cid"`
	FileName  string `json:"file_name"`
	AccessURL string `json:"access_url"`
	Wallet    string `json:"wallet"`
}

// meshNodesResponse lists mesh network peers.
type meshNodesResponse struct {
	Nodes []pinata.MeshNode `json:"nodes"`
	Self  meshSelfInfo      `json:"self"`
}

type meshSelfInfo struct {
	Wallet   string `json:"wallet"`
	DeviceID string `json:"device_id"`
}

// ServeHTTP routes mesh IPFS requests.
func (h *MeshIPFSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/mesh/receive":
		h.handleReceive(w, r)
	case "/api/mesh/nodes":
		h.handleNodes(w, r)
	case "/api/mesh/sync":
		h.handleSync(w, r)
	case "/api/mesh/upload":
		h.handleUpload(w, r)
	case "/api/mesh/recall":
		h.handleRecall(w, r)
	default:
		http.NotFound(w, r)
	}
}

// POST /api/mesh/receive — receive a file sync notification from a peer
func (h *MeshIPFSHandler) handleReceive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req meshReceiveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if req.CID == "" || req.AccessURL == "" {
		writeJSONResponse(w, http.StatusBadRequest, map[string]string{"error": "missing cid or access_url"})
		return
	}

	log.Printf("[mesh-ipfs] received file sync: %s (cid: %s) from wallet %s", req.FileName, req.CID, req.Wallet)

	// Download the file from the access URL and re-upload to our own private store
	go func() {
		ctx := r.Context()
		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Get(req.AccessURL)
		if err != nil {
			log.Printf("[mesh-ipfs] download from access url: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			log.Printf("[mesh-ipfs] download failed: %d", resp.StatusCode)
			return
		}

		_, err = h.cfg.Hub.UploadCrossIdentity(ctx, h.cfg.Wallet, "", h.cfg.DeviceID, req.FileName, resp.Body, map[string]string{
			"source":     "mesh_sync",
			"origin_cid": req.CID,
			"origin_wallet": req.Wallet,
		})
		if err != nil {
			log.Printf("[mesh-ipfs] re-upload failed: %v", err)
			return
		}

		log.Printf("[mesh-ipfs] synced %s to local store", req.FileName)
	}()

	writeJSONResponse(w, http.StatusOK, map[string]string{"status": "accepted"})
}

// GET /api/mesh/nodes — list known mesh peers
func (h *MeshIPFSHandler) handleNodes(w http.ResponseWriter, r *http.Request) {
	if h.cfg.MeshSync == nil {
		writeJSONResponse(w, http.StatusOK, meshNodesResponse{
			Self: meshSelfInfo{Wallet: h.cfg.Wallet, DeviceID: h.cfg.DeviceID},
		})
		return
	}

	writeJSONResponse(w, http.StatusOK, meshNodesResponse{
		Nodes: h.cfg.MeshSync.Nodes(),
		Self:  meshSelfInfo{Wallet: h.cfg.Wallet, DeviceID: h.cfg.DeviceID},
	})
}

// POST /api/mesh/sync — trigger file distribution to all online mesh nodes
func (h *MeshIPFSHandler) handleSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		FileID   string `json:"file_id"`
		CID      string `json:"cid"`
		FileName string `json:"file_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	if h.cfg.MeshSync != nil {
		h.cfg.MeshSync.SyncToAllOnline(req.FileID, req.CID, req.FileName, h.cfg.Wallet)
	}

	writeJSONResponse(w, http.StatusOK, map[string]string{"status": "queued"})
}

// POST /api/mesh/upload — upload a file from this node to Private IPFS
func (h *MeshIPFSHandler) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSONResponse(w, http.StatusBadRequest, map[string]string{"error": "missing file"})
		return
	}
	defer file.Close()

	result, err := h.cfg.Hub.UploadCrossIdentity(r.Context(), h.cfg.Wallet, "", h.cfg.DeviceID, header.Filename, file, map[string]string{
		"source": "mesh_upload",
	})
	if err != nil {
		writeJSONResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Auto-sync to mesh if enabled
	if h.cfg.MeshSync != nil && result != nil {
		h.cfg.MeshSync.SyncToAllOnline(result.ID, result.CID, header.Filename, h.cfg.Wallet)
	}

	writeJSONResponse(w, http.StatusOK, result)
}

// GET /api/mesh/recall?cid=... — get temporary access URL for a private file
func (h *MeshIPFSHandler) handleRecall(w http.ResponseWriter, r *http.Request) {
	cid := r.URL.Query().Get("cid")
	if cid == "" {
		writeJSONResponse(w, http.StatusBadRequest, map[string]string{"error": "missing cid"})
		return
	}

	expire := 300 // 5 min default
	url, err := h.cfg.Hub.RecallFile(r.Context(), cid, expire)
	if err != nil {
		writeJSONResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]string{
		"url":        url,
		"expires_in": fmt.Sprintf("%ds", expire),
	})
}

func writeJSONResponse(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// Ensure io is used (for future streaming support)
var _ = io.Discard
