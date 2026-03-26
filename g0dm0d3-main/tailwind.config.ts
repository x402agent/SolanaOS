import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Matrix theme
        matrix: {
          bg: '#0d0208',
          primary: '#00ff41',
          secondary: '#008f11',
          accent: '#003b00',
          text: '#00ff41',
          dim: '#0d3b0d',
        },
        // Hacker theme
        hacker: {
          bg: '#0a0e14',
          primary: '#ff3e3e',
          secondary: '#ff8c00',
          accent: '#ffcc00',
          text: '#e6e6e6',
          dim: '#1a1f29',
        },
        // Glyph theme
        glyph: {
          bg: '#1a1a2e',
          primary: '#e94560',
          secondary: '#0f3460',
          accent: '#16213e',
          text: '#eaeaea',
          dim: '#0f0f1a',
        },
        // Minimal theme
        minimal: {
          bg: '#fafafa',
          primary: '#171717',
          secondary: '#737373',
          accent: '#e5e5e5',
          text: '#171717',
          dim: '#f5f5f5',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
        terminal: ['VT323', 'monospace'],
        glitch: ['Share Tech Mono', 'monospace'],
      },
      animation: {
        'matrix-rain': 'matrix-rain 20s linear infinite',
        'glitch': 'glitch 1s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'typing': 'typing 3.5s steps(40, end)',
        'blink': 'blink 1s step-end infinite',
        'scanline': 'scanline 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
      },
      keyframes: {
        'matrix-rain': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        'typing': {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        'blink': {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'currentColor' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0, 255, 65, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 65, 0.03) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}

export default config
