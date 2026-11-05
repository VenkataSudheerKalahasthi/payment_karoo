/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Dark Theme — Obsidian Chrome
        obsidian: {
          DEFAULT: '#080808',
          bg: '#080808',
          sidebar: '#080808',
          card: '#171717',
          elevated: '#202020',
          hover: '#303030',
          text: '#CDCBCA',
          secondary: '#A5A5A5',
          muted: '#777777',
          border: 'rgba(205, 203, 202, 0.18)',
        },
        // Light Theme — Pearl White + Royal Blue
        pearl: {
          DEFAULT: '#F5F7FA',
          bg: '#F5F7FA',
          sidebar: '#FFFFFF',
          card: '#FFFFFF',
          elevated: '#F1F5F9',
          hover: '#EFF6FF',
          text: '#242424',
          secondary: '#475569',
          muted: '#64748B',
          brand: '#2563EB',
          brandHover: '#1D4ED8',
          brandSoft: '#DBEAFE',
          border: '#E2E8F0',
        },
        // Strict Semantic Financial Status Tokens
        finance: {
          emerald: '#10B981',
          emeraldDark: '#059669',
          amber: '#F59E0B',
          amberDark: '#D97706',
          red: '#EF4444',
          redDark: '#DC2626',
        },
      },
    },
  },
  plugins: [],
};
