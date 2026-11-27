//! Pure, integer fixed-point port of the gate + sizing logic in
//! `pkg/aster/trader.go` `PerpTrader::ExecuteSignal` (lines 161-225 @ 37041b5).
//!
//! Units: money in micro-USD (u64), percentages/confidence in basis points,
//! leverage as an integer multiple. No floats => no NaN/Inf/negative inputs,
//! which closes the bypasses the Go float version has (see PLAN.md §6).
//! The Lean model in `../../lean/RiskGate.lean` mirrors `execute_signal` 1:1.

pub const BPS: u128 = 10_000;
pub const MIN_CONFIDENCE_BPS: u32 = 6_000;
/// Go hardcodes `signal.Leverage <= 125`; here it is operator config.
pub const GO_HARDCODED_MAX_LEVERAGE: u32 = 125;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TraderConfig {
    pub max_positions: u32,
    pub max_position_bps: u32,
    pub default_leverage: u32,
    pub max_leverage: u32,
    pub min_notional_micro: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Signal {
    pub confidence_bps: u32,
    /// 0 = "not set", use max_position_bps (Go semantics).
    pub size_bps: u32,
    /// 0 = "not set", use default_leverage (Go semantics).
    pub leverage: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Book {
    pub active_positions: u32,
    pub has_position_in_symbol: bool,
    pub available_balance_micro: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Reject {
    LowConfidence,
    MaxPositions,
    AlreadyOpen,
    BelowMinNotional { notional_micro: u128 },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Sizing {
    pub size_bps: u32,
    pub leverage: u32,
    pub notional_micro: u128,
}

pub fn chosen_size_bps(cfg: &TraderConfig, s: &Signal) -> u32 {
    if s.size_bps > 0 && s.size_bps <= cfg.max_position_bps { s.size_bps } else { cfg.max_position_bps }
}

pub fn chosen_leverage(cfg: &TraderConfig, s: &Signal) -> u32 {
    // Clamp semantics (fix/safety-checks-2026-11): 0 = unset -> default; above max -> max.
    if s.leverage == 0 { cfg.default_leverage } else { s.leverage.min(cfg.max_leverage) }
}

/// notional = balance * size_bps * leverage / 10_000 (floor). u128 cannot overflow:
/// u64 * u32 * u32 < 2^128.
pub fn notional_micro(balance_micro: u64, size_bps: u32, leverage: u32) -> u128 {
    (balance_micro as u128) * (size_bps as u128) * (leverage as u128) / BPS
}

pub fn execute_signal(cfg: &TraderConfig, book: &Book, s: &Signal) -> Result<Sizing, Reject> {
    if s.confidence_bps < MIN_CONFIDENCE_BPS {
        return Err(Reject::LowConfidence);
    }
    if book.active_positions >= cfg.max_positions {
        return Err(Reject::MaxPositions);
    }
    if book.has_position_in_symbol {
        return Err(Reject::AlreadyOpen);
    }
    let size_bps = chosen_size_bps(cfg, s);
    let leverage = chosen_leverage(cfg, s);
    let n = notional_micro(book.available_balance_micro, size_bps, leverage);
    if n < cfg.min_notional_micro as u128 {
        return Err(Reject::BelowMinNotional { notional_micro: n });
    }
    Ok(Sizing { size_bps, leverage, notional_micro: n })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn cfg() -> TraderConfig {
        TraderConfig { max_positions: 5, max_position_bps: 1_000, default_leverage: 5,
            max_leverage: 10, min_notional_micro: 5_000_000 }
    }
    #[test]
    fn caps_leverage_at_operator_limit() {
        let book = Book { active_positions: 0, has_position_in_symbol: false, available_balance_micro: 1_000_000_000 };
        let r = execute_signal(&cfg(), &book, &Signal { confidence_bps: 9_000, size_bps: 0, leverage: 125 }).unwrap();
        assert_eq!(r.leverage, 10, "LLM-requested 125x is clamped to the operator cap");
    }
}
