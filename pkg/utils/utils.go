// Package utils provides shared utility functions for MawdBot.
// Adapted from PicoClaw's utils package.
package utils

import (
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// Truncate truncates a string to maxLen runes, appending "..." if truncated.
func Truncate(s string, maxLen int) string {
	if utf8.RuneCountInString(s) <= maxLen {
		return s
	}
	runes := []rune(s)
	if maxLen <= 3 {
		return string(runes[:maxLen])
	}
	return string(runes[:maxLen-3]) + "..."
}

// IsAudioFile checks if a file is an audio file by extension or content type.
func IsAudioFile(filename, contentType string) bool {
	ct := strings.ToLower(contentType)
	if strings.HasPrefix(ct, "audio/") || ct == "application/ogg" {
		return true
	}
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma", ".opus":
		return true
	}
	return false
}

// IsImageFile checks if a file is an image file.
func IsImageFile(filename, contentType string) bool {
	ct := strings.ToLower(contentType)
	if strings.HasPrefix(ct, "image/") {
		return true
	}
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return true
	}
	return false
}

// Contains checks if a slice contains a string (case-insensitive).
func Contains(slice []string, item string) bool {
	item = strings.ToLower(item)
	for _, s := range slice {
		if strings.ToLower(s) == item {
			return true
		}
	}
	return false
}

// Unique returns a deduplicated copy of a string slice.
func Unique(slice []string) []string {
	seen := make(map[string]bool, len(slice))
	result := make([]string, 0, len(slice))
	for _, s := range slice {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

// Coalesce returns the first non-empty string.
func Coalesce(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// SplitMessage splits a long message into chunks of maxLen runes.
func SplitMessage(content string, maxLen int) []string {
	if maxLen <= 0 || utf8.RuneCountInString(content) <= maxLen {
		return []string{content}
	}

	runes := []rune(content)
	var parts []string
	for len(runes) > 0 {
		end := maxLen
		if end > len(runes) {
			end = len(runes)
		}
		parts = append(parts, string(runes[:end]))
		runes = runes[end:]
	}
	return parts
}
