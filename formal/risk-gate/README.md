# Risk gate: Go ↔ Rust ↔ Lean parity

A formal companion to the Aster `PerpTrader` gate and sizing logic
(`pkg/aster/trader.go`: `preTradeGate`, `sizePosition`, `resolveLeverage`).
Nothing here is built by CI or shipped. It's a check you can run by hand.

* `lean/RiskGate.lean`: Lean 4 model (core Lean, no Mathlib) with machine-checked theorems:
  * `accepted_exposure_bounded`: for **any** signal, an accepted trade's notional is
    ≤ balance × maxPositionBps × maxLeverage / 10⁴ (given default ≤ max leverage).
  * `accepted_gates`: confidence ≥ 60 %, positions < max, no existing position,
    notional ≥ minimum.
  * `zero_balance_rejected`.
* `rust/`: integer fixed-point Rust port (micro-USD, bps, u128 math; NaN is unrepresentable).
* `pkg/aster/parity_vectors_test.go` (`TestWriteParityVectors`) generates vectors from the
  **real Go code**. Rust and the Lean executable spec must produce the same statuses
  (and Rust the same notional, within 1 micro-USD).

```sh
SOLANAOS_PARITY_VECTORS=$PWD/formal/risk-gate/vectors.csv go test ./pkg/aster -run TestWriteParityVectors
(cd formal/risk-gate/rust && cargo test)
(cd formal/risk-gate/lean && lean RiskGate.lean && lean --run RiskGate.lean ../vectors.csv)
```

Last run: 20,000 vectors, 0 mismatches across Go/Rust/Lean; all Lean theorems build with no
`sorry` (Lean 4.36.0, rustc 1.100).

Trust boundary: the proofs are about the Lean model. The link to Go/Rust is the differential
test, not a proof. Float rounding in Go (vs exact integers here) is checked to within 1 micro-USD.
