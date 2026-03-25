package pinata

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// ── Tailscale + BLE Mesh File Sync ──────────────────────────────────
// Coordinates file distribution across Tailscale mesh network nodes
// and Bluetooth LE connections for Solana Seeker + Android devices.

// MeshNode represents a peer in the Tailscale/BLE mesh.
type MeshNode struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	IP         string `json:"ip"`
	OS         string `json:"os"`
	Online     bool   `json:"online"`
	IsBLE      bool   `json:"is_ble"`       // Connected via Bluetooth LE
	IsSeeker   bool   `json:"is_seeker"`    // Solana Seeker device
	LastSeen   int64  `json:"last_seen"`
	SyncStatus string `json:"sync_status"` // "synced", "pending", "error"
}

// MeshSync manages file synchronization across the mesh network.
type MeshSync struct {
	hub       *Hub
	mu        sync.RWMutex
	nodes     map[string]*MeshNode
	syncQueue chan syncJob
	stop      chan struct{}
}

type syncJob struct {
	FileID    string
	CID       string
	FileName  string
	TargetIDs []string // node IDs to sync to
	Wallet    string
}

// NewMeshSync creates a mesh file synchronizer.
func NewMeshSync(hub *Hub) *MeshSync {
	return &MeshSync{
		hub:       hub,
		nodes:     make(map[string]*MeshNode),
		syncQueue: make(chan syncJob, 100),
		stop:      make(chan struct{}),
	}
}

// Start begins the mesh sync background worker.
func (m *MeshSync) Start() {
	go m.syncWorker()
	go m.discoveryLoop()
}

// Stop halts the mesh sync.
func (m *MeshSync) Stop() {
	close(m.stop)
}

// ── Node Discovery ──────────────────────────────────────────────────

// DiscoverTailscaleNodes finds peers on the Tailscale network.
func (m *MeshSync) DiscoverTailscaleNodes() ([]MeshNode, error) {
	out, err := exec.Command("tailscale", "status", "--json").Output()
	if err != nil {
		return nil, fmt.Errorf("mesh: tailscale status: %w", err)
	}

	var status struct {
		Peer map[string]struct {
			HostName  string   `json:"HostName"`
			TailscaleIPs []string `json:"TailscaleIPs"`
			OS        string   `json:"OS"`
			Online    bool     `json:"Online"`
		} `json:"Peer"`
		Self struct {
			HostName     string   `json:"HostName"`
			TailscaleIPs []string `json:"TailscaleIPs"`
		} `json:"Self"`
	}
	if err := json.Unmarshal(out, &status); err != nil {
		return nil, fmt.Errorf("mesh: parse tailscale status: %w", err)
	}

	var nodes []MeshNode
	for id, peer := range status.Peer {
		ip := ""
		if len(peer.TailscaleIPs) > 0 {
			ip = peer.TailscaleIPs[0]
		}
		isSeeker := strings.Contains(strings.ToLower(peer.OS), "android") ||
			strings.Contains(strings.ToLower(peer.HostName), "seeker")

		node := MeshNode{
			ID:       id,
			Name:     peer.HostName,
			IP:       ip,
			OS:       peer.OS,
			Online:   peer.Online,
			IsSeeker: isSeeker,
			LastSeen: time.Now().Unix(),
		}
		nodes = append(nodes, node)

		m.mu.Lock()
		m.nodes[id] = &node
		m.mu.Unlock()
	}

	return nodes, nil
}

// DiscoverBLEDevices scans for Bluetooth LE SolanaOS devices.
// Returns discovered device IDs. Actual BLE scanning is delegated to
// the Android bridge or native BLE scanner on the host.
func (m *MeshSync) DiscoverBLEDevices(ctx context.Context, bridgeAddr string) ([]MeshNode, error) {
	if bridgeAddr == "" {
		bridgeAddr = "127.0.0.1:8765"
	}

	// Send BLE scan command to the Seeker bridge
	payload, _ := json.Marshal(map[string]string{
		"type":    "ble_scan",
		"service": "solanaos-mesh",
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("http://%s/api/ble/scan", bridgeAddr), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("mesh: ble scan request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("mesh: ble scan: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Devices []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			RSSI int    `json:"rssi"`
		} `json:"devices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("mesh: decode ble scan: %w", err)
	}

	var nodes []MeshNode
	for _, dev := range result.Devices {
		node := MeshNode{
			ID:       dev.ID,
			Name:     dev.Name,
			IsBLE:    true,
			IsSeeker: strings.Contains(strings.ToLower(dev.Name), "seeker"),
			Online:   true,
			LastSeen: time.Now().Unix(),
		}
		nodes = append(nodes, node)

		m.mu.Lock()
		m.nodes[dev.ID] = &node
		m.mu.Unlock()
	}

	return nodes, nil
}

// ── File Distribution ───────────────────────────────────────────────

// SyncToNodes queues a file for distribution to specific mesh nodes.
func (m *MeshSync) SyncToNodes(fileID, cid, fileName, wallet string, nodeIDs []string) {
	select {
	case m.syncQueue <- syncJob{
		FileID:    fileID,
		CID:       cid,
		FileName:  fileName,
		TargetIDs: nodeIDs,
		Wallet:    wallet,
	}:
	default:
		log.Printf("mesh: sync queue full, dropping job for %s", fileID)
	}
}

// SyncToAllOnline queues a file for distribution to all online nodes.
func (m *MeshSync) SyncToAllOnline(fileID, cid, fileName, wallet string) {
	m.mu.RLock()
	var ids []string
	for id, node := range m.nodes {
		if node.Online {
			ids = append(ids, id)
		}
	}
	m.mu.RUnlock()

	if len(ids) > 0 {
		m.SyncToNodes(fileID, cid, fileName, wallet, ids)
	}
}

// Nodes returns currently known mesh nodes.
func (m *MeshSync) Nodes() []MeshNode {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]MeshNode, 0, len(m.nodes))
	for _, n := range m.nodes {
		out = append(out, *n)
	}
	return out
}

// ── Background Workers ──────────────────────────────────────────────

func (m *MeshSync) syncWorker() {
	for {
		select {
		case <-m.stop:
			return
		case job := <-m.syncQueue:
			m.executeSync(job)
		}
	}
}

func (m *MeshSync) executeSync(job syncJob) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Generate a temporary access link for the file
	accessURL, err := m.hub.RecallFile(ctx, job.CID, 600) // 10 min link
	if err != nil {
		log.Printf("mesh: access link for %s: %v", job.CID, err)
		return
	}

	// Push file notification to each target node
	for _, nodeID := range job.TargetIDs {
		m.mu.RLock()
		node, ok := m.nodes[nodeID]
		m.mu.RUnlock()
		if !ok || !node.Online {
			continue
		}

		if node.IsBLE {
			m.syncViaBLE(ctx, node, job, accessURL)
		} else if node.IP != "" {
			m.syncViaTailscale(ctx, node, job, accessURL)
		}
	}
}

func (m *MeshSync) syncViaTailscale(ctx context.Context, node *MeshNode, job syncJob, accessURL string) {
	payload, _ := json.Marshal(map[string]string{
		"type":       "ipfs_file_sync",
		"file_id":    job.FileID,
		"cid":        job.CID,
		"file_name":  job.FileName,
		"access_url": accessURL,
		"wallet":     job.Wallet,
	})

	addr := net.JoinHostPort(node.IP, "18790") // SolanaOS gateway port
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("http://%s/api/mesh/receive", addr), bytes.NewReader(payload))
	if err != nil {
		log.Printf("mesh: sync to %s: %v", node.Name, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		log.Printf("mesh: sync to %s failed: %v", node.Name, err)
		m.mu.Lock()
		node.SyncStatus = "error"
		m.mu.Unlock()
		return
	}
	resp.Body.Close()

	m.mu.Lock()
	node.SyncStatus = "synced"
	m.mu.Unlock()
	log.Printf("mesh: synced %s to %s via Tailscale", job.FileName, node.Name)
}

func (m *MeshSync) syncViaBLE(ctx context.Context, node *MeshNode, job syncJob, accessURL string) {
	// BLE sync sends a compact notification with the access URL
	// The receiving device fetches the file over its own network connection
	payload, _ := json.Marshal(map[string]string{
		"type":       "ipfs_ble_notify",
		"file_id":    job.FileID,
		"cid":        job.CID,
		"file_name":  job.FileName,
		"access_url": accessURL,
		"wallet":     job.Wallet,
	})

	// Send via local BLE bridge (Android bridge handles actual BLE write)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"http://127.0.0.1:8765/api/ble/send", bytes.NewReader(payload))
	if err != nil {
		log.Printf("mesh: ble sync to %s: %v", node.Name, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	q := req.URL.Query()
	q.Set("device_id", node.ID)
	req.URL.RawQuery = q.Encode()

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		log.Printf("mesh: ble sync to %s failed: %v", node.Name, err)
		return
	}
	resp.Body.Close()

	m.mu.Lock()
	node.SyncStatus = "synced"
	m.mu.Unlock()
	log.Printf("mesh: synced %s to %s via BLE", job.FileName, node.Name)
}

func (m *MeshSync) discoveryLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	// Initial discovery
	if _, err := m.DiscoverTailscaleNodes(); err != nil {
		log.Printf("mesh: initial tailscale discovery: %v", err)
	}

	for {
		select {
		case <-m.stop:
			return
		case <-ticker.C:
			if _, err := m.DiscoverTailscaleNodes(); err != nil {
				log.Printf("mesh: tailscale discovery: %v", err)
			}
		}
	}
}

// ── Presigned Upload URL (for mobile/Seeker) ────────────────────────

// CreatePresignedUpload generates a temporary upload URL for mobile clients.
// The Seeker or Android app uses this to upload directly to Pinata without
// exposing the JWT on-device.
func (h *Hub) CreatePresignedUpload(ctx context.Context, wallet, githubUser string, expireSeconds int) (string, error) {
	if expireSeconds <= 0 {
		expireSeconds = 120
	}

	groupID := ""
	if wallet != "" {
		gid, err := h.resolveWalletGroup(ctx, wallet)
		if err == nil {
			groupID = gid
		}
	}

	kv := make(map[string]string)
	if wallet != "" {
		kv["solana_wallet"] = wallet
	}
	if githubUser != "" {
		kv["github_user"] = githubUser
	}

	payload := map[string]interface{}{
		"expires": expireSeconds,
	}
	if groupID != "" {
		payload["groupId"] = groupID
	}
	if len(kv) > 0 {
		payload["keyvalues"] = kv
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/files/sign", apiBaseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("hub: presigned upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+h.client.cfg.JWT)
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.client.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("hub: presigned upload: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("hub: presigned upload failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Data string `json:"data"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("hub: decode presigned url: %w", err)
	}
	return result.Data, nil
}
