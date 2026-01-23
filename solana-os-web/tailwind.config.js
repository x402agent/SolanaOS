/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'solana-purple': '#9945FF',
        'solana-green': '#14F195',
        'solana-dark': '#0a0a12',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #9945FF, 0 0 10px #9945FF' },
          '100%': { boxShadow: '0 0 10px #14F195, 0 0 20px #14F195' },
        },
      },
    },
  },
  plugins: [],
}
