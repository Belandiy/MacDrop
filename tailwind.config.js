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
        mac: {
          bg: '#1c1c1e',
          card: '#2c2c2e',
          cardHover: '#3a3a3c',
          border: 'rgba(255, 255, 255, 0.1)',
          accent: '#007aff',
          accentHover: '#0062cc',
          green: '#34c759',
          orange: '#ff9500',
          blue: '#0a84ff',
          textMuted: '#8e8e93'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ]
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    },
  },
  plugins: [],
}
