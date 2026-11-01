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
        background: 'var(--bg)',
        sidebar: 'var(--sidebar)',
        panel: 'var(--panel)',
        track: 'var(--track)',
        border: 'var(--border)',
        // Text
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
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
