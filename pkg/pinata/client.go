package pinata

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"time"
)

// ── Pinata Private IPFS Client ──────────────────────────────────────
// Wraps Pinata v3 API for private + public IPFS operations.
// Files are scoped per Solana wallet + GitHub account via keyvalues.

const (
	uploadBaseURL = "https://uploads.pinata.cloud/v3/files"
	apiBaseURL    = "https://api.pinata.cloud/v3"
)

// Config holds Pinata credentials.
type Config struct {
	APIKey    string
	APISecret string
	JWT       string
	Gateway   string // e.g. "your-gateway.mypinata.cloud"
}

// Client is the Pinata Private IPFS client.
type Client struct {
	cfg    Config
	http   *http.Client
}

// New creates a Pinata client from config.
func New(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		http: &http.Client{Timeout: 120 * time.Second},
	}
}

// ── Upload ──────────────────────────────────────────────────────────

// UploadOpts controls upload behavior.
type UploadOpts struct {
	Name          string
	Network       string // "public" or "private" (default: "private")
	GroupID       string
	WalletAddress string // Solana wallet for scoping
	GitHubUser    string // GitHub username for scoping
	DeviceID      string // Seeker/Android device ID
	MeshNodeID    string // Tailscale node ID
	ExtraKV       map[string]string
}

// UploadResult is the response from a successful upload.
type UploadResult struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	CID           string `json:"cid"`
	Size          int64  `json:"size"`
	NumberOfFiles int    `json:"number_of_files"`
	MimeType      string `json:"mime_type"`
	GroupID       string `json:"group_id"`
	CreatedAt     string `json:"created_at"`
}

type uploadResponse struct {
	Data UploadResult `json:"data"`
}

// Upload sends a file to Pinata Private IPFS with wallet/github scoping.
func (c *Client) Upload(ctx context.Context, filename string, data io.Reader, opts UploadOpts) (*UploadResult, error) {
	network := opts.Network
	if network == "" {
		network = "private"
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, fmt.Errorf("pinata: create form file: %w", err)
	}
	if _, err := io.Copy(part, data); err != nil {
		return nil, fmt.Errorf("pinata: copy file data: %w", err)
	}

	_ = writer.WriteField("network", network)

	if opts.Name != "" {
		_ = writer.WriteField("name", opts.Name)
	}
	if opts.GroupID != "" {
		_ = writer.WriteField("group_id", opts.GroupID)
	}

	// Build keyvalues for wallet/github/device scoping
	kv := make(map[string]string)
	if opts.WalletAddress != "" {
		kv["solana_wallet"] = opts.WalletAddress
	}
	if opts.GitHubUser != "" {
		kv["github_user"] = opts.GitHubUser
	}
	if opts.DeviceID != "" {
		kv["device_id"] = opts.DeviceID
	}
	if opts.MeshNodeID != "" {
		kv["mesh_node_id"] = opts.MeshNodeID
	}
	for k, v := range opts.ExtraKV {
		kv[k] = v
	}
	if len(kv) > 0 {
		kvJSON, _ := json.Marshal(kv)
		_ = writer.WriteField("keyvalues", string(kvJSON))
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("pinata: close writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadBaseURL, body)
	if err != nil {
		return nil, fmt.Errorf("pinata: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.JWT)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinata: upload request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinata: upload failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var result uploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("pinata: decode response: %w", err)
	}
	return &result.Data, nil
}

// ── List Files ──────────────────────────────────────────────────────

// ListOpts filters file listing.
type ListOpts struct {
	Network       string // "public" or "private"
	Name          string
	GroupID       string
	CID           string
	WalletAddress string
	GitHubUser    string
	Limit         int
	PageToken     string
}

// FileEntry represents a file in Pinata.
type FileEntry struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	CID           string `json:"cid"`
	Size          int64  `json:"size"`
	NumberOfFiles int    `json:"number_of_files"`
	MimeType      string `json:"mime_type"`
	GroupID       string `json:"group_id"`
	CreatedAt     string `json:"created_at"`
}

// ListResult is the paginated file listing response.
type ListResult struct {
	Files         []FileEntry `json:"files"`
	NextPageToken string      `json:"next_page_token"`
}

type listResponse struct {
	Data ListResult `json:"data"`
}

// List retrieves files filtered by wallet/github/group.
func (c *Client) List(ctx context.Context, opts ListOpts) (*ListResult, error) {
	network := opts.Network
	if network == "" {
		network = "private"
	}

	url := fmt.Sprintf("%s/files/%s", apiBaseURL, network)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("pinata: create list request: %w", err)
	}

	q := req.URL.Query()
	if opts.Name != "" {
		q.Set("name", opts.Name)
	}
	if opts.GroupID != "" {
		q.Set("group", opts.GroupID)
	}
	if opts.CID != "" {
		q.Set("cid", opts.CID)
	}
	if opts.WalletAddress != "" {
		q.Set("keyvalues[solana_wallet]", opts.WalletAddress)
	}
	if opts.GitHubUser != "" {
		q.Set("keyvalues[github_user]", opts.GitHubUser)
	}
	if opts.Limit > 0 {
		q.Set("limit", strconv.Itoa(opts.Limit))
	}
	if opts.PageToken != "" {
		q.Set("pageToken", opts.PageToken)
	}
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Authorization", "Bearer "+c.cfg.JWT)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinata: list request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinata: list failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var result listResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("pinata: decode list: %w", err)
	}
	return &result.Data, nil
}

// ── Private Access Links ────────────────────────────────────────────

// AccessLinkOpts controls temporary access link creation.
type AccessLinkOpts struct {
	CID     string
	Expires int // seconds
}

type accessLinkRequest struct {
	URL     string `json:"url"`
	Expires int    `json:"expires"`
	Date    int64  `json:"date"`
	Method  string `json:"method"`
}

type accessLinkResponse struct {
	Data string `json:"data"`
}

// CreateAccessLink generates a temporary URL for a private file.
func (c *Client) CreateAccessLink(ctx context.Context, opts AccessLinkOpts) (string, error) {
	if opts.Expires <= 0 {
		opts.Expires = 300 // 5 minute default
	}

	gateway := c.cfg.Gateway
	if gateway == "" {
		gateway = "gateway.pinata.cloud"
	}

	payload := accessLinkRequest{
		URL:     fmt.Sprintf("https://%s/files/%s", gateway, opts.CID),
		Expires: opts.Expires,
		Date:    time.Now().Unix(),
		Method:  "GET",
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/files/download_link", apiBaseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("pinata: create access link request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.JWT)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("pinata: access link request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("pinata: access link failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var result accessLinkResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("pinata: decode access link: %w", err)
	}
	return result.Data, nil
}

// ── Delete ──────────────────────────────────────────────────────────

// Delete removes a file by its Pinata ID.
func (c *Client) Delete(ctx context.Context, network, fileID string) error {
	if network == "" {
		network = "private"
	}
	url := fmt.Sprintf("%s/files/%s/%s", apiBaseURL, network, fileID)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("pinata: create delete request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.JWT)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("pinata: delete request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pinata: delete failed (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}
