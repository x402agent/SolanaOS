package hyperliquid

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

func (c *Client) AccountState(ctx context.Context) (*UserState, error) {
	body, err := c.post(ctx, "/info", map[string]any{
		"type": "clearinghouseState",
		"user": c.wallet,
	})
	if err != nil {
		return nil, err
	}
	var state UserState
	if err := json.Unmarshal(body, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (c *Client) OpenOrders(ctx context.Context) ([]OpenOrder, error) {
	body, err := c.post(ctx, "/info", map[string]any{
		"type": "openOrders",
		"user": c.wallet,
	})
	if err != nil {
		return nil, err
	}
	var orders []OpenOrder
	if err := json.Unmarshal(body, &orders); err != nil {
		return nil, err
	}
	return orders, nil
}

func (c *Client) AllMids(ctx context.Context) (map[string]string, error) {
	body, err := c.post(ctx, "/info", map[string]any{"type": "allMids"})
	if err != nil {
		return nil, err
	}
	var mids map[string]string
	if err := json.Unmarshal(body, &mids); err != nil {
		return nil, err
	}
	return mids, nil
}

func (c *Client) UserFills(ctx context.Context, aggregateByTime bool) ([]Fill, error) {
	payload := map[string]any{
		"type": "userFills",
		"user": c.wallet,
	}
	if aggregateByTime {
		payload["aggregateByTime"] = true
	}
	body, err := c.post(ctx, "/info", payload)
	if err != nil {
		return nil, err
	}
	var fills []Fill
	if err := json.Unmarshal(body, &fills); err != nil {
		return nil, err
	}
	return fills, nil
}

func (c *Client) CandleSnapshot(ctx context.Context, coin, interval string, startTime, endTime int64) ([]Candle, error) {
	body, err := c.post(ctx, "/info", map[string]any{
		"type": "candleSnapshot",
		"req": map[string]any{
			"coin":      strings.ToUpper(strings.TrimSpace(coin)),
			"interval":  interval,
			"startTime": startTime,
			"endTime":   endTime,
		},
	})
	if err != nil {
		return nil, err
	}
	var candles []Candle
	if err := json.Unmarshal(body, &candles); err != nil {
		return nil, err
	}
	return candles, nil
}

func (c *Client) MarketState(ctx context.Context, coin string) (*MarketState, error) {
	body, err := c.post(ctx, "/info", map[string]any{"type": "metaAndAssetCtxs"})
	if err != nil {
		return nil, err
	}
	var raw []json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	if len(raw) < 2 {
		return nil, fmt.Errorf("hl market state: malformed metaAndAssetCtxs response")
	}
	var meta metaResponse
	if err := json.Unmarshal(raw[0], &meta); err != nil {
		return nil, err
	}
	var ctxs []assetCtx
	if err := json.Unmarshal(raw[1], &ctxs); err != nil {
		return nil, err
	}
	coin = strings.ToUpper(strings.TrimSpace(coin))
	for i, asset := range meta.Universe {
		if strings.EqualFold(asset.Name, coin) {
			if i >= len(ctxs) {
				return nil, fmt.Errorf("hl market state: missing asset context for %s", coin)
			}
			ctx := ctxs[i]
			return &MarketState{
				Coin:         asset.Name,
				MarkPx:       ctx.MarkPx,
				OraclePx:     ctx.OraclePx,
				MidPx:        ctx.MidPx,
				Funding:      ctx.Funding,
				OpenInterest: ctx.OpenInterest,
				DayNtlVlm:    ctx.DayNtlVlm,
				PrevDayPx:    ctx.PrevDayPx,
				MaxLeverage:  asset.MaxLeverage,
				SzDecimals:   asset.SzDecimals,
			}, nil
		}
	}
	return nil, fmt.Errorf("unknown coin: %s", coin)
}

func (c *Client) MarketOpen(ctx context.Context, coin string, isBuy bool, sz float64, slippage float64) error {
	if slippage <= 0 {
		slippage = DefaultSlippage
	}
	_, err := c.placeLimitOrder(ctx, coin, isBuy, sz, nil, slippage, "Ioc", false)
	return err
}

func (c *Client) MarketClose(ctx context.Context, coin string, sz float64, slippage float64) error {
	if slippage <= 0 {
		slippage = DefaultSlippage
	}
	state, err := c.AccountState(ctx)
	if err != nil {
		return err
	}
	coin = strings.ToUpper(strings.TrimSpace(coin))
	for _, ap := range state.AssetPositions {
		if !strings.EqualFold(ap.Position.Coin, coin) {
			continue
		}
		szi, _ := strconv.ParseFloat(ap.Position.Szi, 64)
		size := sz
		if size == 0 {
			if szi < 0 {
				size = -szi
			} else {
				size = szi
			}
		}
		isBuy := szi < 0
		_, err := c.placeLimitOrder(ctx, coin, isBuy, size, nil, slippage, "Ioc", true)
		return err
	}
	return fmt.Errorf("no open position for %s", coin)
}

func (c *Client) PlaceLimitOrder(ctx context.Context, coin string, isBuy bool, sz, px float64, tif string, reduceOnly bool) (*OrderResult, error) {
	price := px
	return c.placeLimitOrder(ctx, coin, isBuy, sz, &price, 0, tif, reduceOnly)
}

func (c *Client) placeLimitOrder(ctx context.Context, coin string, isBuy bool, sz float64, px *float64, slippage float64, tif string, reduceOnly bool) (*OrderResult, error) {
	if err := c.loadMeta(ctx); err != nil {
		return nil, err
	}
	coin = strings.ToUpper(strings.TrimSpace(coin))
	asset, err := c.coinToAssetID(ctx, coin)
	if err != nil {
		return nil, err
	}
	price, err := c.slippagePrice(ctx, coin, isBuy, slippage, px)
	if err != nil {
		return nil, err
	}
	pxWire, err := floatToWire(price)
	if err != nil {
		return nil, err
	}
	szWire, err := floatToWire(sz)
	if err != nil {
		return nil, err
	}
	action := orderAction{
		Type: "order",
		Orders: []orderWire{{
			Asset:      asset,
			IsBuy:      isBuy,
			LimitPx:    pxWire,
			Size:       szWire,
			ReduceOnly: reduceOnly,
			OrderType:  orderWireType{Limit: &orderWireTypeLimit{Tif: canonicalTIF(tif)}},
		}},
		Grouping: "na",
	}
	body, err := c.executeAction(ctx, action)
	if err != nil {
		return nil, err
	}
	status, err := firstOrderStatus(body)
	if err != nil {
		return nil, err
	}
	return orderResultFromStatus(status), nil
}

func (c *Client) CancelOrder(ctx context.Context, coin string, oid int64) error {
	if err := c.loadMeta(ctx); err != nil {
		return err
	}
	asset, err := c.coinToAssetID(ctx, coin)
	if err != nil {
		return err
	}
	body, err := c.executeAction(ctx, cancelAction{
		Type:    "cancel",
		Cancels: []cancelWire{{Asset: asset, OrderID: oid}},
	})
	if err != nil {
		return err
	}
	return checkCancelResponse(body)
}

func (c *Client) CancelAll(ctx context.Context) (int, error) {
	orders, err := c.OpenOrders(ctx)
	if err != nil {
		return 0, err
	}
	if len(orders) == 0 {
		return 0, nil
	}
	if err := c.loadMeta(ctx); err != nil {
		return 0, err
	}
	cancels := make([]cancelWire, 0, len(orders))
	for _, o := range orders {
		asset, err := c.coinToAssetID(ctx, o.Coin)
		if err != nil {
			continue
		}
		cancels = append(cancels, cancelWire{Asset: asset, OrderID: o.Oid})
	}
	if len(cancels) == 0 {
		return 0, nil
	}
	body, err := c.executeAction(ctx, cancelAction{Type: "cancel", Cancels: cancels})
	if err != nil {
		return 0, err
	}
	if err := checkCancelResponse(body); err != nil {
		return 0, err
	}
	return len(cancels), nil
}

func (c *Client) UpdateLeverage(ctx context.Context, coin string, leverage int, isCross bool) (*UserState, error) {
	if leverage <= 0 {
		return nil, fmt.Errorf("leverage must be greater than 0")
	}
	if err := c.loadMeta(ctx); err != nil {
		return nil, err
	}
	asset, err := c.coinToAssetID(ctx, coin)
	if err != nil {
		return nil, err
	}
	body, err := c.executeAction(ctx, updateLeverageAction{
		Type:     "updateLeverage",
		Asset:    asset,
		IsCross:  isCross,
		Leverage: leverage,
	})
	if err != nil {
		return nil, err
	}
	if _, err := decodeExchangeData[json.RawMessage](body); err != nil {
		return nil, err
	}
	return c.AccountState(ctx)
}

func canonicalTIF(tif string) string {
	switch strings.ToLower(strings.TrimSpace(tif)) {
	case "alo":
		return "Alo"
	case "gtc":
		return "Gtc"
	default:
		return "Ioc"
	}
}

func orderResultFromStatus(s orderStatus) *OrderResult {
	res := &OrderResult{}
	if s.Resting != nil {
		res.Status = "resting"
		res.Oid = s.Resting.Oid
		if s.Resting.Cloid != nil {
			res.ClientOrderID = *s.Resting.Cloid
		}
		return res
	}
	if s.Filled != nil {
		res.Status = "filled"
		res.Oid = s.Filled.Oid
		res.AvgPx = s.Filled.AvgPx
		res.TotalSz = s.Filled.TotalSz
		return res
	}
	if s.Error != nil {
		res.Status = "error"
	}
	return res
}

func firstOrderStatus(body []byte) (orderStatus, error) {
	data, err := decodeExchangeData[struct {
		Statuses []orderStatus `json:"statuses"`
	}](body)
	if err != nil {
		return orderStatus{}, err
	}
	if len(data.Statuses) == 0 {
		return orderStatus{}, fmt.Errorf("hl exchange error: missing order status")
	}
	status := data.Statuses[0]
	if status.Error != nil {
		return orderStatus{}, fmt.Errorf("hl order error: %s", *status.Error)
	}
	return status, nil
}

func checkCancelResponse(body []byte) error {
	data, err := decodeExchangeData[cancelResponse](body)
	if err != nil {
		return err
	}
	for _, raw := range data.Statuses {
		var status string
		if err := json.Unmarshal(raw, &status); err == nil {
			if status != "success" {
				return fmt.Errorf("hl cancel error: %s", status)
			}
			continue
		}
		var wrapped struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(raw, &wrapped); err == nil && wrapped.Error != "" {
			return fmt.Errorf("hl cancel error: %s", wrapped.Error)
		}
	}
	return nil
}

func decodeExchangeData[T any](body []byte) (T, error) {
	var zero T
	var probe struct {
		Status   string          `json:"status"`
		Response json.RawMessage `json:"response"`
	}
	if err := json.Unmarshal(body, &probe); err != nil {
		return zero, fmt.Errorf("hl decode response: %w", err)
	}
	if probe.Status != "ok" {
		return zero, fmt.Errorf("hl exchange error: status=%s body=%s", probe.Status, truncate(string(body), 200))
	}
	var wrapped struct {
		Type string `json:"type"`
		Data T      `json:"data"`
	}
	if err := json.Unmarshal(probe.Response, &wrapped); err != nil {
		return zero, fmt.Errorf("hl decode success response: %w", err)
	}
	return wrapped.Data, nil
}
