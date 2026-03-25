package main

import "testing"

func TestDisplayBaseURL(t *testing.T) {
	tests := []struct {
		name string
		addr string
		want string
	}{
		{name: "portOnly", addr: ":18789", want: "http://127.0.0.1:18789"},
		{name: "explicitHost", addr: "0.0.0.0:18789", want: "http://0.0.0.0:18789"},
		{name: "localhost", addr: "localhost:18789", want: "http://localhost:18789"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := displayBaseURL(tc.addr); got != tc.want {
				t.Fatalf("displayBaseURL(%q) = %q, want %q", tc.addr, got, tc.want)
			}
		})
	}
}
