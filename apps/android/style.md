Scope: all native Android UI in `apps/android` (Jetpack Compose).
Goal: one coherent SolanaOS runtime shell across onboarding, Connect, Solana, Chat, Arcade, ORE, and Settings.

## 1. Design Direction

- Cyber-terminal runtime, not consumer fintech minimalism.
- Local-first operator surface with visible system state.
- Neon signal language: green for live, purple for routing/AI, orange for risk/manual intervention.
- Dense but legible; hierarchy should come from rhythm, framing, and motion instead of generic Material cards.
- If a screen is live, say what is live. If a path is optional, say why.

## 2. Visual Baseline

The shared baseline now lives in:

- `app/src/main/java/ai/openclaw/app/ui/MobileUiTokens.kt`
- `app/src/main/java/ai/openclaw/app/ui/SolanaChrome.kt`
- `app/src/main/java/ai/openclaw/app/ui/PostOnboardingTabs.kt`

Baseline traits:

- dark multi-stop runtime background
- thin signal borders and scanline framing
- uppercase mono labels + bold title blocks
- compact panels with explicit state chips
- animated MawdBot motion only where it adds identity or affordance

## 3. Core Tokens

- Background gradient: `#000000`, `#060610`, `#0A0A12`
- Surface: `#0B0D14`
- Surface strong: `#11131A`
- Border green: `rgba(20,241,149,0.25)`
- Border purple: `rgba(153,69,255,0.25)`
- Text primary: `#EFFBF6`
- Text secondary: `#8FB8A9`
- Text tertiary: `#587367`
- Success green: `#14F195`
- Accent purple: `#9945FF`
- Warning orange: `#FF7400`
- Danger red: `#FF5B5B`

Rule: do not introduce random one-off gradients or pastel colors. Stay inside the runtime palette unless a live data visualization demands otherwise.

## 4. Typography

- Product copy and section titles: Manrope
- Labels, terminal text, machine state, setup codes: monospace
- Display titles: bold, uppercase, short
- Body copy: concise and operator-oriented

Recommended emphasis:

- Hero title: `mobileTitle1`
- Section title: `mobileTitle2`
- Action label: `mobileHeadline`
- Runtime body: `mobileBody`
- Terminal/callout text: `mobileCallout`
- Machine labels: `mobileCaption1` / `mobileCaption2`

## 5. Layout And Spacing

- Respect safe drawing insets.
- Keep the shell dense but breathable with `8/10/12/14dp` rhythm.
- Prefer full-width runtime panels over nested card stacks.
- Use horizontal status rows for quick scanability before deep content.
- Bottom navigation is a dock, not a standard tab bar.

## 6. Motion

- Motion should signal liveness, not decorate emptiness.
- Floating bots: hero and welcome surfaces only.
- Walking bots: terminal/agent contexts only.
- Continuous motion must stay subtle and low-amplitude.
- Avoid animating core data cards just to make the screen feel busy.

## 7. Buttons And Actions

- Primary live action: green outlined/soft-filled button.
- Routing or AI action: purple.
- Risk/manual/destructive action: orange or red depending on severity.
- High-importance actions should span full width or balanced halves.

## 8. Reality Rules

- No screen should imply a live capability that is not wired.
- If a feature launches an external live flow, say so explicitly.
- If a backend or API is not configured, surface that configuration state plainly.
- Do not leave placeholder fake metrics in production-facing runtime surfaces.

## 9. Backend Rules

- Public backend coordinates can ship in `BuildConfig`.
- Secrets such as deploy keys never ship in the APK.
- Wallet identity sync must be signed when used as backend identity.
- Backend state should appear in Connect or the feature that depends on it.

## 10. Source Of Truth

- `app/src/main/java/ai/openclaw/app/ui/MobileUiTokens.kt`
- `app/src/main/java/ai/openclaw/app/ui/SolanaChrome.kt`
- `app/src/main/java/ai/openclaw/app/ui/PostOnboardingTabs.kt`
- `app/src/main/java/ai/openclaw/app/ui/ConnectTabScreen.kt`
- `app/src/main/java/ai/openclaw/app/ui/SolanaKitScreen.kt`
- `app/src/main/java/ai/openclaw/app/ui/chat/ChatSheetContent.kt`

If implementation and this document diverge, update both in the same change.
