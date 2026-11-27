//! Differential parity vs the REAL Go code on fix/safety-checks-2026-11
//! (pkg/aster TestWriteParityVectors -> ../vectors.csv; clamp semantics).
use solanaos_risk_gate::*;

#[test]
fn parity_with_go_fixed_branch() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../vectors.csv");
    let Ok(csv) = std::fs::read_to_string(path) else { eprintln!("no {path}; skipping"); return };
    let (mut n, mut bad_status, mut bad_notional) = (0, 0, 0);
    for line in csv.lines().skip(1) {
        let f: Vec<&str> = line.split(',').collect();
        let u = |i: usize| f[i].parse::<u64>().unwrap();
        let cfg = TraderConfig { max_positions: u(2) as u32, max_position_bps: u(5) as u32,
            default_leverage: u(7) as u32, max_leverage: u(8) as u32, min_notional_micro: u(10) * 10_000 };
        let book = Book { active_positions: u(1) as u32, has_position_in_symbol: u(3) == 1,
            available_balance_micro: u(9) * 10_000 };
        let sig = Signal { confidence_bps: u(0) as u32, size_bps: u(4) as u32, leverage: u(6) as u32 };
        let r = execute_signal(&cfg, &book, &sig);
        let st = match r { Ok(_) => "accepted", Err(Reject::LowConfidence) => "low_confidence",
            Err(Reject::MaxPositions) => "max_positions", Err(Reject::AlreadyOpen) => "already_open",
            Err(Reject::BelowMinNotional { .. }) => "below_min_notional" };
        n += 1;
        if st != f[11] { bad_status += 1; eprintln!("STATUS {line} rust={st}"); }
        if let Ok(s) = r {
            let go: f64 = f[12].parse().unwrap();
            if (s.notional_micro as f64 - go).abs() > 1.0 + go * 1e-12 { bad_notional += 1; }
        }
    }
    eprintln!("v2 vectors={n} status_mismatch={bad_status} notional_mismatch={bad_notional}");
    assert_eq!((bad_status, bad_notional), (0, 0));
}
