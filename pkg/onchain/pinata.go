// Package onchain :: pinata.go
//
// Pinata IPFS client for uploading agent metadata JSON.
// Used by the 8004 agent registry flow to pin metadata off-chain
// before referencing it on-chain via ipfs:// URIs.
package onchain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const pinataJSONEndpoint = "https://api.pinata.cloud/pinning/pinJSONToIPFS"

// PinataClient uploads JSON to Pinata IPFS.
type PinataClient struct {
	jwt    string
	client *http.Client
}

// NewPinataClient creates a Pinata client from a JWT token.
func NewPinataClient(jwt string) *PinataClient {
	return &PinataClient{
		jwt: jwt,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// PinJSONResult is the response from a successful Pinata pin.
type PinJSONResult struct {
	IpfsHash  string `json:"IpfsHash"`
	PinSize   int    `json:"PinSize"`
	Timestamp string `json:"Timestamp"`
}

// PinJSON uploads a JSON object to Pinata and returns the IPFS CID.
func (p *PinataClient) PinJSON(ctx context.Context, name string, data any) (*PinJSONResult, error) {
	payload := map[string]any{
		"pinataContent": data,
		"pinataMetadata": map[string]string{
			"name": name,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal pinata payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, pinataJSONEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build pinata request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.jwt)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinata request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pinata HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result PinJSONResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode pinata response: %w", err)
	}
	return &result, nil
}

// IPFSURI returns the ipfs:// URI for a CID.
func IPFSURI(cid string) string {
	return "ipfs://" + cid
}

// PinataGatewayURL returns the public gateway URL for a CID.
func PinataGatewayURL(cid string) string {
	return "https://gateway.pinata.cloud/ipfs/" + cid
}
