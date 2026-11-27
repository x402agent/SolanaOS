package daemon

import "testing"

func TestParseAsterOpenNumbers(t *testing.T) {
	// Regression: strconv.ParseFloat accepts "NaN"/"Inf", which used to reach
	// ExecuteSignal and slip past the confidence gate.
	for _, rest := range [][]string{
		{"0.05", "NaN"},
		{"0.05", "nan"},
		{"0.05", "Inf"},
		{"0.05", "-Inf"},
		{"NaN"},
		{"+Inf", "0.8"},
	} {
		if _, _, _, err := parseAsterOpenNumbers(rest); err == nil {
			t.Errorf("%v: want rejection", rest)
		}
	}

	size, conf, thesis, err := parseAsterOpenNumbers([]string{"0.05", "0.8", "breakout", "retest"})
	if err != nil || size != 0.05 || conf != 0.8 || thesis != "breakout retest" {
		t.Fatalf("got %v %v %q %v", size, conf, thesis, err)
	}
	size, conf, thesis, err = parseAsterOpenNumbers(nil)
	if err != nil || size != 0.10 || conf != 0.70 || thesis != "telegram manual trade" {
		t.Fatalf("defaults: got %v %v %q %v", size, conf, thesis, err)
	}
	// Non-numeric first word is thesis, as before.
	_, _, thesis, err = parseAsterOpenNumbers([]string{"momentum", "play"})
	if err != nil || thesis != "momentum play" {
		t.Fatalf("thesis only: got %q %v", thesis, err)
	}
}
