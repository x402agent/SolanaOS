package pinata

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ── Groups ──────────────────────────────────────────────────────────
// Groups organize files per wallet/user/device on Private IPFS.

// Group represents a Pinata file group.
type Group struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

type groupResponse struct {
	Data Group `json:"data"`
}

type groupListResponse struct {
	Data struct {
		Groups []Group `json:"groups"`
	} `json:"data"`
}

// CreateGroup creates a private or public group.
func (c *Client) CreateGroup(ctx context.Context, network, name string) (*Group, error) {
	if network == "" {
		network = "private"
	}

	payload, _ := json.Marshal(map[string]string{"name": name})
	url := fmt.Sprintf("%s/groups/%s", apiBaseURL, network)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("pinata: create group request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.JWT)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinata: create group: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinata: create group failed (%d): %s", resp.StatusCode, string(body))
	}

	var result groupResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("pinata: decode group: %w", err)
	}
	return &result.Data, nil
}

// ListGroups lists groups on the given network.
func (c *Client) ListGroups(ctx context.Context, network string) ([]Group, error) {
	if network == "" {
		network = "private"
	}

	url := fmt.Sprintf("%s/groups/%s", apiBaseURL, network)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("pinata: list groups request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.JWT)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinata: list groups: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinata: list groups failed (%d): %s", resp.StatusCode, string(body))
	}

	var result groupListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("pinata: decode groups: %w", err)
	}
	return result.Data.Groups, nil
}

// EnsureWalletGroup creates or finds a private group for a Solana wallet.
// Convention: "wallet:{address}" for per-wallet isolation.
func (c *Client) EnsureWalletGroup(ctx context.Context, walletAddress string) (*Group, error) {
	groupName := "wallet:" + walletAddress

	groups, err := c.ListGroups(ctx, "private")
	if err != nil {
		return nil, err
	}
	for i := range groups {
		if groups[i].Name == groupName {
			return &groups[i], nil
		}
	}

	return c.CreateGroup(ctx, "private", groupName)
}

// EnsureUserGroup creates or finds a private group for a GitHub user.
// Convention: "github:{username}" for per-user isolation.
func (c *Client) EnsureUserGroup(ctx context.Context, githubUser string) (*Group, error) {
	groupName := "github:" + githubUser

	groups, err := c.ListGroups(ctx, "private")
	if err != nil {
		return nil, err
	}
	for i := range groups {
		if groups[i].Name == groupName {
			return &groups[i], nil
		}
	}

	return c.CreateGroup(ctx, "private", groupName)
}

// EnsureDeviceGroup creates or finds a private group for a device (Seeker/mesh node).
// Convention: "device:{deviceID}" for per-device isolation.
func (c *Client) EnsureDeviceGroup(ctx context.Context, deviceID string) (*Group, error) {
	groupName := "device:" + deviceID

	groups, err := c.ListGroups(ctx, "private")
	if err != nil {
		return nil, err
	}
	for i := range groups {
		if groups[i].Name == groupName {
			return &groups[i], nil
		}
	}

	return c.CreateGroup(ctx, "private", groupName)
}
