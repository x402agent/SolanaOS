# SPL Rewards Readiness

This note defines the current SolanaOS Android posture for future user rewards.

## Current State

- The launch build is **not** a live token rewards app.
- Users can connect a Mobile Wallet Adapter wallet on Seeker.
- Users can opt into a local "future rewards waitlist" state on-device.
- No SPL token mint, claim, payout, staking, or referral distribution flow is active in the current APK.

## Why This Is The Right Launch Posture

For the first Solana Mobile dApp Store submission, the safest answer to the store rewards question remains `No`.

That keeps the release simple:

- no tokenomics promises in the launch listing
- no unfinished claim UX in the mobile app
- no backend dependency required for review
- no ambiguity about whether the app is currently distributing value

## What Is Already Ready

- wallet authorization persistence via Mobile Wallet Adapter
- SIWS and detached message signing
- raw transaction sign and sign-and-send verification
- a user-facing rewards-readiness card in the Connect flow
- local persistence for future rewards opt-in

## Recommended Future Rollout

### Phase 1

- Launch the app on Solana Mobile with rewards disabled
- Collect only local opt-in for "future rewards"
- Do not mention guaranteed token payouts in the store listing

### Phase 2

- Launch the SPL token separately
- Add backend-controlled eligibility and anti-abuse checks
- Introduce a claim API that returns a wallet-bound claim payload

### Phase 3

- Add an in-app claim card
- Require a connected Seeker wallet
- Use SIWS or wallet-bound signatures to authenticate claims
- Support claim receipts and explorer links in-app

## Suggested Claim Model

- Track usage points off-chain first
- Bind points to a wallet address only after explicit wallet connection
- When the program goes live:
  - fetch claimable balance from backend
  - build a claim transaction or signed claim message
  - present it to the user through Mobile Wallet Adapter
  - record the resulting signature as the claim receipt

## Store Policy Guidance

- Keep the listing answer `No` until the app actually distributes tokens or rewards
- When live rewards ship, update:
  - listing description
  - rewards question
  - privacy/support docs
  - any risk or eligibility disclosures
