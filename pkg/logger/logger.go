// Package logger provides structured logging for MawdBot.
// Adapted from PicoClaw's logger — category-filtered, field-tagged log output.
package logger

import (
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	mu       sync.RWMutex
	level    Level = INFO
	disabled       = map[string]bool{}
)

type Level int

const (
	DEBUG Level = iota
	INFO
	WARN
	ERROR
	FATAL
)

var levelNames = map[Level]string{
	DEBUG: "DEBUG",
	INFO:  "INFO",
	WARN:  "WARN",
	ERROR: "ERROR",
	FATAL: "FATAL",
}

var levelColors = map[Level]string{
	DEBUG: "\033[36m",  // cyan
	INFO:  "\033[32m",  // green
	WARN:  "\033[33m",  // yellow
	ERROR: "\033[31m",  // red
	FATAL: "\033[35m",  // magenta
}

const resetColor = "\033[0m"

func SetLevel(l Level) {
	mu.Lock()
	defer mu.Unlock()
	level = l
}

func DisableCategory(cat string) {
	mu.Lock()
	defer mu.Unlock()
	disabled[cat] = true
}

func logf(l Level, category, msg string, fields map[string]any) {
	mu.RLock()
	if l < level {
		mu.RUnlock()
		return
	}
	if disabled[category] {
		mu.RUnlock()
		return
	}
	mu.RUnlock()

	ts := time.Now().Format("15:04:05.000")
	color := levelColors[l]
	lname := levelNames[l]

	var fieldStr string
	if len(fields) > 0 {
		pairs := make([]string, 0, len(fields))
		for k, v := range fields {
			pairs = append(pairs, fmt.Sprintf("%s=%v", k, v))
		}
		fieldStr = " " + strings.Join(pairs, " ")
	}

	line := fmt.Sprintf("%s%s %s [%s]%s %s%s",
		color, ts, lname, category, resetColor, msg, fieldStr)

	if l >= ERROR {
		log.New(os.Stderr, "", 0).Println(line)
	} else {
		log.New(os.Stdout, "", 0).Println(line)
	}

	if l == FATAL {
		os.Exit(1)
	}
}

// Category-filtered logging (CF = CategoryFields)
func DebugCF(cat, msg string, fields map[string]any) { logf(DEBUG, cat, msg, fields) }
func InfoCF(cat, msg string, fields map[string]any)  { logf(INFO, cat, msg, fields) }
func WarnCF(cat, msg string, fields map[string]any)   { logf(WARN, cat, msg, fields) }
func ErrorCF(cat, msg string, fields map[string]any)  { logf(ERROR, cat, msg, fields) }
func FatalCF(cat, msg string, fields map[string]any)  { logf(FATAL, cat, msg, fields) }

// Convenience shortcuts
func Debug(msg string) { logf(DEBUG, "solanaos", msg, nil) }
func Info(msg string)  { logf(INFO, "solanaos", msg, nil) }
func Warn(msg string)  { logf(WARN, "solanaos", msg, nil) }
func Error(msg string) { logf(ERROR, "solanaos", msg, nil) }
