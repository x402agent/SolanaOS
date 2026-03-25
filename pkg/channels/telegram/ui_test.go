package telegram

import "testing"

func TestParseTelegramCallbackData(t *testing.T) {
	t.Parallel()

	action, value, ok := parseTelegramCallbackData("tg:cmd:/status")
	if !ok {
		t.Fatalf("expected callback payload to parse")
	}
	if action != telegramCallbackCmd {
		t.Fatalf("unexpected action: %q", action)
	}
	if value != "/status" {
		t.Fatalf("unexpected value: %q", value)
	}
}

func TestParseTelegramCallbackDataRejectsInvalidPayload(t *testing.T) {
	t.Parallel()

	if _, _, ok := parseTelegramCallbackData("status"); ok {
		t.Fatalf("expected invalid payload to be rejected")
	}
}

func TestNormalizeQuickActionMenu(t *testing.T) {
	t.Parallel()

	got, ok := normalizeQuickAction("Menu")
	if !ok {
		t.Fatalf("expected quick action to normalize")
	}
	if got != "/menu" {
		t.Fatalf("unexpected normalized command: %q", got)
	}
}

func TestTelegramDashboardPages(t *testing.T) {
	t.Parallel()

	for _, page := range []string{"main", "trading", "ai", "system"} {
		body, markup, ok := telegramDashboardPage(page)
		if !ok {
			t.Fatalf("expected page %q to exist", page)
		}
		if body == "" {
			t.Fatalf("expected page %q body", page)
		}
		if markup == nil || len(markup.InlineKeyboard) == 0 {
			t.Fatalf("expected page %q keyboard", page)
		}
	}
}
