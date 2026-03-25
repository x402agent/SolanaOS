package seeker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/pinata"
)

// ── IPFS Bridge Commands for Seeker/Android ─────────────────────────
// Extends the Seeker BridgeClient with IPFS operations that work
// across the Solana Seeker mobile app, Android app, and mesh network.

// IPFSBridge wraps a Pinata hub for Seeker device operations.
type IPFSBridge struct {
	hub    *pinata.Hub
	bridge *BridgeClient
	wallet string
	device string
}

// NewIPFSBridge creates an IPFS bridge for a Seeker device.
func NewIPFSBridge(hub *pinata.Hub, bridge *BridgeClient, wallet, deviceID string) *IPFSBridge {
	return &IPFSBridge{
		hub:    hub,
		bridge: bridge,
		wallet: wallet,
		device: deviceID,
	}
}

// ── Upload from Device ──────────────────────────────────────────────

// UploadFromDevice uploads a file from the Seeker/Android device to Private IPFS.
func (ib *IPFSBridge) UploadFromDevice(ctx context.Context, filename string, data io.Reader) (*pinata.UploadResult, error) {
	return ib.hub.UploadCrossIdentity(ctx, ib.wallet, "", ib.device, filename, data, map[string]string{
		"source":   "seeker",
		"platform": "android",
	})
}

// UploadDevicePhoto captures a photo from the device camera and uploads it.
func (ib *IPFSBridge) UploadDevicePhoto(ctx context.Context, cameraFacing string) (*pinata.UploadResult, error) {
	// Request photo capture from Android bridge
	payload, _ := json.Marshal(map[string]string{
		"facing": cameraFacing,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		ib.bridge.baseURL+"/api/camera/capture", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("ipfs bridge: camera request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := ib.bridge.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ipfs bridge: camera capture: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ipfs bridge: camera failed (%d): %s", resp.StatusCode, string(body))
	}

	filename := fmt.Sprintf("seeker-photo-%d.jpg", time.Now().Unix())
	return ib.hub.UploadCrossIdentity(ctx, ib.wallet, "", ib.device, filename, resp.Body, map[string]string{
		"source":   "seeker-camera",
		"facing":   cameraFacing,
		"platform": "android",
	})
}

// ── List & Recall ───────────────────────────────────────────────────

// ListDeviceFiles lists files uploaded from this device.
func (ib *IPFSBridge) ListDeviceFiles(ctx context.Context, limit int) (*pinata.ListResult, error) {
	return ib.hub.Client().List(ctx, pinata.ListOpts{
		Network:       "private",
		WalletAddress: ib.wallet,
		Limit:         limit,
	})
}

// RecallFile generates a temporary access URL for a private file.
func (ib *IPFSBridge) RecallFile(ctx context.Context, cid string, expireSeconds int) (string, error) {
	return ib.hub.RecallFile(ctx, cid, expireSeconds)
}

// ── Presigned Upload (for direct mobile upload) ─────────────────────

// GetPresignedUploadURL creates a temporary upload URL that the Android app
// can use to upload directly to Pinata without exposing the JWT.
func (ib *IPFSBridge) GetPresignedUploadURL(ctx context.Context, expireSeconds int) (string, error) {
	return ib.hub.CreatePresignedUpload(ctx, ib.wallet, "", expireSeconds)
}

// ── Bridge HTTP Handler (for Android app requests) ──────────────────

// IPFSHandler is an HTTP handler that the Seeker daemon exposes for the
// Android app to interact with IPFS. The Android app calls these endpoints
// over localhost.
type IPFSHandler struct {
	bridge *IPFSBridge
}

// NewIPFSHandler creates the HTTP handler.
func NewIPFSHandler(bridge *IPFSBridge) *IPFSHandler {
	return &IPFSHandler{bridge: bridge}
}

// ServeHTTP routes IPFS requests from the Android app.
func (h *IPFSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	switch r.URL.Path {
	case "/api/ipfs/upload":
		h.handleUpload(ctx, w, r)
	case "/api/ipfs/list":
		h.handleList(ctx, w, r)
	case "/api/ipfs/recall":
		h.handleRecall(ctx, w, r)
	case "/api/ipfs/presign":
		h.handlePresign(ctx, w, r)
	default:
		http.NotFound(w, r)
	}
}

func (h *IPFSHandler) handleUpload(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing file"})
		return
	}
	defer file.Close()

	result, err := h.bridge.UploadFromDevice(ctx, header.Filename, file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *IPFSHandler) handleList(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	limit := 50
	result, err := h.bridge.ListDeviceFiles(ctx, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *IPFSHandler) handleRecall(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	cid := r.URL.Query().Get("cid")
	if cid == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing cid"})
		return
	}

	url, err := h.bridge.RecallFile(ctx, cid, 300)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (h *IPFSHandler) handlePresign(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	url, err := h.bridge.GetPresignedUploadURL(ctx, 120)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
