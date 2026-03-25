package controllers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/httpjson"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/services"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type ChatController struct {
	chat *services.ChatService
}

func NewChatController(chat *services.ChatService) *ChatController {
	return &ChatController{chat: chat}
}

func (c *ChatController) GetUserChats(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userId")
	if strings.TrimSpace(userID) == "" {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "Missing userId"})
		return
	}
	rooms, err := c.chat.ListUserChats(userID)
	if err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{Success: true, Data: map[string]any{"chats": rooms}})
}

func (c *ChatController) CreateDirectChat(w http.ResponseWriter, r *http.Request) {
	var req types.CreateDirectChatRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	room, existed, err := c.chat.CreateDirectChat(req.UserID, req.OtherUserID)
	if err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]any{
			"chat":    room,
			"chatId":  room.ID,
			"existed": existed,
		},
	})
}

func (c *ChatController) CreateGroupChat(w http.ResponseWriter, r *http.Request) {
	var req types.CreateGroupChatRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	room, err := c.chat.CreateGroupChat(req.Name, req.UserID, req.ParticipantIDs)
	if err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusCreated, types.APIResponse{
		Success: true,
		Data: map[string]any{
			"chat":   room,
			"chatId": room.ID,
		},
	})
}

func (c *ChatController) GetChatMessages(w http.ResponseWriter, r *http.Request) {
	chatID := r.PathValue("chatId")
	if strings.TrimSpace(chatID) == "" {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "Missing chatId"})
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	var before time.Time
	if raw := strings.TrimSpace(r.URL.Query().Get("before")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "invalid before timestamp"})
			return
		}
		before = parsed
	}
	messages, err := c.chat.GetMessages(chatID, limit, before)
	if err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{Success: true, Data: map[string]any{"messages": messages}})
}

func (c *ChatController) SendMessage(w http.ResponseWriter, r *http.Request) {
	var req types.SendChatMessageRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	message, err := c.chat.SendMessage(req)
	if err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusCreated, types.APIResponse{Success: true, Data: map[string]any{"message": message}})
}

func (c *ChatController) EditMessage(w http.ResponseWriter, r *http.Request) {
	messageID := r.PathValue("messageId")
	if strings.TrimSpace(messageID) == "" {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "Missing messageId"})
		return
	}
	var req types.EditChatMessageRequest
	if err := httpjson.Decode(r, &req); err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if strings.TrimSpace(req.UserID) == "" || strings.TrimSpace(req.Content) == "" {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "userId and content are required"})
		return
	}
	message, err := c.chat.EditMessage(messageID, req.UserID, req.Content)
	if err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{Success: true, Data: map[string]any{"message": message}})
}

func (c *ChatController) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	messageID := r.PathValue("messageId")
	userID := strings.TrimSpace(r.URL.Query().Get("userId"))
	if messageID == "" || userID == "" {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: "messageId and userId are required"})
		return
	}
	message, err := c.chat.DeleteMessage(messageID, userID)
	if err != nil {
		httpjson.Write(w, http.StatusBadRequest, types.APIResponse{Success: false, Error: err.Error()})
		return
	}
	httpjson.Write(w, http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]any{
			"messageId": message.ID,
			"chatId":    message.ChatRoomID,
			"message":   "Message deleted successfully",
		},
	})
}

func (c *ChatController) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	excludeUserID := r.URL.Query().Get("excludeUserId")
	users := c.chat.SearchUsers(query, excludeUserID)
	httpjson.Write(w, http.StatusOK, types.APIResponse{Success: true, Data: map[string]any{"users": users}})
}
