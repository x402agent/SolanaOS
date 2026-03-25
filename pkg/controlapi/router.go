package controlapi

import (
	"log"
	"net/http"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/controllers"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
)

type Server struct {
	status     *controllers.StatusController
	intents    *controllers.IntentsController
	chat       *controllers.ChatController
	threads    *controllers.ThreadController
	trade      *controllers.TradeController
	pumpfun    *controllers.PumpfunController
	tokenMill  *controllers.TokenMillController
	openRouter *controllers.OpenRouterController
}

func NewServer() *Server {
	config := services.NewConfigService()
	threadService := services.NewThreadService()
	execution := services.NewExecutionService()
	chat := services.NewChatService()
	jupiter := services.NewJupiterService()
	vision := services.NewVisionService(config)
	return &Server{
		status:     controllers.NewStatusController(config, threadService, execution),
		intents:    controllers.NewIntentsController(execution),
		chat:       controllers.NewChatController(chat),
		threads:    controllers.NewThreadController(threadService),
		trade:      controllers.NewTradeController(jupiter, execution),
		pumpfun:    controllers.NewPumpfunController(execution),
		tokenMill:  controllers.NewTokenMillController(execution),
		openRouter: controllers.NewOpenRouterController(config, vision),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.status.Health)
	mux.HandleFunc("GET /api/control/status", s.status.Status)
	mux.HandleFunc("GET /api/control/intents", s.intents.List)
	mux.HandleFunc("GET /api/control/chat/users/{userId}/rooms", s.chat.GetUserChats)
	mux.HandleFunc("POST /api/control/chat/direct", s.chat.CreateDirectChat)
	mux.HandleFunc("POST /api/control/chat/group", s.chat.CreateGroupChat)
	mux.HandleFunc("GET /api/control/chat/rooms/{chatId}/messages", s.chat.GetChatMessages)
	mux.HandleFunc("POST /api/control/chat/messages", s.chat.SendMessage)
	mux.HandleFunc("PUT /api/control/chat/messages/{messageId}", s.chat.EditMessage)
	mux.HandleFunc("DELETE /api/control/chat/messages/{messageId}", s.chat.DeleteMessage)
	mux.HandleFunc("GET /api/control/chat/users", s.chat.SearchUsers)
	mux.HandleFunc("GET /api/control/threads", s.threads.List)
	mux.HandleFunc("POST /api/control/threads", s.threads.Create)
	mux.HandleFunc("POST /api/control/trade/quote", s.trade.Quote)
	mux.HandleFunc("POST /api/control/trade/stage", s.trade.Stage)
	mux.HandleFunc("POST /api/control/pumpfun/launch", s.pumpfun.Launch)
	mux.HandleFunc("POST /api/control/pumpfun/buy", s.pumpfun.Buy)
	mux.HandleFunc("POST /api/control/pumpfun/sell", s.pumpfun.Sell)
	mux.HandleFunc("POST /api/control/tokenmill/market", s.tokenMill.CreateMarket)
	mux.HandleFunc("GET /api/control/openrouter/config", s.openRouter.Config)
	mux.HandleFunc("POST /api/control/openrouter/vision", s.openRouter.VisionAnalyze)
	return withLogging(mux)
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[control-api] %s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}
