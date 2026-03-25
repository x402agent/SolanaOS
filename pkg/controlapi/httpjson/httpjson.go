package httpjson

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

func Write(w http.ResponseWriter, status int, payload types.APIResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func Decode(r *http.Request, dst any) error {
	if r.Body == nil {
		return errors.New("missing request body")
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}
