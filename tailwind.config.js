/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/renderer/**/*.{html,ts,tsx}',
    './electron.vite.config.ts'
  ],
  theme: {
    extend: {
      colors: {
        // Core surfaces (light mode defaults, dark via .dark class)
        background: { DEFAULT: '#F3F4F6', dark: '#0B0B10' },
        sidebar: { DEFAULT: '#EEF2F7', dark: '#0F0F15' },
        panel: { DEFAULT: '#FFFFFF', dark: '#14141C' },
        track: { DEFAULT: '#E5E7EB', dark: '#1F1F2A' },
        border: { DEFAULT: '#D1D5DB', dark: '#2A2A36' },
        // Text
        'text-primary': { DEFAULT: '#111827', dark: '#ECECEC' },
        'text-muted': { DEFAULT: '#6B7280', dark: '#9A9AA6' },
        'text-dim': { DEFAULT: '#9CA3AF', dark: '#5D5D6A' },
        // Semantic accents
        cyan: '#00F0FF',
        yellow: '#FCEE09',
        green: '#5DFF6A',
        magenta: '#B026FF',
        pink: '#FF2A6D',
        orange: '#FF9F43',
      },
      fontFamily: {
        sans: ['Rajdhani', 'Bahnschrift', 'Arial Narrow', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Cascadia Mono', 'monospace'],
      },
      fontSize: {
        'brand': ['28px', { letterSpacing: '0.20em', fontWeight: '700', lineHeight: '1' }],
        'page-title': ['34px', { letterSpacing: '0.06em', fontWeight: '700', lineHeight: '1' }],
        'nav': ['15px', { letterSpacing: '0.14em', fontWeight: '700', lineHeight: '1' }],
        'kpi-value': ['38px', { fontWeight: '700', lineHeight: '1' }],
        'panel-heading': ['11px', { letterSpacing: '0.16em', fontWeight: '400', lineHeight: '1' }],
        'button': ['12px', { letterSpacing: '0.14em', fontWeight: '700', lineHeight: '1' }],
        'filter': ['11px', { letterSpacing: '0.14em', fontWeight: '700', lineHeight: '1' }],
      },
      clipPath: {
        'panel': 'polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)',
        'button': 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)',
      },
      spacing: {
        'sidebar': '220px',
      },
    },
  },
  plugins: [],
}
