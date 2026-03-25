package pinata

import (
	"context"
	"fmt"
	"io"
	"log"
	"sync"
)

// ── SolanaOS Hub ────────────────────────────────────────────────────
// High-level orchestrator that ties Pinata Private IPFS to Solana wallets,
// GitHub accounts, Convex users, Seeker devices, and Tailscale mesh nodes.

// Hub is the SolanaOS IPFS hub that manages per-identity file namespaces.
type Hub struct {
	client *Client
	mu     sync.RWMutex
	// Cache wallet group IDs to avoid repeated API calls
	walletGroups map[string]string
	userGroups   map[string]string
	deviceGroups map[string]string
}

// NewHub creates a hub from Pinata config.
func NewHub(cfg Config) *Hub {
	return &Hub{
		client:       New(cfg),
		walletGroups: make(map[string]string),
		userGroups:   make(map[string]string),
		deviceGroups: make(map[string]string),
	}
}

// Client returns the underlying Pinata client.
func (h *Hub) Client() *Client { return h.client }

// ── Identity-Scoped Uploads ─────────────────────────────────────────

// UploadForWallet uploads a file to Private IPFS scoped to a Solana wallet.
func (h *Hub) UploadForWallet(ctx context.Context, wallet, filename string, data io.Reader, extra map[string]string) (*UploadResult, error) {
	groupID, err := h.resolveWalletGroup(ctx, wallet)
	if err != nil {
		return nil, fmt.Errorf("hub: resolve wallet group: %w", err)
	}

	return h.client.Upload(ctx, filename, data, UploadOpts{
		Name:          filename,
		Network:       "private",
		GroupID:       groupID,
		WalletAddress: wallet,
		ExtraKV:       extra,
	})
}

// UploadForUser uploads a file scoped to a GitHub user.
func (h *Hub) UploadForUser(ctx context.Context, githubUser, filename string, data io.Reader, extra map[string]string) (*UploadResult, error) {
	groupID, err := h.resolveUserGroup(ctx, githubUser)
	if err != nil {
		return nil, fmt.Errorf("hub: resolve user group: %w", err)
	}

	return h.client.Upload(ctx, filename, data, UploadOpts{
		Name:       filename,
		Network:    "private",
		GroupID:    groupID,
		GitHubUser: githubUser,
		ExtraKV:    extra,
	})
}

// UploadForDevice uploads a file scoped to a Seeker/mesh device.
func (h *Hub) UploadForDevice(ctx context.Context, deviceID, filename string, data io.Reader, extra map[string]string) (*UploadResult, error) {
	groupID, err := h.resolveDeviceGroup(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("hub: resolve device group: %w", err)
	}

	return h.client.Upload(ctx, filename, data, UploadOpts{
		Name:     filename,
		Network:  "private",
		GroupID:  groupID,
		DeviceID: deviceID,
		ExtraKV:  extra,
	})
}

// UploadCrossIdentity uploads scoped to both wallet + github + device.
func (h *Hub) UploadCrossIdentity(ctx context.Context, wallet, githubUser, deviceID, filename string, data io.Reader, extra map[string]string) (*UploadResult, error) {
	// Use wallet group as primary, tag all identities in keyvalues
	groupID := ""
	if wallet != "" {
		gid, err := h.resolveWalletGroup(ctx, wallet)
		if err != nil {
			log.Printf("hub: wallet group fallback: %v", err)
		} else {
			groupID = gid
		}
	}

	return h.client.Upload(ctx, filename, data, UploadOpts{
		Name:          filename,
		Network:       "private",
		GroupID:       groupID,
		WalletAddress: wallet,
		GitHubUser:    githubUser,
		DeviceID:      deviceID,
		ExtraKV:       extra,
	})
}

// ── Identity-Scoped Listing ─────────────────────────────────────────

// ListForWallet lists private files belonging to a Solana wallet.
func (h *Hub) ListForWallet(ctx context.Context, wallet string, limit int) (*ListResult, error) {
	return h.client.List(ctx, ListOpts{
		Network:       "private",
		WalletAddress: wallet,
		Limit:         limit,
	})
}

// ListForUser lists private files belonging to a GitHub user.
func (h *Hub) ListForUser(ctx context.Context, githubUser string, limit int) (*ListResult, error) {
	return h.client.List(ctx, ListOpts{
		Network:    "private",
		GitHubUser: githubUser,
		Limit:      limit,
	})
}

// ── Recall (Access Links) ───────────────────────────────────────────

// RecallFile creates a temporary access link for a private file.
func (h *Hub) RecallFile(ctx context.Context, cid string, expireSeconds int) (string, error) {
	return h.client.CreateAccessLink(ctx, AccessLinkOpts{
		CID:     cid,
		Expires: expireSeconds,
	})
}

// ── Group Resolution (cached) ───────────────────────────────────────

func (h *Hub) resolveWalletGroup(ctx context.Context, wallet string) (string, error) {
	h.mu.RLock()
	if gid, ok := h.walletGroups[wallet]; ok {
		h.mu.RUnlock()
		return gid, nil
	}
	h.mu.RUnlock()

	group, err := h.client.EnsureWalletGroup(ctx, wallet)
	if err != nil {
		return "", err
	}

	h.mu.Lock()
	h.walletGroups[wallet] = group.ID
	h.mu.Unlock()
	return group.ID, nil
}

func (h *Hub) resolveUserGroup(ctx context.Context, githubUser string) (string, error) {
	h.mu.RLock()
	if gid, ok := h.userGroups[githubUser]; ok {
		h.mu.RUnlock()
		return gid, nil
	}
	h.mu.RUnlock()

	group, err := h.client.EnsureUserGroup(ctx, githubUser)
	if err != nil {
		return "", err
	}

	h.mu.Lock()
	h.userGroups[githubUser] = group.ID
	h.mu.Unlock()
	return group.ID, nil
}

func (h *Hub) resolveDeviceGroup(ctx context.Context, deviceID string) (string, error) {
	h.mu.RLock()
	if gid, ok := h.deviceGroups[deviceID]; ok {
		h.mu.RUnlock()
		return gid, nil
	}
	h.mu.RUnlock()

	group, err := h.client.EnsureDeviceGroup(ctx, deviceID)
	if err != nil {
		return "", err
	}

	h.mu.Lock()
	h.deviceGroups[deviceID] = group.ID
	h.mu.Unlock()
	return group.ID, nil
}
