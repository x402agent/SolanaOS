# Solana Mobile Submission Workbook

This file collects the exact details needed to submit the SolanaOS Android app to the Solana Mobile dApp Store for Seeker.

## Listing Details

- dApp Name: `SolanaOS`
- Package Name: `com.nanosolana.solanaos`
- Subtitle: `Local-first Solana agent for Seeker`
- App Website: `https://tech.solanaos.net/`
- Languages: `English`

## Description

SolanaOS is a local-first Solana mobile dApp for Seeker that pairs with your SolanaOS runtime and gives you a single control surface for status, chat, voice, camera, permissions, and on-device operations. It is designed for Seeker-native workflows where you want a mobile dashboard for your Solana agent instead of a generic Android shell.

## Editorial / Featured Draft

- Headline: `Run your Solana agent from Seeker`
- Tag: `Local-first control`
- Graphic size required: `1200x1200`

## Legal / Support URLs

- Website: `https://tech.solanaos.net/`
- Support Page: `https://tech.solanaos.net/support/`
- Privacy Policy: `https://tech.solanaos.net/privacy/`
- License: `https://tech.solanaos.net/legal/license/`
- Copyright: `https://tech.solanaos.net/legal/copyright/`

## Email Fields

The repository currently exposes one published security inbox:

- Contact Email: `security@8bitlabs.xyz`
- Support Email: `security@8bitlabs.xyz`

Replace both with a dedicated support alias before final submission if you create one.

## Rewards / Tokens

- "This dApp distributes tokens and/or rewards to its users": `No` for the initial Solana Mobile submission.
- Current app posture: wallet-first rewards readiness only.
- Launch-safe explanation:
  - users can connect a Seeker wallet now
  - the app can locally mark interest in a future rewards program
  - no live SPL token distribution, claiming, staking, or payout flow is active in the launch build
- If the future SPL rewards program ships later, update this answer only when the mobile UX includes an explicit reward/claim/distribution experience.

## Asset Checklist

- dApp Icon: `512x512 px`
- Banner: `1200x600 px`
- Preview media: at least `4`
- Editor's Choice graphic: `1200x1200 px` if featured

Official store assets now live in `design/solana-mobile/`:

- Icon: `design/solana-mobile/icon-512.png`
- Banner: `design/solana-mobile/banner-1200x600.png`
- Preview 1: `design/solana-mobile/preview-01.png`
- Preview 2: `design/solana-mobile/preview-02.png`
- Preview 3: `design/solana-mobile/preview-03.png`
- Preview 4: `design/solana-mobile/preview-04.png`

Verified dimensions:

- `icon-512.png` → `512x512`
- `banner-1200x600.png` → `1200x600`
- `preview-01.png` → `1080x1920`
- `preview-02.png` → `1080x1920`
- `preview-03.png` → `1080x1920`
- `preview-04.png` → `1080x1920`

Use `design/solana-mobile/README.md` as the asset source of truth when filling the Seeker dApp Store form.

## Notes For APK Submission

- Current Android app label: `SolanaOS`
- Current Android package/applicationId: `com.nanosolana.solanaos`
- Current debug APK naming: `solanaos-mobile-<version>-debug.apk`
- Increment `versionCode` and `versionName` before each store update
- Keep the same signing key across updates

## Gaps Still Not Solved By This Pass

- Native Mobile Wallet Adapter integration is present for wallet connect, disconnect, SIWS, detached message signing, and unsigned transaction sign/send primitives, but there is still no polished end-user transaction form in the Compose UI
- Editor's Choice `1200x1200` artwork is still not present in this repo
- Dedicated support/legal email aliases are not yet provisioned in this repo
- Future SPL rewards are only in readiness mode right now; a live claim/distribution backend and token launch are not part of the store build yet
