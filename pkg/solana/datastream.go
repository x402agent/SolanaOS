// Package solana — SolanaTracker Datastream WebSocket client.
// Connects to wss://datastream.solanatracker.io/{KEY} and provides
// subscribe/unsubscribe methods for all Datastream channels.
package solana

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const datastreamBaseWSS = "wss://datastream.solanatracker.io"

// DatastreamClient manages a persistent WebSocket connection to SolanaTracker Datastream.
type DatastreamClient struct {
	key  string
	conn *websocket.Conn
	mu   sync.Mutex

	handlers map[string]func(json.RawMessage)
	hmu      sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc
}

// DatastreamMsg is a generic message envelope from the Datastream WebSocket.
type DatastreamMsg struct {
	Type    string          `json:"type"`
	Channel string          `json:"channel,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// NewDatastreamClient creates a new Datastream client. Call Connect() to establish the WebSocket.
func NewDatastreamClient(datastreamKey string) *DatastreamClient {
	ctx, cancel := context.WithCancel(context.Background())
	return &DatastreamClient{
		key:      datastreamKey,
		handlers: make(map[string]func(json.RawMessage)),
		ctx:      ctx,
		cancel:   cancel,
	}
}

// Connect dials the Datastream WebSocket and starts the read loop.
func (d *DatastreamClient) Connect() error {
	url := fmt.Sprintf("%s/%s", datastreamBaseWSS, d.key)
	conn, _, err := websocket.DefaultDialer.DialContext(d.ctx, url, nil)
	if err != nil {
		return fmt.Errorf("datastream connect: %w", err)
	}
	d.mu.Lock()
	d.conn = conn
	d.mu.Unlock()
	log.Printf("[DATASTREAM] Connected to SolanaTracker Datastream")
	go d.readLoop()
	return nil
}

// ConnectWithReconnect connects and automatically reconnects on failure.
func (d *DatastreamClient) ConnectWithReconnect() {
	go func() {
		backoff := time.Second
		for {
			select {
			case <-d.ctx.Done():
				return
			default:
			}
			if err := d.Connect(); err != nil {
				log.Printf("[DATASTREAM] Connection failed: %v (retry in %v)", err, backoff)
				time.Sleep(backoff)
				if backoff < 30*time.Second {
					backoff *= 2
				}
				continue
			}
			backoff = time.Second
			// Block until connection drops
			<-d.ctx.Done()
			return
		}
	}()
}

// Close shuts down the Datastream connection.
func (d *DatastreamClient) Close() {
	d.cancel()
	d.mu.Lock()
	if d.conn != nil {
		d.conn.Close()
	}
	d.mu.Unlock()
}

func (d *DatastreamClient) readLoop() {
	for {
		select {
		case <-d.ctx.Done():
			return
		default:
		}
		d.mu.Lock()
		conn := d.conn
		d.mu.Unlock()
		if conn == nil {
			return
		}
		_, raw, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[DATASTREAM] Read error: %v", err)
			return
		}
		var msg DatastreamMsg
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}
		d.hmu.RLock()
		if h, ok := d.handlers[msg.Type]; ok {
			h(msg.Data)
		}
		// Also fire channel-specific handler
		if msg.Channel != "" {
			key := msg.Type + ":" + msg.Channel
			if h, ok := d.handlers[key]; ok {
				h(msg.Data)
			}
		}
		d.hmu.RUnlock()
	}
}

func (d *DatastreamClient) send(msg any) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.conn == nil {
		return fmt.Errorf("datastream: not connected")
	}
	return d.conn.WriteJSON(msg)
}

// OnMessage registers a handler for a specific message type (e.g. "latestMessage", "priceTokenMessage").
func (d *DatastreamClient) OnMessage(msgType string, handler func(json.RawMessage)) {
	d.hmu.Lock()
	d.handlers[msgType] = handler
	d.hmu.Unlock()
}

// OnChannelMessage registers a handler for a specific type+channel combo.
func (d *DatastreamClient) OnChannelMessage(msgType, channel string, handler func(json.RawMessage)) {
	d.hmu.Lock()
	d.handlers[msgType+":"+channel] = handler
	d.hmu.Unlock()
}

// ── Subscribe Methods ────────────────────────────────────────────────

// JoinLatest subscribes to new tokens/pools created on Solana.
func (d *DatastreamClient) JoinLatest() error {
	return d.send(map[string]string{"type": "joinLatest"})
}

func (d *DatastreamClient) LeaveLatest() error {
	return d.send(map[string]string{"type": "leaveLatest"})
}

// JoinPool subscribes to updates for a specific pool.
func (d *DatastreamClient) JoinPool(poolAddress string) error {
	return d.send(map[string]string{"type": "joinPool", "channel": poolAddress})
}

func (d *DatastreamClient) LeavePool(poolAddress string) error {
	return d.send(map[string]string{"type": "leavePool", "channel": poolAddress})
}

// JoinTokenTx subscribes to swap transactions for a token.
func (d *DatastreamClient) JoinTokenTx(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinTokenTx", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveTokenTx(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveTokenTx", "channel": tokenAddress})
}

// JoinPoolTx subscribes to transactions for a specific token in a specific pool.
func (d *DatastreamClient) JoinPoolTx(poolAddress string) error {
	return d.send(map[string]string{"type": "joinPoolTx", "channel": poolAddress})
}

func (d *DatastreamClient) LeavePoolTx(poolAddress string) error {
	return d.send(map[string]string{"type": "leavePoolTx", "channel": poolAddress})
}

// JoinPoolWalletTx subscribes to transactions for a pool+wallet pair. Channel: "pool:wallet".
func (d *DatastreamClient) JoinPoolWalletTx(poolAddress, walletAddress string) error {
	return d.send(map[string]string{"type": "joinPoolWalletTx", "channel": poolAddress + ":" + walletAddress})
}

func (d *DatastreamClient) LeavePoolWalletTx(poolAddress, walletAddress string) error {
	return d.send(map[string]string{"type": "leavePoolWalletTx", "channel": poolAddress + ":" + walletAddress})
}

// JoinPricePool subscribes to price updates for a specific pool.
func (d *DatastreamClient) JoinPricePool(poolAddress string) error {
	return d.send(map[string]string{"type": "joinPricePool", "channel": poolAddress})
}

func (d *DatastreamClient) LeavePricePool(poolAddress string) error {
	return d.send(map[string]string{"type": "leavePricePool", "channel": poolAddress})
}

// JoinPriceAggregated subscribes to aggregated price across all pools for a token.
func (d *DatastreamClient) JoinPriceAggregated(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinPriceAggregated", "channel": tokenAddress})
}

func (d *DatastreamClient) LeavePriceAggregated(tokenAddress string) error {
	return d.send(map[string]string{"type": "leavePriceAggregated", "channel": tokenAddress})
}

// JoinPriceToken subscribes to price updates from the primary pool for a token.
func (d *DatastreamClient) JoinPriceToken(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinPriceToken", "channel": tokenAddress})
}

func (d *DatastreamClient) LeavePriceToken(tokenAddress string) error {
	return d.send(map[string]string{"type": "leavePriceToken", "channel": tokenAddress})
}

// JoinPriceAll subscribes to price updates from all pools for a token.
func (d *DatastreamClient) JoinPriceAll(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinPriceAll", "channel": tokenAddress})
}

func (d *DatastreamClient) LeavePriceAll(tokenAddress string) error {
	return d.send(map[string]string{"type": "leavePriceAll", "channel": tokenAddress})
}

// JoinWallet subscribes to swap transactions for a wallet.
func (d *DatastreamClient) JoinWallet(walletAddress string) error {
	return d.send(map[string]string{"type": "joinWallet", "channel": walletAddress})
}

func (d *DatastreamClient) LeaveWallet(walletAddress string) error {
	return d.send(map[string]string{"type": "leaveWallet", "channel": walletAddress})
}

// JoinBalance subscribes to wallet balance changes.
func (d *DatastreamClient) JoinBalance(walletAddress string) error {
	return d.send(map[string]string{"type": "joinBalance", "channel": walletAddress})
}

func (d *DatastreamClient) LeaveBalance(walletAddress string) error {
	return d.send(map[string]string{"type": "leaveBalance", "channel": walletAddress})
}

// JoinWalletTokenBalance subscribes to a specific token balance for a wallet.
func (d *DatastreamClient) JoinWalletTokenBalance(walletAddress, tokenAddress string) error {
	return d.send(map[string]string{"type": "joinWalletTokenBalance", "channel": walletAddress + ":" + tokenAddress})
}

func (d *DatastreamClient) LeaveWalletTokenBalance(walletAddress, tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveWalletTokenBalance", "channel": walletAddress + ":" + tokenAddress})
}

// JoinGraduating subscribes to tokens approaching bonding curve completion.
func (d *DatastreamClient) JoinGraduating() error {
	return d.send(map[string]string{"type": "joinGraduating"})
}

func (d *DatastreamClient) LeaveGraduating() error {
	return d.send(map[string]string{"type": "leaveGraduating"})
}

// JoinGraduated subscribes to tokens that just graduated.
func (d *DatastreamClient) JoinGraduated() error {
	return d.send(map[string]string{"type": "joinGraduated"})
}

func (d *DatastreamClient) LeaveGraduated() error {
	return d.send(map[string]string{"type": "leaveGraduated"})
}

// JoinMetadata subscribes to token metadata updates.
func (d *DatastreamClient) JoinMetadata(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinMetadata", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveMetadata(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveMetadata", "channel": tokenAddress})
}

// JoinHolders subscribes to holder count updates for a token.
func (d *DatastreamClient) JoinHolders(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinHolders", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveHolders(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveHolders", "channel": tokenAddress})
}

// JoinTokenChanges subscribes to token info changes.
func (d *DatastreamClient) JoinTokenChanges(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinTokenChanges", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveTokenChanges(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveTokenChanges", "channel": tokenAddress})
}

// JoinCurve subscribes to curve percentage alerts for bonding curve tokens.
func (d *DatastreamClient) JoinCurve(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinCurve", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveCurve(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveCurve", "channel": tokenAddress})
}

// JoinSniper subscribes to sniper wallet activity for a token.
func (d *DatastreamClient) JoinSniper(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinSniper", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveSniper(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveSniper", "channel": tokenAddress})
}

// JoinInsider subscribes to insider wallet activity for a token.
func (d *DatastreamClient) JoinInsider(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinInsider", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveInsider(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveInsider", "channel": tokenAddress})
}

// JoinTokenStats subscribes to multi-timeframe statistics for a token.
func (d *DatastreamClient) JoinTokenStats(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinTokenStats", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveTokenStats(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveTokenStats", "channel": tokenAddress})
}

// JoinPoolStats subscribes to pool statistics.
func (d *DatastreamClient) JoinPoolStats(poolAddress string) error {
	return d.send(map[string]string{"type": "joinPoolStats", "channel": poolAddress})
}

func (d *DatastreamClient) LeavePoolStats(poolAddress string) error {
	return d.send(map[string]string{"type": "leavePoolStats", "channel": poolAddress})
}

// JoinTokenVolume subscribes to token volume updates.
func (d *DatastreamClient) JoinTokenVolume(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinTokenVolume", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveTokenVolume(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveTokenVolume", "channel": tokenAddress})
}

// JoinPoolVolume subscribes to pool volume updates.
func (d *DatastreamClient) JoinPoolVolume(poolAddress string) error {
	return d.send(map[string]string{"type": "joinPoolVolume", "channel": poolAddress})
}

func (d *DatastreamClient) LeavePoolVolume(poolAddress string) error {
	return d.send(map[string]string{"type": "leavePoolVolume", "channel": poolAddress})
}

// JoinFeeTracking subscribes to fee tracking updates.
func (d *DatastreamClient) JoinFeeTracking(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinFee", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveFeeTracking(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveFee", "channel": tokenAddress})
}

// JoinBundlers subscribes to bundler activity tracking.
func (d *DatastreamClient) JoinBundlers(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinBundlers", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveBundlers(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveBundlers", "channel": tokenAddress})
}

// JoinDevHoldings subscribes to developer holdings tracking.
func (d *DatastreamClient) JoinDevHoldings(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinDevHoldings", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveDevHoldings(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveDevHoldings", "channel": tokenAddress})
}

// JoinTop10Holders subscribes to top 10 holder changes.
func (d *DatastreamClient) JoinTop10Holders(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinTop10", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveTop10Holders(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveTop10", "channel": tokenAddress})
}

// JoinTokenPrimary subscribes to primary pool designation changes.
func (d *DatastreamClient) JoinTokenPrimary(tokenAddress string) error {
	return d.send(map[string]string{"type": "joinTokenPrimary", "channel": tokenAddress})
}

func (d *DatastreamClient) LeaveTokenPrimary(tokenAddress string) error {
	return d.send(map[string]string{"type": "leaveTokenPrimary", "channel": tokenAddress})
}
