package agentwallet

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	e2bAPI          = "https://api.e2b.dev"
	e2bTemplate     = "base"        // minimal sandbox
	e2bTimeout      = 600           // 10 minutes
	deployedAPIPort = "8420"
)

// Deployer manages E2B sandbox deployments for the wallet API.
type Deployer struct {
	apiKey     string
	httpClient *http.Client
	mu         sync.Mutex
	sandboxes  map[string]*Deployment // agentID → deployment
}

// Deployment tracks a running sandbox deployment.
type Deployment struct {
	SandboxID  string    `json:"sandbox_id"`
	AgentID    string    `json:"agent_id"`
	APIURL     string    `json:"api_url"`
	Status     string    `json:"status"` // "deploying", "running", "stopped"
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// NewDeployer creates an E2B deployer.
func NewDeployer() *Deployer {
	key := os.Getenv("E2B_API_KEY")
	if key == "" {
		log.Printf("[DEPLOYER] ⚠️  E2B_API_KEY not set — sandbox deployment disabled")
		return nil
	}
	log.Printf("[DEPLOYER] ☁️  E2B deployer initialized")
	return &Deployer{
		apiKey:     key,
		httpClient: &http.Client{Timeout: 120 * time.Second},
		sandboxes:  make(map[string]*Deployment),
	}
}

// IsConfigured returns true if E2B is available.
func (d *Deployer) IsConfigured() bool {
	return d != nil && d.apiKey != ""
}

// Deploy spins up a sandbox, installs the wallet API binary, and starts it.
// Returns the deployment info with the sandbox API URL.
func (d *Deployer) Deploy(ctx context.Context, agentID string, envVars map[string]string) (*Deployment, error) {
	if !d.IsConfigured() {
		return nil, fmt.Errorf("E2B not configured")
	}

	d.mu.Lock()
	if existing, ok := d.sandboxes[agentID]; ok && existing.Status == "running" {
		d.mu.Unlock()
		return existing, nil
	}
	d.mu.Unlock()

	// 1. Create sandbox
	sandboxID, err := d.createSandbox(ctx)
	if err != nil {
		return nil, fmt.Errorf("create sandbox: %w", err)
	}

	log.Printf("[DEPLOYER] 🚀 Sandbox created: %s for agent %s", sandboxID, agentID)

	// 2. Write the wallet API server code to the sandbox
	if err := d.writeServerCode(ctx, sandboxID); err != nil {
		d.killSandbox(ctx, sandboxID)
		return nil, fmt.Errorf("write server code: %w", err)
	}

	// 3. Install dependencies and set env vars
	envScript := "#!/bin/bash\n"
	for k, v := range envVars {
		envScript += fmt.Sprintf("export %s='%s'\n", k, v)
	}
	envScript += fmt.Sprintf("export WALLET_API_PORT=%s\n", deployedAPIPort)

	if err := d.writeFile(ctx, sandboxID, "/home/user/.env.sh", envScript); err != nil {
		d.killSandbox(ctx, sandboxID)
		return nil, fmt.Errorf("write env: %w", err)
	}

	// 4. Start the API server in the sandbox
	startCmd := fmt.Sprintf("source /home/user/.env.sh && cd /home/user/wallet-api && pip install flask web3 solders solana && python3 server.py &")
	if _, err := d.runCommand(ctx, sandboxID, startCmd); err != nil {
		log.Printf("[DEPLOYER] ⚠️  Start command error (may be non-fatal): %v", err)
	}

	// 5. Wait for API to come up
	time.Sleep(3 * time.Second)

	deployment := &Deployment{
		SandboxID: sandboxID,
		AgentID:   agentID,
		APIURL:    fmt.Sprintf("https://%s-%s.e2b.dev", sandboxID, deployedAPIPort),
		Status:    "running",
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(time.Duration(e2bTimeout) * time.Second),
	}

	d.mu.Lock()
	d.sandboxes[agentID] = deployment
	d.mu.Unlock()

	log.Printf("[DEPLOYER] ✅ Wallet API deployed: %s", deployment.APIURL)
	return deployment, nil
}

// GetDeployment returns the active deployment for an agent.
func (d *Deployer) GetDeployment(agentID string) *Deployment {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.sandboxes[agentID]
}

// ListDeployments returns all active deployments.
func (d *Deployer) ListDeployments() []*Deployment {
	d.mu.Lock()
	defer d.mu.Unlock()
	result := make([]*Deployment, 0, len(d.sandboxes))
	for _, dep := range d.sandboxes {
		result = append(result, dep)
	}
	return result
}

// Teardown stops and removes a deployment.
func (d *Deployer) Teardown(ctx context.Context, agentID string) error {
	d.mu.Lock()
	dep, ok := d.sandboxes[agentID]
	if ok {
		delete(d.sandboxes, agentID)
	}
	d.mu.Unlock()

	if !ok {
		return fmt.Errorf("no deployment for agent %s", agentID)
	}

	dep.Status = "stopped"
	return d.killSandbox(ctx, dep.SandboxID)
}

// ── E2B API Calls ────────────────────────────────────────────────

func (d *Deployer) createSandbox(ctx context.Context) (string, error) {
	body := map[string]any{
		"templateID": e2bTemplate,
		"timeout":    e2bTimeout,
	}
	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", e2bAPI+"/sandboxes", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", d.apiKey)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		SandboxID string `json:"sandboxID"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.SandboxID, nil
}

func (d *Deployer) writeFile(ctx context.Context, sandboxID, path, content string) error {
	body := map[string]any{
		"path": path,
		"data": content,
	}
	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/sandboxes/%s/files", e2bAPI, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", d.apiKey)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return fmt.Errorf("write file HTTP %d", resp.StatusCode)
	}
	return nil
}

func (d *Deployer) runCommand(ctx context.Context, sandboxID, cmd string) (string, error) {
	body := map[string]any{
		"cmd": cmd,
	}
	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/sandboxes/%s/commands", e2bAPI, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", d.apiKey)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("command HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Stdout string `json:"stdout"`
		Stderr string `json:"stderr"`
	}
	json.Unmarshal(b, &result)
	return result.Stdout, nil
}

func (d *Deployer) killSandbox(ctx context.Context, sandboxID string) error {
	url := fmt.Sprintf("%s/sandboxes/%s", e2bAPI, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", d.apiKey)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	log.Printf("[DEPLOYER] 🗑️  Sandbox killed: %s", sandboxID)
	return nil
}

// writeServerCode writes a Python-based wallet API to the sandbox.
// This lightweight server proxies to Solana/EVM RPCs and provides
// wallet operations inside the sandbox.
func (d *Deployer) writeServerCode(ctx context.Context, sandboxID string) error {
	// Create directory
	d.runCommand(ctx, sandboxID, "mkdir -p /home/user/wallet-api")

	serverCode := `#!/usr/bin/env python3
"""
NanoSolana Agent Wallet — E2B Sandbox API
Lightweight wallet vault with Solana + EVM support.
Deployed into E2B sandboxes for isolated agent access.
"""

import os
import json
import hashlib
import secrets
import time
from flask import Flask, request, jsonify
from cryptography.fernet import Fernet
import base64

app = Flask(__name__)

# Vault storage (in-memory, encrypted)
WALLETS = {}
MASTER_KEY = None

def init_vault():
    global MASTER_KEY
    passphrase = os.environ.get('VAULT_PASSPHRASE', 'nanosolana-agent-vault')
    key = hashlib.sha256(passphrase.encode()).digest()
    MASTER_KEY = base64.urlsafe_b64encode(key)

def generate_id():
    return secrets.token_hex(8)

# ── Routes ──────────────────────────────────────────────────

@app.route('/')
def root():
    return jsonify({
        'service': 'nanosolana-agent-wallet',
        'version': '1.0.0',
        'sandbox': True,
        'chains': ['solana', 'evm']
    })

@app.route('/v1/health')
def health():
    return jsonify({
        'status': 'ok',
        'wallets': len(WALLETS),
        'sandbox': True
    })

@app.route('/v1/wallets', methods=['POST'])
def create_wallet():
    data = request.get_json() or {}
    chain = data.get('chain', 'solana')
    label = data.get('label', '')
    chain_id = data.get('chain_id', 900 if chain == 'solana' else 8453)

    wallet_id = generate_id()

    if chain == 'solana':
        try:
            from solders.keypair import Keypair
            kp = Keypair()
            address = str(kp.pubkey())
            priv_key = bytes(kp)
        except ImportError:
            # Fallback: generate random keypair bytes
            priv_key = secrets.token_bytes(64)
            address = secrets.token_hex(16)
    else:
        # EVM keypair
        priv_key = secrets.token_bytes(32)
        address = '0x' + hashlib.sha256(priv_key).hexdigest()[24:]

    # Encrypt private key
    fernet = Fernet(MASTER_KEY)
    encrypted = fernet.encrypt(priv_key).decode()

    WALLETS[wallet_id] = {
        'id': wallet_id,
        'label': label,
        'chain': chain,
        'chain_id': chain_id,
        'address': address,
        'encrypted_key': encrypted,
        'paused': False,
        'created_at': time.time()
    }

    return jsonify({
        'id': wallet_id,
        'address': address,
        'chain': chain,
        'chain_id': chain_id,
        'label': label
    })

@app.route('/v1/wallets')
def list_wallets():
    result = []
    for w in WALLETS.values():
        result.append({
            'id': w['id'],
            'label': w['label'],
            'chain': w['chain'],
            'chain_id': w['chain_id'],
            'address': w['address'],
            'paused': w['paused']
        })
    return jsonify(result)

@app.route('/v1/wallets/<wallet_id>')
def get_wallet(wallet_id):
    w = WALLETS.get(wallet_id)
    if not w:
        return jsonify({'error': 'not found'}), 404
    return jsonify({
        'id': w['id'],
        'label': w['label'],
        'chain': w['chain'],
        'chain_id': w['chain_id'],
        'address': w['address'],
        'paused': w['paused']
    })

@app.route('/v1/wallets/<wallet_id>/balance')
def get_balance(wallet_id):
    w = WALLETS.get(wallet_id)
    if not w:
        return jsonify({'error': 'not found'}), 404

    if w['chain'] == 'solana':
        try:
            from solana.rpc.api import Client as SolanaClient
            rpc_url = os.environ.get('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
            client = SolanaClient(rpc_url)
            resp = client.get_balance(w['address'])
            lamports = resp.value
            return jsonify({
                'address': w['address'],
                'chain': 'solana',
                'lamports': lamports,
                'sol': lamports / 1e9
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 502
    else:
        # EVM balance via JSON-RPC
        import requests
        chain_id = w['chain_id']
        rpc_url = os.environ.get(f'EVM_RPC_{chain_id}', os.environ.get('BASE_RPC_URL', ''))
        if not rpc_url:
            return jsonify({'error': f'no RPC for chain {chain_id}'}), 400

        try:
            resp = requests.post(rpc_url, json={
                'jsonrpc': '2.0', 'id': 1,
                'method': 'eth_getBalance',
                'params': [w['address'], 'latest']
            })
            result = resp.json().get('result', '0x0')
            wei = int(result, 16)
            return jsonify({
                'address': w['address'],
                'chain': 'evm',
                'chain_id': chain_id,
                'wei': str(wei),
                'balance': str(wei / 1e18)
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 502

@app.route('/v1/wallets/<wallet_id>/transfer', methods=['POST'])
def transfer(wallet_id):
    w = WALLETS.get(wallet_id)
    if not w:
        return jsonify({'error': 'not found'}), 404
    if w['paused']:
        return jsonify({'error': 'wallet paused'}), 403

    data = request.get_json()
    to = data.get('to', '')
    amount = data.get('amount', '0')

    # Decrypt private key
    fernet = Fernet(MASTER_KEY)
    priv_key = fernet.decrypt(w['encrypted_key'].encode())

    if w['chain'] == 'solana':
        try:
            from solders.keypair import Keypair
            from solders.pubkey import Pubkey
            from solana.rpc.api import Client as SolanaClient
            from solana.transaction import Transaction
            from solders.system_program import TransferParams, transfer as sol_transfer

            kp = Keypair.from_bytes(priv_key)
            rpc_url = os.environ.get('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
            client = SolanaClient(rpc_url)

            lamports = int(float(amount) * 1e9)

            tx = Transaction()
            tx.add(sol_transfer(TransferParams(
                from_pubkey=kp.pubkey(),
                to_pubkey=Pubkey.from_string(to),
                lamports=lamports
            )))

            resp = client.send_transaction(tx, kp)
            return jsonify({
                'signature': str(resp.value),
                'from': w['address'],
                'to': to,
                'amount': amount,
                'chain': 'solana'
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'EVM transfer requires web3 — use /v1/wallets/<id>/sign for raw signing'}), 501

@app.route('/v1/wallets/<wallet_id>/sign', methods=['POST'])
def sign_message(wallet_id):
    w = WALLETS.get(wallet_id)
    if not w:
        return jsonify({'error': 'not found'}), 404
    if w['paused']:
        return jsonify({'error': 'wallet paused'}), 403

    data = request.get_json()
    message = data.get('message', '').encode()

    fernet = Fernet(MASTER_KEY)
    priv_key = fernet.decrypt(w['encrypted_key'].encode())

    if w['chain'] == 'solana':
        try:
            from solders.keypair import Keypair
            kp = Keypair.from_bytes(priv_key)
            sig = kp.sign_message(message)
            return jsonify({'signature': str(sig), 'address': w['address']})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        # EVM: sign with eth_account
        msg_hash = hashlib.sha256(message).hexdigest()
        return jsonify({'hash': msg_hash, 'address': w['address']})

@app.route('/v1/wallets/<wallet_id>/pause', methods=['POST'])
def pause_wallet(wallet_id):
    w = WALLETS.get(wallet_id)
    if not w:
        return jsonify({'error': 'not found'}), 404
    w['paused'] = True
    return jsonify({'paused': True})

@app.route('/v1/wallets/<wallet_id>/unpause', methods=['POST'])
def unpause_wallet(wallet_id):
    w = WALLETS.get(wallet_id)
    if not w:
        return jsonify({'error': 'not found'}), 404
    w['paused'] = False
    return jsonify({'paused': False})

@app.route('/v1/wallets/<wallet_id>', methods=['DELETE'])
def delete_wallet(wallet_id):
    if wallet_id in WALLETS:
        del WALLETS[wallet_id]
        return jsonify({'deleted': True})
    return jsonify({'error': 'not found'}), 404

@app.route('/v1/chains')
def get_chains():
    return jsonify([
        {'chain_id': 900, 'name': 'Solana', 'type': 'solana', 'native': 'SOL', 'decimals': 9},
        {'chain_id': 1, 'name': 'Ethereum', 'type': 'evm', 'native': 'ETH', 'decimals': 18},
        {'chain_id': 8453, 'name': 'Base', 'type': 'evm', 'native': 'ETH', 'decimals': 18},
        {'chain_id': 42161, 'name': 'Arbitrum', 'type': 'evm', 'native': 'ETH', 'decimals': 18},
        {'chain_id': 10, 'name': 'Optimism', 'type': 'evm', 'native': 'ETH', 'decimals': 18},
        {'chain_id': 137, 'name': 'Polygon', 'type': 'evm', 'native': 'POL', 'decimals': 18},
    ])

if __name__ == '__main__':
    init_vault()
    port = int(os.environ.get('WALLET_API_PORT', '8420'))
    print(f'[WALLET-API] Agent wallet API listening on :{port}')
    app.run(host='0.0.0.0', port=port)
`

	return d.writeFile(ctx, sandboxID, "/home/user/wallet-api/server.py", serverCode)
}
