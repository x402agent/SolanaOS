@tailwind base;
@tailwind components;
@tailwind utilities;

/* ═══════════════════════════════════════════════════════════
   G0DM0D3 - CORE STYLES
   "Cognition without control"
   ═══════════════════════════════════════════════════════════ */

:root {
  --cursor-blink: 530ms;
}

/* Base styles */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

*::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

*::-webkit-scrollbar-track {
  background: var(--scrollbar-track, transparent);
}

*::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}

*::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

*::-webkit-scrollbar-corner {
  background: transparent;
}

/* Matrix theme */
.theme-matrix {
  --bg: #0d0208;
  --primary: #00ff41;
  --secondary: #008f11;
  --accent: #003b00;
  --text: #00ff41;
  --dim: #0d3b0d;
  --scrollbar-thumb: #1c1c1c;
  --scrollbar-thumb-hover: #2a2a2a;
  --scrollbar-track: #0d0208;
}

/* Hacker theme */
.theme-hacker {
  --bg: #0a0e14;
  --primary: #ff3e3e;
  --secondary: #ff8c00;
  --accent: #ffcc00;
  --text: #e6e6e6;
  --dim: #1a1f29;
  --scrollbar-thumb: #1c1c1c;
  --scrollbar-thumb-hover: #2a2a2a;
  --scrollbar-track: #0a0e14;
}

/* Glyph theme */
.theme-glyph {
  --bg: #1a1a2e;
  --primary: #e94560;
  --secondary: #0f3460;
  --accent: #16213e;
  --text: #eaeaea;
  --dim: #0f0f1a;
  --scrollbar-thumb: #1c1c1c;
  --scrollbar-thumb-hover: #2a2a2a;
  --scrollbar-track: #1a1a2e;
}

/* Minimal theme */
.theme-minimal {
  --bg: #fafafa;
  --primary: #171717;
  --secondary: #737373;
  --accent: #e5e5e5;
  --text: #171717;
  --dim: #f5f5f5;
  --scrollbar-thumb: #d4d4d4;
  --scrollbar-thumb-hover: #a3a3a3;
  --scrollbar-track: #fafafa;
}

/* Theme-aware classes */
.theme-bg { background-color: var(--bg); }
.theme-primary { color: var(--primary); }
.theme-secondary { color: var(--secondary); }
.theme-text { color: var(--text); }
.bg-theme-dim { background-color: var(--dim); }
.bg-theme-accent { background-color: var(--accent); }
.border-theme-primary { border-color: var(--primary); }
.border-theme-dim { border-color: var(--dim); }

/* Glowing effects */
.glow-primary {
  text-shadow: 0 0 10px var(--primary), 0 0 20px var(--primary), 0 0 30px var(--primary);
}

.glow-box {
  box-shadow: 0 0 10px var(--primary), inset 0 0 5px var(--primary);
}

/* Terminal cursor */
.terminal-cursor::after {
  content: '█';
  animation: blink var(--cursor-blink) step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Scanline effect */
.scanlines::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 4px
  );
  pointer-events: none;
  z-index: 100;
}

/* Matrix rain background */
.matrix-bg {
  background:
    linear-gradient(180deg, transparent 0%, var(--bg) 100%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='%230d0208'/%3E%3Ctext x='0' y='15' font-family='monospace' font-size='12' fill='%23003b00'%3E01%3C/text%3E%3C/svg%3E");
}

/* CRT effect */
.crt::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%);
  pointer-events: none;
}

/* Typing animation */
.typing-effect {
  overflow: hidden;
  border-right: 2px solid var(--primary);
  white-space: nowrap;
  animation:
    typing 2s steps(30, end),
    blink var(--cursor-blink) step-end infinite;
}

@keyframes typing {
  from { width: 0; }
  to { width: 100%; }
}

/* Glitch effect */
.glitch {
  position: relative;
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.glitch::before {
  left: 2px;
  text-shadow: -2px 0 #ff00ff;
  clip: rect(44px, 450px, 56px, 0);
  animation: glitch-anim 5s infinite linear alternate-reverse;
}

.glitch::after {
  left: -2px;
  text-shadow: -2px 0 #00ffff;
  clip: rect(44px, 450px, 56px, 0);
  animation: glitch-anim2 5s infinite linear alternate-reverse;
}

@keyframes glitch-anim {
  0% { clip: rect(31px, 9999px, 94px, 0); }
  20% { clip: rect(62px, 9999px, 42px, 0); }
  40% { clip: rect(16px, 9999px, 78px, 0); }
  60% { clip: rect(89px, 9999px, 13px, 0); }
  80% { clip: rect(47px, 9999px, 59px, 0); }
  100% { clip: rect(23px, 9999px, 71px, 0); }
}

@keyframes glitch-anim2 {
  0% { clip: rect(65px, 9999px, 19px, 0); }
  20% { clip: rect(28px, 9999px, 84px, 0); }
  40% { clip: rect(91px, 9999px, 37px, 0); }
  60% { clip: rect(12px, 9999px, 68px, 0); }
  80% { clip: rect(54px, 9999px, 45px, 0); }
  100% { clip: rect(76px, 9999px, 22px, 0); }
}

/* Noise overlay */
.noise::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.03;
  z-index: 1000;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}

/* Code block styling */
.prose pre {
  background: var(--dim) !important;
  border: 1px solid var(--primary);
  border-radius: 4px;
}

.prose code {
  color: var(--primary) !important;
  background: var(--dim);
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
}

/* Message animations */
.message-enter {
  animation: message-slide-in 0.3s ease-out;
}

@keyframes message-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Liquid morph animation — ULTRAPLINIAN leader upgrade */
.liquid-morph {
  animation: liquid-dissolve 0.6s ease-out;
}

@keyframes liquid-dissolve {
  0% {
    opacity: 0.3;
    filter: blur(6px) saturate(2);
    transform: scaleY(0.97);
  }
  30% {
    opacity: 0.6;
    filter: blur(3px) saturate(1.5);
    transform: scaleY(0.99);
  }
  100% {
    opacity: 1;
    filter: blur(0px) saturate(1);
    transform: scaleY(1);
  }
}

/* Race navigator arrow key hint — visible on focus */
.race-navigator .arrow-hint {
  opacity: 0;
  transition: opacity 0.2s;
}
.race-navigator:focus .arrow-hint {
  opacity: 0.4;
}

/* Easter egg: Konami code activation */
.konami-active {
  animation: rainbow-bg 2s linear infinite;
}

@keyframes rainbow-bg {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

/* Selection styling */
::selection {
  background: var(--primary);
  color: var(--bg);
}

/* Focus styles */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .sidebar.open {
    transform: translateX(0);
  }
}

/* Backwards E — mirror a real E via CSS (matches index.html) */
.flipped-e {
  display: inline-block;
  transform: scaleX(-1);
}

/* Backwards E — clean flip, no extra styling so it matches the other letters */
.flipped-e-soft {
  display: inline-block;
  transform: scaleX(-1);
}


/* ASCII art styling */
.ascii-art {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  line-height: 1;
  white-space: pre;
  color: var(--primary);
}

/* Hacker button */
.hacker-btn {
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.hacker-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  opacity: 0.3;
  transition: left 0.5s ease;
}

.hacker-btn:hover::before {
  left: 100%;
}

/* Race response navigator */
.race-navigator button:not(:disabled):hover {
  text-shadow: 0 0 6px var(--primary);
}

/* Loading dots */
.loading-dots::after {
  content: '';
  animation: loading-dots 1.5s infinite;
}

@keyframes loading-dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}
