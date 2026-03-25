package cron

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func ParseSchedule(raw string) (time.Duration, error) {
	raw = strings.ToLower(strings.TrimSpace(raw))
	switch raw {
	case "", "hourly":
		return time.Hour, nil
	case "daily", "@daily":
		return 24 * time.Hour, nil
	case "nightly":
		return 24 * time.Hour, nil
	case "weekly", "@weekly":
		return 7 * 24 * time.Hour, nil
	}

	if d, err := time.ParseDuration(raw); err == nil && d > 0 {
		return d, nil
	}

	if strings.HasSuffix(raw, "m") || strings.HasSuffix(raw, "h") {
		return time.ParseDuration(raw)
	}

	if n, err := strconv.Atoi(raw); err == nil && n > 0 {
		return time.Duration(n) * time.Minute, nil
	}

	return 0, fmt.Errorf("unsupported schedule: %s", raw)
}
