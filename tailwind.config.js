/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{html,js,ts,jsx,tsx}",
    "./src/renderer/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#090a0f',
        surface: {
          1: '#111319',
          2: '#171a23',
          3: '#1f2330',
          glass: 'rgba(23, 26, 35, 0.75)'
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          medium: 'rgba(255, 255, 255, 0.12)',
          glow: 'rgba(99, 102, 241, 0.3)'
        },
        mac: {
          bg: '#090a0f',
          card: '#111319',
          cardHover: '#1f2330',
          border: 'rgba(255, 255, 255, 0.08)',
          accent: '#6366f1',
          accentHover: '#4f46e5',
          green: '#10b981',
          orange: '#f59e0b',
          blue: '#3b82f6',
          textMuted: '#94a3b8'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Plus Jakarta Sans"',
          '"SF Pro Display"',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"JetBrains Mono"',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace'
        ]
      },
      boxShadow: {
        'ambient': '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
        'card': '0 12px 30px -8px rgba(0, 0, 0, 0.5)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    },
  },
  plugins: [],
}
