// Package aster :: futures.go
// Futures account and trading endpoints.
//
// Core operations:
//   - Place/Cancel/Query orders
//   - Account balance and positions
//   - Leverage and margin management
//   - Listen key for user data stream
//   - Transfer between spot and futures
package aster

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
)

// ═══════════════════════════════════════════════════════════════════════
// ACCOUNT
// ═══════════════════════════════════════════════════════════════════════

// FutBalance returns futures account balances (V2).
func (c *Client) FutBalance() ([]FuturesBalance, error) {
	data, err := c.futSignedGet(c.futPath("/fapi/v2/balance", "/fapi/v3/balance"), url.Values{})
	if err != nil {
		return nil, err
	}
	var balances []FuturesBalance
	if err := json.Unmarshal(data, &balances); err != nil {
		return nil, err
	}
	return balances, nil
}

// FutAccount returns full futures account info (V4).
func (c *Client) FutAccount() (*FuturesAccount, error) {
	data, err := c.futSignedGet(c.futPath("/fapi/v4/account", "/fapi/v3/account"), url.Values{})
	if err != nil {
		return nil, err
	}
	var account FuturesAccount
	if err := json.Unmarshal(data, &account); err != nil {
		return nil, err
	}
	return &account, nil
}

// FutPositionRisk returns position risk (V2).
func (c *Client) FutPositionRisk(symbol string) ([]PositionRisk, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futSignedGet(c.futPath("/fapi/v2/positionRisk", "/fapi/v3/positionRisk"), params)
	if err != nil {
		return nil, err
	}
	var positions []PositionRisk
	if err := json.Unmarshal(data, &positions); err != nil {
		return nil, err
	}
	return positions, nil
}

// ═══════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════

// FutNewOrder places a new futures order.
func (c *Client) FutNewOrder(p NewOrderParams) (*OrderResponse, error) {
	params := url.Values{
		"symbol": {p.Symbol},
		"side":   {string(p.Side)},
		"type":   {string(p.Type)},
	}

	if p.PositionSide != "" {
		params.Set("positionSide", string(p.PositionSide))
	}
	if p.TimeInForce != "" {
		params.Set("timeInForce", string(p.TimeInForce))
	}
	if p.Quantity != "" {
		params.Set("quantity", p.Quantity)
	}
	if p.Price != "" {
		params.Set("price", p.Price)
	}
	if p.StopPrice != "" {
		params.Set("stopPrice", p.StopPrice)
	}
	if p.ReduceOnly {
		params.Set("reduceOnly", "true")
	}
	if p.ClosePosition {
		params.Set("closePosition", "true")
	}
	if p.ActivationPrice != "" {
		params.Set("activationPrice", p.ActivationPrice)
	}
	if p.CallbackRate != "" {
		params.Set("callbackRate", p.CallbackRate)
	}
	if p.WorkingType != "" {
		params.Set("workingType", string(p.WorkingType))
	}
	if p.NewClientOrderID != "" {
		params.Set("newClientOrderId", p.NewClientOrderID)
	}

	data, err := c.futSignedPost(c.futPath("/fapi/v1/order", "/fapi/v3/order"), params)
	if err != nil {
		return nil, err
	}
	var order OrderResponse
	if err := json.Unmarshal(data, &order); err != nil {
		return nil, err
	}
	return &order, nil
}

// FutCancelOrder cancels an active futures order.
func (c *Client) FutCancelOrder(symbol string, orderID int64, clientOrderID string) (*OrderResponse, error) {
	params := url.Values{"symbol": {symbol}}
	if orderID > 0 {
		params.Set("orderId", strconv.FormatInt(orderID, 10))
	}
	if clientOrderID != "" {
		params.Set("origClientOrderId", clientOrderID)
	}
	data, err := c.futSignedDelete(c.futPath("/fapi/v1/order", "/fapi/v3/order"), params)
	if err != nil {
		return nil, err
	}
	var order OrderResponse
	if err := json.Unmarshal(data, &order); err != nil {
		return nil, err
	}
	return &order, nil
}

// FutCancelAllOrders cancels all open orders for a symbol.
func (c *Client) FutCancelAllOrders(symbol string) error {
	params := url.Values{"symbol": {symbol}}
	_, err := c.futSignedDelete(c.futPath("/fapi/v1/allOpenOrders", "/fapi/v3/allOpenOrders"), params)
	return err
}

// FutQueryOrder queries a specific order.
func (c *Client) FutQueryOrder(symbol string, orderID int64, clientOrderID string) (*OrderResponse, error) {
	params := url.Values{"symbol": {symbol}}
	if orderID > 0 {
		params.Set("orderId", strconv.FormatInt(orderID, 10))
	}
	if clientOrderID != "" {
		params.Set("origClientOrderId", clientOrderID)
	}
	data, err := c.futSignedGet(c.futPath("/fapi/v1/order", "/fapi/v3/order"), params)
	if err != nil {
		return nil, err
	}
	var order OrderResponse
	if err := json.Unmarshal(data, &order); err != nil {
		return nil, err
	}
	return &order, nil
}

// FutOpenOrders returns all open orders, optionally filtered by symbol.
func (c *Client) FutOpenOrders(symbol string) ([]OrderResponse, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futSignedGet(c.futPath("/fapi/v1/openOrders", "/fapi/v3/openOrders"), params)
	if err != nil {
		return nil, err
	}
	var orders []OrderResponse
	if err := json.Unmarshal(data, &orders); err != nil {
		return nil, err
	}
	return orders, nil
}

// FutAllOrders returns all orders (active, canceled, filled).
func (c *Client) FutAllOrders(symbol string, limit int) ([]OrderResponse, error) {
	params := url.Values{"symbol": {symbol}}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futSignedGet(c.futPath("/fapi/v1/allOrders", "/fapi/v3/allOrders"), params)
	if err != nil {
		return nil, err
	}
	var orders []OrderResponse
	if err := json.Unmarshal(data, &orders); err != nil {
		return nil, err
	}
	return orders, nil
}

// FutUserTrades returns account trade history for a symbol.
func (c *Client) FutUserTrades(symbol string, limit int) ([]TradeRecord, error) {
	params := url.Values{"symbol": {symbol}}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futSignedGet(c.futPath("/fapi/v1/userTrades", "/fapi/v3/userTrades"), params)
	if err != nil {
		return nil, err
	}
	var trades []TradeRecord
	if err := json.Unmarshal(data, &trades); err != nil {
		return nil, err
	}
	return trades, nil
}

// FutIncome returns income history (PnL, funding, commission).
func (c *Client) FutIncome(symbol, incomeType string, limit int) ([]IncomeRecord, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	if incomeType != "" {
		params.Set("incomeType", incomeType)
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futSignedGet(c.futPath("/fapi/v1/income", "/fapi/v3/income"), params)
	if err != nil {
		return nil, err
	}
	var records []IncomeRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, err
	}
	return records, nil
}

// ═══════════════════════════════════════════════════════════════════════
// LEVERAGE & MARGIN
// ═══════════════════════════════════════════════════════════════════════

// FutChangeLeverage changes initial leverage for a symbol.
func (c *Client) FutChangeLeverage(symbol string, leverage int) (*LeverageResponse, error) {
	params := url.Values{
		"symbol":   {symbol},
		"leverage": {strconv.Itoa(leverage)},
	}
	data, err := c.futSignedPost(c.futPath("/fapi/v1/leverage", "/fapi/v3/leverage"), params)
	if err != nil {
		return nil, err
	}
	var resp LeverageResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// FutChangeMarginType changes margin type (ISOLATED/CROSSED).
func (c *Client) FutChangeMarginType(symbol string, marginType MarginType) error {
	params := url.Values{
		"symbol":     {symbol},
		"marginType": {string(marginType)},
	}
	_, err := c.futSignedPost(c.futPath("/fapi/v1/marginType", "/fapi/v3/marginType"), params)
	return err
}

// FutModifyPositionMargin adds or removes position margin.
// marginType: 1 = add, 2 = reduce.
func (c *Client) FutModifyPositionMargin(symbol string, amount string, marginChangeType int) error {
	params := url.Values{
		"symbol": {symbol},
		"amount": {amount},
		"type":   {strconv.Itoa(marginChangeType)},
	}
	_, err := c.futSignedPost(c.futPath("/fapi/v1/positionMargin", "/fapi/v3/positionMargin"), params)
	return err
}

// FutLeverageBrackets returns notional and leverage brackets.
func (c *Client) FutLeverageBrackets(symbol string) ([]LeverageBracket, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futSignedGet(c.futPath("/fapi/v1/leverageBracket", "/fapi/v3/leverageBracket"), params)
	if err != nil {
		return nil, err
	}
	// When symbol is provided, returns single object vs array
	if symbol != "" {
		var single LeverageBracket
		if err := json.Unmarshal(data, &single); err != nil {
			return nil, err
		}
		return []LeverageBracket{single}, nil
	}
	var brackets []LeverageBracket
	if err := json.Unmarshal(data, &brackets); err != nil {
		return nil, err
	}
	return brackets, nil
}

// ═══════════════════════════════════════════════════════════════════════
// POSITION MODE
// ═══════════════════════════════════════════════════════════════════════

// FutGetPositionMode returns hedge mode status.
func (c *Client) FutGetPositionMode() (bool, error) {
	data, err := c.futSignedGet(c.futPath("/fapi/v1/positionSide/dual", "/fapi/v3/positionSide/dual"), url.Values{})
	if err != nil {
		return false, err
	}
	var resp struct {
		DualSidePosition bool `json:"dualSidePosition"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return false, err
	}
	return resp.DualSidePosition, nil
}

// FutSetPositionMode sets hedge mode (true) or one-way mode (false).
func (c *Client) FutSetPositionMode(hedgeMode bool) error {
	val := "false"
	if hedgeMode {
		val = "true"
	}
	params := url.Values{"dualSidePosition": {val}}
	_, err := c.futSignedPost(c.futPath("/fapi/v1/positionSide/dual", "/fapi/v3/positionSide/dual"), params)
	return err
}

// ═══════════════════════════════════════════════════════════════════════
// TRANSFER
// ═══════════════════════════════════════════════════════════════════════

// Transfer moves funds between spot and futures.
// kindType: "SPOT_FUTURE" or "FUTURE_SPOT"
func (c *Client) Transfer(asset string, amount string, kindType string, clientTranID string) (*TransferResponse, error) {
	params := url.Values{
		"asset":        {asset},
		"amount":       {amount},
		"kindType":     {kindType},
		"clientTranId": {clientTranID},
	}
	// Uses the futures endpoint for transfers
	data, err := c.futSignedPost(c.futPath("/fapi/v1/asset/wallet/transfer", "/fapi/v3/asset/wallet/transfer"), params)
	if err != nil {
		return nil, err
	}
	var resp TransferResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ═══════════════════════════════════════════════════════════════════════
// LISTEN KEY (User Data Stream)
// ═══════════════════════════════════════════════════════════════════════

// FutCreateListenKey creates or returns a user data stream listen key.
func (c *Client) FutCreateListenKey() (string, error) {
	var (
		req []byte
		err error
	)
	if c.usesV3Auth() {
		req, err = c.futSignedPost("/fapi/v3/listenKey", url.Values{})
	} else {
		req, err = c.doPublic("POST", c.futBase, "/fapi/v1/listenKey", nil)
	}
	if err != nil {
		return "", err
	}
	var resp ListenKeyResponse
	if err := json.Unmarshal(req, &resp); err != nil {
		return "", err
	}
	return resp.ListenKey, nil
}

// FutExtendListenKey extends the validity of a listen key.
func (c *Client) FutExtendListenKey(listenKey string) error {
	params := url.Values{"listenKey": {listenKey}}
	var err error
	if c.usesV3Auth() {
		_, err = c.futSignedPut("/fapi/v3/listenKey", params)
	} else {
		_, err = c.doPublic("PUT", c.futBase, "/fapi/v1/listenKey", params)
	}
	return err
}

// FutCloseListenKey closes a user data stream.
func (c *Client) FutCloseListenKey(listenKey string) error {
	params := url.Values{"listenKey": {listenKey}}
	var err error
	if c.usesV3Auth() {
		_, err = c.futSignedDelete("/fapi/v3/listenKey", params)
	} else {
		_, err = c.doPublic("DELETE", c.futBase, "/fapi/v1/listenKey", params)
	}
	return err
}

// ═══════════════════════════════════════════════════════════════════════
// SPOT ORDERS (simplified)
// ═══════════════════════════════════════════════════════════════════════

// SpotNewOrder places a new spot order.
func (c *Client) SpotNewOrder(p NewOrderParams) (*OrderResponse, error) {
	params := url.Values{
		"symbol": {p.Symbol},
		"side":   {string(p.Side)},
		"type":   {string(p.Type)},
	}
	if p.TimeInForce != "" {
		params.Set("timeInForce", string(p.TimeInForce))
	}
	if p.Quantity != "" {
		params.Set("quantity", p.Quantity)
	}
	if p.Price != "" {
		params.Set("price", p.Price)
	}
	if p.StopPrice != "" {
		params.Set("stopPrice", p.StopPrice)
	}
	if p.NewClientOrderID != "" {
		params.Set("newClientOrderId", p.NewClientOrderID)
	}
	data, err := c.spotSignedPost(c.spotPath("/api/v1/order", "/api/v3/order"), params)
	if err != nil {
		return nil, err
	}
	var order OrderResponse
	if err := json.Unmarshal(data, &order); err != nil {
		return nil, err
	}
	return &order, nil
}

// SpotAccount returns spot account information.
func (c *Client) SpotAccount() (*FuturesAccount, error) {
	data, err := c.spotSignedGet(c.spotPath("/api/v1/account", "/api/v3/account"), url.Values{})
	if err != nil {
		return nil, err
	}
	var account FuturesAccount
	if err := json.Unmarshal(data, &account); err != nil {
		return nil, err
	}
	return &account, nil
}

// ═══════════════════════════════════════════════════════════════════════
// BATCH ORDERS
// ═══════════════════════════════════════════════════════════════════════

// FutBatchOrders places up to 5 orders at once.
func (c *Client) FutBatchOrders(orders []NewOrderParams) ([]json.RawMessage, error) {
	if len(orders) > 5 {
		return nil, fmt.Errorf("max 5 batch orders, got %d", len(orders))
	}

	// Build batch order list
	var batch []map[string]string
	for _, p := range orders {
		o := map[string]string{
			"symbol": p.Symbol,
			"side":   string(p.Side),
			"type":   string(p.Type),
		}
		if p.PositionSide != "" {
			o["positionSide"] = string(p.PositionSide)
		}
		if p.TimeInForce != "" {
			o["timeInForce"] = string(p.TimeInForce)
		}
		if p.Quantity != "" {
			o["quantity"] = p.Quantity
		}
		if p.Price != "" {
			o["price"] = p.Price
		}
		if p.StopPrice != "" {
			o["stopPrice"] = p.StopPrice
		}
		if p.ReduceOnly {
			o["reduceOnly"] = "true"
		}
		if p.WorkingType != "" {
			o["workingType"] = string(p.WorkingType)
		}
		batch = append(batch, o)
	}

	batchJSON, err := json.Marshal(batch)
	if err != nil {
		return nil, err
	}

	params := url.Values{
		"batchOrders": {string(batchJSON)},
	}

	data, err := c.futSignedPost(c.futPath("/fapi/v1/batchOrders", "/fapi/v3/batchOrders"), params)
	if err != nil {
		return nil, err
	}

	var results []json.RawMessage
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, err
	}
	return results, nil
}
