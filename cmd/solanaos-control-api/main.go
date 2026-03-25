package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi"
)

func main() {
	addr := flag.String("addr", ":18789", "listen address")
	flag.Parse()

	server := &http.Server{
		Addr:              *addr,
		Handler:           controlapi.NewServer().Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	baseURL := displayBaseURL(*addr)
	log.Printf("solanaos-control-api listening on %s", *addr)
	log.Printf("status: GET %s/api/control/status", baseURL)
	log.Printf("vision: POST %s/api/control/openrouter/vision", baseURL)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func displayBaseURL(addr string) string {
	if len(addr) > 0 && addr[0] == ':' {
		return "http://127.0.0.1" + addr
	}
	return fmt.Sprintf("http://%s", addr)
}
