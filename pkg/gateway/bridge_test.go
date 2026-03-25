package gateway

import "testing"

func TestDetectPlaintextProtocol(t *testing.T) {
	tests := []struct {
		name string
		line string
		want string
	}{
		{name: "json", line: `{"type":"ping"}`, want: ""},
		{name: "http_get", line: "GET / HTTP/1.1", want: "http"},
		{name: "http_header", line: "Host: example.com", want: "http"},
		{name: "websocket_header", line: "Upgrade: websocket", want: "http"},
		{name: "tls_client_hello", line: "\x16\x03\x01\x02", want: "tls"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := detectPlaintextProtocol(tc.line); got != tc.want {
				t.Fatalf("detectPlaintextProtocol(%q) = %q, want %q", tc.line, got, tc.want)
			}
		})
	}
}
