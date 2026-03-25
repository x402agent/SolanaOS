package types

import "time"

type APIResponse struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

type ThreadItem struct {
	ID        string    `json:"id"`
	Author    string    `json:"author"`
	Headline  string    `json:"headline"`
	Body      string    `json:"body"`
	Kind      string    `json:"kind"`
	Stats     string    `json:"stats"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateThreadRequest struct {
	Author   string `json:"author"`
	Headline string `json:"headline"`
	Body     string `json:"body"`
	Kind     string `json:"kind"`
	Stats    string `json:"stats"`
}

type TradeQuoteRequest struct {
	FromToken   string  `json:"fromToken"`
	ToToken     string  `json:"toToken"`
	Amount      float64 `json:"amount"`
	SlippageBps int     `json:"slippageBps"`
}

type TradeQuoteResponse struct {
	Provider    string `json:"provider"`
	InputMint   string `json:"inputMint"`
	OutputMint  string `json:"outputMint"`
	InAmount    string `json:"inAmount"`
	OutAmount   string `json:"outAmount"`
	OtherAmount string `json:"otherAmountThreshold,omitempty"`
	SwapMode    string `json:"swapMode,omitempty"`
	PriceImpact string `json:"priceImpactPct,omitempty"`
	RouteCount  int    `json:"routeCount,omitempty"`
	Raw         any    `json:"raw,omitempty"`
}

type TradeStageRequest struct {
	FromToken   string  `json:"fromToken"`
	ToToken     string  `json:"toToken"`
	Amount      float64 `json:"amount"`
	SlippageBps int     `json:"slippageBps"`
}

type PumpfunLaunchRequest struct {
	Name        string  `json:"name"`
	Symbol      string  `json:"symbol"`
	Description string  `json:"description"`
	AmountSOL   float64 `json:"amountSol"`
}

type PumpfunSwapRequest struct {
	TokenAddress string  `json:"tokenAddress"`
	AmountSOL    float64 `json:"amountSol"`
}

type TokenMillMarketRequest struct {
	Name        string  `json:"name"`
	CurvePreset string  `json:"curvePreset"`
	SeedSOL     float64 `json:"seedSol"`
}

type StagedIntent struct {
	ID        string         `json:"id"`
	Kind      string         `json:"kind"`
	Status    string         `json:"status"`
	Summary   string         `json:"summary"`
	Payload   map[string]any `json:"payload"`
	CreatedAt time.Time      `json:"createdAt"`
}

type OpenRouterConfig struct {
	Enabled   bool   `json:"enabled"`
	Model     string `json:"model"`
	GrokModel string `json:"grokModel"`
}

type VisionAnalyzeRequest struct {
	Prompt      string `json:"prompt"`
	ImageBase64 string `json:"imageBase64"`
	MimeType    string `json:"mimeType"`
}

type VisionAnalyzeResponse struct {
	Model   string `json:"model"`
	Comment string `json:"comment"`
}

type ControlStatus struct {
	Service         string           `json:"service"`
	OpenRouter      OpenRouterConfig `json:"openRouter"`
	ThreadCount     int              `json:"threadCount"`
	StagedIntentCount int            `json:"stagedIntentCount"`
	Features        []string         `json:"features"`
}

type ChatUser struct {
	ID                string `json:"id"`
	Username          string `json:"username"`
	ProfilePictureURL string `json:"profilePictureUrl,omitempty"`
}

type ChatParticipant struct {
	User    ChatUser `json:"user"`
	IsAdmin bool     `json:"isAdmin"`
}

type ChatMessage struct {
	ID             string         `json:"id"`
	ChatRoomID     string         `json:"chatRoomId"`
	Sender         ChatUser       `json:"sender"`
	Content        string         `json:"content"`
	ImageURL       string         `json:"imageUrl,omitempty"`
	AdditionalData map[string]any `json:"additionalData,omitempty"`
	IsDeleted      bool           `json:"isDeleted"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

type ChatRoom struct {
	ID           string            `json:"id"`
	Type         string            `json:"type"`
	Name         string            `json:"name,omitempty"`
	IsActive     bool              `json:"isActive"`
	Participants []ChatParticipant `json:"participants"`
	LastMessage  *ChatMessage      `json:"lastMessage,omitempty"`
	UnreadCount  int               `json:"unreadCount"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

type CreateDirectChatRequest struct {
	UserID      string `json:"userId"`
	OtherUserID string `json:"otherUserId"`
}

type CreateGroupChatRequest struct {
	Name           string   `json:"name"`
	UserID         string   `json:"userId"`
	ParticipantIDs []string `json:"participantIds"`
}

type SendChatMessageRequest struct {
	ChatID         string         `json:"chatId"`
	UserID         string         `json:"userId"`
	Content        string         `json:"content"`
	ImageURL       string         `json:"imageUrl"`
	AdditionalData map[string]any `json:"additionalData"`
}

type EditChatMessageRequest struct {
	UserID  string `json:"userId"`
	Content string `json:"content"`
}
