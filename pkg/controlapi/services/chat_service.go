package services

import (
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type chatRoomState struct {
	room           types.ChatRoom
	participantIDs []string
}

type ChatService struct {
	mu       sync.RWMutex
	users    map[string]types.ChatUser
	rooms    map[string]*chatRoomState
	messages map[string][]types.ChatMessage
}

func NewChatService() *ChatService {
	now := time.Now().UTC()
	users := map[string]types.ChatUser{
		"user-seeker": {ID: "user-seeker", Username: "seeker"},
		"user-grok":   {ID: "user-grok", Username: "grok.vision"},
		"user-nano":   {ID: "user-nano", Username: "nano.sol"},
		"user-pump":   {ID: "user-pump", Username: "pump.ops"},
	}
	globalParticipants := []string{"user-seeker", "user-grok", "user-nano"}
	room := &chatRoomState{
		room: types.ChatRoom{
			ID:        "chat-global",
			Type:      "global",
			Name:      "Global Community",
			IsActive:  true,
			CreatedAt: now,
			UpdatedAt: now,
		},
		participantIDs: globalParticipants,
	}
	svc := &ChatService{
		users:    users,
		rooms:    map[string]*chatRoomState{"chat-global": room},
		messages: map[string][]types.ChatMessage{},
	}
	room.room.Participants = svc.buildParticipants(globalParticipants, "user-seeker")
	msg, _ := svc.SendMessage(types.SendChatMessageRequest{
		ChatID:  "chat-global",
		UserID:  "user-grok",
		Content: "Global chat is ready for Grok commentary, feed cross-posts, and wallet-aware coordination.",
	})
	room.room.LastMessage = &msg
	return svc
}

func (s *ChatService) ListUserChats(userID string) ([]types.ChatRoom, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.users[userID]; !ok {
		return nil, fmt.Errorf("user not found")
	}
	var out []types.ChatRoom
	for _, state := range s.rooms {
		if !slices.Contains(state.participantIDs, userID) {
			continue
		}
		room := state.room
		room.Participants = s.buildParticipants(state.participantIDs, userID)
		if msgs := s.messages[room.ID]; len(msgs) > 0 {
			last := msgs[len(msgs)-1]
			room.LastMessage = &last
		}
		out = append(out, room)
	}
	slices.SortFunc(out, func(a, b types.ChatRoom) int {
		return b.UpdatedAt.Compare(a.UpdatedAt)
	})
	return out, nil
}

func (s *ChatService) CreateDirectChat(userID, otherUserID string) (types.ChatRoom, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if userID == otherUserID {
		return types.ChatRoom{}, false, fmt.Errorf("cannot create chat with yourself")
	}
	if _, ok := s.users[userID]; !ok {
		return types.ChatRoom{}, false, fmt.Errorf("userId not found")
	}
	if _, ok := s.users[otherUserID]; !ok {
		return types.ChatRoom{}, false, fmt.Errorf("otherUserId not found")
	}
	for _, state := range s.rooms {
		if state.room.Type != "direct" {
			continue
		}
		if len(state.participantIDs) == 2 &&
			slices.Contains(state.participantIDs, userID) &&
			slices.Contains(state.participantIDs, otherUserID) {
			room := state.room
			room.Participants = s.buildParticipants(state.participantIDs, userID)
			return room, true, nil
		}
	}
	now := time.Now().UTC()
	id := "chat-" + uuid.NewString()
	state := &chatRoomState{
		room: types.ChatRoom{
			ID:        id,
			Type:      "direct",
			IsActive:  true,
			CreatedAt: now,
			UpdatedAt: now,
		},
		participantIDs: []string{userID, otherUserID},
	}
	state.room.Participants = s.buildParticipants(state.participantIDs, userID)
	s.rooms[id] = state
	return state.room, false, nil
}

func (s *ChatService) CreateGroupChat(name, userID string, participantIDs []string) (types.ChatRoom, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.TrimSpace(name) == "" {
		return types.ChatRoom{}, fmt.Errorf("name is required")
	}
	if _, ok := s.users[userID]; !ok {
		return types.ChatRoom{}, fmt.Errorf("userId not found")
	}
	all := append([]string{userID}, participantIDs...)
	seen := map[string]bool{}
	var deduped []string
	for _, id := range all {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		if _, ok := s.users[id]; !ok {
			return types.ChatRoom{}, fmt.Errorf("participant `%s` not found", id)
		}
		seen[id] = true
		deduped = append(deduped, id)
	}
	now := time.Now().UTC()
	id := "chat-" + uuid.NewString()
	state := &chatRoomState{
		room: types.ChatRoom{
			ID:        id,
			Type:      "group",
			Name:      name,
			IsActive:  true,
			CreatedAt: now,
			UpdatedAt: now,
		},
		participantIDs: deduped,
	}
	state.room.Participants = s.buildParticipants(deduped, userID)
	s.rooms[id] = state
	return state.room, nil
}

func (s *ChatService) GetMessages(chatID string, limit int, before time.Time) ([]types.ChatMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.rooms[chatID]; !ok {
		return nil, fmt.Errorf("chat not found")
	}
	msgs := s.messages[chatID]
	var filtered []types.ChatMessage
	for _, msg := range msgs {
		if !before.IsZero() && !msg.CreatedAt.Before(before) {
			continue
		}
		filtered = append(filtered, msg)
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if len(filtered) > limit {
		filtered = filtered[len(filtered)-limit:]
	}
	out := make([]types.ChatMessage, len(filtered))
	copy(out, filtered)
	return out, nil
}

func (s *ChatService) SendMessage(req types.SendChatMessageRequest) (types.ChatMessage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.rooms[req.ChatID]
	if !ok {
		return types.ChatMessage{}, fmt.Errorf("chat not found")
	}
	if _, ok := s.users[req.UserID]; !ok {
		return types.ChatMessage{}, fmt.Errorf("user not found")
	}
	if !slices.Contains(state.participantIDs, req.UserID) {
		return types.ChatMessage{}, fmt.Errorf("user is not a participant in this chat")
	}
	hasText := strings.TrimSpace(req.Content) != ""
	hasImage := strings.TrimSpace(req.ImageURL) != ""
	hasExtra := len(req.AdditionalData) > 0
	if !hasText && !hasImage && !hasExtra {
		return types.ChatMessage{}, fmt.Errorf("message must contain text, imageUrl, or additionalData")
	}
	now := time.Now().UTC()
	msg := types.ChatMessage{
		ID:             "msg-" + uuid.NewString(),
		ChatRoomID:     req.ChatID,
		Sender:         s.users[req.UserID],
		Content:        req.Content,
		ImageURL:       req.ImageURL,
		AdditionalData: req.AdditionalData,
		IsDeleted:      false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	s.messages[req.ChatID] = append(s.messages[req.ChatID], msg)
	state.room.UpdatedAt = now
	state.room.LastMessage = &msg
	return msg, nil
}

func (s *ChatService) EditMessage(messageID, userID, content string) (types.ChatMessage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for roomID, msgs := range s.messages {
		for idx, msg := range msgs {
			if msg.ID != messageID {
				continue
			}
			if msg.Sender.ID != userID {
				return types.ChatMessage{}, fmt.Errorf("message not found or you are not authorized to edit it")
			}
			msg.Content = content
			msg.UpdatedAt = time.Now().UTC()
			msgs[idx] = msg
			s.messages[roomID] = msgs
			return msg, nil
		}
	}
	return types.ChatMessage{}, fmt.Errorf("message not found")
}

func (s *ChatService) DeleteMessage(messageID, userID string) (types.ChatMessage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for roomID, msgs := range s.messages {
		for idx, msg := range msgs {
			if msg.ID != messageID {
				continue
			}
			if msg.Sender.ID != userID {
				return types.ChatMessage{}, fmt.Errorf("message not found or you are not authorized to delete it")
			}
			msg.IsDeleted = true
			msg.Content = "[This message has been deleted]"
			msg.UpdatedAt = time.Now().UTC()
			msgs[idx] = msg
			s.messages[roomID] = msgs
			return msg, nil
		}
	}
	return types.ChatMessage{}, fmt.Errorf("message not found")
}

func (s *ChatService) SearchUsers(query, excludeUserID string) []types.ChatUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []types.ChatUser
	q := strings.ToLower(strings.TrimSpace(query))
	for _, user := range s.users {
		if user.ID == excludeUserID {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(user.Username), q) {
			continue
		}
		out = append(out, user)
	}
	slices.SortFunc(out, func(a, b types.ChatUser) int {
		return strings.Compare(a.Username, b.Username)
	})
	return out
}

func (s *ChatService) buildParticipants(ids []string, adminID string) []types.ChatParticipant {
	participants := make([]types.ChatParticipant, 0, len(ids))
	for _, id := range ids {
		user, ok := s.users[id]
		if !ok {
			continue
		}
		participants = append(participants, types.ChatParticipant{
			User:    user,
			IsAdmin: id == adminID,
		})
	}
	return participants
}
