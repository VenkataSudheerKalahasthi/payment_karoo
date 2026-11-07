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
        // Dark Theme — Exact Dark Navy & Electric Blue Palette
        obsidian: {
          DEFAULT: '#0B0D14',
          bg: '#0B0D14',
          sidebar: '#0B0D14',
          card: '#191B25',
          elevated: '#191D2A',
          hover: '#1C2740',
          text: '#E8ECF5',
          secondary: '#9AA4B8',
          muted: '#9AA4B8',
          border: '#272B38',
          accent: '#1C2740',
          accentText: '#8FB5FF',
          primary: '#1F61EF',
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
