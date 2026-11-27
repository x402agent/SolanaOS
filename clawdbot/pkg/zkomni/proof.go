// Package zkomni is Clawd Bot's Go surface for Cheshire ZK Omnichain
// messaging (msgType 4, Robinhood EID 30416 ↔ Solana EID 30168) and the
// in-repo zk-shark-agent TypeScript sidecar under ./zk-primitives/agent.
//
// Crypto matches robinhood-agents/src/zkOmni/proof.js (Ed25519 PoK of secret):
//
//	seed      = SHA-256("clawd-zk-omni-ed25519:v1" || 0x00 || secret)
//	(pk, sk)  = Ed25519 keypair from seed
//	binding   = SHA-256(agentId || payloadCommitment || modelHash)
//	nullifier = SHA-256("clawd-zk-omni-nullifier:v1" || 0x00 || pk || 0x00 || binding)
//	proof     = Ed25519.Sign(sk, publicInputsHash)
package zkomni

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const (
	MsgTypeZKOmni       = 4
	EIDSolanaMainnet    = 30168
	EIDRobinhoodMainnet = 30416
	MaxActionLen        = 64
	MaxMemoLen          = 200
	ProofBytes          = 64
)

var (
	seedDomain = []byte("clawd-zk-omni-ed25519:v1")
	nfDomain   = []byte("clawd-zk-omni-nullifier:v1")
	pubDomain  = []byte("clawd-zk-omni-public:v1")
)

// Message is the canonical ZkOmni payload fields (before ABI encode).
type Message struct {
	AgentID           string `json:"agentId"`
	Controller        string `json:"controller"`
	Nullifier         string `json:"nullifier"`
	PayloadCommitment string `json:"payloadCommitment"`
	ModelHash         string `json:"modelHash"`
	ProofPubkey       string `json:"proofPubkey"`
	ExpiresAt         uint64 `json:"expiresAt"`
	Action            string `json:"action"`
	Memo              string `json:"memo"`
	Proof             string `json:"proof"`
}

// Plan is a ready-to-send / ready-to-relay message plan.
type Plan struct {
	Kind       string  `json:"kind"`
	MsgType    int     `json:"msgType"`
	Direction  string  `json:"direction"`
	SrcEID     int     `json:"srcEid"`
	DstEID     int     `json:"dstEid"`
	Message    Message `json:"message"`
	Scheme     string  `json:"scheme"`
	PublicHash string  `json:"publicInputsHash"`
	Binding    string  `json:"binding"`
	Note       string  `json:"note"`
}

func mustHex32(label, v string) ([32]byte, error) {
	var out [32]byte
	s := strings.TrimPrefix(strings.TrimSpace(strings.ToLower(v)), "0x")
	if len(s) != 64 {
		return out, fmt.Errorf("%s must be 32 bytes hex", label)
	}
	b, err := hex.DecodeString(s)
	if err != nil || len(b) != 32 {
		return out, fmt.Errorf("%s invalid hex", label)
	}
	copy(out[:], b)
	return out, nil
}

func hex0x(b []byte) string {
	return "0x" + hex.EncodeToString(b)
}

func sha256Parts(parts ...[]byte) [32]byte {
	h := sha256.New()
	for _, p := range parts {
		h.Write(p)
	}
	var out [32]byte
	copy(out[:], h.Sum(nil))
	return out
}

// DeriveKeypair returns Ed25519 key material from a secret (≥16 bytes).
func DeriveKeypair(secret []byte) (ed25519.PublicKey, ed25519.PrivateKey, error) {
	if len(secret) < 16 {
		return nil, nil, errors.New("secret must be at least 16 bytes")
	}
	seed := sha256Parts(seedDomain, []byte{0}, secret)
	priv := ed25519.NewKeyFromSeed(seed[:])
	return priv.Public().(ed25519.PublicKey), priv, nil
}

// Binding = SHA-256(agentId || payloadCommitment || modelHash).
func Binding(agentID, payloadCommitment, modelHash [32]byte) [32]byte {
	return sha256Parts(agentID[:], payloadCommitment[:], modelHash[:])
}

// NullifierFromPubkey = SHA-256(nfDomain || 0x00 || pk || 0x00 || binding).
func NullifierFromPubkey(pk ed25519.PublicKey, binding [32]byte) [32]byte {
	return sha256Parts(nfDomain, []byte{0}, pk, []byte{0}, binding[:])
}

// PublicInputsHash matches robinhood-agents proof.js computePublicInputsHash.
func PublicInputsHash(m Message) ([32]byte, error) {
	agentID, err := mustHex32("agentId", m.AgentID)
	if err != nil {
		return [32]byte{}, err
	}
	controller, err := mustHex32("controller", m.Controller)
	if err != nil {
		return [32]byte{}, err
	}
	nullifier, err := mustHex32("nullifier", m.Nullifier)
	if err != nil {
		return [32]byte{}, err
	}
	payload, err := mustHex32("payloadCommitment", m.PayloadCommitment)
	if err != nil {
		return [32]byte{}, err
	}
	model, err := mustHex32("modelHash", m.ModelHash)
	if err != nil {
		return [32]byte{}, err
	}
	pk, err := mustHex32("proofPubkey", m.ProofPubkey)
	if err != nil {
		return [32]byte{}, err
	}
	action := []byte(m.Action)
	memo := []byte(m.Memo)
	if len(action) > MaxActionLen || len(memo) > MaxMemoLen {
		return [32]byte{}, errors.New("action/memo too long")
	}
	var exp [8]byte
	binary.BigEndian.PutUint64(exp[:], m.ExpiresAt)
	return sha256Parts(
		pubDomain,
		agentID[:],
		controller[:],
		nullifier[:],
		payload[:],
		model[:],
		pk[:],
		exp[:],
		[]byte{byte(len(action))},
		action,
		[]byte{byte(len(memo))},
		memo,
	), nil
}

// CreateProof builds nullifier + Ed25519 proof for the given fields (secret never leaves the host).
func CreateProof(secret []byte, agentID, controller, payloadCommitment, modelHash [32]byte, expiresAt uint64, action, memo string) (Message, [32]byte, [32]byte, error) {
	pk, sk, err := DeriveKeypair(secret)
	if err != nil {
		return Message{}, [32]byte{}, [32]byte{}, err
	}
	if len(action) > MaxActionLen || len(memo) > MaxMemoLen {
		return Message{}, [32]byte{}, [32]byte{}, errors.New("action/memo too long")
	}
	binding := Binding(agentID, payloadCommitment, modelHash)
	nullifier := NullifierFromPubkey(pk, binding)
	msg := Message{
		AgentID:           hex0x(agentID[:]),
		Controller:        hex0x(controller[:]),
		Nullifier:         hex0x(nullifier[:]),
		PayloadCommitment: hex0x(payloadCommitment[:]),
		ModelHash:         hex0x(modelHash[:]),
		ProofPubkey:       hex0x(pk),
		ExpiresAt:         expiresAt,
		Action:            action,
		Memo:              memo,
	}
	pubHash, err := PublicInputsHash(msg)
	if err != nil {
		return Message{}, [32]byte{}, [32]byte{}, err
	}
	sig := ed25519.Sign(sk, pubHash[:])
	if len(sig) != ProofBytes {
		return Message{}, [32]byte{}, [32]byte{}, fmt.Errorf("unexpected proof length %d", len(sig))
	}
	msg.Proof = hex0x(sig)
	return msg, pubHash, binding, nil
}

// VerifyProof checks Ed25519 signature and nullifier relation (no secret required).
func VerifyProof(m Message) error {
	pkRaw, err := mustHex32("proofPubkey", m.ProofPubkey)
	if err != nil {
		return err
	}
	sigHex := strings.TrimPrefix(strings.TrimSpace(m.Proof), "0x")
	sig, err := hex.DecodeString(sigHex)
	if err != nil || len(sig) != ProofBytes {
		return errors.New("proof must be 64 bytes hex")
	}
	agentID, err := mustHex32("agentId", m.AgentID)
	if err != nil {
		return err
	}
	payload, err := mustHex32("payloadCommitment", m.PayloadCommitment)
	if err != nil {
		return err
	}
	model, err := mustHex32("modelHash", m.ModelHash)
	if err != nil {
		return err
	}
	nullifier, err := mustHex32("nullifier", m.Nullifier)
	if err != nil {
		return err
	}
	binding := Binding(agentID, payload, model)
	expected := NullifierFromPubkey(pkRaw[:], binding)
	if expected != nullifier {
		return errors.New("nullifier does not match proofPubkey binding (ZK relation failed)")
	}
	pubHash, err := PublicInputsHash(m)
	if err != nil {
		return err
	}
	if !ed25519.Verify(pkRaw[:], pubHash[:], sig) {
		return errors.New("Ed25519 proof verification failed")
	}
	return nil
}

// PlanMessage builds a full plan for robinhood-to-solana or solana-to-robinhood.
func PlanMessage(secret []byte, direction, action, memo string, agentIDHex, controllerHex string, expiresAt uint64) (*Plan, error) {
	if direction == "" {
		direction = "robinhood-to-solana"
	}
	if action == "" {
		action = "zk_message"
	}
	if expiresAt == 0 {
		return nil, errors.New("expiresAt required")
	}
	agentID, err := mustHex32("agentId", orDefault(agentIDHex, "0x"+strings.Repeat("00", 31)+"01"))
	if err != nil {
		return nil, err
	}
	controller, err := mustHex32("controller", orDefault(controllerHex, "0x"+strings.Repeat("11", 32)))
	if err != nil {
		return nil, err
	}
	// payload commitment = SHA-256(action || 0 || memo || 0 || agentId || 0 || expires)
	h := sha256.New()
	h.Write([]byte(action))
	h.Write([]byte{0})
	h.Write([]byte(memo))
	h.Write([]byte{0})
	h.Write(agentID[:])
	h.Write([]byte{0})
	h.Write([]byte(fmt.Sprintf("%d", expiresAt)))
	var payload [32]byte
	copy(payload[:], h.Sum(nil))
	var model [32]byte

	msg, pubHash, binding, err := CreateProof(secret, agentID, controller, payload, model, expiresAt, action, memo)
	if err != nil {
		return nil, err
	}
	if err := VerifyProof(msg); err != nil {
		return nil, fmt.Errorf("self-verify failed: %w", err)
	}

	src, dst := EIDRobinhoodMainnet, EIDSolanaMainnet
	if direction == "solana-to-robinhood" {
		src, dst = EIDSolanaMainnet, EIDRobinhoodMainnet
	}
	return &Plan{
		Kind:       "zk-omni",
		MsgType:    MsgTypeZKOmni,
		Direction:  direction,
		SrcEID:     src,
		DstEID:     dst,
		Message:    msg,
		Scheme:     "ed25519-pok-v1",
		PublicHash: hex0x(pubHash[:]),
		Binding:    hex0x(binding[:]),
		Note:       "Nullifier is ZK-bound to proofPubkey; Ed25519 proof attests public inputs. Deliver via robinhood-agents zk-omni-oneshot or relayer.",
	}, nil
}

func orDefault(v, d string) string {
	if strings.TrimSpace(v) == "" {
		return d
	}
	return v
}
